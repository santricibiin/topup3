"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Loader2,
  Minus,
  Power,
  PowerOff,
  Trash2,
  Wand2,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn, formatIDR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  basePrice: string;
  sellPrice: string;
  status: string;
}

interface Props {
  products: ProductRow[];
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "secondary"> = {
  ACTIVE: "success",
  GANGGUAN: "warning",
  INACTIVE: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktif",
  GANGGUAN: "Gangguan",
  INACTIVE: "Nonaktif",
};

export function ProductsTable({ products }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [marginOpen, setMarginOpen] = useState(false);
  const [marginValue, setMarginValue] = useState("500");

  const allSelected = useMemo(
    () => products.length > 0 && selected.size === products.length,
    [products.length, selected.size],
  );
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    if (allSelected || someSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    setBusy("delete");
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal hapus");
      toast.success(`${json.data.deleted} produk dihapus`);
      setSelected(new Set());
      setConfirmDeleteOpen(false);
      start(() => router.refresh());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function bulkSetStatus(status: "ACTIVE" | "INACTIVE" | "GANGGUAN") {
    if (selected.size === 0) return;
    setBusy(`status-${status}`);
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal update");
      toast.success(`${json.data.updated} produk → ${STATUS_LABEL[status]}`);
      setSelected(new Set());
      start(() => router.refresh());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function applyMargin() {
    const marginAdd = Number(marginValue);
    if (!Number.isFinite(marginAdd) || marginAdd === 0) {
      toast.error("Nilai margin tidak valid.");
      return;
    }
    setBusy("margin");
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], marginAdd }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal update");
      toast.success(`${json.data.updated} produk diubah`);
      setSelected(new Set());
      setMarginOpen(false);
      start(() => router.refresh());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const isBusy = busy !== null || pending;

  return (
    <>
      {/* Modal: konfirmasi hapus */}
      <ConfirmModal
        open={confirmDeleteOpen}
        title="Hapus produk?"
        description={
          <div className="space-y-2">
            <p>
              <span className="font-semibold text-foreground">
                {selected.size} produk
              </span>{" "}
              akan dihapus permanen dari katalog.
            </p>
            <p>
              Tindakan ini tidak bisa dibatalkan. Riwayat transaksi yang sudah
              ada tetap aman.
            </p>
          </div>
        }
        confirmLabel={
          busy === "delete" ? "Menghapus..." : `Hapus ${selected.size} produk`
        }
        cancelLabel="Batal"
        variant="destructive"
        loading={busy === "delete"}
        onConfirm={bulkDelete}
        onClose={() => setConfirmDeleteOpen(false)}
      />

      {/* Modal: atur margin (ganti prompt() jelek) */}
      <MarginModal
        open={marginOpen}
        count={selected.size}
        value={marginValue}
        loading={busy === "margin"}
        onChange={setMarginValue}
        onConfirm={applyMargin}
        onClose={() => setMarginOpen(false)}
      />

      {/* Floating action bar — center bottom saat ada selection */}
      {selected.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 md:bottom-6">
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2 shadow-2xl backdrop-blur md:gap-2.5 md:px-4 md:py-2.5">
            <div className="flex items-center gap-2 pl-1 pr-2 md:border-r md:border-border">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums">
                {selected.size}
              </span>
              <span className="hidden text-sm font-medium md:inline">
                terpilih
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <ActionBtn
                onClick={() => bulkSetStatus("ACTIVE")}
                disabled={isBusy}
                icon={Power}
                tone="text-emerald-500"
                label="Aktifkan"
              />
              <ActionBtn
                onClick={() => bulkSetStatus("GANGGUAN")}
                disabled={isBusy}
                icon={AlertTriangle}
                tone="text-amber-500"
                label="Gangguan"
              />
              <ActionBtn
                onClick={() => bulkSetStatus("INACTIVE")}
                disabled={isBusy}
                icon={PowerOff}
                tone="text-muted-foreground"
                label="Nonaktif"
              />
              <ActionBtn
                onClick={() => setMarginOpen(true)}
                disabled={isBusy}
                icon={Wand2}
                tone="text-primary"
                label="Margin"
              />
              <ActionBtn
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={isBusy}
                icon={Trash2}
                tone="text-destructive"
                label="Hapus"
                destructive
              />
            </div>

            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Batalkan pilihan"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile: stacked dengan checkbox di kiri */}
      <ul className="divide-y divide-border md:hidden">
        {products.length === 0 ? (
          <EmptyState />
        ) : (
          products.map((p) => {
            const isSel = selected.has(p.id);
            return (
              <li
                key={p.id}
                onClick={() => toggleOne(p.id)}
                className={cn(
                  "flex cursor-pointer gap-3 px-4 py-3 transition-colors",
                  isSel ? "bg-primary/5" : "hover:bg-muted/30",
                )}
              >
                <CheckIcon checked={isSel} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {p.sku}
                      </div>
                    </div>
                    <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{p.brand}</span>
                    <span>·</span>
                    <span>{p.category}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-xs text-muted-foreground">
                      Modal{" "}
                      <span className="tabular-nums">{formatIDR(p.basePrice)}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-primary">
                      {formatIDR(p.sellPrice)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-12 px-4 py-3">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="grid h-5 w-5 place-items-center"
                  aria-label="Pilih semua"
                >
                  <CheckIcon
                    checked={allSelected}
                    indeterminate={someSelected}
                  />
                </button>
              </th>
              <th className="px-4 py-3 text-left">Produk</th>
              <th className="px-4 py-3 text-left">Brand</th>
              <th className="px-4 py-3 text-left">Kategori</th>
              <th className="px-4 py-3 text-right">Modal</th>
              <th className="px-4 py-3 text-right">Jual</th>
              <th className="px-4 py-3 text-right">Margin</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {products.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState />
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const isSel = selected.has(p.id);
                const margin =
                  Number(p.sellPrice) - Number(p.basePrice);
                return (
                  <tr
                    key={p.id}
                    onClick={() => toggleOne(p.id)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSel
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <td className="px-4 py-3">
                      <CheckIcon checked={isSel} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium leading-tight">{p.name}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {p.sku}
                      </div>
                    </td>
                    <td className="px-4 py-3">{p.brand}</td>
                    <td className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                      {p.category}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatIDR(p.basePrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatIDR(p.sellPrice)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          "tabular-nums text-xs",
                          margin > 0
                            ? "text-emerald-500"
                            : margin < 0
                              ? "text-destructive"
                              : "text-muted-foreground",
                        )}
                      >
                        {margin > 0 ? "+" : ""}
                        {formatIDR(margin)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ActionBtn({
  onClick,
  disabled,
  icon: Icon,
  tone,
  label,
  destructive,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: typeof Trash2;
  tone: string;
  label: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        destructive
          ? "hover:bg-destructive/10"
          : "hover:bg-muted",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", tone)} />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center gap-2 py-16 px-4 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Wand2 className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium">Belum ada produk</div>
      <p className="max-w-xs text-xs text-muted-foreground">
        Klik tombol <strong>Sync dari Digiflazz</strong> di kanan atas untuk menarik
        pricelist provider.
      </p>
    </div>
  );
}

function CheckIcon({
  checked,
  indeterminate,
}: {
  checked: boolean;
  indeterminate?: boolean;
}) {
  if (indeterminate) {
    return (
      <span className="grid h-4 w-4 place-items-center rounded border-2 border-primary bg-primary/20">
        <Minus className="h-2.5 w-2.5 text-primary" />
      </span>
    );
  }
  if (checked) {
    return (
      <span className="grid h-4 w-4 place-items-center rounded border-2 border-primary bg-primary text-primary-foreground">
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="block h-4 w-4 rounded border-2 border-border transition-colors" />
  );
}

/* ========================================================================
 * Margin modal — pretty replacement untuk window.prompt()
 * ====================================================================== */

interface MarginModalProps {
  open: boolean;
  count: number;
  value: string;
  loading: boolean;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

function MarginModal({
  open,
  count,
  value,
  loading,
  onChange,
  onConfirm,
  onClose,
}: MarginModalProps) {
  if (!open) return null;
  const num = Number(value);
  const valid = Number.isFinite(num) && num !== 0;

  return (
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
        <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold tracking-tight">Atur Margin</h3>
              <p className="text-xs text-muted-foreground">
                Tambah / kurangi harga jual {count} produk terpilih.
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

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nilai (Rupiah)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <Input
                type="number"
                inputMode="numeric"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="500"
                className="pl-9 tabular-nums"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Positif untuk menaikkan, negatif untuk menurunkan harga jual.
              Contoh: <code className="rounded bg-muted px-1 py-0.5 text-[10px]">500</code>{" "}
              atau{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">-300</code>.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[100, 500, 1000, -500].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChange(String(preset))}
                disabled={loading}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
              >
                {preset > 0 ? "+" : ""}
                {preset.toLocaleString("id-ID")}
              </button>
            ))}
          </div>

          {valid && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                Akan diterapkan
              </div>
              <p className="mt-1 text-muted-foreground">
                Harga jual {count} produk akan{" "}
                <span
                  className={cn(
                    "font-semibold",
                    num > 0 ? "text-emerald-500" : "text-destructive",
                  )}
                >
                  {num > 0 ? "naik" : "turun"} {formatIDR(Math.abs(num))}
                </span>
                .
              </p>
            </div>
          )}
        </div>

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
            className="flex-1"
            onClick={onConfirm}
            disabled={loading || !valid}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Terapkan
          </Button>
        </div>
      </div>
    </div>
  );
}
