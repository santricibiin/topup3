/**
 * Tipe data Digiflazz API.
 * Reference: https://developer.digiflazz.com/api/buyer/
 */

// ---- Cek Saldo ----
export interface DigiflazzCekSaldoRequest {
  cmd: "deposit";
  username: string;
  sign: string; // md5(username + apiKey + "depo")
}
export interface DigiflazzCekSaldoData {
  deposit: number;
}

// ---- Price List ----
export interface DigiflazzPriceListRequest {
  cmd: "prepaid" | "pasca";
  username: string;
  sign: string; // md5(username + apiKey + "pricelist")
  code?: string;
  category?: string;
  brand?: string;
  type?: string;
}
export interface DigiflazzProduct {
  product_name: string;
  category: string;
  brand: string;
  type: string;
  seller_name: string;
  price: number;
  buyer_sku_code: string;
  buyer_product_status: boolean;
  seller_product_status: boolean;
  unlimited_stock: boolean;
  stock: number;
  multi: boolean;
  start_cut_off: string;
  end_cut_off: string;
  desc: string;
}

// Pricelist pascabayar punya field tambahan `commission` & `admin`
// dan field harga (`price`) bisa 0 (harga real diketahui saat inquiry).
export interface DigiflazzPostpaidProduct {
  product_name: string;
  category: string;
  brand: string;
  seller_name: string;
  admin: number;          // admin fee Digiflazz (0 untuk produk tertentu)
  commission: number;     // komisi flat untuk seller
  buyer_sku_code: string;
  buyer_product_status: boolean;
  seller_product_status: boolean;
  desc: string;
}

// ---- Inquiry / Bayar Pasca ----
export interface DigiflazzInquiryRequest {
  commands: "inq-pasca";
  username: string;
  buyer_sku_code: string;
  customer_no: string;
  ref_id: string;
  sign: string; // md5(username + apiKey + ref_id)
  testing?: boolean;
}
export interface DigiflazzPayRequest {
  commands: "pay-pasca";
  username: string;
  buyer_sku_code: string;
  customer_no: string;
  ref_id: string;
  sign: string; // md5(username + apiKey + ref_id)
  testing?: boolean;
}
// Response inq-pasca / pay-pasca — sebagian field optional karena varian
// per produk (PLN, PDAM, BPJS, Internet, dst).
export interface DigiflazzPostpaidData {
  ref_id: string;
  customer_no: string;
  customer_name?: string;
  buyer_sku_code: string;
  admin: number;
  message: string;
  status: "Sukses" | "Gagal" | "Pending";
  rc: string;
  sn?: string;
  periode?: string;
  buyer_last_saldo?: number;
  price: number;
  selling_price?: number;
  desc?: Record<string, unknown>;
}

// ---- Order Transaksi ----
export interface DigiflazzOrderRequest {
  username: string;
  buyer_sku_code: string;
  customer_no: string;
  ref_id: string;
  sign: string; // md5(username + apiKey + ref_id)
  testing?: boolean;
  msg?: string;
  cb_url?: string;
}

// ---- Cek Status ----
// Prepaid: kirim ulang topup dengan ref_id sama (tanpa cb_url & tanpa testing
// flag yang berbeda) — Digiflazz akan balikin status terkini.
// Postpaid: gunakan command "status-pasca".
export interface DigiflazzCheckStatusPrepaidRequest {
  username: string;
  buyer_sku_code: string;
  customer_no: string;
  ref_id: string;
  sign: string; // md5(username + apiKey + ref_id)
}
export interface DigiflazzCheckStatusPostpaidRequest {
  commands: "status-pasca";
  username: string;
  buyer_sku_code: string;
  customer_no: string;
  ref_id: string;
  sign: string; // md5(username + apiKey + ref_id)
}
export interface DigiflazzOrderData {
  ref_id: string;
  customer_no: string;
  buyer_sku_code: string;
  message: string;
  status: "Pending" | "Sukses" | "Gagal";
  rc: string;            // response code
  sn: string;
  buyer_last_saldo: number;
  price: number;
  tele: string;
  wa: string;
}

// ---- Webhook (transaksi.create / transaksi.update) ----
export interface DigiflazzWebhookPayload {
  data: DigiflazzOrderData;
}

// ---- Wrapper response umum ----
export interface DigiflazzResponse<T> {
  data: T;
}
