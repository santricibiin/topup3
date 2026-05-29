"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Hourglass,
  Ban,
  Copy,
  RefreshCw,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { cn, formatIDR } from "@/lib/utils";
import { toast } from "sonner";

interface DepositDTO {
  id: string;
  amount: string;
  uniqueCode: number;
  totalAmount: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED" | "CANCELLED";
  qrisPayload: string | null;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
}

interface Props {
  initial: DepositDTO;
  danaOwnerName: string;
}

const POLL_MS = 2_000;

const STATUS_META = {
  PENDING: {
    label: "Menunggu pembayaran",
    sub: "Scan QR berikut menggunakan aplikasi e-wallet pendukung QRIS.",
    icon: Clock,
    tone: "amber",
    badge: "warning" as const,
  },
  SUCCESS: {
    label: "Pembayaran berhasil",
    sub: "Saldo sudah masuk ke akun kamu.",
    icon: CheckCircle2,
    tone: "emerald",
    badge: "success" as const,
  },
  EXPIRED: {
    label: "QR kadaluarsa",
    sub: "Silakan buat deposit baru.",
    icon: Hourglass,
    tone: "muted",
    badge: "secondary" as const,
  },
  CANCELLED: {
    label: "Deposit dibatalkan",
    sub: "Kamu sudah membatalkan deposit ini.",
    icon: Ban,
    tone: "muted",
    badge: "secondary" as const,
  },
  FAILED: {
    label: "Pembayaran gagal",
    sub: "Coba buat deposit baru atau hubungi admin.",
    icon: XCircle,
    tone: "destructive",
    badge: "destructive" as const,
  },
} as const;

export function DepositDetail({ initial, danaOwnerName }: Props) {
  const router = useRouter();
  const [deposit, setDeposit] = useState(initial);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null); // null saat SSR/first paint → no mismatch
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Generate QR image dari payload
  useEffect(() => {
    if (!deposit.qrisPayload) {
      setQrDataUrl(null);
      return;
    }
    // Kalau payload sudah berupa data URL (PNG base64 dari converter), pakai langsung.
    if (deposit.qrisPayload.startsWith("data:image")) {
      setQrDataUrl(deposit.qrisPayload);
      return;
    }
    // Kalau payload EMVCo string → render via library
    QRCode.toDataURL(deposit.qrisPayload, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [deposit.qrisPayload]);

  // Tick countdown setiap 1s — start setelah mount supaya sinkron client-server.
  useEffect(() => {
    if (deposit.status !== "PENDING") return;
    setNow(Date.now()); // initial set
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deposit.status]);

  // Polling status setiap POLL_MS
  useEffect(() => {
    if (deposit.status !== "PENDING") return;
    let stopped = false;
    async function tick() {
      try {
        const res = await fetch(`/api/deposits/${deposit.id}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!json.success || stopped) return;
        const updated = json.data as DepositDTO;
        if (updated.status !== deposit.status) {
          setDeposit(updated);
          if (updated.status === "SUCCESS") {
            toast.success("Pembayaran diterima!");
            router.refresh();
          } else if (updated.status === "EXPIRED") {
            toast.error("QR kadaluarsa");
          }
        }
      } catch {
        /* abaikan */
      }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [deposit.id, deposit.status, router]);

  const meta = STATUS_META[deposit.status];
  const Icon = meta.icon;
  const expiresAtMs = new Date(deposit.expiresAt).getTime();
  const remainingMs = now === null ? 0 : Math.max(0, expiresAtMs - now);
  const remainingMin = Math.floor(remainingMs / 60_000);
  const remainingSec = Math.floor((remainingMs % 60_000) / 1000);

  async function copyAmount() {
    try {
      await navigator.clipboard.writeText(deposit.totalAmount);
      toast.success("Nominal disalin");
    } catch {
      toast.error("Gagal menyalin");
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/deposits/${deposit.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal");
      toast.success("Deposit dibatalkan");
      router.push("/deposit");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  }

  return (
    <>
      <ConfirmModal
        open={confirmCancel}
        title="Batalkan deposit?"
        description={
          <p>
            Deposit dengan nominal{" "}
            <span className="font-semibold text-foreground">
              {formatIDR(deposit.amount)}
            </span>{" "}
            akan dibatalkan. Kamu bisa buat deposit baru kapan saja.
          </p>
        }
        confirmLabel={cancelling ? "Membatalkan..." : "Ya, batalkan"}
        cancelLabel="Tutup"
        variant="destructive"
        loading={cancelling}
        onConfirm={handleCancel}
        onClose={() => setConfirmCancel(false)}
      />

      <div className="space-y-5">
        {/* HERO STATUS */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border p-5 md:p-6",
            meta.tone === "emerald" &&
              "border-emerald-500/40 bg-emerald-500/5",
            meta.tone === "amber" && "border-amber-500/40 bg-amber-500/5",
            meta.tone === "destructive" &&
              "border-destructive/40 bg-destructive/5",
            meta.tone === "muted" && "border-border bg-muted/30",
          )}
        >
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "grid h-12 w-12 shrink-0 place-items-center rounded-xl",
                meta.tone === "emerald" &&
                  "bg-emerald-500/15 text-emerald-500",
                meta.tone === "amber" && "bg-amber-500/15 text-amber-500",
                meta.tone === "destructive" &&
                  "bg-destructive/15 text-destructive",
                meta.tone === "muted" && "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight md:text-xl">
                  {meta.label}
                </h1>
                <Badge variant={meta.badge}>{deposit.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{meta.sub}</p>

              {deposit.status === "PENDING" && (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-muted-foreground">
                    Memantau pembayaran &middot; sisa{" "}
                    <span
                      className="font-mono font-semibold tabular-nums text-foreground"
                      suppressHydrationWarning
                    >
                      {now === null
                        ? "--:--"
                        : `${String(remainingMin).padStart(2, "0")}:${String(remainingSec).padStart(2, "0")}`}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* QR CODE — hanya saat PENDING */}
        {deposit.status === "PENDING" && (
          <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-violet-500/10 shadow-sm">
            <div className="border-b border-border/60 px-5 py-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Scan QR berikut
              </div>
              {danaOwnerName && (
                <div className="mt-0.5 text-xs font-medium">
                  Tujuan: <span className="text-primary">{danaOwnerName}</span>
                </div>
              )}
            </div>

            {/* QR canvas dengan frame elegant */}
            <div className="grid place-items-center px-5 py-6 md:py-8">
              <div className="relative">
                {/* Glow / gradient ring */}
                <div className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-primary/30 via-primary/10 to-violet-500/30 blur-md" />
                <div className="relative rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/5">
                  {/* Corner brackets - decorative */}
                  <div className="pointer-events-none absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 border-primary rounded-tl-lg" />
                  <div className="pointer-events-none absolute right-2 top-2 h-4 w-4 border-r-2 border-t-2 border-primary rounded-tr-lg" />
                  <div className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                  <div className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-primary rounded-br-lg" />

                  {qrDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={qrDataUrl}
                      alt="QR Pembayaran"
                      className="h-64 w-64 md:h-72 md:w-72"
                    />
                  ) : (
                    <div className="grid h-64 w-64 place-items-center text-muted-foreground md:h-72 md:w-72">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-border/60 bg-card/60 px-5 py-4 backdrop-blur">
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Bayar tepat sebesar{" "}
                  <span className="font-semibold">
                    {formatIDR(deposit.totalAmount)}
                  </span>
                  . 3 digit terakhir adalah kode unik untuk identifikasi
                  pembayaran kamu.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* DETAIL */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border/60 px-5 py-3 text-sm font-semibold">
            Detail Deposit
          </div>
          <dl className="divide-y divide-border/60 text-sm">
            <Row label="Nominal" value={formatIDR(deposit.amount)} bold />
            <Row
              label="Kode unik"
              value={`+${deposit.uniqueCode}`}
              mono
            />
            <Row
              label="Total bayar"
              value={formatIDR(deposit.totalAmount)}
              bold
              highlight
              copy={deposit.totalAmount}
              onCopy={copyAmount}
            />
            <Row label="Metode" value="QRIS" />
            <Row
              label="Dibuat"
              value={new Date(deposit.createdAt).toLocaleString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
            {deposit.paidAt && (
              <Row
                label="Dibayar"
                value={new Date(deposit.paidAt).toLocaleString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            )}
            <Row
              label="ID"
              value={deposit.id}
              mono
              small
            />
          </dl>
        </div>

        {/* ACTIONS */}
        <div className="flex flex-wrap gap-2">
          {deposit.status === "PENDING" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.refresh()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmCancel(true)}
                disabled={cancelling}
              >
                Batalkan deposit
              </Button>
            </>
          )}
          {deposit.status === "SUCCESS" && (
            <Button
              size="sm"
              onClick={() => {
                router.push("/topup");
              }}
            >
              Mulai Topup
            </Button>
          )}
          {(deposit.status === "EXPIRED" ||
            deposit.status === "CANCELLED" ||
            deposit.status === "FAILED") && (
            <Button size="sm" onClick={() => router.push("/deposit")}>
              Buat deposit baru
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  bold,
  mono,
  small,
  highlight,
  copy,
  onCopy,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
  small?: boolean;
  highlight?: boolean;
  copy?: string;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "flex items-center gap-2 text-right tabular-nums",
          mono && "font-mono",
          small && "text-[11px]",
          bold && "font-semibold",
          highlight && "text-primary",
        )}
      >
        {small ? (
          <span className="truncate" title={value}>
            {value}
          </span>
        ) : (
          <span>{value}</span>
        )}
        {copy && onCopy && (
          <button
            type="button"
            onClick={onCopy}
            aria-label={`Salin ${label}`}
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </dd>
    </div>
  );
}
