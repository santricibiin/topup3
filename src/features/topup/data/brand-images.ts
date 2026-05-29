/**
 * Map slug brand → URL gambar logo.
 *
 * Saat ini kosong — semua brand fallback ke `BrandAvatar` (gradient inisial).
 * Untuk menambahkan logo manual, tinggal tambahkan entry, contoh:
 *
 *   "axis": { src: "/logos/axis.png", accent: "from-violet-500 to-purple-700" },
 */

export interface BrandImage {
  src: string;
  accent?: string;
}

export const BRAND_IMAGES: Record<string, BrandImage> = {};

/**
 * Lookup logo dengan fallback fuzzy:
 *  1. Exact slug match
 *  2. Slug mengandung salah satu kata kunci dari map
 *  3. null → caller (BrandHero) pakai BrandAvatar gradient inisial
 */
export function getBrandImage(slug: string): BrandImage | null {
  if (!slug) return null;
  const key = slug.toLowerCase();
  if (BRAND_IMAGES[key]) return BRAND_IMAGES[key]!;

  const keys = Object.keys(BRAND_IMAGES).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (key.includes(k)) return BRAND_IMAGES[k]!;
  }
  return null;
}
