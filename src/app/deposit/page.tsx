import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Wallet,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Hourglass,
  Ban,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/navbar";
import { prisma } from "@/lib/prisma";
import { formatIDR } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth";
import { settingsService } from "@/services/settings.service";
import { DepositForm } from "@/features/deposit/components/deposit-form";
import { RelativeTime } from "@/components/ui/relative-time";
import { Pagination } from "@/components/ui/pagination";

export const metadata = { title: "Deposit Saldo" };
export const dynamic = "force-dynamic";

const ALLOWED_PAGE_SIZE = new Set([20, 50, 100, 200]);

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  PENDING: "warning",
  SUCCESS: "success",
  FAILED: "destructive",
  EXPIRED: "secondary",
  CANCELLED: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  SUCCESS: "Berhasil",
  FAILED: "Gagal",
  EXPIRED: "Kadaluarsa",
  CANCELLED: "Dibatalkan",
};

const STATUS_ICON: Record<string, typeof Clock> = {
  PENDING: Clock,
  SUCCESS: CheckCircle2,
  FAILED: XCircle,
  EXPIRED: Hourglass,
  CANCELLED: Ban,
};

interface PageProps {
  searchParams: { page?: string; perPage?: string };
}

export default async function DepositPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rawSize = Number(searchParams.perPage);
  const pageSize = ALLOWED_PAGE_SIZE.has(rawSize) ? rawSize : 20;
  const rawPage = Number(searchParams.page);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const skip = (page - 1) * pageSize;

  const [config, balance, history, totalHistory, activePending] = await Promise.all([
    settingsService.getDepositConfig(),
    prisma.balance.findUnique({ where: { userId: user.id } }),
    prisma.deposit.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.deposit.count({ where: { userId: user.id } }),
    prisma.deposit.findFirst({
      where: {
        userId: user.id,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const balanceStr = balance?.amount.toString() ?? "0";

  return (
    <>
      <Navbar />
      <main className="relative flex-1 overflow-hidden">
        <div className="container max-w-3xl space-y-6 py-6 md:py-10">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Deposit Saldo
            </h1>
            <p className="text-sm text-muted-foreground">
              Top-up saldo via QRIS — verifikasi otomatis &amp; instan.
            </p>
          </div>

          {/* Banner pending deposit (kalau ada) */}
          {activePending && (
            <Link
              href={`/deposit/${activePending.id}`}
              className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 transition-colors hover:bg-amber-500/10"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Clock className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  Deposit menunggu pembayaran
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatIDR(activePending.amount.toString())} · expired{" "}
                  <RelativeTime date={activePending.expiresAt} />
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          )}

          {/* Form deposit */}
          {!config.qrisCode ? (
            <Card>
              <CardContent className="grid place-items-center gap-2 p-12 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-sm font-medium">
                  Deposit belum tersedia
                </div>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Admin belum mengatur metode pembayaran. Hubungi admin untuk
                  bantuan top-up manual.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  Top-up Baru
                </CardTitle>
                <CardDescription>
                  Pilih nominal &mdash; QRIS akan di-generate otomatis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DepositForm
                  min={config.min}
                  max={config.max}
                  expiryMin={config.expiryMin}
                  currentBalance={balanceStr}
                />
              </CardContent>
            </Card>
          )}

          {/* Riwayat */}
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Deposit</CardTitle>
              <CardDescription>
                Total {totalHistory} transaksi &mdash; klik untuk detail
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <div className="grid place-items-center gap-2 px-4 py-12 text-center">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-muted">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-sm font-medium">Belum ada riwayat</div>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    Deposit pertama kamu akan tampil di sini.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {history.map((d) => {
                    const Icon = STATUS_ICON[d.status] ?? Clock;
                    const variant = STATUS_VARIANT[d.status] ?? "secondary";
                    const isPending =
                      d.status === "PENDING" && d.expiresAt > new Date();
                    const isSuccess = d.status === "SUCCESS";

                    return (
                      <li key={d.id}>
                        <Link
                          href={`/deposit/${d.id}`}
                          className="group relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40"
                        >
                          {/* Left status accent stripe */}
                          <span
                            aria-hidden
                            className={`absolute inset-y-2 left-0 w-1 rounded-r-full ${
                              isPending
                                ? "bg-amber-500"
                                : isSuccess
                                  ? "bg-emerald-500"
                                  : d.status === "FAILED"
                                    ? "bg-destructive"
                                    : "bg-border"
                            }`}
                          />

                          <div
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                              isPending
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                : isSuccess
                                  ? "bg-emerald-500/15 text-emerald-500"
                                  : d.status === "FAILED"
                                    ? "bg-destructive/15 text-destructive"
                                    : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold tabular-nums">
                                {formatIDR(d.amount.toString())}
                              </span>
                              <Badge variant={variant}>
                                {STATUS_LABEL[d.status] ?? d.status}
                              </Badge>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                              <RelativeTime date={d.createdAt} />
                              <span aria-hidden>&middot;</span>
                              <span className="font-mono">
                                {d.id.slice(0, 8)}
                              </span>
                              {isPending && (
                                <>
                                  <span aria-hidden>&middot;</span>
                                  <span className="font-medium text-amber-600 dark:text-amber-400">
                                    bayar Rp{" "}
                                    {Number(d.totalAmount).toLocaleString("id-ID")}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}

              {totalHistory > 0 && (
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={totalHistory}
                  shown={history.length}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
