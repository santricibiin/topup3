/**
 * Digiflazz Service — semua interaksi ke API Digiflazz HARUS lewat sini.
 *
 * Signature rule (md5):
 * - cek deposit  : md5(username + apiKey + "depo")
 * - price list   : md5(username + apiKey + "pricelist")
 * - transaksi    : md5(username + apiKey + ref_id)
 *
 * Kredensial (username, apiKey, mode) diambil dari Setting (DB) dengan fallback
 * ke env. Bisa diubah on-the-fly dari panel admin.
 */
import { env } from "@/config/env";
import { md5 } from "@/lib/crypto";
import { Errors } from "@/lib/errors";
import { HttpClient } from "@/lib/http";
import { logger } from "@/lib/logger";
import { settingsService } from "./settings.service";
import type {
  DigiflazzCekSaldoData,
  DigiflazzOrderData,
  DigiflazzPostpaidData,
  DigiflazzPostpaidProduct,
  DigiflazzProduct,
  DigiflazzResponse,
} from "@/types/digiflazz";

class DigiflazzService {
  private readonly http: HttpClient;

  constructor() {
    this.http = new HttpClient({
      baseURL: env.DIGIFLAZZ_BASE_URL,
      serviceName: "digiflazz",
      timeoutMs: 20_000,
    });
  }

  private async getCreds() {
    return settingsService.getDigiflazzCredentials();
  }

  private sign(username: string, apiKey: string, suffix: string): string {
    return md5(`${username}${apiKey}${suffix}`);
  }

  /** Cek saldo deposit Digiflazz. */
  async cekSaldo(): Promise<number> {
    const { username, apiKey } = await this.getCreds();
    const body = {
      cmd: "deposit" as const,
      username,
      sign: this.sign(username, apiKey, "depo"),
    };
    const res = await this.http.post<typeof body, DigiflazzResponse<DigiflazzCekSaldoData>>(
      "/cek-saldo",
      body,
    );
    return res.data.deposit;
  }

  /** Ambil price list (prepaid). */
  async getPriceList(filter?: {
    code?: string;
    category?: string;
    brand?: string;
    type?: string;
  }): Promise<DigiflazzProduct[]> {
    const { username, apiKey } = await this.getCreds();
    const body = {
      cmd: "prepaid" as const,
      username,
      sign: this.sign(username, apiKey, "pricelist"),
      ...filter,
    };
    const res = await this.http.post<
      typeof body,
      DigiflazzResponse<DigiflazzProduct[]>
    >("/price-list", body);
    return res.data;
  }

  /**
   * Ambil price list PASCABAYAR (cmd: "pasca").
   *
   * Field harga di response umumnya 0 — harga real baru muncul saat inquiry.
   * Field `admin` & `commission` adalah fee/komisi yang ditetapkan Digiflazz.
   */
  async getPostpaidPriceList(filter?: {
    code?: string;
    category?: string;
    brand?: string;
  }): Promise<DigiflazzPostpaidProduct[]> {
    const { username, apiKey } = await this.getCreds();
    const body = {
      cmd: "pasca" as const,
      username,
      sign: this.sign(username, apiKey, "pricelist"),
      ...filter,
    };
    const res = await this.http.post<
      typeof body,
      DigiflazzResponse<DigiflazzPostpaidProduct[]>
    >("/price-list", body);
    return res.data;
  }

  /**
   * Eksekusi order ke Digiflazz.
   * `ref_id` MUST sama dengan orderId di tabel Transaction (idempotency).
   */
  async order(params: {
    refId: string;
    sku: string;
    customerNo: string;
    cbUrl?: string;
    testing?: boolean;
  }): Promise<DigiflazzOrderData> {
    const { username, apiKey, mode } = await this.getCreds();
    const body = {
      username,
      buyer_sku_code: params.sku,
      customer_no: params.customerNo,
      ref_id: params.refId,
      sign: this.sign(username, apiKey, params.refId),
      testing: params.testing ?? mode === "development",
      cb_url: params.cbUrl,
    };

    try {
      const res = await this.http.post<
        typeof body,
        DigiflazzResponse<DigiflazzOrderData>
      >("/transaction", body);
      return res.data;
    } catch (err) {
      logger.error("digiflazz.order.fail", { refId: params.refId });
      throw Errors.digiflazz("Gagal menghubungi Digiflazz.", { cause: String(err) });
    }
  }

  /**
   * Cek status transaksi PREPAID.
   *
   * Sesuai dokumentasi Digiflazz:
   * "Cek status dapat dilakukan dengan melakukan topup ulang dengan ref id
   *  yang sama pada transaksi sebelumnya."
   *
   * Artinya cek status prepaid = re-POST ke /transaction dengan field
   * wajib lengkap (buyer_sku_code, customer_no, ref_id, sign). Digiflazz
   * akan deduplikasi via ref_id dan mengembalikan status terbaru.
   *
   * PERINGATAN: jangan dipanggil untuk transaksi >= 90 hari karena
   * Digiflazz akan menganggap transaksi BARU. Caller wajib guard umur tx.
   */
  async checkStatusPrepaid(params: {
    refId: string;
    sku: string;
    customerNo: string;
  }): Promise<DigiflazzOrderData> {
    const { username, apiKey, mode } = await this.getCreds();
    const body = {
      username,
      buyer_sku_code: params.sku,
      customer_no: params.customerNo,
      ref_id: params.refId,
      sign: this.sign(username, apiKey, params.refId),
      // testing flag ikut mode supaya cek-status di sandbox tidak nyangkut
      // ke produksi (Digiflazz match ref_id per environment).
      testing: mode === "development",
    };
    const res = await this.http.post<
      typeof body,
      DigiflazzResponse<DigiflazzOrderData>
    >("/transaction", body);
    return res.data;
  }

  /**
   * Cek status transaksi POSTPAID (pascabayar) dengan command `status-pasca`.
   *
   * PERINGATAN: untuk transaksi >= 90 hari Digiflazz akan respon
   * "Data belum ada".
   */
  async checkStatusPostpaid(params: {
    refId: string;
    sku: string;
    customerNo: string;
  }): Promise<DigiflazzOrderData> {
    const { username, apiKey } = await this.getCreds();
    const body = {
      commands: "status-pasca" as const,
      username,
      buyer_sku_code: params.sku,
      customer_no: params.customerNo,
      ref_id: params.refId,
      sign: this.sign(username, apiKey, params.refId),
    };
    const res = await this.http.post<
      typeof body,
      DigiflazzResponse<DigiflazzOrderData>
    >("/transaction", body);
    return res.data;
  }

  /**
   * Inquiry tagihan pascabayar (`inq-pasca`).
   *
   * `ref_id` yang dipakai di sini WAJIB sama dengan `ref_id` saat pay-pasca
   * (Digiflazz match antar inquiry & payment via ref_id).
   */
  async inquiryPostpaid(params: {
    refId: string;
    sku: string;
    customerNo: string;
  }): Promise<DigiflazzPostpaidData> {
    const { username, apiKey, mode } = await this.getCreds();
    const body = {
      commands: "inq-pasca" as const,
      username,
      buyer_sku_code: params.sku,
      customer_no: params.customerNo,
      ref_id: params.refId,
      sign: this.sign(username, apiKey, params.refId),
      testing: mode === "development",
    };
    try {
      const res = await this.http.post<
        typeof body,
        DigiflazzResponse<DigiflazzPostpaidData>
      >("/transaction", body);
      return res.data;
    } catch (err) {
      logger.error("digiflazz.inq-pasca.fail", { refId: params.refId });
      throw Errors.digiflazz("Gagal menghubungi Digiflazz untuk inquiry.", {
        cause: String(err),
      });
    }
  }

  /**
   * Bayar tagihan pascabayar (`pay-pasca`).
   *
   * Wajib dipanggil dengan `ref_id` yang sama dengan saat inquiry.
   * Doc Digiflazz: "Hanya dapat melakukan pembayaran tagihan pada tanggal
   * yang sama dengan tanggal pengecekan tagihan." → caller wajib guard.
   */
  async payPostpaid(params: {
    refId: string;
    sku: string;
    customerNo: string;
  }): Promise<DigiflazzPostpaidData> {
    const { username, apiKey, mode } = await this.getCreds();
    const body = {
      commands: "pay-pasca" as const,
      username,
      buyer_sku_code: params.sku,
      customer_no: params.customerNo,
      ref_id: params.refId,
      sign: this.sign(username, apiKey, params.refId),
      testing: mode === "development",
    };
    try {
      const res = await this.http.post<
        typeof body,
        DigiflazzResponse<DigiflazzPostpaidData>
      >("/transaction", body);
      return res.data;
    } catch (err) {
      logger.error("digiflazz.pay-pasca.fail", { refId: params.refId });
      throw Errors.digiflazz("Gagal menghubungi Digiflazz untuk bayar tagihan.", {
        cause: String(err),
      });
    }
  }
}

export const digiflazzService = new DigiflazzService();
