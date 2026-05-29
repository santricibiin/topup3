import { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler, ok } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { settingsService, SETTING_KEYS } from "@/services/settings.service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const PaymentSchema = z.object({
  qrisCode: z.string().trim().max(2000).optional().default(""),
  callbackSecret: z.string().trim().max(120).optional().default(""),
  min: z
    .number()
    .int()
    .min(100, "Minimal harus >= 100")
    .max(50_000_000, "Tidak masuk akal"),
  max: z
    .number()
    .int()
    .min(100)
    .max(100_000_000),
  expiryMin: z.number().int().min(1).max(120),
  danaOwnerName: z.string().trim().max(120).optional().default(""),
});

/**
 * GET  — ambil konfigurasi pembayaran (QRIS, secret webhook, min/max).
 *        callbackSecret di-mask supaya gak kebaca dari client.
 * POST — simpan konfigurasi pembayaran.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);
  const cfg = await settingsService.getDepositConfig();
  return ok({
    qrisCode: cfg.qrisCode,
    callbackSecret: cfg.callbackSecret
      ? settingsService.mask(cfg.callbackSecret)
      : "",
    callbackSecretSet: Boolean(cfg.callbackSecret),
    min: cfg.min,
    max: cfg.max,
    expiryMin: cfg.expiryMin,
    danaOwnerName: cfg.danaOwnerName,
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const admin = await requireAdminApi(req);
  const body = await req.json().catch(() => ({}));
  const data = PaymentSchema.parse(body);

  if (data.max < data.min) {
    throw new Error("Maksimal harus lebih besar dari minimal.");
  }

  const updates: Array<{
    key: (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];
    value: string;
  }> = [
    { key: SETTING_KEYS.DEPOSIT_QRIS_CODE, value: data.qrisCode ?? "" },
    { key: SETTING_KEYS.DEPOSIT_MIN, value: String(data.min) },
    { key: SETTING_KEYS.DEPOSIT_MAX, value: String(data.max) },
    { key: SETTING_KEYS.DEPOSIT_EXPIRY_MIN, value: String(data.expiryMin) },
    {
      key: SETTING_KEYS.DEPOSIT_DANA_OWNER_NAME,
      value: data.danaOwnerName ?? "",
    },
  ];

  // Hanya update secret kalau dikirim non-empty (biar gak hilang gara2 admin
  // nge-save form tanpa nyentuh field itu, karena kita kirim masked di GET).
  if (data.callbackSecret && !data.callbackSecret.includes("•")) {
    updates.push({
      key: SETTING_KEYS.DEPOSIT_CALLBACK_SECRET,
      value: data.callbackSecret,
    });
  }

  await settingsService.setMany(updates);

  logger.info("admin.payment.update", { by: admin.id });

  return ok({ updated: true });
});
