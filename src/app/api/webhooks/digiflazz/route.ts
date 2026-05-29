/**
 * Webhook Digiflazz — POST /api/webhooks/digiflazz
 *
 * Validasi opsional via header `X-Hub-Signature` (HMAC-SHA1 dari secret).
 * Idempotent: status hanya naik (Pending → Sukses/Gagal).
 */
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { DigiflazzWebhookSchema } from "@/schemas/webhook.schema";
import { gatewayLogService } from "@/services/gateway-log.service";
import { transactionService } from "@/services/transaction.service";

export const POST = apiHandler(async (req: NextRequest) => {
  const rawText = await req.text();
  const secret = process.env.DIGIFLAZZ_WEBHOOK_SECRET;

  // SECURITY: signature WAJIB di-verify. Kalau secret gak di-set, tolak request
  // supaya attacker gak bisa kirim fake webhook "Sukses" tanpa bayar.
  if (!secret) {
    logger.error("digiflazz.webhook.secret_not_configured");
    throw Errors.internal("Webhook secret belum di-set. Hubungi admin.");
  }

  const incoming = req.headers.get("x-hub-signature") ?? "";
  const expected =
    "sha1=" + crypto.createHmac("sha1", secret).update(rawText).digest("hex");
  if (!incoming || !safeEqual(expected, incoming)) {
    logger.warn("digiflazz.webhook.invalid_signature");
    throw Errors.invalidSignature();
  }

  const json = JSON.parse(rawText);
  const parsed = DigiflazzWebhookSchema.parse(json);
  const data = parsed.data;

  await gatewayLogService.write(prisma, {
    provider: "DIGIFLAZZ",
    direction: "WEBHOOK",
    endpoint: "/api/webhooks/digiflazz",
    httpStatus: 200,
    payload: parsed,
  });

  const tx = await prisma.transaction.findUnique({
    where: { orderId: data.ref_id },
  });
  if (!tx) {
    logger.warn("digiflazz.webhook.tx_not_found", { refId: data.ref_id });
    return NextResponse.json({ success: true });
  }

  await transactionService.applyDigiflazzResult(tx.id, {
    status: data.status,
    rc: data.rc,
    sn: data.sn,
    message: data.message,
  });

  return NextResponse.json({ success: true });
});
