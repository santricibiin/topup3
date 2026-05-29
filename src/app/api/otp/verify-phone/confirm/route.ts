/**
 * POST /api/otp/verify-phone/confirm
 * Verifikasi kode OTP nomor WhatsApp.
 *
 * Body: { requestId: string, code: string }
 *
 * Saat sukses: User.phoneVerified diisi & User.phone di-sync.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler, ok } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getCurrentUserFromRequest } from "@/server/auth";
import { otpService } from "@/services/otp.service";

export const dynamic = "force-dynamic";

const Schema = z.object({
  requestId: z.string().min(8).max(64),
  code: z.string().regex(/^\d{4,8}$/, "Kode OTP harus 4–8 digit angka"),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const user = await getCurrentUserFromRequest(req);
  if (!user) throw Errors.unauthorized();

  rateLimit({
    key: `otp:verify-phone:confirm:${user.id}`,
    max: 10,
    windowMs: 10 * 60_000,
    message: "Terlalu banyak percobaan. Coba lagi nanti.",
  });
  rateLimit({
    key: `otp:verify-phone:confirm:ip:${getClientIp(req)}`,
    max: 20,
    windowMs: 10 * 60_000,
  });

  const body = await req.json();
  const input = Schema.parse(body);

  const result = await otpService.confirmVerifyPhone({
    userId: user.id,
    requestId: input.requestId,
    code: input.code,
  });

  return ok({ phone: result.phone, verified: true });
});
