/**
 * Category Settings Service — kustomisasi tampilan kategori topup.
 * Default value berasal dari constant in-app; admin bisa override per kategori.
 *
 * Cache 30 detik untuk mengurangi query.
 */
import { ProductCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface CategoryConfig {
  category: ProductCategory;
  label: string;
  iconName: string;
  gradient: string;
  badge: string | null;
  hidden: boolean;
  sortOrder: number;
}

/**
 * Default value untuk tiap kategori. Disinkronkan dengan UI fallback
 * di topup-search.tsx supaya output konsisten kalau admin belum override.
 *
 * Default icon pakai Iconify (Solar bold-duotone) untuk visual yang lebih kaya.
 * Format: "solar:icon-name-bold-duotone" — auto-resolved oleh CategoryIcon component.
 */
export const DEFAULT_CATEGORY_CONFIG: Record<ProductCategory, Omit<CategoryConfig, "category">> = {
  PULSA: { label: "Pulsa", iconName: "solar:smartphone-2-bold-duotone", gradient: "from-emerald-500 to-teal-600", badge: null, hidden: false, sortOrder: 10 },
  DATA: { label: "Paket Data", iconName: "solar:wi-fi-router-bold-duotone", gradient: "from-sky-500 to-blue-600", badge: null, hidden: false, sortOrder: 20 },
  PAKET_SMS_TELPON: { label: "SMS & Telpon", iconName: "solar:phone-calling-bold-duotone", gradient: "from-teal-500 to-emerald-700", badge: null, hidden: false, sortOrder: 30 },
  MASA_AKTIF: { label: "Masa Aktif", iconName: "solar:calendar-mark-bold-duotone", gradient: "from-orange-500 to-rose-600", badge: null, hidden: false, sortOrder: 40 },
  AKTIVASI_VOUCHER: { label: "Aktivasi Voucher", iconName: "solar:ticket-sale-bold-duotone", gradient: "from-cyan-500 to-sky-700", badge: null, hidden: false, sortOrder: 50 },
  PLN: { label: "Token PLN", iconName: "solar:bolt-bold-duotone", gradient: "from-amber-500 to-orange-600", badge: null, hidden: false, sortOrder: 60 },
  EWALLET: { label: "E-Wallet", iconName: "solar:wallet-money-bold-duotone", gradient: "from-violet-500 to-purple-600", badge: null, hidden: false, sortOrder: 70 },
  GAME: { label: "Game", iconName: "solar:gameboy-bold-duotone", gradient: "from-fuchsia-500 to-pink-600", badge: null, hidden: false, sortOrder: 80 },
  VOUCHER: { label: "Voucher", iconName: "solar:gift-bold-duotone", gradient: "from-rose-500 to-red-600", badge: null, hidden: false, sortOrder: 90 },
  STREAMING: { label: "Streaming", iconName: "solar:tv-bold-duotone", gradient: "from-indigo-500 to-blue-700", badge: null, hidden: false, sortOrder: 100 },
  TV_KABEL: { label: "TV Kabel", iconName: "solar:tv-bold-duotone", gradient: "from-blue-500 to-violet-700", badge: null, hidden: false, sortOrder: 110 },
  GAS: { label: "Gas", iconName: "solar:fire-bold-duotone", gradient: "from-red-500 to-orange-700", badge: null, hidden: false, sortOrder: 120 },
  BPJS: { label: "BPJS", iconName: "solar:health-bold-duotone", gradient: "from-emerald-500 to-green-700", badge: null, hidden: false, sortOrder: 130 },
  ASURANSI: { label: "Asuransi", iconName: "solar:shield-check-bold-duotone", gradient: "from-blue-500 to-indigo-700", badge: null, hidden: false, sortOrder: 140 },
  PDAM: { label: "PDAM", iconName: "solar:water-bold-duotone", gradient: "from-sky-500 to-cyan-700", badge: null, hidden: false, sortOrder: 150 },
  TRANSPORTASI: { label: "Transportasi", iconName: "solar:bus-bold-duotone", gradient: "from-amber-500 to-yellow-700", badge: null, hidden: false, sortOrder: 160 },
  SEMBAKO: { label: "Sembako", iconName: "solar:bag-2-bold-duotone", gradient: "from-lime-500 to-green-700", badge: null, hidden: false, sortOrder: 170 },
  PASCABAYAR: { label: "Pascabayar", iconName: "solar:document-text-bold-duotone", gradient: "from-slate-500 to-slate-700", badge: null, hidden: false, sortOrder: 180 },
  OTHER: { label: "Lainnya", iconName: "solar:widget-bold-duotone", gradient: "from-zinc-500 to-zinc-700", badge: null, hidden: false, sortOrder: 999 },
};

/**
 * Pengelompokan kategori untuk layout "Box Section" di halaman /topup.
 * Definisi sebenarnya ada di modul pure `@/features/topup/category-groups`
 * (tanpa dependensi prisma) supaya aman di-import dari client component juga.
 * Di-re-export di sini untuk kemudahan akses dari layer service.
 */
export {
  CATEGORY_GROUPS,
  CATEGORY_TO_GROUP,
  type CategoryGroup,
} from "@/features/topup/category-groups";

const TTL_MS = 30_000;
let cache: { data: CategoryConfig[]; ts: number } | null = null;

class CategorySettingsService {
  /** List semua kategori dengan setting yg sudah di-merge dari DB. */
  async getAll(): Promise<CategoryConfig[]> {
    if (cache && Date.now() - cache.ts < TTL_MS) {
      return cache.data;
    }
    const rows = await prisma.categorySetting.findMany();
    const overrides = new Map<ProductCategory, typeof rows[number]>();
    for (const r of rows) overrides.set(r.category, r);

    const all: CategoryConfig[] = (Object.keys(DEFAULT_CATEGORY_CONFIG) as ProductCategory[]).map((cat) => {
      const def = DEFAULT_CATEGORY_CONFIG[cat];
      const ovr = overrides.get(cat);
      return {
        category: cat,
        label: ovr?.label || def.label,
        iconName: ovr?.iconName || def.iconName,
        gradient: ovr?.gradient || def.gradient,
        badge: ovr?.badge ?? def.badge,
        hidden: ovr?.hidden ?? def.hidden,
        sortOrder: ovr?.sortOrder ?? def.sortOrder,
      };
    });
    all.sort((a, b) => a.sortOrder - b.sortOrder);
    cache = { data: all, ts: Date.now() };
    return all;
  }

  /** List kategori yg dihandle untuk user (filter hidden). */
  async getVisible(): Promise<CategoryConfig[]> {
    const all = await this.getAll();
    return all.filter((c) => !c.hidden);
  }

  /** Update setting per kategori. */
  async update(
    category: ProductCategory,
    data: {
      label?: string | null;
      iconName?: string | null;
      gradient?: string | null;
      badge?: string | null;
      hidden?: boolean;
      sortOrder?: number;
    },
  ): Promise<void> {
    await prisma.categorySetting.upsert({
      where: { category },
      create: {
        category,
        label: data.label ?? null,
        iconName: data.iconName ?? null,
        gradient: data.gradient ?? null,
        badge: data.badge ?? null,
        hidden: data.hidden ?? false,
        sortOrder: data.sortOrder ?? DEFAULT_CATEGORY_CONFIG[category].sortOrder,
      },
      update: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.iconName !== undefined && { iconName: data.iconName }),
        ...(data.gradient !== undefined && { gradient: data.gradient }),
        ...(data.badge !== undefined && { badge: data.badge }),
        ...(data.hidden !== undefined && { hidden: data.hidden }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
    this.invalidate();
  }

  /** Reset 1 kategori ke default (hapus row override). */
  async reset(category: ProductCategory): Promise<void> {
    await prisma.categorySetting.deleteMany({ where: { category } });
    this.invalidate();
  }

  invalidate(): void {
    cache = null;
  }
}

export const categorySettingsService = new CategorySettingsService();
