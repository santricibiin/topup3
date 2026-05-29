import { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler, ok } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/server/auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const ProfileSchema = z.object({
  fullName: z.string().trim().max(120).optional().nullable(),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^(\+?62|0)[0-9]{8,14}$/, "Format nomor HP tidak valid")
    .optional()
    .nullable()
    .or(z.literal("")),
});

/**
 * GET   /api/profile  → ambil data profil sendiri
 * PATCH /api/profile  → update fullName / phone
 *
 * Catatan: avatar pakai endpoint terpisah (POST /api/profile/avatar utk upload,
 * DELETE utk hapus) — supaya bisa multipart upload tanpa konflik dengan
 * JSON-only PATCH ini.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await getCurrentUserFromRequest(req);
  if (!user) throw Errors.unauthorized();

  return ok({
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    balance: user.balance?.amount.toString() ?? "0",
    createdAt: user.createdAt,
  });
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  const user = await getCurrentUserFromRequest(req);
  if (!user) throw Errors.unauthorized();

  const body = await req.json().catch(() => ({}));
  const data = ProfileSchema.parse(body);

  // Cek phone unique kalau diubah
  if (data.phone && data.phone !== user.phone) {
    const existing = await prisma.user.findUnique({
      where: { phone: data.phone },
      select: { id: true },
    });
    if (existing && existing.id !== user.id) {
      throw Errors.conflict("Nomor HP sudah dipakai pengguna lain.");
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(data.fullName !== undefined && { fullName: data.fullName || null }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
    },
  });

  logger.info("user.profile.update", { userId: user.id });

  return ok({ updated: true });
});
