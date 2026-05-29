import Link from "next/link";
import {
  ExternalLink,
  ShieldCheck,
  ListChecks,
  TrendingUp,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { formatIDR } from "@/lib/utils";
import { requireAdminPage } from "@/server/admin";
import { TransactionStatusBadge } from "@/features/transaction/components/status-badge";
import { TransactionsFilter } from "@/features/admin/components/transactions-filter";
import { Pagination } from "@/components/ui/pagination";

export const metadata = { title: "Admin · Transaksi" };
export const dynamic = "force-dynamic";

const ALLOWED_PAGE_SIZE = new Set([20, 50, 100, 200]);
const MAX_SEARCH_LENGTH = 64;

interface PageProps {
  searchParams: {
    status?: string;
    q?: string;
    page?: string;
    perPage?: string;
  };
}

export default async function AdminTransactionsPage({ searchParams }: PageProps) {
  // SECURITY: explicit admin guard (jangan andalkan layout/middleware doang).
  await requireAdminPage();

  const status = (searchParams.status ?? "ALL").toUpperCase();
  // SECURITY: cap search query length untuk cegah DoS via long string scan.
  const q = (searchParams.q?.trim() ?? "").slice(0, MAX_SEARCH_LENGTH);

  const rawSize = Number(searchParams.perPage);
  const pageSize = ALLOWED_PAGE_SIZE.has(rawSize) ? rawSize : 20;
  const rawPage = Number(searchParams.page);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const skip = (page - 1) * pageSize;

  const where = {
    // Inquiry pasca yang belum dibayar bukan transaksi real — exclude.
    isInquiryOnly: false,
    ...(status !== "ALL" && { status: status as never }),
    ...(q.length >= 2 && {
      OR: [
        { orderId: { contains: q } },
        { customerNo: { contains: q } },
        { productName: { contains: q } },
        { user: { username: { contains: q } } },
        { user: { email: { contains: q } } },
      ],
    }),
  } as const;

  const [items, matchedCount, totalAll, totalSuccess, totalPending, totalRevenue] =
    await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          user: { select: { username: true, email: true, phone: true } },
        },
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.count({ where: { isInquiryOnly: false } }),
      prisma.transaction.count({ where: { status: "SUCCESS" } }),
      prisma.transaction.count({
        where: {
          status: { in: ["PENDING", "PAID", "PROCESSING"] },
          isInquiryOnly: false,
        },
      }),
      prisma.transaction.aggregate({
        where: { status: "SUCCESS" },
        _sum: { totalAmount: true },
      }),
    ]);

  const revenue = totalRevenue._sum.totalAmount?.toString() ?? "0";

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
            <ShieldCheck className="h-6 w-6 text-primary md:h-7 md:w-7" />
            Transaksi
          </h1>
          <p className="text-sm text-muted-foreground">
            Pantau seluruh transaksi user secara real-time.
          </p>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Total Transaksi"
          value={totalAll.toLocaleString("id-ID")}
          icon={ListChecks}
          tone="text-foreground"
        />
        <Stat
          label="Sukses"
          value={totalSuccess.toLocaleString("id-ID")}
          icon={CheckCircle2}
          tone="text-emerald-500"
        />
        <Stat
          label="Pending / Proses"
          value={totalPending.toLocaleString("id-ID")}
          icon={Clock}
          tone="text-amber-500"
        />
        <Stat
          label="Total Revenue"
          value={formatIDR(revenue)}
          icon={TrendingUp}
          tone="text-primary"
        />
      </div>

      {/* FILTER */}
      <Card>
        <CardContent className="space-y-4 p-4 md:p-5">
          <TransactionsFilter initialQ={q ?? ""} initialStatus={status} />

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
              {status && status !== "ALL" && (
                <>
                  {" "}status{" "}
                  <span className="font-medium text-foreground">{status}</span>
                </>
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* TABLE */}
      <Card>
        <CardContent className="p-0">
          {/* Mobile: stacked cards */}
          <ul className="divide-y divide-border md:hidden">
            {items.length === 0 ? (
              <EmptyState />
            ) : (
              items.map((t) => (
                <li key={t.id} className="space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/transaction/${t.orderId}`}
                      className="flex items-center gap-1 font-mono text-xs font-semibold text-primary hover:underline"
                    >
                      {t.orderId}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <TransactionStatusBadge status={t.status} />
                  </div>
                  <div className="text-sm font-medium">{t.productName}</div>

                  <div className="rounded-md bg-muted/40 px-2.5 py-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{t.user.username}</span>
                      <span className="font-mono text-muted-foreground">
                        {t.customerNo}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {t.user.email}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(t.createdAt).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatIDR(t.totalAmount.toString())}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Waktu</th>
                  <th className="px-4 py-3 text-left">Order ID</th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Produk</th>
                  <th className="px-4 py-3 text-left">Tujuan</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState />
                    </td>
                  </tr>
                ) : (
                  items.map((t) => (
                    <tr key={t.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                        {new Date(t.createdAt).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted-foreground">
                          {t.orderId}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-medium">{t.user.username}</div>
                        <div className="truncate text-muted-foreground">
                          {t.user.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">{t.productName}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {t.customerNo}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatIDR(t.totalAmount.toString())}
                      </td>
                      <td className="px-4 py-3">
                        <TransactionStatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/transaction/${t.orderId}`}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                        >
                          Detail
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={matchedCount}
            shown={items.length}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center gap-2 px-4 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
        <ListChecks className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium">Tidak ada transaksi</div>
      <p className="max-w-xs text-xs text-muted-foreground">
        Belum ada transaksi yang cocok dengan filter saat ini.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  icon: typeof ListChecks;
  tone?: string;
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
    </div>
  );
}
