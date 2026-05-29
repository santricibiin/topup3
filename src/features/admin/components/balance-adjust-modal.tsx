"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Wallet,
  X,
  Plus,
  Minus,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { cn, formatIDR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  user: {
    id: string;
    username: string;
    email: string;
    balance: string;
  };
  onClose: () => void;
}

const PRESETS = [10_000, 50_000, 100_000, 500_000, 1_000_000];

/**
 * Modal kelola saldo user — admin bisa tambah (credit) atau kurangi (debit).
 * Submit ke POST /api/admin/users/[id]/balance.
 */
export function BalanceAdjustModal({ user, onClose }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"credit" | "debit">("credit");
  const [rawAmount, setRawAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, loading]);

  const amountNum = Number(rawAmount.replace(/[^\d]/g, ""));
  const valid = amountNum > 0;
  const signed = mode === "credit" ? amountNum : -amountNum;
  const currentBalance = Number(user.balance);
  const newBalance = currentBalance + signed;
  const wouldGoNegative = mode === "debit" && newBalance < 0;

  async function handleSubmit() {
    if (!valid || wouldGoNegative) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: signed,
          description: description.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal");
      toast.success(
        `Saldo ${user.username} ${mode === "credit" ? "bertambah" : "berkurang"} ${formatIDR(amountNum)}`,
      );
      onClose();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Tutup"
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
        onClick={onClose}
        disabled={loading}
      />

      <div className="relative z-10 w-full max-w-md animate-fade-in rounded-2xl border border-border bg-card shadow-2xl">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold tracking-tight">Kelola Saldo</h3>
              <p className="truncate text-xs text-muted-foreground">
                {user.username} · {user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="space-y-5 px-6 py-5">
          {/* Saldo info */}
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Saldo saat ini
            </div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums">
              {formatIDR(user.balance)}
            </div>
          </div>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setMode("credit")}
              disabled={loading}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all",
                mode === "credit"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-card hover:text-foreground",
              )}
            >
              <Plus className="h-4 w-4" />
              Tambah
            </button>
            <button
              type="button"
              onClick={() => setMode("debit")}
              disabled={loading}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all",
                mode === "debit"
                  ? "bg-destructive text-destructive-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-card hover:text-foreground",
              )}
            >
              <Minus className="h-4 w-4" />
              Kurangi
            </button>
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Nominal (Rupiah)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <Input
                type="text"
                inputMode="numeric"
                value={rawAmount}
                onChange={(e) =>
                  setRawAmount(e.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="0"
                className="pl-9 text-lg font-semibold tabular-nums"
                autoFocus
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRawAmount(String(preset))}
                  disabled={loading}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                >
                  +{preset.toLocaleString("id-ID")}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Catatan{" "}
              <span className="font-normal text-muted-foreground">(opsional)</span>
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                mode === "credit"
                  ? "Contoh: Bonus referral, koreksi sistem"
                  : "Contoh: Refund manual, penalty"
              }
              maxLength={200}
              disabled={loading}
            />
          </div>

          {/* Preview */}
          {valid && (
            <div
              className={cn(
                "rounded-lg border p-3 text-xs",
                wouldGoNegative
                  ? "border-destructive/30 bg-destructive/5 text-destructive"
                  : "border-border bg-muted/40",
              )}
            >
              {wouldGoNegative ? (
                <div className="font-medium">
                  Saldo tidak cukup. Saldo saat ini hanya{" "}
                  {formatIDR(user.balance)}.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    Pratinjau perubahan
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 tabular-nums">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Sebelum
                      </span>
                      <span className="text-sm">
                        {formatIDR(currentBalance)}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div
                      className={cn(
                        "flex flex-col text-right",
                        mode === "credit"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive",
                      )}
                    >
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {mode === "credit" ? "+ Tambah" : "− Kurang"}
                      </span>
                      <span className="text-sm font-semibold">
                        {formatIDR(amountNum)}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Setelah
                      </span>
                      <span className="text-sm font-semibold text-primary">
                        {formatIDR(newBalance)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex gap-2 border-t border-border/60 px-6 py-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            variant={mode === "debit" ? "destructive" : "default"}
            className="flex-1"
            onClick={handleSubmit}
            disabled={loading || !valid || wouldGoNegative}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "credit" ? "Tambah" : "Kurangi"} Saldo
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
