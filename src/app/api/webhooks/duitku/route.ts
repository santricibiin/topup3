/**
 * Webhook Duitku — POST /api/webhooks/duitku
 *
 * Body: x-www-form-urlencoded.
 * Wajib:
 * 1) Validasi MD5 signature: md5(merchantCode + amount + merchantOrderId + apiKey)
 * 2) Idempotent: aman dipanggil berkali-kali oleh Duitku.
 * 3) Selalu balas 200 setelah valid agar Duitku tidak retry membabi-buta.
 */
import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { DuitkuWebhookSchema } from "@/schemas/webhook.schema";
import { duitkuService } from "@/services/duitku.service";
import { gatewayLogService } from "@/services/gateway-log.service";
import { transactionService } from "@/services/transaction.service";
import type { DuitkuWebhookPayload } from "@/types/duitku";

export const POST = apiHandler(async (req: NextRequest) => {
  const contentType = req.headers.get("content-type") ?? "";
  let raw: Record<string, string>;

  if (contentType.includes("application/json")) {
    raw = (await req.json()) as Record<string, string>;
  } else {
    const form = await req.formData();
    raw = Object.fromEntries(
      Array.from(form.entries()).map(([k, v]) => [k, String(v)]),
    );
  }

  const payload = DuitkuWebhookSchema.parse(raw) as unknown as DuitkuWebhookPayload;

  // 1) Verifikasi signature SEBELUM apa-apa.
  const sigOk = duitkuService.verifyWebhookSignature(payload);

  await gatewayLogService.write(prisma, {
    provider: "DUITKU",
    direction: "WEBHOOK",
    endpoint: "/api/webhooks/duitku",
    httpStatus: 200,
    signature: payload.signature,
    payload,
  });

  if (!sigOk) {
    logger.warn("duitku.webhook.invalid_signature", {
      orderId: payload.merchantOrderId,
    });
    throw Errors.invalidSignature();
  }

  // 2) Cari transaksi.
  const tx = await transactionService.findByOrderId(payload.merchantOrderId);
  if (!tx) {
    logger.warn("duitku.webhook.tx_not_found", { orderId: payload.merchantOrderId });
    return NextResponse.json({ success: true });
  }

  // 3) Validasi nominal cocok (anti-tampering).
  if (Number(payload.amount) !== Number(tx.totalAmount)) {
    logger.warn("duitku.webhook.amount_mismatch", {
      orderId: payload.merchantOrderId,
      paid: payload.amount,
      expected: tx.totalAmount.toString(),
    });
    throw Errors.invalidSignature();
  }

  // 4) Tindak lanjut sesuai resultCode.
  if (payload.resultCode === "00") {
    await transactionService.markPaid(tx.orderId, payload.reference);
  } else {
    await transactionService.failAndRefund(tx.id, "Pembayaran gagal/expired di Duitku.");
  }

  return NextResponse.json({ success: true });
});
