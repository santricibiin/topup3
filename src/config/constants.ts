/**
 * Konstanta global. Tidak boleh berisi kredensial.
 */
export const APP = {
  name: "PTopup",
  description: "Topup PPOB & Game — cepat, aman, anti-ribet.",
} as const;

export const TX_EXPIRY_MINUTES = 30;          // invoice Duitku berlaku 30 menit
export const POLLING_INTERVAL_MS = 1_500;     // polling status transaksi (≈ real-time)
export const MAX_DIGIFLAZZ_RETRIES = 2;
// Inquiry pasca berlaku 30 menit ATAU sampai akhir hari (mana lebih dulu).
// Doc Digiflazz: pay-pasca hanya valid pada tanggal yang sama dengan inquiry.
export const POSTPAID_INQUIRY_EXPIRY_MINUTES = 30;

export const ORDER_PREFIX = "PTU";            // PTU-20260526-XXXX
