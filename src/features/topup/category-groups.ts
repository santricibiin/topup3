/**
 * Pengelompokan kategori untuk layout "Box Section" di halaman /topup.
 * Mirip aplikasi PPOB: grup "Pembelian" (produk prabayar) & "Pembayaran" (tagihan).
 *
 * Modul ini PURE (tanpa dependensi server/prisma) supaya aman di-import baik dari
 * server component, client component, maupun service layer.
 */

export interface CategoryGroup {
  key: string;
  label: string;
  /** Daftar kategori (string ProductCategory). */
  categories: string[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    key: "pembelian",
    label: "Pembelian",
    categories: [
      "PULSA",
      "DATA",
      "PAKET_SMS_TELPON",
      "MASA_AKTIF",
      "AKTIVASI_VOUCHER",
      "PLN",
      "EWALLET",
      "GAME",
      "VOUCHER",
      "STREAMING",
    ],
  },
  {
    key: "pembayaran",
    label: "Pembayaran",
    categories: [
      "PASCABAYAR",
      "TV_KABEL",
      "GAS",
      "BPJS",
      "ASURANSI",
      "PDAM",
      "TRANSPORTASI",
      "SEMBAKO",
    ],
  },
  {
    key: "lainnya",
    label: "Lainnya",
    categories: ["OTHER"],
  },
];

/** Map cepat: category → group key. */
export const CATEGORY_TO_GROUP: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const g of CATEGORY_GROUPS) {
    for (const c of g.categories) m[c] = g.key;
  }
  return m;
})();
