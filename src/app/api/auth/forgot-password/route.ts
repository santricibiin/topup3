/**
 * POST /api/auth/forgot-password
 * Kirim OTP reset password ke nomor WhatsApp yang terdaftar untuk akun.
 *
 * Body: { identifier: string }  // email atau username
 *
 * SECURITY:
 *  - Tidak boleh leak existence akun. Selalu balas success.
 *  - Rate limit ketat per IP (cegah enumeration & abuse).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler, ok } from "@/server/api-handler";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { otpService } from "@/services/otp.service";

export const dynamic = "force-dynamic";

const Schema = z.object({
  identifier: z.string().min(3).max(80),
});

export const POST = apiHandler(async (req: NextRequest) => {
  rateLimit({
    key: `otp:forgot:ip:${getClientIp(req)}`,
    max: 5,
    windowMs: 30 * 60_000, // 5 request per 30 menit per IP
    message: "Terlalu banyak permintaan. Coba lagi nanti.",
  });

  const body = await req.json();
  const input = Schema.parse(body);

  // Selalu balas success — generic message — apakah user/phone exist atau tidak.
  // Kalau exist, requestId & phoneMasked diisi; kalau tidak, dua-duanya null.
  // UI tetap lanjut ke step "masukkan kode" tapi verify pasti gagal.
  // ALTERNATIF (kalau mau zero leak): jangan kirim requestId, paksa user
  // input identifier lagi di step verify. Tapi UX jelek. Kompromi sekarang:
  // requestId kosong = UI tampilkan "kalau akun ada, kode telah dikirim".
  const result = await otpService.sendResetPassword({
    identifier: input.identifier,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return ok({
    requestId: result.requestId,
    phoneMasked: result.phoneMasked,
    // Generic message yang UI tampilkan — tidak membocorkan keberadaan akun.
    message:
      "Jika akun ditemukan, kode reset password sudah dikirim ke WhatsApp.",
  });
});
