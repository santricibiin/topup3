import { z } from "zod";

/**
 * Skema body webhook dari Duitku.
 * Catatan: Duitku mengirim x-www-form-urlencoded — parse dulu di route.
 */
export const DuitkuWebhookSchema = z.object({
  merchantCode: z.string().min(1),
  amount: z.string().min(1),
  merchantOrderId: z.string().min(1),
  productDetail: z.string().optional().default(""),
  additionalParam: z.string().optional().default(""),
  paymentCode: z.string().optional().default(""),
  resultCode: z.enum(["00", "01"]),
  merchantUserId: z.string().optional().default(""),
  reference: z.string().min(1),
  signature: z.string().min(1),
  publisherOrderId: z.string().optional().default(""),
  spUserHash: z.string().optional().default(""),
  settlementDate: z.string().optional().default(""),
  issuerCode: z.string().optional().default(""),
});
export type DuitkuWebhookInput = z.infer<typeof DuitkuWebhookSchema>;

/**
 * Skema body webhook dari Digiflazz.
 * Header `X-Hub-Signature` berisi HMAC-SHA1 dari secret webhook.
 */
export const DigiflazzWebhookSchema = z.object({
  data: z.object({
    ref_id: z.string().min(1),
    customer_no: z.string(),
    buyer_sku_code: z.string(),
    message: z.string().optional().default(""),
    status: z.enum(["Pending", "Sukses", "Gagal"]),
    rc: z.string().optional().default(""),
    sn: z.string().optional().default(""),
    buyer_last_saldo: z.number().optional(),
    price: z.number().optional(),
    tele: z.string().optional(),
    wa: z.string().optional(),
  }),
});
export type DigiflazzWebhookInput = z.infer<typeof DigiflazzWebhookSchema>;
