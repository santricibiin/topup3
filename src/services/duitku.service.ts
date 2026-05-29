/**
 * Duitku Service — semua interaksi ke Duitku HARUS lewat sini.
 *
 * Signature rule:
 * - createInvoice : md5(merchantCode + merchantOrderId + paymentAmount + apiKey)
 * - checkStatus   : md5(merchantCode + merchantOrderId + apiKey)
 * - paymentMethod : sha256(merchantCode + amount + datetime + apiKey)
 * - webhook       : md5(merchantCode + amount + merchantOrderId + apiKey)  ← VALIDASI WAJIB
 */
import { env } from "@/config/env";
import { md5, sha256, safeEqual } from "@/lib/crypto";
import { Errors } from "@/lib/errors";
import { HttpClient } from "@/lib/http";
import { logger } from "@/lib/logger";
import type {
  DuitkuCheckStatusResponse,
  DuitkuCreateInvoiceRequest,
  DuitkuCreateInvoiceResponse,
  DuitkuPaymentMethodItem,
  DuitkuPaymentMethodResponse,
  DuitkuWebhookPayload,
} from "@/types/duitku";

class DuitkuService {
  private readonly http: HttpClient;
  private readonly merchantCode: string;
  private readonly apiKey: string;

  constructor() {
    this.http = new HttpClient({
      baseURL: env.DUITKU_BASE_URL,
      serviceName: "duitku",
      timeoutMs: 20_000,
    });
    this.merchantCode = env.DUITKU_MERCHANT_CODE;
    this.apiKey = env.DUITKU_API_KEY;
  }

  /** List metode pembayaran berdasarkan nominal. */
  async getPaymentMethods(amount: number): Promise<DuitkuPaymentMethodItem[]> {
    const datetime = formatDuitkuDatetime(new Date());
    const signature = sha256(`${this.merchantCode}${amount}${datetime}${this.apiKey}`);

    const body = {
      merchantcode: this.merchantCode,
      amount,
      datetime,
      signature,
    };

    const res = await this.http.post<typeof body, DuitkuPaymentMethodResponse>(
      "/paymentmethod/getpaymentmethod",
      body,
    );

    if (res.responseCode !== "00") {
      throw Errors.duitku(res.responseMessage || "Gagal ambil metode pembayaran.");
    }
    return res.paymentFee;
  }

  /** Buat invoice (Create Transaction). */
  async createInvoice(params: {
    orderId: string;
    amount: number;
    productName: string;
    paymentMethod: string;
    customer: { email: string; name?: string; phone?: string };
    expiryMinutes?: number;
  }): Promise<DuitkuCreateInvoiceResponse> {
    const signature = md5(
      `${this.merchantCode}${params.orderId}${params.amount}${this.apiKey}`,
    );

    const body: DuitkuCreateInvoiceRequest = {
      merchantCode: this.merchantCode,
      paymentAmount: params.amount,
      paymentMethod: params.paymentMethod,
      merchantOrderId: params.orderId,
      productDetails: params.productName,
      email: params.customer.email,
      customerVaName: params.customer.name,
      phoneNumber: params.customer.phone,
      callbackUrl: env.DUITKU_CALLBACK_URL,
      returnUrl: env.DUITKU_RETURN_URL,
      signature,
      expiryPeriod: params.expiryMinutes ?? 30,
      itemDetails: [
        {
          name: params.productName,
          price: params.amount,
          quantity: 1,
        },
      ],
    };

    try {
      const res = await this.http.post<typeof body, DuitkuCreateInvoiceResponse>(
        "/v2/inquiry",
        body,
      );
      if (res.statusCode !== "00") {
        throw Errors.duitku(res.statusMessage || "Gagal membuat invoice.");
      }
      return res;
    } catch (err) {
      logger.error("duitku.createInvoice.fail", { orderId: params.orderId });
      throw err;
    }
  }

  /** Cek status (untuk polling/reconciliation). */
  async checkStatus(orderId: string): Promise<DuitkuCheckStatusResponse> {
    const signature = md5(`${this.merchantCode}${orderId}${this.apiKey}`);
    const body = {
      merchantCode: this.merchantCode,
      merchantOrderId: orderId,
      signature,
    };
    return this.http.post<typeof body, DuitkuCheckStatusResponse>(
      "/transactionStatus",
      body,
    );
  }

  /**
   * Validasi signature webhook Duitku.
   * Formula: md5(merchantCode + amount + merchantOrderId + apiKey)
   * Pakai `safeEqual` (timing-safe).
   */
  verifyWebhookSignature(payload: DuitkuWebhookPayload): boolean {
    const expected = md5(
      `${payload.merchantCode}${payload.amount}${payload.merchantOrderId}${this.apiKey}`,
    );
    return safeEqual(expected, payload.signature.toLowerCase());
  }
}

function formatDuitkuDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export const duitkuService = new DuitkuService();
