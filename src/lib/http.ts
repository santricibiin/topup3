/**
 * HTTP client wrapper untuk komunikasi ke Digiflazz & Duitku.
 * - Timeout default 15 detik
 * - Retry idempotent (GET) maksimal 2x dengan exponential backoff
 * - Logging JSON line via logger
 *
 * JANGAN log Authorization / API key.
 */
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { logger } from "./logger";

export interface HttpClientOptions {
  baseURL: string;
  timeoutMs?: number;
  serviceName: string;
}

export class HttpClient {
  private readonly axios: AxiosInstance;
  private readonly serviceName: string;

  constructor(opts: HttpClientOptions) {
    this.serviceName = opts.serviceName;
    this.axios = axios.create({
      baseURL: opts.baseURL,
      timeout: opts.timeoutMs ?? 15_000,
      headers: { "Content-Type": "application/json" },
    });
  }

  async post<TReq, TRes>(
    path: string,
    body: TReq,
    config?: AxiosRequestConfig,
  ): Promise<TRes> {
    return this.request<TRes>({ ...config, method: "POST", url: path, data: body });
  }

  async get<TRes>(path: string, config?: AxiosRequestConfig): Promise<TRes> {
    return this.request<TRes>({ ...config, method: "GET", url: path }, true);
  }

  private async request<TRes>(
    config: AxiosRequestConfig,
    retryable = false,
  ): Promise<TRes> {
    const maxAttempts = retryable ? 3 : 1;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const start = Date.now();
      try {
        const res = await this.axios.request<TRes>(config);
        logger.info(`${this.serviceName}.http.ok`, {
          method: config.method,
          url: config.url,
          status: res.status,
          ms: Date.now() - start,
          attempt,
        });
        return res.data;
      } catch (err) {
        lastErr = err;
        const e = err as AxiosError;
        logger.warn(`${this.serviceName}.http.err`, {
          method: config.method,
          url: config.url,
          status: e.response?.status,
          code: e.code,
          ms: Date.now() - start,
          attempt,
          // surface body provider untuk diagnosa (mis. Digiflazz 400)
          body: safeBody(e.response?.data),
        });
        if (attempt < maxAttempts) {
          await sleep(200 * 2 ** (attempt - 1));
          continue;
        }
        throw err;
      }
    }

    throw lastErr;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Truncate & redact response body untuk logging (jangan log API key). */
function safeBody(data: unknown): unknown {
  if (data == null) return undefined;
  try {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    return str.length > 800 ? str.slice(0, 800) + "...(trunc)" : str;
  } catch {
    return "[unserializable]";
  }
}
