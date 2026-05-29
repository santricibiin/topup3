"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Wallet, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIDR } from "@/lib/utils";

interface Props {
  min: number;
  max: number;
  expiryMin: number;
  currentBalance: string;
}

const PRESETS = [20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000];

/**
 * Form input nominal deposit. Setelah submit:
 *  - sistem generate uniqueCode (3 digit) → totalAmount
 *  - QRIS dinamis di-generate
 *  - redirect ke /deposit/[id] yg menampilkan QR + countdown
 */
export function DepositForm({ min, max, expiryMin, currentBalance }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const num = Number(amount.replace(/[^\d]/g, ""));
  const valid = num >= min && num <= max;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      toast.error(
        num < min
          ? `Minimal deposit ${formatIDR(min)}`
          : `Maksimal deposit ${formatIDR(max)}`,
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal");
      router.push(`/deposit/${json.data.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Saldo saat ini */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-gradient-to-br from-primary/10 via-card to-violet-500/5 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Saldo saat ini
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {formatIDR(currentBalance)}
            </div>
          </div>
        </div>
      </div>

      {/* Amount input */}
      <div className="space-y-2">
        <Label htmlFor="amount">Nominal Deposit</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
            Rp
          </span>
          <Input
            id="amount"
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
            className="h-12 pl-9 text-lg font-semibold tabular-nums"
            autoFocus
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Min {formatIDR(min)} · Max {formatIDR(max)}
        </p>
      </div>

      {/* Quick presets */}
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.filter((p) => p >= min && p <= max).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(String(p))}
            className={`rounded-lg border px-3 py-2.5 text-sm font-semibold tabular-nums transition-all ${
              num === p
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/50"
            }`}
          >
            {formatIDR(p)}
          </button>
        ))}
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        QR akan berlaku <span className="font-medium text-foreground">{expiryMin} menit</span>.
        Sistem otomatis verifikasi pembayaran kamu.
      </div>

      <Button
        type="submit"
        disabled={loading || !valid}
        size="lg"
        className="w-full"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Lanjutkan
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}
