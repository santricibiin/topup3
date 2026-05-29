import { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler, ok } from "@/server/api-handler";
import { authService } from "@/services/auth.service";
import { otpService } from "@/services/otp.service";
import { settingsService } from "@/services/settings.service";
import { RegisterSchema } from "@/schemas/auth.schema";
import { setSessionCookie } from "@/server/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { normalizePhone } from "@/lib/phone";

// Saat WA OTP enabled, body register WAJIB include requestId + code untuk
// verifikasi nomor. Schema base divalidasi dulu via RegisterSchema.
const OtpFieldsSchema = z.object({
  otpRequestId: z.string().min(8).max(64),
  otpCode: z.string().regex(/^\d{4,8}$/),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const ip = getClientIp(req);
  // Rate limit: 5 pendaftaran / 1 jam per IP — cegah account spam
  rateLimit({
    key: `register:ip:${ip}`,
    max: 5,
    windowMs: 60 * 60_000,
    message: "Terlalu banyak pendaftaran dari IP ini. Coba lagi 1 jam.",
  });

  const body = await req.json();
  const input = RegisterSchema.parse(body);

  const waotp = await settingsService.getWaOtpConfig();

  // Saat WA OTP aktif: phone wajib terisi & sudah lulus OTP verify.
  let phoneVerifiedAt: Date | undefined;
  if (waotp.enabled) {
    if (!input.phone) {
      throw Errors.badRequest("Nomor WhatsApp wajib diisi.");
    }
    const otp = OtpFieldsSchema.safeParse(body);
    if (!otp.success) {
      throw Errors.badRequest("Kode OTP wajib diisi.");
    }
    // Verify OTP & pastikan phone yang diverifikasi cocok dengan input.phone.
    const verified = await otpService.confirmRegisterOtp({
      requestId: otp.data.otpRequestId,
      code: otp.data.otpCode,
    });
    const inputPhoneNorm = normalizePhone(input.phone);
    if (verified.phone !== inputPhoneNorm) {
      throw Errors.badRequest("Nomor di OTP tidak cocok dengan input.");
    }
    phoneVerifiedAt = new Date();
    // Pakai phone normalized supaya konsisten format di DB
    input.phone = verified.phone;
  }

  const user = await authService.register(input, { phoneVerifiedAt });
  const session = await authService.login({
    identifier: input.email,
    password: input.password,
  });
  setSessionCookie(session.token, session.expiresAt);

  logger.info("auth.register.success", {
    ip,
    userId: user.id,
    email: user.email,
    otpVerified: Boolean(phoneVerifiedAt),
  });

  return ok({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  });
});
