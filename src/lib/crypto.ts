/**
 * Hashing util MD5/SHA — khusus signature PG.
 * Wajib dipakai untuk validasi webhook Duitku.
 */
import crypto from "node:crypto";

export function md5(input: string): string {
  return crypto.createHash("md5").update(input, "utf8").digest("hex");
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Constant-time string compare untuk mencegah timing attack
 * saat memvalidasi signature.
 */
export function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}
