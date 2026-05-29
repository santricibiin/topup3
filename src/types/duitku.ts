/**
 * Tipe data Duitku API.
 * Reference: https://docs.duitku.com/api/
 */

// ---- Get Payment Method ----
export interface DuitkuPaymentMethodRequest {
  merchantcode: string;
  amount: number;
  datetime: string; // YYYY-MM-DD HH:mm:ss
  signature: string; // sha256(merchantcode + amount + datetime + apiKey)
}
export interface DuitkuPaymentMethodItem {
  paymentMethod: string;
  paymentName: string;
  paymentImage: string;
  totalFee: string;
}
export interface DuitkuPaymentMethodResponse {
  paymentFee: DuitkuPaymentMethodItem[];
  responseCode: string;
  responseMessage: string;
}

// ---- Create Invoice ----
export interface DuitkuCreateInvoiceRequest {
  merchantCode: string;
  paymentAmount: number;
  paymentMethod: string;       // "VC", "BC", "OV", dll
  merchantOrderId: string;     // unik per transaksi
  productDetails: string;
  email: string;
  customerVaName?: string;
  phoneNumber?: string;
  itemDetails?: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  callbackUrl: string;
  returnUrl: string;
  signature: string;           // md5(merchantCode + merchantOrderId + paymentAmount + apiKey)
  expiryPeriod?: number;       // menit
}
export interface DuitkuCreateInvoiceResponse {
  merchantCode: string;
  reference: string;
  paymentUrl: string;
  vaNumber?: string;
  qrString?: string;
  amount: string;
  statusCode: string;
  statusMessage: string;
}

// ---- Check Status ----
export interface DuitkuCheckStatusRequest {
  merchantCode: string;
  merchantOrderId: string;
  signature: string; // md5(merchantCode + merchantOrderId + apiKey)
}
export interface DuitkuCheckStatusResponse {
  merchantOrderId: string;
  reference: string;
  amount: string;
  fee?: string;
  statusCode: "00" | "01" | "02"; // 00=success, 01=pending, 02=failed/expired
  statusMessage: string;
}

// ---- Webhook Callback ----
// Body x-www-form-urlencoded dari Duitku.
export interface DuitkuWebhookPayload {
  merchantCode: string;
  amount: string;
  merchantOrderId: string;
  productDetail: string;
  additionalParam?: string;
  paymentCode?: string;
  resultCode: "00" | "01"; // 00=success
  merchantUserId?: string;
  reference: string;
  signature: string; // md5(merchantCode + amount + merchantOrderId + apiKey)
  publisherOrderId?: string;
  spUserHash?: string;
  settlementDate?: string;
  issuerCode?: string;
}
