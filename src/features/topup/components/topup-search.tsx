"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, ArrowLeft } from "lucide-react";
import { CategoryIcon } from "@/components/ui/category-icon";
import { BrandHero } from "./brand-hero";
import { CATEGORY_GROUPS } from "../category-groups";

export interface CategoryMeta {
  category: string;
  label: string;
  iconName: string;
  gradient: string;
  badge: string | null;
  hidden: boolean;
  sortOrder: number;
}

interface BrandItem {
  brand: string;
  slug: string;
  category: string;
  count: number;
}

interface Props {
  brands: BrandItem[];
  categoryMeta: CategoryMeta[];
  iconSize: number;
  iconShape?: "rounded" | "circle";
  groupedLayout?: boolean;
}

export function TopupSearch({ brands, categoryMeta, iconSize, iconShape = "rounded", groupedLayout = false }: Props) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<string | null>(null);

  // Skala turunan
  const scale = iconSize / 56; // 0.43 - 1.71
  const catLabelPx = Math.round(13 * Math.max(0.95, Math.min(scale, 1.25))); // 12-16px

  const brandImgSize = iconSize + 8; // brand img ikut iconSize + sedikit lebih besar
  const brandLabelPx = Math.round(12 * Math.max(0.95, Math.min(scale, 1.25)));

  // Grid columns juga adaptif terhadap iconSize.
  // Default (iconSize=56): 3 col mobile, 4 sm, 5 md.
  // Icon kecil (≤48): 4 col mobile, 5 sm, 6 md → card ikut mengecil.
  // Icon besar (≥72): 2 col mobile, 3 sm, 4 md → card lebih lega.
  const catGridCls =
    iconSize <= 32
      ? "grid-cols-5 sm:grid-cols-6 md:grid-cols-8"
      : iconSize <= 48
        ? "grid-cols-4 sm:grid-cols-5 md:grid-cols-6"
        : iconSize >= 72
          ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
          : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5";

  const brandGridCls =
    iconSize <= 32
      ? "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
      : iconSize <= 48
        ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
        : iconSize >= 72
          ? "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

  const metaByKey = useMemo(() => {
    const m = new Map<string, CategoryMeta>();
    for (const c of categoryMeta) m.set(c.category, c);
    return m;
  }, [categoryMeta]);

  const categoriesWithCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of brands) {
      counts.set(b.category, (counts.get(b.category) ?? 0) + b.count);
    }
    return categoryMeta
      .filter((c) => counts.has(c.category))
      .map((c) => ({ ...c, count: counts.get(c.category)! }));
  }, [brands, categoryMeta]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return brands.filter((b) => {
      const meta = metaByKey.get(b.category);
      if (meta?.hidden) return false;
      if (active && b.category !== active) return false;
      if (!needle) return true;
      const label = meta?.label ?? b.category;
      return (
        b.brand.toLowerCase().includes(needle) ||
        label.toLowerCase().includes(needle)
      );
    });
  }, [brands, q, active, metaByKey]);

  const showBrandGrid = active !== null || q.trim().length > 0;
  const activeMeta = active ? metaByKey.get(active) : null;

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder="Cari game, operator, atau e-wallet…"
          className="h-12 w-full rounded-xl border border-input bg-card pl-11 pr-4 text-sm shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {!showBrandGrid && (
        <div className="space-y-6">
          {groupedLayout ? (
            CATEGORY_GROUPS.map((group) => {
              const groupCats = categoriesWithCount.filter((c) =>
                group.categories.includes(c.category),
              );
              if (groupCats.length === 0) return null;
              return (
                <section
                  key={group.key}
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                >
                  <div className="border-b border-border/60 px-5 py-3.5">
                    <h2 className="text-base font-semibold tracking-tight md:text-lg">
                      {group.label}
                    </h2>
                  </div>
                  <div className={`grid gap-y-4 gap-x-3 p-5 ${catGridCls}`}>
                    {groupCats.map((c) => (
                      <CategoryButton
                        key={c.category}
                        meta={c}
                        iconSize={iconSize}
                        iconShape={iconShape}
                        labelPx={catLabelPx}
                        onClick={() => setActive(c.category)}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          ) : (
            <div>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Pilih Kategori
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Tap kategori untuk lihat brand yang tersedia.
                  </p>
                </div>
              </div>
              <div className={`grid gap-y-4 gap-x-3 ${catGridCls}`}>
                {categoriesWithCount.map((c) => (
                  <CategoryButton
                    key={c.category}
                    meta={c}
                    iconSize={iconSize}
                    iconShape={iconShape}
                    labelPx={catLabelPx}
                    onClick={() => setActive(c.category)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showBrandGrid && (
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setActive(null);
                setQ("");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kategori
            </button>
            <div className="text-right">
              <div className="text-sm font-semibold tracking-tight">
                {activeMeta?.label ?? "Hasil pencarian"}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {filtered.length} brand
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
              Tidak ada brand yang cocok. Coba kata kunci lain.
            </div>
          ) : (
            <div className={`grid gap-y-4 gap-x-3 ${brandGridCls}`}>
              {filtered.map((b) => (
                <Link
                  key={`${b.slug}-${b.category}`}
                  href={`/topup/${b.slug}?category=${b.category}`}
                  className="group relative flex flex-col items-center gap-2 text-center transition-all hover:-translate-y-0.5"
                >
                  <BrandHero
                    brand={b.brand}
                    slug={b.slug}
                    variant="card"
                    size={brandImgSize}
                  />
                  <div
                    className="line-clamp-2 font-medium leading-tight text-foreground"
                    style={{ fontSize: `${brandLabelPx}px` }}
                  >
                    {b.brand}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CategoryButtonProps {
  meta: CategoryMeta & { count: number };
  iconSize: number;
  iconShape: "rounded" | "circle";
  labelPx: number;
  onClick: () => void;
}

function CategoryButton({
  meta,
  iconSize,
  iconShape,
  labelPx,
  onClick,
}: CategoryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-center gap-2 text-center transition-all hover:-translate-y-0.5"
    >
      {meta.badge && (
        <span className="absolute -right-1 -top-1.5 z-10 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive-foreground shadow-md ring-2 ring-background">
          {meta.badge}
        </span>
      )}
      <div
        className={`grid place-items-center bg-gradient-to-br text-white shadow-md ring-1 ring-black/5 transition-shadow group-hover:shadow-lg ${iconShape === "circle" ? "rounded-full" : "rounded-2xl"} ${meta.gradient}`}
        style={{ width: iconSize, height: iconSize }}
      >
        <CategoryIcon name={meta.iconName} className="h-1/2 w-1/2" />
      </div>
      <div
        className="font-medium leading-tight text-foreground"
        style={{ fontSize: `${labelPx}px` }}
      >
        {meta.label}
      </div>
    </button>
  );
}
