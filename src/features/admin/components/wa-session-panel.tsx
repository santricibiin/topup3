"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  LogOut,
  QrCode,
  RefreshCw,
  Smartphone,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type SessionStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "QR_PENDING"
  | "PAIRING_PENDING"
  | "CONNECTED";

interface SessionInfo {
  status: SessionStatus;
  number: string | null;
  connectedAt: string | null;
  lastError: string | null;
  hasQr: boolean;
  pairingCode: string | null;
  pairPhone: string | null;
}

const POLL_INTERVAL_MS = 2500;

/**
 * Section admin: status sesi WhatsApp + tombol Connect / QR / Disconnect.
 *
 * Polling status tiap 2.5 detik selama dialog QR terbuka atau status non-final.
 * QR di-fetch terpisah saat status `QR_PENDING`.
 */
export function WaSessionPanel() {
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [phone, setPhone] = useState("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/admin/waotp/session/status", {
        cache: "no-store",
      });
      const json = await res.json();
      // worker shape: { ok: true, session: {...} }
      const s = (json?.data?.session ?? null) as SessionInfo | null;
      setInfo(s);
      if (s?.status === "QR_PENDING") {
        await fetchQr();
      } else if (s?.status === "CONNECTED") {
        setQrImage(null);
      }
    } catch (err) {
      // jangan toast tiap tick — biar tidak spam
      // eslint-disable-next-line no-console
      console.warn("status.fail", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchQr() {
    try {
      const res = await fetch("/api/admin/waotp/session/qr", {
        cache: "no-store",
      });
      const json = await res.json();
      const img = (json?.data?.image ?? null) as string | null;
      if (img) setQrImage(img);
    } catch {
      // ignore
    }
  }

  function startPoll() {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => fetchStatus(), POLL_INTERVAL_MS);
  }
  function stopPoll() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  useEffect(() => {
    fetchStatus();
    startPoll();
    return () => stopPoll();
  }, []);

  async function handleConnect() {
    setActing(true);
    try {
      const res = await fetch("/api/admin/waotp/session/start", {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success && json?.data?.error) {
        throw new Error(json.data.error);
      }
      toast.success("Memulai sesi WhatsApp…");
      await fetchStatus();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActing(false);
    }
  }

  async function handlePair() {
    if (!phone.trim()) {
      toast.error("Isi nomor WhatsApp dulu (mis. 08123456789).");
      return;
    }
    setActing(true);
    try {
      const res = await fetch("/api/admin/waotp/session/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json?.data?.error ?? "Gagal minta pairing code.");
      }
      toast.success("Pairing code dibuat. Masukkan di WhatsApp HP.");
      await fetchStatus();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActing(false);
    }
  }

  async function handleDisconnect() {
    if (
      !window.confirm(
        "Yakin keluar dari WhatsApp? Sesi akan diputus & QR baru wajib di-scan ulang.",
      )
    ) {
      return;
    }
    setActing(true);
    try {
      await fetch("/api/admin/waotp/session/logout", { method: "POST" });
      toast.success("Sesi WhatsApp diputus.");
      setQrImage(null);
      await fetchStatus();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActing(false);
    }
  }

  if (loading && !info) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat status sesi…
      </div>
    );
  }

  const status = info?.status ?? "DISCONNECTED";
  const number = info?.number ?? null;

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Status sesi WhatsApp</span>
            <StatusBadge status={status} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {status === "CONNECTED" && number && (
              <>Terhubung: <span className="font-mono">+{number}</span></>
            )}
            {status === "QR_PENDING" && "Scan QR di bawah dengan WhatsApp HP."}
            {status === "PAIRING_PENDING" &&
              "Masukkan pairing code di bawah ke WhatsApp HP."}
            {status === "CONNECTING" && "Sedang menghubungkan…"}
            {status === "DISCONNECTED" &&
              (info?.lastError
                ? `Terputus: ${info.lastError}`
                : "Pilih metode di bawah untuk mulai sesi.")}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {status !== "CONNECTED" && (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={acting || status === "CONNECTING"}
            >
              {acting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Connect
            </Button>
          )}
          {status === "CONNECTED" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDisconnect}
              disabled={acting}
              className="text-destructive hover:bg-destructive/10"
            >
              {acting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Disconnect
            </Button>
          )}
        </div>
      </div>

      {/* QR */}
      {status === "QR_PENDING" && qrImage && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Scan QR ini di WhatsApp
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrImage}
            alt="WhatsApp QR Code"
            className="h-64 w-64 rounded-lg border border-border bg-background"
          />
          <div className="max-w-sm text-center text-xs text-muted-foreground">
            Buka WhatsApp di HP → Settings → Linked Devices → Link a Device →
            arahkan ke QR ini.
          </div>
        </div>
      )}

      {status === "QR_PENDING" && !qrImage && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Generate QR…
        </div>
      )}

      {/* Pairing code aktif — tampilkan kode 8 karakter */}
      {status === "PAIRING_PENDING" && info?.pairingCode && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Pairing code{info?.pairPhone ? ` untuk +${info.pairPhone}` : ""}
          </div>
          <div className="font-mono text-3xl font-bold tracking-[0.3em] text-foreground">
            {info.pairingCode}
          </div>
          <div className="max-w-sm text-center text-xs text-muted-foreground">
            Buka WhatsApp di HP → Settings → Linked Devices → Link a Device →
            <span className="font-semibold"> Link with phone number instead</span>{" "}
            → ketik kode di atas. Kode berlaku beberapa menit.
          </div>
        </div>
      )}

      {/* Metode konek (cuma saat belum terhubung) */}
      {status !== "CONNECTED" && status !== "CONNECTING" && (
        <div className="rounded-lg border border-border p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Hubungkan via Pairing Code{" "}
            <span className="font-normal normal-case">(disarankan untuk VPS)</span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Kalau scan QR gagal terus (umum di server/VPS), pakai pairing code.
            Masukkan nomor WhatsApp lalu ketik kode yang muncul di HP.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="08123456789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={acting}
              className="sm:max-w-xs"
            />
            <Button onClick={handlePair} disabled={acting}>
              {acting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              Minta Pairing Code
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SessionStatus }) {
  if (status === "CONNECTED") {
    return (
      <Badge variant="success" className="gap-1 text-[10px]">
        <CheckCircle2 className="h-3 w-3" />
        CONNECTED
      </Badge>
    );
  }
  if (status === "QR_PENDING") {
    return (
      <Badge variant="warning" className="gap-1 text-[10px]">
        <QrCode className="h-3 w-3" />
        SCAN QR
      </Badge>
    );
  }
  if (status === "PAIRING_PENDING") {
    return (
      <Badge variant="warning" className="gap-1 text-[10px]">
        <Smartphone className="h-3 w-3" />
        PAIRING CODE
      </Badge>
    );
  }
  if (status === "CONNECTING") {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <Loader2 className="h-3 w-3 animate-spin" />
        CONNECTING
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-[10px]">
      <XCircle className="h-3 w-3" />
      DISCONNECTED
    </Badge>
  );
}
