import { Card, CardContent } from "@/components/ui/card";
import { Package, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatIDR } from "@/lib/utils";
import { SyncProductsButton } from "@/features/admin/components/sync-products-button";
import { ProductsTable } from "@/features/admin/components/products-table";
import { ProductsFilter } from "@/features/admin/components/products-filter";
import { Pagination } from "@/components/ui/pagination";

export const metadata = { title: "Admin · Produk" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { q?: string; category?: string; page?: string; perPage?: string };
}

const ALLOWED_PAGE_SIZE = new Set([20, 50, 100, 200]);

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const q = searchParams.q?.trim();
  const category = searchParams.category?.trim().toUpperCase();

  // Pagination params
  const rawSize = Number(searchParams.perPage);
  const pageSize = ALLOWED_PAGE_SIZE.has(rawSize) ? rawSize : 20;
  const rawPage = Number(searchParams.page);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const skip = (page - 1) * pageSize;

  const where = {
    ...(q && {
      OR: [
        { name: { contains: q } },
        { sku: { contains: q } },
        { brand: { contains: q } },
      ],
    }),
    ...(category && category !== "ALL" && { category: category as never }),
  } as const;

  const [
    products,
    matchedCount,
    totalAll,
    totalActive,
    totalGangguan,
    totalInactive,
    avgPriceAgg,
  ] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        sku: true,
        name: true,
        brand: true,
        category: true,
        basePrice: true,
        sellPrice: true,
        status: true,
      },
      orderBy: [{ category: "asc" }, { brand: "asc" }, { sellPrice: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.product.count({ where }),
    prisma.product.count(),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.product.count({ where: { status: "GANGGUAN" } }),
    prisma.product.count({ where: { status: "INACTIVE" } }),
    prisma.product.aggregate({
      where: { status: "ACTIVE" },
      _avg: { sellPrice: true },
    }),
  ]);

  const avgPrice = avgPriceAgg._avg.sellPrice
    ? Number(avgPriceAgg._avg.sellPrice).toString()
    : "0";

  const rows = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    category: String(p.category),
    basePrice: p.basePrice.toString(),
    sellPrice: p.sellPrice.toString(),
    status: p.status,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Produk
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola katalog produk &amp; sinkron pricelist Digiflazz.
          </p>
        </div>
        <SyncProductsButton />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Total Produk"
          value={totalAll.toLocaleString("id-ID")}
          icon={Package}
          tone="text-foreground"
        />
        <Stat
          label="Aktif"
          value={totalActive.toLocaleString("id-ID")}
          icon={CheckCircle2}
          tone="text-emerald-500"
        />
        <Stat
          label="Gangguan"
          value={totalGangguan.toLocaleString("id-ID")}
          icon={AlertTriangle}
          tone="text-amber-500"
          subtle={`+ ${totalInactive} nonaktif`}
        />
        <Stat
          label="Rata-rata Harga"
          value={formatIDR(avgPrice)}
          icon={TrendingUp}
          tone="text-primary"
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 md:p-5">
          <ProductsFilter initialQ={q ?? ""} initialCategory={category ?? "ALL"} />

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span>
              Cocok filter:{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {matchedCount.toLocaleString("id-ID")}
              </span>
              {q && (
                <>
                  {" "}untuk{" "}
                  <span className="font-medium text-foreground">"{q}"</span>
                </>
              )}
              {category && category !== "ALL" && (
                <>
                  {" "}di kategori{" "}
                  <span className="font-medium text-foreground">{category}</span>
                </>
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <ProductsTable products={rows} />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={matchedCount}
            shown={rows.length}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "text-foreground",
  subtle,
}: {
  label: string;
  value: string;
  icon: typeof Package;
  tone?: string;
  subtle?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className={`mt-2 text-xl font-semibold tabular-nums ${tone} md:text-2xl`}>
        {value}
      </div>
      {subtle && (
        <div className="mt-0.5 text-[10px] text-muted-foreground">{subtle}</div>
      )}
    </div>
  );
}
