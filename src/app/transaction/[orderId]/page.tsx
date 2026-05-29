import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Clock,
  CreditCard,
  Hash,
  Loader2,
  Receipt,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  Wallet,
  XCircle,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";
import { formatIDR, formatDateTime } from "@/lib/utils";
import { RelativeTime } from "@/components/ui/relative-time";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransactionStatusBadge } from "@/features/transaction/components/status-badge";
import { TransactionPoller } from "@/features/transaction/components/transaction-poller";
import { CopyButton } from "@/features/transaction/components/copy-button";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { orderId: string };
}

export async function generateMetadata({ params }: PageProps) {
  return { title: `Transaksi ${params.orderId}` };
}

const FINAL = new Set(["SUCCESS", "FAILED", "REFUNDED", "EXPIRED", "CANCELLED"]);

function getHero(status: string) {
  switch (status) {
    case "SUCCESS":
      return {
        Icon: CheckCircle2,
        title: "Transaksi sukses",
        sub: "Token / item sudah dikirim ke nomor tujuan.",
        toneCard: "border-emerald-500/30 bg-emerald-500/5",
        toneIcon: "bg-emerald-500/15 text-emerald-500",
      };
    case "FAILED":
      return {
        Icon: XCircle,
        title: "Transaksi gagal",
        sub: "Saldo otomatis dikembalikan jika kamu bayar pakai saldo.",
        toneCard: "border-destructive/30 bg-destructive/5",
        toneIcon: "bg-destructive/15 text-destructive",
      };
    case "EXPIRED":
      return {
        Icon: Clock,
        title: "Transaksi kadaluarsa",
        sub: "Buat order baru jika kamu masih ingin melanjutkan.",
        toneCard: "border-border bg-muted/20",
        toneIcon: "bg-muted text-muted-foreground",
      };
    case "CANCELLED":
      return {
        Icon: XCircle,
        title: "Transaksi dibatalkan",
        sub: "Order ini sudah ditutup.",
        toneCard: "border-border bg-muted/20",
        toneIcon: "bg-muted text-muted-foreground",
      };
    case "REFUNDED":
      return {
        Icon: Wallet,
        title: "Saldo direfund",
        sub: "Saldo sudah dikembalikan ke akunmu.",
        toneCard: "border-border bg-muted/20",
        toneIcon: "bg-emerald-500/15 text-emerald-500",
      };
    case "PROCESSING":
    case "PAID":
      return {
        Icon: Loader2,
        title: "Sedang diproses",
        sub: "Order sudah diteruskan ke provider. Update masuk otomatis.",
        toneCard: "border-amber-500/30 bg-amber-500/5",
        toneIcon: "bg-amber-500/15 text-amber-500 animate-spin-slow",
        spin: true,
      };
    case "PENDING":
    default:
      return {
        Icon: Clock,
        title: "Menunggu pembayaran",
        sub: "Selesaikan pembayaran sebelum waktu kadaluarsa.",
        toneCard: "border-amber-500/30 bg-amber-500/5",
        toneIcon: "bg-amber-500/15 text-amber-500",
      };
  }
}

export default async function TransactionStatusPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tx = await prisma.transaction.findUnique({
    where: { orderId: params.orderId },
    include: {
      user: { select: { username: true, email: true, phone: true } },
    },
  });
  if (!tx || (tx.userId !== user.id && user.role !== "ADMIN")) notFound();

  const isAdminView = user.role === "ADMIN" && tx.userId !== user.id;
  const isFinal = FINAL.has(tx.status);
  const hero = getHero(tx.status);

  return (
    <>
      <Navbar />
      <main className="container flex-1 py-6 md:py-10">
        <div className="mx-auto max-w-2xl space-y-5">
          {/* Admin banner */}
          {isAdminView && (
            <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wider text-primary">
                  Admin View
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  Kamu melihat transaksi milik pengguna lain.
                </div>
              </div>
            </div>
          )}

          {/* Breadcrumb */}
          <Button asChild variant="ghost" size="sm" className="-ml-3 h-8 text-muted-foreground">
            <Link href={isAdminView ? "/admin/transactions" : "/transactions"}>
              <ChevronLeft className="h-4 w-4" />
              {isAdminView ? "Kembali ke admin" : "Riwayat transaksi"}
            </Link>
          </Button>

          {/* Hero status card */}
          <Card className={`overflow-hidden ${hero.toneCard}`}>
            <CardContent className="space-y-4 p-5 md:p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${hero.toneIcon}`}
                >
                  <hero.Icon className={`h-6 w-6 ${hero.spin ? "animate-spin" : ""}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-xl font-semibold tracking-tight md:text-2xl">
                      {hero.title}
                    </h1>
                    <TransactionStatusBadge status={tx.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{hero.sub}</p>
                </div>
              </div>

              {/* Provider message — saat masih on-going atau gagal */}
              {tx.providerMessage && tx.status !== "SUCCESS" && (
                <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Pesan provider: </span>
                  {tx.providerMessage}
                </div>
              )}

              {/* SN / Token (jika sukses) */}
              {tx.providerSn && tx.status === "SUCCESS" && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="h-3 w-3" />
                        Serial Number / Token
                      </div>
                      <div className="mt-1 break-all font-mono text-sm font-semibold">
                        {tx.providerSn}
                      </div>
                    </div>
                    <CopyButton value={tx.providerSn} />
                  </div>
                </div>
              )}

              {/* Action utama saat PENDING */}
              {tx.paymentUrl && tx.status === "PENDING" && (
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <a href={tx.paymentUrl} target="_blank" rel="noopener noreferrer">
                    Lanjut bayar <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Auto-refresh poller */}
          {!isFinal && <TransactionPoller orderId={tx.orderId} />}

          {/* Pemilik transaksi — admin view only */}
          {isAdminView && tx.user && (
            <Card>
              <CardContent className="p-5 md:p-6">
                <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-display font-semibold">Pemilik transaksi</h2>
                </div>
                <dl className="divide-y divide-border/60 text-sm">
                  <Row label="Username" value={tx.user.username} mono />
                  <Row label="Email" value={tx.user.email} copy={tx.user.email} />
                  {tx.user.phone && (
                    <Row label="Telepon" value={tx.user.phone} copy={tx.user.phone} mono />
                  )}
                  <Row label="User ID" value={tx.userId} mono />
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Detail transaksi */}
          <Card>
            <CardContent className="p-5 md:p-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-display font-semibold">Detail transaksi</h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Hash className="h-3 w-3" />
                  <span className="font-mono">{tx.orderId}</span>
                  <CopyButton value={tx.orderId} label="Salin Order ID" />
                </div>
              </div>

              <dl className="divide-y divide-border/60 text-sm">
                <Row label="Produk" value={tx.productName} />
                <Row
                  label="Nomor tujuan"
                  value={tx.customerNo}
                  copy={tx.customerNo}
                  mono
                />
                {tx.customerName && (
                  <Row label="Nama pelanggan" value={tx.customerName} />
                )}
                {tx.periode && <Row label="Periode" value={tx.periode} />}
                {tx.serverId && <Row label="Server / Zone" value={tx.serverId} mono />}

                <Row
                  label="Metode bayar"
                  value={
                    tx.paymentMethod === "BALANCE"
                      ? "Saldo PTopup"
                      : tx.paymentChannel
                        ? `${tx.paymentMethod.replace("DUITKU_", "")} · ${tx.paymentChannel}`
                        : tx.paymentMethod
                  }
                />
                {tx.paymentRef && (
                  <Row label="Referensi" value={tx.paymentRef} copy={tx.paymentRef} mono />
                )}

                <Row
                  label="Dibuat"
                  value={formatDateTime(tx.createdAt)}
                  hint={<RelativeTime date={tx.createdAt} />}
                />
                {tx.paidAt && (
                  <Row
                    label="Dibayar"
                    value={formatDateTime(tx.paidAt)}
                    hint={<RelativeTime date={tx.paidAt} />}
                  />
                )}
                {tx.expiredAt && tx.status === "PENDING" && (
                  <Row
                    label="Kadaluarsa"
                    value={formatDateTime(tx.expiredAt)}
                    hint={<RelativeTime date={tx.expiredAt} />}
                  />
                )}
              </dl>

              {/* Rincian harga — basePrice + adminFee jadi totalAmount */}
              {Number(tx.adminFee) > 0 && (
                <dl className="mt-4 divide-y divide-border/60 rounded-lg border border-border/60 bg-background/40 px-4 text-sm">
                  <Row label="Tagihan" value={formatIDR(tx.basePrice.toString())} />
                  <Row label="Biaya admin" value={formatIDR(tx.adminFee.toString())} />
                </dl>
              )}

              {/* Total */}
              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  Total dibayar
                </div>
                <div className="font-display text-xl font-semibold tabular-nums text-primary">
                  {formatIDR(tx.totalAmount.toString())}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Struk pasca — render inquiryDetail kalau ada */}
          {tx.inquiryDetail && typeof tx.inquiryDetail === "object" && (
            <Card>
              <CardContent className="p-5 md:p-6">
                <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-display font-semibold">Detail tagihan</h2>
                </div>
                <InquiryDetailView data={tx.inquiryDetail as Record<string, unknown>} />
              </CardContent>
            </Card>
          )}

          {/* Bottom actions */}
          <div className="flex flex-wrap gap-2">
            {isAdminView ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/transactions">Kembali ke daftar transaksi</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href="/transactions">Riwayat</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/topup">Topup lagi</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function Row({
  label,
  value,
  hint,
  mono,
  copy,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  mono?: boolean;
  copy?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex max-w-[60%] items-center gap-1.5 text-right">
        <div>
          <div className={`font-medium ${mono ? "tabular-nums font-mono text-xs" : ""}`}>
            {value}
          </div>
          {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
        </div>
        {copy && <CopyButton value={copy} />}
      </dd>
    </div>
  );
}

/**
 * Render struk tagihan pasca dari Digiflazz `desc`.
 * - Field primitif (string/number) → ditampilkan sebagai Row.
 * - Field `detail` (array of object) → tabel ringkas per baris tagihan.
 * - Field nested object lain → tampil compact JSON.
 */
function InquiryDetailView({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  const primitives = entries.filter(
    ([, v]) => v !== null && typeof v !== "object",
  );
  const detail = (data["detail"] as unknown) as
    | Array<Record<string, unknown>>
    | undefined;

  return (
    <>
      {primitives.length > 0 && (
        <dl className="divide-y divide-border/60 text-sm">
          {primitives.map(([k, v]) => (
            <Row key={k} label={prettyLabel(k)} value={String(v)} />
          ))}
        </dl>
      )}

      {Array.isArray(detail) && detail.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Rincian per Periode
          </div>
          <div className="space-y-2">
            {detail.map((row, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/60 bg-background/40 p-3"
              >
                <dl className="divide-y divide-border/40 text-sm">
                  {Object.entries(row).map(([k, v]) => (
                    <Row key={k} label={prettyLabel(k)} value={String(v)} />
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function prettyLabel(key: string): string {
  return key
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
