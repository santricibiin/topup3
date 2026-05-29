import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { apiHandler, ok } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getCurrentUserFromRequest, SESSION_COOKIE } from "@/server/auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const PasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password lama wajib diisi"),
  newPassword: z
    .string()
    .min(8, "Password baru minimal 8 karakter")
    .max(128, "Password terlalu panjang")
    .regex(/[A-Z]/, "Harus mengandung huruf besar (A-Z)")
    .regex(/[a-z]/, "Harus mengandung huruf kecil (a-z)")
    .regex(/[0-9]/, "Harus mengandung angka (0-9)"),
});

/**
 * PUT /api/profile/password — ganti password user yg login.
 * Verifikasi password lama dulu sebelum hash & save yang baru.
 * Setelah sukses, semua session lain di-invalidate (kecuali yg sekarang).
 */
export const PUT = apiHandler(async (req: NextRequest) => {
  const user = await getCurrentUserFromRequest(req);
  if (!user) throw Errors.unauthorized();

  // Rate limit: max 5 ganti password / jam / user + 10 / jam / IP.
  // Cegah brute-force tebak password lama.
  rateLimit({
    key: `profile:password:${user.id}`,
    max: 5,
    windowMs: 60 * 60_000,
    message: "Terlalu banyak percobaan ganti password. Coba lagi 1 jam.",
  });
  rateLimit({
    key: `profile:password:ip:${getClientIp(req)}`,
    max: 10,
    windowMs: 60 * 60_000,
  });

  const body = await req.json().catch(() => ({}));
  const { currentPassword, newPassword } = PasswordSchema.parse(body);

  // Re-fetch row supaya dapat passwordHash terbaru.
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row) throw Errors.notFound("User");

  const ok1 = await bcrypt.compare(currentPassword, row.passwordHash);
  if (!ok1) {
    logger.warn("user.password.change.bad_old", { userId: user.id });
    throw Errors.validation({ message: "Password lama tidak cocok." });
  }

  const newHash = await bcrypt.hash(newPassword, 12);

  // Invalidate semua session lain kecuali yg sedang dipakai.
  // Penting: kalau ada session yg di-steal (XSS, MITM, dll), attacker langsung kick-out.
  const currentToken = req.cookies.get(SESSION_COOKIE)?.value ?? "";

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    }),
    prisma.session.deleteMany({
      where: {
        userId: user.id,
        NOT: { token: currentToken },
      },
    }),
  ]);

  logger.info("user.password.change", { userId: user.id });
  return ok({ updated: true });
});
