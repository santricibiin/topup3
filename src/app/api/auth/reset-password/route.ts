/**
 * POST /api/auth/reset-password
 * Step 2 reset password: verify OTP + ganti password.
 *
 * Body: { requestId, code, newPassword, confirmPassword }
 *
 * Side-effect:
 *  - User.passwordHash di-update.
 *  - Semua Session user di-delete (force re-login di semua device).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler, ok } from "@/server/api-handler";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { otpService, hashPassword } from "@/services/otp.service";

export const dynamic = "force-dynamic";

const Schema = z
  .object({
    requestId: z.string().min(8).max(64),
    code: z.string().regex(/^\d{4,8}$/, "Kode OTP harus 4–8 digit angka"),
    newPassword: z
      .string()
      .min(8, "Min 8 karakter")
      .regex(/[A-Z]/, "Harus mengandung huruf besar")
      .regex(/[a-z]/, "Harus mengandung huruf kecil")
      .regex(/[0-9]/, "Harus mengandung angka"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });

export const POST = apiHandler(async (req: NextRequest) => {
  rateLimit({
    key: `otp:reset:ip:${getClientIp(req)}`,
    max: 10,
    windowMs: 30 * 60_000,
    message: "Terlalu banyak percobaan. Coba lagi nanti.",
  });

  const body = await req.json();
  const input = Schema.parse(body);

  const newPasswordHash = await hashPassword(input.newPassword);
  const result = await otpService.confirmResetPassword({
    requestId: input.requestId,
    code: input.code,
    newPasswordHash,
  });

  return ok({
    userId: result.userId,
    message: "Password berhasil diubah. Silakan login dengan password baru.",
  });
});
