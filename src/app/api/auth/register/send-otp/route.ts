/**
 * POST /api/auth/register/send-otp
 * Step 1 register dengan OTP: kirim kode verifikasi ke nomor calon user.
 *
 * Body: { phone: string }
 *
 * Hanya bisa dipakai saat fitur WA OTP enabled (gate di otp.service).
 * Pre-check: phone belum terdaftar — supaya kita gak bayar pulsa OTP buat
 * nomor yang tidak akan jadi user baru.
 *
 * SECURITY:
 *  - Rate limit ketat per IP (cegah spam).
 *  - Tidak butuh login.
 *  - Phone uniqueness final check di-do lagi saat /register actual untuk
 *    cegah race condition (2 user race daftar dengan nomor sama).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler, ok } from "@/server/api-handler";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { otpService } from "@/services/otp.service";

export const dynamic = "force-dynamic";

const Schema = z.object({
  phone: z.string().min(8).max(20),
});

export const POST = apiHandler(async (req: NextRequest) => {
  rateLimit({
    key: `register:otp:ip:${getClientIp(req)}`,
    max: 5,
    windowMs: 30 * 60_000,
    message: "Terlalu banyak permintaan kode. Coba lagi nanti.",
  });

  const body = await req.json();
  const input = Schema.parse(body);

  const sent = await otpService.sendRegister({
    phone: input.phone,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return ok({
    requestId: sent.requestId,
    phone: sent.phone,
    expiresAt: sent.expiresAt,
    expiresInSeconds: sent.expiresInSeconds,
  });
});
