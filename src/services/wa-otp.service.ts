/**
 * WA OTP gateway client — wrapper untuk service di WAOTP_API_URL.
 *
 * Tanggung jawab thin: cuma HTTP call. Logic OTP, ownership validation,
 * side-effect (verify phone, reset password) ada di otp.service.ts.
 *
 * Auth: header `x-api-key`.
 *
 * Konfigurasi (URL & apiKey) dibaca dari Setting DB tiap request supaya
 * admin bisa ubah dari panel tanpa restart. Fallback ke env saat DB kosong.
 *
 * Endpoint yang dipakai:
 *  - POST /otp/send
 *  - POST /otp/verify
 *  - GET  /otp/status/:requestId
 */
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { settingsService } from "./settings.service";

interface SendOtpInput {
  phone: string;            // 0xxx / 62xxx / +62xxx — gateway akan normalize
  purpose?: string;         // "verify_phone" | "reset_password" | dll (label audit)
  length?: number;          // default 6
  expiresInSeconds?: number;// default 300
  template?: string;        // override template
  templateId?: string;
  variables?: Record<string, string | number>;
  sessionId?: string;
}

interface SendOtpResult {
  ok: true;
  requestId: string;
  phone: string;            // normalized "628xxx"
  expiresAt: string;        // ISO
  expiresInSeconds: number;
}

interface VerifyOtpResult {
  ok: true;
  verified: true;
  requestId: string;
  phone: string;
  verifiedAt: string;
}

interface GatewayErrorResp {
  error: string;
  attemptsRemaining?: number;
}

class WaOtpService {
  private async getConfig(): Promise<{ url: string; apiKey: string }> {
    const cfg = await settingsService.getWaOtpConfig();
    return { url: cfg.url, apiKey: cfg.apiKey };
  }

  /**
   * Generic request helper — timeout 10 detik, parse JSON, propagate error
   * gateway sebagai AppError yang bermakna.
   */
  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const { url: baseUrl, apiKey } = await this.getConfig();
    if (!apiKey) {
      throw Errors.conflict(
        "WA OTP gateway belum dikonfigurasi (API key kosong).",
      );
    }
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    };
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: ac.signal,
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // not json — biarin null, error handler di bawah yg ambil teks mentah
      }
      if (!res.ok) {
        const errResp = (json ?? {}) as GatewayErrorResp;
        const msg = errResp.error ?? `WA gateway error (HTTP ${res.status})`;
        // Mapping kode khusus → AppError yang sesuai
        if (res.status === 404) throw Errors.notFound("OTP");
        if (res.status === 410) throw Errors.conflict("Kode OTP sudah kedaluwarsa.");
        if (res.status === 429) {
          const remain = errResp.attemptsRemaining;
          throw Errors.conflict(
            remain !== undefined
              ? `Terlalu banyak percobaan. Sisa: ${remain}.`
              : "Terlalu banyak percobaan. Minta kode baru.",
          );
        }
        if (res.status === 409) {
          throw Errors.conflict(
            "Sesi WhatsApp tidak terhubung. Coba lagi sebentar.",
          );
        }
        if (res.status === 502) {
          throw Errors.conflict("Gagal kirim ke WhatsApp. Coba lagi.");
        }
        if (res.status === 400) {
          // Bisa juga "Invalid OTP code" — surfacekan attempts kalau ada
          const remain = errResp.attemptsRemaining;
          throw Errors.conflict(
            remain !== undefined
              ? `${msg}. Sisa percobaan: ${remain}.`
              : msg,
          );
        }
        throw Errors.conflict(msg);
      }
      return json as T;
    } catch (err) {
      // Network / timeout
      if ((err as { name?: string }).name === "AbortError") {
        logger.warn("waotp.timeout", { path });
        throw Errors.conflict("WA gateway timeout. Coba lagi.");
      }
      // Re-throw AppError apa adanya
      if ((err as { code?: string }).code) throw err;
      logger.error("waotp.fail", { path, err: String(err) });
      throw Errors.conflict("Tidak bisa menghubungi WA gateway.");
    } finally {
      clearTimeout(timeout);
    }
  }

  async send(input: SendOtpInput): Promise<SendOtpResult> {
    return this.request<SendOtpResult>("POST", "/otp/send", input);
  }

  /**
   * Verify kode OTP. Disarankan pakai requestId (lebih aman & akurat).
   * Phone hanya fallback (gateway akan ambil OTP terbaru untuk nomor itu).
   */
  async verify(input: {
    code: string;
    requestId?: string;
    phone?: string;
  }): Promise<VerifyOtpResult> {
    if (!input.requestId && !input.phone) {
      throw Errors.badRequest("requestId atau phone wajib diisi.");
    }
    return this.request<VerifyOtpResult>("POST", "/otp/verify", input);
  }

  async status(requestId: string): Promise<{
    ok: true;
    request: {
      id: string;
      phone: string;
      status: "PENDING" | "SENT" | "VERIFIED" | "EXPIRED" | "FAILED";
      purpose: string | null;
      attempts: number;
      maxAttempts: number;
      expiresAt: string;
      sentAt: string | null;
      verifiedAt: string | null;
      failedAt: string | null;
      createdAt: string;
    };
  }> {
    return this.request("GET", `/otp/status/${encodeURIComponent(requestId)}`);
  }
}

export const waOtpService = new WaOtpService();
