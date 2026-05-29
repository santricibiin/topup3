import Link from "next/link";
import { Wallet, Plus, History } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { prisma } from "@/lib/prisma";
import { slugify, formatIDR } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth";
import { settingsService, SETTING_KEYS } from "@/services/settings.service";
import { categorySettingsService } from "@/services/category-settings.service";
import { TopupSearch } from "@/features/topup/components/topup-search";

export const metadata = { title: "Topup" };
export const dynamic = "force-dynamic";

export default async function TopupCatalogPage() {
  const [user, grouped, categoryMeta, iconSizeRaw, iconShapeRaw, groupedRaw] = await Promise.all([
    getCurrentUser(),
    prisma.product.groupBy({
      by: ["brand", "category"],
      where: { status: "ACTIVE" },
      _count: { _all: true },
      orderBy: [{ category: "asc" }, { brand: "asc" }],
    }),
    categorySettingsService.getVisible(),
    settingsService.get(SETTING_KEYS.TOPUP_ICON_SIZE),
    settingsService.get(SETTING_KEYS.TOPUP_ICON_SHAPE),
    settingsService.get(SETTING_KEYS.TOPUP_GROUPED_LAYOUT),
  ]);

  const iconSize = Math.max(24, Math.min(96, Number(iconSizeRaw) || 56));
  const iconShape: "rounded" | "circle" =
    iconShapeRaw === "circle" ? "circle" : "rounded";
  const groupedLayout = groupedRaw === "true";
  const visibleSet = new Set(categoryMeta.map((c) => c.category));

  // Filter brand: hanya kategori yg visible.
  const brands = grouped
    .filter((g) => visibleSet.has(g.category))
    .map((g) => ({
      brand: g.brand,
      slug: slugify(g.brand),
      category: String(g.category),
      count: g._count._all,
    }));

  const balance = user?.balance?.amount.toString() ?? "0";

  return (
    <>
      <Navbar />
      <main className="relative flex-1 overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5">
        <div className="grid-bg pointer-events-none absolute inset-0 -z-10 opacity-40" aria-hidden />
        <div className="container py-6 md:py-10">
          {/* Saldo box */}
          {user && (
            <div className="mx-auto mb-8 max-w-3xl">
              <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-violet-500/10 p-5 shadow-sm">
                <div
                  className="pointer-events-none absolute inset-0 opacity-60"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 90% 10%, hsl(var(--primary) / 0.15) 0%, transparent 50%)",
                  }}
                  aria-hidden
                />
                <div className="relative flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Saldo · {user.username}
                      </div>
                      <div className="truncate text-xl font-semibold tabular-nums tracking-tight md:text-2xl">
                        {formatIDR(balance)}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href="/transactions"
                      className="hidden items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground sm:inline-flex"
                    >
                      <History className="h-3.5 w-3.5" />
                      Riwayat
                    </Link>
                    <Link
                      href="/deposit"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Topup Saldo
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hero kecil */}
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance font-display text-2xl font-semibold tracking-tight md:text-4xl">
              Topup favoritmu, <span className="text-primary">tanpa antri.</span>
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-balance text-sm text-muted-foreground">
              Lebih dari {brands.length} brand siap pakai — pilih, bayar, token langsung masuk.
            </p>
          </div>

          {/* Search bar besar */}
          <div className="mx-auto mt-6 max-w-3xl">
            <TopupSearch
              brands={brands}
              categoryMeta={categoryMeta}
              iconSize={iconSize}
              iconShape={iconShape}
              groupedLayout={groupedLayout}
            />
          </div>
        </div>
      </main>
    </>
  );
}
