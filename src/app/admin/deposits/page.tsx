import {
  Wallet,
  CheckCircle2,
  Clock,
  TrendingUp,
  Settings,
  ListChecks,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { prisma } from "@/lib/prisma";
import { formatIDR } from "@/lib/utils";
import { settingsService } from "@/services/settings.service";
import { DepositsFilter } from "@/features/admin/components/deposits-filter";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { PaymentSettingsForm } from "@/features/admin/components/payment-settings-form";
import type { DepositStatus } from "@prisma/client";

export const metadata = { title: "Admin · Deposit" };
export const dynamic = "force-dynamic";

const ALLOWED_PAGE_SIZE = new Set([20, 50, 100, 200]);
const VALID_STATUSES = new Set<DepositStatus>([
  "PENDING",
  "SUCCESS",
  "EXPIRED",
  "CANCELLED",
  "FAILED",
]);

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  PENDING: "warning",
  SUCCESS: "success",
  FAILED: "destructive",
  EXPIRED: "secondary",
  CANCELLED: "secondary",
};

interface PageProps {
  searchParams: {
    status?: string;
    q?: string;
    page?: string;
    perPage?: string;
  };
}

export default async function AdminDepositsPage({ searchParams }: PageProps) {
  const statusParam = searchParams.status?.toUpperCase();
  const status =
    statusParam && VALID_STATUSES.has(statusParam as DepositStatus)
      ? (statusParam as DepositStatus)
      : undefined;
  const q = searchParams.q?.trim();

  const rawSize = Number(searchParams.perPage);
  const pageSize = ALLOWED_PAGE_SIZE.has(rawSize) ? rawSize : 20;
  const rawPage = Number(searchParams.page);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const skip = (page - 1) * pageSize;

  const where = {
    ...(status && { status }),
    ...(q && {
      OR: [
        { id: { contains: q } },
        { user: { username: { contains: q } } },
        { user: { email: { contains: q } } },
      ],
    }),
  };

  const [
    items,
    matchedCount,
    totalAll,
    totalPending,
    totalSuccess,
    sumSuccess,
    payment,
  ] = await Promise.all([
    prisma.deposit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        user: { select: { username: true, email: true } },
      },
    }),
    prisma.deposit.count({ where }),
    prisma.deposit.count(),
    prisma.deposit.count({ where: { status: "PENDING" } }),
    prisma.deposit.count({ where: { status: "SUCCESS" } }),
    prisma.deposit.aggregate({
      where: { status: "SUCCESS" },
      _sum: { amount: true },
    }),
    settingsService.getDepositConfig(),
  ]);

  const sumValue = sumSuccess._sum.amount?.toString() ?? "0";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
            <Wallet className="h-6 w-6 text-primary md:h-7 md:w-7" />
            Deposit
          </h1>
          <p className="text-sm text-muted-foreground">
            Pengaturan, provider, dan riwayat deposit dalam satu tempat.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Total Deposit"
          value={totalAll.toLocaleString("id-ID")}
          icon={Wallet}
          tone="text-foreground"
        />
        <Stat
          label="Pending"
          value={totalPending.toLocaleString("id-ID")}
          icon={Clock}
          tone="text-amber-500"
        />
        <Stat
          label="Sukses"
          value={totalSuccess.toLocaleString("id-ID")}
          icon={CheckCircle2}
          tone="text-emerald-500"
        />
        <Stat
          label="Total Diterima"
          value={formatIDR(sumValue)}
          icon={TrendingUp}
          tone="text-primary"
        />
      </div>

      {/* Section 1 — Pengaturan Deposit */}
      <CollapsibleSection
        icon={<Settings className="h-4 w-4" />}
        title="Pengaturan Deposit"
        description="QRIS DANA, secret webhook, dan limit nominal deposit user."
      >
        <PaymentSettingsForm
          initial={{
            qrisCode: payment.qrisCode,
            callbackSecret: payment.callbackSecret
              ? settingsService.mask(payment.callbackSecret)
              : "",
            callbackSecretSet: Boolean(payment.callbackSecret),
            min: payment.min,
            max: payment.max,
            expiryMin: payment.expiryMin,
            danaOwnerName: payment.danaOwnerName,
          }}
        />
      </CollapsibleSection>

      {/* Section 2 — Riwayat */}
      <CollapsibleSection
        icon={<ListChecks className="h-4 w-4" />}
        title="Riwayat Deposit"
        description={`${matchedCount.toLocaleString("id-ID")} deposit cocok filter.`}
        defaultOpen
        badge={
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {totalAll}
          </span>
        }
      >
        <div className="space-y-4">
          <DepositsFilter initialQ={q ?? ""} initialStatus={status ?? "ALL"} />

          <Card>
            <CardContent className="p-0">
              {/* Mobile cards */}
              <ul className="divide-y divide-border md:hidden">
                {items.length === 0 ? (
                  <EmptyState />
                ) : (
                  items.map((d) => (
                    <li key={d.id} className="space-y-2 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-xs text-muted-foreground">
                            {d.id.slice(0, 12)}…
                          </div>
                          <div className="text-sm font-semibold tabular-nums">
                            {formatIDR(d.amount.toString())}
                          </div>
                        </div>
                        <Badge variant={STATUS_VARIANT[d.status] ?? "secondary"}>
                          {d.status}
                        </Badge>
                      </div>

                      <div className="rounded-md bg-muted/40 px-2.5 py-1.5 text-xs">
                        <div className="font-medium">{d.user.username}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {d.user.email}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Total{" "}
                          <span className="font-mono tabular-nums">
                            {formatIDR(d.totalAmount.toString())}
                          </span>
                        </span>
                        <span className="tabular-nums">
                          {new Date(d.createdAt).toLocaleString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </li>
                  ))
                )}
              </ul>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Waktu</th>
                      <th className="px-4 py-3 text-left">ID</th>
                      <th className="px-4 py-3 text-left">User</th>
                      <th className="px-4 py-3 text-right">Nominal</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-left">Metode</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState />
                        </td>
                      </tr>
                    ) : (
                      items.map((d) => (
                        <tr
                          key={d.id}
                          className="transition-colors hover:bg-muted/40"
                        >
                          <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                            {new Date(d.createdAt).toLocaleString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {d.id.slice(0, 12)}…
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div className="font-medium">{d.user.username}</div>
                            <div className="truncate text-muted-foreground">
                              {d.user.email}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">
                            {formatIDR(d.amount.toString())}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                            {formatIDR(d.totalAmount.toString())}
                          </td>
                          <td className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                            {d.method}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_VARIANT[d.status] ?? "secondary"}>
                              {d.status}
                            </Badge>
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
      </CollapsibleSection>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center gap-2 px-4 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Wallet className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium">Belum ada deposit</div>
      <p className="max-w-xs text-xs text-muted-foreground">
        Belum ada deposit yang cocok dengan filter saat ini.
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
  icon: typeof Wallet;
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
