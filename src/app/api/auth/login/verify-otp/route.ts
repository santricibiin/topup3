/**
 * POST /api/auth/login/verify-otp
 * Step 2 login 2FA: verify OTP yang dikirim saat step 1.
 *
 * Body: { requestId: string, code: string }
 *
 * Sukses → set session cookie & return user data.
 *
 * SECURITY:
 *  - Rate limit per IP & per requestId (cegah brute force).
 *  - Ownership check di service: requestId harus terikat ke userId record-nya
 *    (gateway kasih kode, kita validate userId match sebelum issue session).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler, ok } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { authService } from "@/services/auth.service";
import { otpService } from "@/services/otp.service";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/server/auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const Schema = z.object({
  requestId: z.string().min(8).max(64),
  code: z.string().regex(/^\d{4,8}$/, "Kode OTP harus 4–8 digit angka"),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const ip = getClientIp(req);
  rateLimit({
    key: `login:otp:ip:${ip}`,
    max: 10,
    windowMs: 15 * 60_000,
    message: "Terlalu banyak percobaan. Coba lagi nanti.",
  });

  const body = await req.json();
  const input = Schema.parse(body);

  // Lookup record buat ambil userId (record menyimpan userId saat send).
  const record = await prisma.otpRequest.findUnique({
    where: { requestId: input.requestId },
    select: { userId: true, purpose: true },
  });
  if (!record || record.purpose !== "LOGIN" || !record.userId) {
    throw Errors.notFound("OTP");
  }

  rateLimit({
    key: `login:otp:user:${record.userId}`,
    max: 10,
    windowMs: 15 * 60_000,
    message: "Terlalu banyak percobaan. Coba lagi nanti.",
  });

  await otpService.confirmLoginOtp({
    requestId: input.requestId,
    code: input.code,
    expectUserId: record.userId,
  });

  // OTP valid → ambil user & buat session.
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user || user.status !== "ACTIVE") {
    throw Errors.unauthorized("Akun tidak aktif.");
  }
  const session = await authService.createSession(user);
  setSessionCookie(session.token, session.expiresAt);

  logger.info("auth.login.2fa_ok", { userId: user.id });

  return ok({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  });
});
