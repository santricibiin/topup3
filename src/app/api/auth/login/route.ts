/**
 * POST /api/auth/login
 *
 * Branching:
 *  - WAOTP enabled + user.phoneVerified + setting `loginRequired=true`
 *    → kirim OTP, return { requireOtp: true, requestId, phoneMasked }.
 *      Session BELUM dibuat. Client lanjut ke step 2.
 *  - Selain itu (legacy / user tanpa phone verified) → langsung create session.
 */
import { NextRequest } from "next/server";
import { apiHandler, ok } from "@/server/api-handler";
import { LoginSchema } from "@/schemas/auth.schema";
import { authService } from "@/services/auth.service";
import { otpService } from "@/services/otp.service";
import { settingsService } from "@/services/settings.service";
import { setSessionCookie } from "@/server/auth";
import { rateLimit, rateLimitReset, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const POST = apiHandler(async (req: NextRequest) => {
  const ip = getClientIp(req);
  // Rate limit per IP: 5 percobaan / 15 menit
  rateLimit({
    key: `login:ip:${ip}`,
    max: 5,
    windowMs: 15 * 60_000,
    message: "Terlalu banyak percobaan login dari IP ini. Coba lagi 15 menit.",
  });

  const body = await req.json();
  const input = LoginSchema.parse(body);

  // Rate limit per identifier (mencegah brute force lewat banyak IP)
  rateLimit({
    key: `login:user:${input.identifier.toLowerCase()}`,
    max: 10,
    windowMs: 15 * 60_000,
    message: "Terlalu banyak percobaan untuk akun ini. Coba lagi 15 menit.",
  });

  try {
    // Step 1 selalu: validate password.
    const user = await authService.verifyCredentials(input);

    // Cek apakah perlu OTP (2FA).
    const waotp = await settingsService.getWaOtpConfig();
    const need2fa =
      waotp.enabled && waotp.loginRequired && user.phoneVerified && user.phone;

    if (need2fa && user.phone) {
      try {
        const sent = await otpService.sendLogin({
          userId: user.id,
          phone: user.phone,
          ipAddress: ip,
          userAgent: req.headers.get("user-agent") ?? undefined,
        });
        // Reset hit counter SEKARANG karena password benar — kalau OTP
        // gagal step 2 itu masalah berbeda yang punya rate limit sendiri.
        rateLimitReset(`login:user:${input.identifier.toLowerCase()}`);
        return ok({
          requireOtp: true,
          requestId: sent.requestId,
          phoneMasked: `+${sent.phone.slice(0, 5)}****${sent.phone.slice(-4)}`,
          expiresInSeconds: sent.expiresInSeconds,
        });
      } catch (otpErr) {
        // Throttle: kalau OTP barusan dikirim, tampilkan info yang sama
        // (jangan langsung create session — itu bypass 2FA).
        logger.warn("auth.login.otp_send_fail", {
          userId: user.id,
          err: String(otpErr),
        });
        throw otpErr;
      }
    }

    // Tidak perlu OTP → langsung create session (current behavior).
    const session = await authService.createSession(user);
    setSessionCookie(session.token, session.expiresAt);
    rateLimitReset(`login:user:${input.identifier.toLowerCase()}`);

    return ok({
      requireOtp: false,
      id: session.user.id,
      email: session.user.email,
      username: session.user.username,
      role: session.user.role,
    });
  } catch (err) {
    logger.warn("auth.login.failed", {
      ip,
      identifier: input.identifier,
    });
    throw err;
  }
});
