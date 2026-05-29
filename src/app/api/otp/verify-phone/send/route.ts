/**
 * POST /api/otp/verify-phone/send
 * Kirim OTP ke nomor WhatsApp user yang sedang login.
 *
 * Body: { phone: string }  // boleh kirim nomor baru (akan di-update saat verified)
 *
 * Auth: required
 * Rate limit: 1 OTP / menit per phone (di service), 5 / 10 menit per IP.
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
  phone: z.string().min(8).max(20),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const user = await getCurrentUserFromRequest(req);
  if (!user) throw Errors.unauthorized();

  rateLimit({
    key: `otp:verify-phone:user:${user.id}`,
    max: 5,
    windowMs: 10 * 60_000,
    message: "Terlalu banyak permintaan kode. Coba lagi nanti.",
  });
  rateLimit({
    key: `otp:verify-phone:ip:${getClientIp(req)}`,
    max: 10,
    windowMs: 10 * 60_000,
  });

  const body = await req.json();
  const input = Schema.parse(body);

  const sent = await otpService.sendVerifyPhone({
    userId: user.id,
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
