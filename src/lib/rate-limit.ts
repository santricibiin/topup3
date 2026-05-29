/**
 * Rate Limiter — in-memory sliding window.
 *
 * Cocok untuk single-instance deployment (VPS, dll).
 * Untuk multi-instance/load-balanced, ganti ke Redis-backed (mis. @upstash/ratelimit).
 *
 * Cara pakai:
 *   import { rateLimit, getClientIp } from "@/lib/rate-limit";
 *   const ip = getClientIp(req);
 *   await rateLimit({ key: `login:${ip}`, max: 5, windowMs: 15 * 60_000 });
 *   // throw Errors.rateLimited() kalau lewat
 */
import { NextRequest } from "next/server";
import { Errors } from "@/lib/errors";

interface Bucket {
  hits: number[];
}

const store = new Map<string, Bucket>();

// Auto-cleanup tiap 5 menit biar gak memory leak
const CLEANUP_INTERVAL_MS = 5 * 60_000;
let cleanupStarted = false;
function ensureCleanup() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  setInterval(() => {
    const cutoff = Date.now() - 60 * 60_000; // 1 jam
    for (const [key, bucket] of store.entries()) {
      bucket.hits = bucket.hits.filter((t) => t > cutoff);
      if (bucket.hits.length === 0) store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS).unref?.();
}

export interface RateLimitOptions {
  /** Unique key per identifier (mis. `login:1.2.3.4`). */
  key: string;
  /** Max hits dalam window. */
  max: number;
  /** Window dalam millisecond. */
  windowMs: number;
  /** Custom error message saat ke-trigger. */
  message?: string;
}

/**
 * Cek + record hit. Throw `Errors.rateLimited()` kalau melewati limit.
 */
export function rateLimit(opts: RateLimitOptions): void {
  ensureCleanup();
  const now = Date.now();
  const cutoff = now - opts.windowMs;

  let bucket = store.get(opts.key);
  if (!bucket) {
    bucket = { hits: [] };
    store.set(opts.key, bucket);
  }

  // Buang hit yang udah lewat window
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= opts.max) {
    const oldestHit = bucket.hits[0]!;
    const retryAfterMs = oldestHit + opts.windowMs - now;
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    const minutes = Math.ceil(retryAfterSec / 60);
    throw Errors.rateLimited(
      opts.message ??
        `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.`,
    );
  }

  bucket.hits.push(now);
}

/**
 * Reset rate limit untuk key tertentu (mis. setelah login sukses).
 */
export function rateLimitReset(key: string): void {
  store.delete(key);
}

/**
 * Ekstrak IP client. Cek header proxy umum (Cloudflare, Nginx, dll)
 * dengan urutan dari paling trusted ke fallback.
 */
export function getClientIp(req: NextRequest | Request): string {
  const headers = req.headers;
  // Cloudflare
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  // Standard proxy
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    // Ambil yang pertama (client asli, sebelum proxy chain)
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  // Nginx
  const xri = headers.get("x-real-ip");
  if (xri) return xri.trim();
  // Fallback: NextRequest punya .ip
  const reqIp = (req as NextRequest).ip;
  if (reqIp) return reqIp;
  return "unknown";
}
