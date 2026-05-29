import { redirect } from "next/navigation";
import Link from "next/link";
import { History, Wallet, Zap } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { formatIDR } from "@/lib/utils";
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

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [recent, totals] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: user.id, isInquiryOnly: false },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.transaction.groupBy({
      by: ["status"],
      where: { userId: user.id, isInquiryOnly: false },
      _count: { _all: true },
    }),
  ]);

  const totalTx = totals.reduce((acc, t) => acc + t._count._all, 0);
  const successCount =
    totals.find((t) => t.status === "SUCCESS")?._count._all ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Halo, {user.fullName ?? user.username}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ringkasan akun & aktivitas terakhirmu.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardDescription>Saldo</CardDescription>
              <CardTitle className="mt-1 text-2xl tabular-nums">
                {formatIDR(user.balance?.amount.toString() ?? "0")}
              </CardTitle>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardDescription>Transaksi</CardDescription>
              <CardTitle className="mt-1 text-2xl tabular-nums">
                {totalTx}
              </CardTitle>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
              <History className="h-5 w-5" />
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardDescription>Berhasil</CardDescription>
              <CardTitle className="mt-1 text-2xl tabular-nums">
                {successCount}
              </CardTitle>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Transaksi terbaru</CardTitle>
            <CardDescription>5 order terakhirmu.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/transactions">Lihat semua</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="px-6 pb-6 text-sm text-muted-foreground">
              Belum ada transaksi.{" "}
              <Link href="/topup" className="text-primary hover:underline">
                Mulai topup
              </Link>
              .
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-4 px-6 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Link
                        href={`/transaction/${tx.orderId}`}
                        className="truncate hover:underline"
                      >
                        {tx.productName}
                      </Link>
                      <Badge variant="outline" className="text-[10px]">
                        {tx.orderId}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {tx.customerNo} · {new Date(tx.createdAt).toLocaleString("id-ID")}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatIDR(tx.totalAmount.toString())}
                    </span>
                    <TransactionStatusBadge status={tx.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
