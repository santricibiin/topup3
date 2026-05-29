import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminService } from "@/services/admin.service";
import { formatIDR } from "@/lib/utils";
import {
  Users,
  Package,
  Receipt,
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { SalesChart } from "@/features/admin/components/sales-chart";
import { CategoryChart } from "@/features/admin/components/category-chart";

export const metadata = { title: "Admin Dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [stats, salesChart, categoryChart] = await Promise.all([
    adminService.getDashboardStats(),
    adminService.getSalesChart(14),
    adminService.getCategoryBreakdown(),
  ]);

  const cards = [
    {
      label: "Total Pengguna",
      value: stats.totalUsers.toLocaleString("id-ID"),
      icon: Users,
      tone: "text-sky-500",
    },
    {
      label: "Produk Aktif",
      value: stats.totalProducts.toLocaleString("id-ID"),
      icon: Package,
      tone: "text-violet-500",
    },
    {
      label: "Total Transaksi",
      value: stats.totalTransactions.toLocaleString("id-ID"),
      icon: Receipt,
      tone: "text-amber-500",
    },
    {
      label: "Total Revenue",
      value: formatIDR(stats.totalRevenue),
      icon: Wallet,
      highlight: true,
    },
    {
      label: "Pending / Proses",
      value: stats.pendingCount.toLocaleString("id-ID"),
      icon: Clock,
      tone: "text-amber-500",
    },
    {
      label: "Sukses Hari Ini",
      value: stats.successToday.toLocaleString("id-ID"),
      icon: CheckCircle2,
      tone: "text-emerald-500",
    },
    {
      label: "Gagal Hari Ini",
      value: stats.failedToday.toLocaleString("id-ID"),
      icon: XCircle,
      tone: "text-destructive",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ringkasan operasional platform.
        </p>
      </div>

      {/* PROFIT HIGHLIGHT — full width banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-emerald-500/10 p-5 shadow-sm md:p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 90% 20%, hsl(var(--primary) / 0.25) 0%, transparent 55%)",
          }}
          aria-hidden
        />
        <div className="relative grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg ring-1 ring-black/5">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Total Profit
            </div>
            <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight md:text-4xl">
              {formatIDR(stats.totalProfit)}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>
                Dari{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {stats.totalTransactions.toLocaleString("id-ID")}
                </span>{" "}
                transaksi
              </span>
              <span className="hidden sm:inline">·</span>
              <span>
                Revenue{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {formatIDR(stats.totalRevenue)}
                </span>
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/80 px-4 py-3 backdrop-blur md:min-w-[180px]">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Profit Hari Ini
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-primary md:text-xl">
              {formatIDR(stats.profitToday)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {stats.successToday} tx sukses
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="overflow-hidden">
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
              <CardDescription>{c.label}</CardDescription>
              <c.icon
                className={`h-4 w-4 ${c.tone ?? "text-muted-foreground"}`}
              />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-semibold tabular-nums ${c.highlight ? "text-primary" : ""}`}
              >
                {c.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Grafik Penjualan</CardTitle>
            <CardDescription>
              Revenue harian dari transaksi sukses, 14 hari terakhir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SalesChart data={salesChart} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kategori Terlaris</CardTitle>
            <CardDescription>
              Breakdown revenue berdasarkan kategori produk.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryChart data={categoryChart} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
