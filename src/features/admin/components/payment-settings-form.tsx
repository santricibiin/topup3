"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  RotateCcw,
  QrCode,
  Key,
  Clock,
  Wallet,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIDR } from "@/lib/utils";

interface Props {
  initial: {
    qrisCode: string;
    callbackSecret: string; // masked
    callbackSecretSet: boolean;
    min: number;
    max: number;
    expiryMin: number;
    danaOwnerName: string;
  };
}

export function PaymentSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [qrisCode, setQrisCode] = useState(initial.qrisCode);
  const [secret, setSecret] = useState(initial.callbackSecret);
  const [showSecret, setShowSecret] = useState(false);
  const [min, setMin] = useState(String(initial.min));
  const [max, setMax] = useState(String(initial.max));
  const [expiryMin, setExpiryMin] = useState(String(initial.expiryMin));
  const [danaOwnerName, setDanaOwnerName] = useState(initial.danaOwnerName);
  const [saving, setSaving] = useState(false);

  const dirty =
    qrisCode !== initial.qrisCode ||
    (secret !== initial.callbackSecret && !secret.includes("•")) ||
    Number(min) !== initial.min ||
    Number(max) !== initial.max ||
    Number(expiryMin) !== initial.expiryMin ||
    danaOwnerName !== initial.danaOwnerName;

  function reset() {
    setQrisCode(initial.qrisCode);
    setSecret(initial.callbackSecret);
    setMin(String(initial.min));
    setMax(String(initial.max));
    setExpiryMin(String(initial.expiryMin));
    setDanaOwnerName(initial.danaOwnerName);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrisCode: qrisCode.trim(),
          callbackSecret: secret.includes("•") ? "" : secret.trim(),
          min: Number(min),
          max: Number(max),
          expiryMin: Number(expiryMin),
          danaOwnerName: danaOwnerName.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal simpan");
      toast.success("Konfigurasi pembayaran tersimpan");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function generateSecret() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    const hex = [...arr]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    setSecret(hex);
    setShowSecret(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* QRIS Code */}
      <div className="space-y-2">
        <Label htmlFor="qris-code" className="flex items-center gap-1.5">
          <QrCode className="h-3.5 w-3.5 text-muted-foreground" />
          QRIS Statis (EMVCo)
        </Label>
        <textarea
          id="qris-code"
          value={qrisCode}
          onChange={(e) => setQrisCode(e.target.value)}
          placeholder="00020101021126570011ID.DANA.WWW011893..."
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <p className="text-xs text-muted-foreground">
          Salin kode QR statis dari aplikasi DANA Bisnis. Sistem akan
          mengkonversi ke QRIS dinamis (per nominal) saat user request deposit.
        </p>
      </div>

      {/* Callback Secret */}
      <div className="space-y-2">
        <Label htmlFor="callback-secret" className="flex items-center gap-1.5">
          <Key className="h-3.5 w-3.5 text-muted-foreground" />
          Webhook Secret
          {initial.callbackSecretSet && (
            <span className="ml-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              tersimpan
            </span>
          )}
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="callback-secret"
              type={showSecret ? "text" : "password"}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Klik 'Generate' untuk membuat secret baru"
              className="pr-10 font-mono text-xs"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={showSecret ? "Sembunyikan" : "Tampilkan"}
            >
              {showSecret ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generateSecret}
          >
            Generate
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Pakai sebagai header{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
            X-Forwarder-Secret
          </code>{" "}
          di Android Notification Forwarder. Endpoint:{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
            POST /api/webhooks/dana-callback
          </code>
        </p>
      </div>

      {/* Min / Max / Expiry — grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="dep-min" className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
            Minimal (Rp)
          </Label>
          <Input
            id="dep-min"
            type="number"
            inputMode="numeric"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            min={100}
            className="tabular-nums"
          />
          <p className="text-[11px] text-muted-foreground">
            {formatIDR(Number(min) || 0)}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dep-max" className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
            Maksimal (Rp)
          </Label>
          <Input
            id="dep-max"
            type="number"
            inputMode="numeric"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            min={100}
            className="tabular-nums"
          />
          <p className="text-[11px] text-muted-foreground">
            {formatIDR(Number(max) || 0)}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dep-expiry" className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            Expiry (menit)
          </Label>
          <Input
            id="dep-expiry"
            type="number"
            inputMode="numeric"
            value={expiryMin}
            onChange={(e) => setExpiryMin(e.target.value)}
            min={1}
            max={120}
            className="tabular-nums"
          />
          <p className="text-[11px] text-muted-foreground">
            QR berlaku {expiryMin} menit
          </p>
        </div>
      </div>

      {/* Owner DANA */}
      <div className="space-y-2">
        <Label htmlFor="dana-owner">Nama Pemilik DANA (opsional)</Label>
        <Input
          id="dana-owner"
          value={danaOwnerName}
          onChange={(e) => setDanaOwnerName(e.target.value)}
          placeholder="John Doe"
          maxLength={120}
        />
        <p className="text-xs text-muted-foreground">
          Tampil di halaman deposit user sebagai konfirmasi nama penerima.
        </p>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="text-xs text-muted-foreground">
          {dirty ? (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Ada perubahan belum disimpan
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Tersinkron
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {dirty && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reset}
              disabled={saving}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
          <Button type="submit" disabled={saving || !dirty}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan
          </Button>
        </div>
      </div>
    </form>
  );
}
