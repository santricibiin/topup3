import Link from "next/link";
import { redirect } from "next/navigation";
import { TransactionStatus, Prisma } from "@prisma/client";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  ListChecks,
  Loader2,
  Receipt,
  Search,
  XCircle,
} from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { formatIDR, formatDateTime } from "@/lib/utils";
import { RelativeTime } from "@/components/ui/relative-time";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransactionStatusBadge } from "@/features/transaction/components/status-badge";
import { Pagination } from "@/components/ui/pagination";

export const metadata = { title: "Riwayat Transaksi" };
export const dynamic = "force-dynamic";

const ALLOWED_PAGE_SIZE = new Set([20, 50, 100, 200]);

const STATUS_FILTERS = [
  { key: "ALL", label: "Semua" },
  { key: "PENDING", label: "Menunggu" },
  { key: "PROCESSING", label: "Diproses" },
  { key: "SUCCESS", label: "Sukses" },
  { key: "FAILED", label: "Gagal" },
] as const;

type FilterKey = (typeof STATUS_FILTERS)[number]["key"];

interface PageProps {
  searchParams: { status?: string; q?: string; page?: string; perPage?: string };
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const filter = ((searchParams.status ?? "ALL").toUpperCase() as FilterKey) ?? "ALL";
  const q = searchParams.q?.trim() ?? "";
  const rawSize = Number(searchParams.perPage);
  const pageSize = ALLOWED_PAGE_SIZE.has(rawSize) ? rawSize : 20;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const where: Prisma.TransactionWhereInput = {
    userId: user.id,
    // Inquiry pasca yang belum dibayar (atau gagal di tahap inquiry)
    // tidak masuk riwayat — itu cuma cek tagihan, bukan transaksi.
    isInquiryOnly: false,
    ...(filter === "PENDING" && {
      status: { in: [TransactionStatus.PENDING, TransactionStatus.PAID] },
    }),
    ...(filter === "PROCESSING" && { status: TransactionStatus.PROCESSING }),
    ...(filter === "SUCCESS" && { status: TransactionStatus.SUCCESS }),
    ...(filter === "FAILED" && {
      status: {
        in: [
          TransactionStatus.FAILED,
          TransactionStatus.EXPIRED,
          TransactionStatus.CANCELLED,
          TransactionStatus.REFUNDED,
        ],
      },
    }),
    ...(q && {
      OR: [
        { orderId: { contains: q } },
        { customerNo: { contains: q } },
        { productName: { contains: q } },
      ],
    }),
  };

  // Stats: hitung sekali tanpa filter user
  const [statsRaw, total, txs] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["status"],
      where: { userId: user.id, isInquiryOnly: false },
      _count: true,
      _sum: { totalAmount: true },
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const stats = {
    total: statsRaw.reduce((a, s) => a + s._count, 0),
    success: statsRaw.find((s) => s.status === "SUCCESS")?._count ?? 0,
    successAmount: Number(
      statsRaw.find((s) => s.status === "SUCCESS")?._sum.totalAmount ?? 0,
    ),
    pending:
      (statsRaw.find((s) => s.status === "PENDING")?._count ?? 0) +
      (statsRaw.find((s) => s.status === "PAID")?._count ?? 0) +
      (statsRaw.find((s) => s.status === "PROCESSING")?._count ?? 0),
    failed:
      (statsRaw.find((s) => s.status === "FAILED")?._count ?? 0) +
      (statsRaw.find((s) => s.status === "EXPIRED")?._count ?? 0) +
      (statsRaw.find((s) => s.status === "CANCELLED")?._count ?? 0),
  };

  const buildHref = (next: Partial<{ status: string; q: string; page: number }>) => {
    const params = new URLSearchParams();
    const s = next.status ?? filter;
    if (s && s !== "ALL") params.set("status", s);
    const qq = next.q ?? q;
    if (qq) params.set("q", qq);
    const p = next.page ?? page;
    if (p && p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/transactions?${qs}` : "/transactions";
  };

  const STAT_CARDS = [
    { label: "Total transaksi", value: stats.total.toString(), icon: ListChecks },
    {
      label: "Total sukses",
      value: formatIDR(stats.successAmount),
      icon: CheckCircle2,
      tone: "success" as const,
    },
    { label: "Menunggu / proses", value: stats.pending.toString(), icon: Loader2 },
    { label: "Gagal / kadaluarsa", value: stats.failed.toString(), icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
            Riwayat Transaksi
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Semua aktivitas topup &amp; pembayaranmu, dipantau real-time.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/topup">
            Topup baru <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                  c.tone === "success"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-primary/10 text-primary"
                }`}
              >
                <c.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </div>
                <div className="mt-0.5 truncate font-display text-lg font-semibold tabular-nums">
                  {c.value}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter + Search */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <form action="/transactions" method="get" className="flex flex-wrap items-center gap-2">
            {filter !== "ALL" && <input type="hidden" name="status" value={filter} />}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Cari order ID, nomor tujuan, atau produk…"
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button type="submit" size="sm" className="h-10">
              Cari
            </Button>
            {(q || filter !== "ALL") && (
              <Button asChild type="button" size="sm" variant="ghost" className="h-10">
                <Link href="/transactions">Reset</Link>
              </Button>
            )}
          </form>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Link
                  key={f.key}
                  href={buildHref({ status: f.key, page: 1 })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {txs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-base">Belum ada transaksi</CardTitle>
            <CardDescription className="max-w-sm">
              {q || filter !== "ALL"
                ? "Tidak ada transaksi yang cocok dengan filter ini. Coba reset filter."
                : "Mulai topup pulsa, paket data, atau game favoritmu sekarang."}
            </CardDescription>
            <Button asChild size="sm" className="mt-2">
              <Link href="/topup">
                Mulai topup <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60">
              {txs.map((tx) => {
                const isProcessing =
                  tx.status === "PROCESSING" || tx.status === "PAID";
                const isPending = tx.status === "PENDING";
                return (
                  <li key={tx.id}>
                    <Link
                      href={`/transaction/${tx.orderId}`}
                      className="flex items-start gap-4 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-6"
                    >
                      <div
                        className={`mt-1 hidden h-10 w-10 shrink-0 place-items-center rounded-lg sm:grid ${
                          tx.status === "SUCCESS"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : tx.status === "FAILED" ||
                                tx.status === "EXPIRED" ||
                                tx.status === "CANCELLED"
                              ? "bg-destructive/10 text-destructive"
                              : isProcessing
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {tx.status === "SUCCESS" ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : tx.status === "FAILED" ||
                          tx.status === "EXPIRED" ||
                          tx.status === "CANCELLED" ? (
                          <XCircle className="h-5 w-5" />
                        ) : isProcessing ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Clock className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">
                              {tx.productName}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              <span className="font-mono">{tx.customerNo}</span>
                              <span aria-hidden>·</span>
                              <span
                                className="font-mono text-[11px]"
                                title={tx.orderId}
                              >
                                {tx.orderId}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-display text-base font-semibold tabular-nums">
                              {formatIDR(tx.totalAmount.toString())}
                            </div>
                            <div className="mt-1 flex justify-end">
                              <TransactionStatusBadge status={tx.status} />
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span title={formatDateTime(tx.createdAt)}>
                            <RelativeTime date={tx.createdAt} />
                          </span>
                          <span aria-hidden>·</span>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {tx.paymentMethod === "BALANCE"
                              ? "Saldo"
                              : tx.paymentChannel ?? tx.paymentMethod}
                          </Badge>
                          {isPending && tx.paymentUrl && (
                            <Badge variant="warning" className="text-[10px]">
                              Belum dibayar
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {total > 0 && (
        <Card>
          <CardContent className="p-0">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              shown={txs.length}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
