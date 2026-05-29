import "server-only";
import { randomBytes } from "node:crypto";

/**
 * Generate order id unik. Format: PTU-YYYYMMDD-XXXXXXXXXXXX
 *
 * Pakai crypto.randomBytes (CSPRNG) supaya gak bisa di-predict / enumerate.
 * 6 bytes -> 12 hex chars (~2^48 kombinasi per hari, tidak feasible di-brute).
 *
 * Server-only: ga di-bundle ke browser. node:crypto cuma jalan di Node runtime.
 */
export function generateOrderId(prefix = "PTU"): string {
  const d = new Date();
  const ymd =
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  const rand = randomBytes(6).toString("hex").toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
}
