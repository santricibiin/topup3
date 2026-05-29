import { z } from "zod";

/**
 * Skema input checkout topup.
 * Validasi: SKU produk, nomor tujuan, metode pembayaran.
 */
export const TopupCheckoutSchema = z.object({
  productSku: z.string().min(1, "Produk wajib dipilih"),
  customerNo: z
    .string()
    .min(3, "Nomor tujuan minimal 3 karakter")
    .max(32, "Nomor tujuan maksimal 32 karakter")
    .regex(/^[a-zA-Z0-9._-]+$/, "Karakter tidak valid"),
  serverId: z.string().max(32).optional(),
  paymentMethod: z.enum([
    "BALANCE",
    "DUITKU_VA",
    "DUITKU_QRIS",
    "DUITKU_EWALLET",
    "DUITKU_RETAIL",
    "DUITKU_OTHER",
  ]),
  paymentChannel: z.string().max(16).optional(), // kode Duitku: BC, M2, OV, dll
  pin: z.string().regex(/^\d{6}$/).optional(),    // wajib jika BALANCE & user set PIN
});
export type TopupCheckoutInput = z.infer<typeof TopupCheckoutSchema>;

export const ProductFilterSchema = z.object({
  category: z.string().optional(),
  brand: z.string().optional(),
  q: z.string().optional(),
});

/**
 * Skema input inquiry tagihan pascabayar (`inq-pasca`).
 * Tidak butuh paymentMethod karena inquiry tidak memotong saldo.
 */
export const PostpaidInquirySchema = z.object({
  productSku: z.string().min(1, "Produk wajib dipilih"),
  customerNo: z
    .string()
    .min(3, "Nomor tujuan minimal 3 karakter")
    .max(64, "Nomor tujuan maksimal 64 karakter")
    // Pasca beberapa produk (SAMSAT) pakai koma sebagai pemisah.
    .regex(/^[a-zA-Z0-9._,-]+$/, "Karakter tidak valid"),
});
export type PostpaidInquiryInput = z.infer<typeof PostpaidInquirySchema>;

/**
 * Skema konfirmasi bayar tagihan setelah inquiry sukses.
 * orderId sudah ada di URL path; di body hanya pilihan metode bayar.
 */
export const PostpaidConfirmPaySchema = z.object({
  paymentMethod: z.enum([
    "BALANCE",
    "DUITKU_VA",
    "DUITKU_QRIS",
    "DUITKU_EWALLET",
    "DUITKU_RETAIL",
    "DUITKU_OTHER",
  ]),
  paymentChannel: z.string().max(16).optional(),
  pin: z.string().regex(/^\d{6}$/).optional(),
});
export type PostpaidConfirmPayInput = z.infer<typeof PostpaidConfirmPaySchema>;
