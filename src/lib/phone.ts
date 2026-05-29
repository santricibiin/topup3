/**
 * Phone number normalization & validation utilities.
 *
 * Standard format yang dipakai di seluruh app: "62XXXXXXXXXX" (E.164 tanpa +).
 * Gateway WA OTP juga me-normalize ke format ini di response.
 */

/**
 * Convert "08123...", "+62812...", "62812...", "812..." → "62812..."
 * Return null kalau format jelas-jelas invalid.
 */
export function normalizePhone(input: string): string | null {
  if (!input) return null;
  // Buang semua karakter non-digit kecuali + di depan
  const cleaned = input.replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  let digits: string;
  if (cleaned.startsWith("+62")) {
    digits = "62" + cleaned.slice(3);
  } else if (cleaned.startsWith("62")) {
    digits = cleaned;
  } else if (cleaned.startsWith("0")) {
    digits = "62" + cleaned.slice(1);
  } else if (cleaned.startsWith("8")) {
    digits = "62" + cleaned;
  } else {
    return null;
  }

  // Indonesia mobile: 62 + 8XX + 6-11 digits = total 11-15 digits
  if (digits.length < 11 || digits.length > 15) return null;
  if (!digits.startsWith("628")) return null;
  if (!/^\d+$/.test(digits)) return null;

  return digits;
}

/**
 * Mask nomor untuk display: 628123456789 → +6281****6789
 * Cegah leak nomor lengkap di response (mis. saat forgot-password).
 */
export function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  const start = phone.slice(0, 5);
  const end = phone.slice(-4);
  return `+${start}****${end}`;
}
