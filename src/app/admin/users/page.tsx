import {
  Users,
  UserCheck,
  UserCog,
  Wallet,
  Crown,
  Mail,
  Phone,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { formatIDR } from "@/lib/utils";
import { UsersFilter } from "@/features/admin/components/users-filter";
import { BalanceAdjustButton } from "@/features/admin/components/balance-adjust-button";
import { Pagination } from "@/components/ui/pagination";

export const metadata = { title: "Admin · Pengguna" };
export const dynamic = "force-dynamic";

const ALLOWED_PAGE_SIZE = new Set([20, 50, 100, 200]);

const ROLE_VARIANT: Record<string, "success" | "warning" | "secondary"> = {
  ADMIN: "warning",
  RESELLER: "success",
  USER: "secondary",
};

interface PageProps {
  searchParams: { q?: string; role?: string; page?: string; perPage?: string };
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const q = searchParams.q?.trim();
  const roleFilter = searchParams.role?.trim().toUpperCase();

  const rawSize = Number(searchParams.perPage);
  const pageSize = ALLOWED_PAGE_SIZE.has(rawSize) ? rawSize : 20;
  const rawPage = Number(searchParams.page);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const skip = (page - 1) * pageSize;

  // Build where clause
  const where = {
    ...(q && {
      OR: [
        { username: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
      ],
    }),
    ...(roleFilter === "USER" && { role: "USER" as const }),
    ...(roleFilter === "RESELLER" && { role: "RESELLER" as const }),
    ...(roleFilter === "ADMIN" && { role: "ADMIN" as const }),
    ...(roleFilter === "SUSPENDED" && { status: "SUSPENDED" as const }),
    ...(roleFilter === "BANNED" && { status: "BANNED" as const }),
  };

  const [
    users,
    matchedCount,
    totalUsers,
    totalAdmin,
    totalReseller,
    balanceAgg,
  ] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        balance: true,
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "RESELLER" } }),
    prisma.balance.aggregate({ _sum: { amount: true } }),
  ]);

  const totalBalance = balanceAgg._sum.amount?.toString() ?? "0";

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
            <Users className="h-6 w-6 text-primary md:h-7 md:w-7" />
            Pengguna
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola akun user, role, dan saldo platform.
          </p>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Total Pengguna"
          value={totalUsers.toLocaleString("id-ID")}
          icon={UserCheck}
          tone="text-foreground"
        />
        <Stat
          label="Reseller"
          value={totalReseller.toLocaleString("id-ID")}
          icon={Crown}
          tone="text-emerald-500"
        />
        <Stat
          label="Admin"
          value={totalAdmin.toLocaleString("id-ID")}
          icon={UserCog}
          tone="text-amber-500"
        />
        <Stat
          label="Total Saldo"
          value={formatIDR(totalBalance)}
          icon={Wallet}
          tone="text-primary"
        />
      </div>

      {/* FILTER */}
      <Card>
        <CardContent className="space-y-4 p-4 md:p-5">
          <UsersFilter initialQ={q ?? ""} initialRole={roleFilter ?? "ALL"} />

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
              {roleFilter && roleFilter !== "ALL" && (
                <>
                  {" "}role{" "}
                  <span className="font-medium text-foreground">{roleFilter}</span>
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
            {users.length === 0 ? (
              <EmptyState />
            ) : (
              users.map((u) => (
                <li key={u.id} className="space-y-2.5 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Avatar username={u.username} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {u.username}
                        </span>
                        <Badge variant={ROLE_VARIANT[u.role] ?? "secondary"}>
                          {u.role}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {u.email}
                      </div>
                      {u.phone && (
                        <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {u.phone}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Saldo
                      </div>
                      <div className="font-semibold tabular-nums text-primary">
                        {formatIDR(u.balance?.amount.toString() ?? "0")}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Tx
                      </div>
                      <div className="font-semibold tabular-nums">
                        {u._count.transactions}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Status
                      </div>
                      <div className="text-xs font-medium">{u.status}</div>
                    </div>
                  </div>

                  <BalanceAdjustButton
                    variant="text"
                    user={{
                      id: u.id,
                      username: u.username,
                      email: u.email,
                      balance: u.balance?.amount.toString() ?? "0",
                    }}
                  />

                  <div className="text-right text-[10px] text-muted-foreground tabular-nums">
                    Bergabung{" "}
                    {new Date(u.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
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
                  <th className="px-4 py-3 text-left">Pengguna</th>
                  <th className="px-4 py-3 text-left">Kontak</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-right">Transaksi</th>
                  <th className="px-4 py-3 text-left">Bergabung</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState />
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar username={u.username} small />
                          <div className="min-w-0">
                            <div className="font-medium leading-tight">
                              {u.username}
                            </div>
                            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                              {u.id.slice(0, 8)}…
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="truncate">{u.email}</div>
                        {u.phone && (
                          <div className="text-muted-foreground">{u.phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ROLE_VARIANT[u.role] ?? "secondary"}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium ${
                            u.status === "ACTIVE"
                              ? "text-emerald-500"
                              : "text-muted-foreground"
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-primary">
                        {formatIDR(u.balance?.amount.toString() ?? "0")}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {u._count.transactions}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                        {new Date(u.createdAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <BalanceAdjustButton
                          user={{
                            id: u.id,
                            username: u.username,
                            email: u.email,
                            balance: u.balance?.amount.toString() ?? "0",
                          }}
                        />
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
            shown={users.length}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Avatar({ username, small }: { username: string; small?: boolean }) {
  const initials = username.slice(0, 2).toUpperCase();
  // Hash sederhana → palette gradient.
  const hash = [...username].reduce((s, c) => s + c.charCodeAt(0), 0);
  const gradients = [
    "from-emerald-500 to-teal-600",
    "from-sky-500 to-blue-600",
    "from-violet-500 to-purple-600",
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
    "from-cyan-500 to-sky-600",
  ];
  const grad = gradients[hash % gradients.length];

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold text-white shadow-sm ring-1 ring-black/5 ${grad} ${
        small ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs"
      }`}
    >
      {initials}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center gap-2 px-4 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Users className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium">Tidak ada pengguna</div>
      <p className="max-w-xs text-xs text-muted-foreground">
        Belum ada user yang cocok dengan filter saat ini.
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
  icon: typeof Users;
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
