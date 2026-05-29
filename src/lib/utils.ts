import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format Rupiah dari number / string / Decimal.
 */
export function formatIDR(value: number | string): string {
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "Rp0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(num);
}

/**
 * Slugify string menjadi URL-friendly: lowercase, dash-separated, ASCII only.
 * Contoh: "MOBILE LEGENDS" -> "mobile-legends".
 */
export function slugify(value: string): string {
  return value
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Format relative time (id-ID): "baru saja", "5 menit lalu", "2 jam lalu", "kemarin", dll.
 * Untuk tanggal > 7 hari fallback ke "12 Mei 2026".
 */
export function formatRelativeTime(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 30) return "baru saja";
  if (sec < 60) return `${sec} detik lalu`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "kemarin";
  if (day < 7) return `${day} hari lalu`;
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Format tanggal & jam id-ID: "26 Mei 2026, 14:32". */
export function formatDateTime(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
