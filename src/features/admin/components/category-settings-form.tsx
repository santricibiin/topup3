"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Sparkles,
  Maximize,
  Minimize,
  Tags,
  Square,
  Circle,
  Palette,
  Wand2,
  LayoutGrid,
  LayoutPanelTop,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryIcon } from "@/components/ui/category-icon";
import { cn } from "@/lib/utils";

export interface CategoryRow {
  category: string;
  label: string;
  iconName: string;
  gradient: string;
  badge: string | null;
  hidden: boolean;
  sortOrder: number;
}

export type IconShape = "rounded" | "circle";

interface Props {
  initialItems: CategoryRow[];
  initialIconSize: number;
  initialIconShape: IconShape;
  initialGroupedLayout: boolean;
}

const PRESET_GRADIENTS = [
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-600",
  "from-violet-500 to-purple-600",
  "from-fuchsia-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-red-600",
  "from-indigo-500 to-blue-700",
  "from-cyan-500 to-sky-700",
  "from-teal-500 to-emerald-700",
  "from-orange-500 to-rose-600",
  "from-blue-500 to-violet-700",
  "from-red-500 to-orange-700",
  "from-emerald-500 to-green-700",
  "from-blue-500 to-indigo-700",
  "from-amber-500 to-yellow-700",
  "from-lime-500 to-green-700",
  "from-slate-500 to-slate-700",
  "from-zinc-500 to-zinc-700",
];

const ICON_SUGGESTIONS = [
  // Lucide (legacy / netral)
  "Smartphone",
  "Wifi",
  "Phone",
  "Wallet",
  "Gamepad2",
  "Zap",
  "Tv",
  "Receipt",
  // Iconify - Solar bold-duotone (modern, kaya warna)
  "solar:phone-calling-bold-duotone",
  "solar:wi-fi-router-bold-duotone",
  "solar:smartphone-2-bold-duotone",
  "solar:wallet-money-bold-duotone",
  "solar:gameboy-bold-duotone",
  "solar:bolt-bold-duotone",
  "solar:tv-bold-duotone",
  "solar:gift-bold-duotone",
  "solar:ticket-sale-bold-duotone",
  "solar:calendar-mark-bold-duotone",
  "solar:bag-2-bold-duotone",
  "solar:cup-hot-bold-duotone",
  "solar:document-text-bold-duotone",
  "solar:bus-bold-duotone",
  "solar:health-bold-duotone",
  "solar:shield-check-bold-duotone",
  "solar:flag-bold-duotone",
  "solar:water-bold-duotone",
  "solar:fire-bold-duotone",
  // Iconify - Phosphor fill (clean, premium feel)
  "ph:phone-fill",
  "ph:wifi-high-fill",
  "ph:wallet-fill",
  "ph:game-controller-fill",
  "ph:lightning-fill",
  "ph:television-fill",
  "ph:gift-fill",
  "ph:ticket-fill",
];

export function CategorySettingsForm({
  initialItems,
  initialIconSize,
  initialIconShape,
  initialGroupedLayout,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<CategoryRow[]>(initialItems);
  const [iconSize, setIconSize] = useState(initialIconSize);
  const [iconShape, setIconShape] = useState<IconShape>(initialIconShape);
  const [groupedLayout, setGroupedLayout] = useState(initialGroupedLayout);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(() => {
    if (iconSize !== initialIconSize) return true;
    if (iconShape !== initialIconShape) return true;
    if (groupedLayout !== initialGroupedLayout) return true;
    if (items.length !== initialItems.length) return true;
    for (let i = 0; i < items.length; i++) {
      const a = items[i]!;
      const b = initialItems[i]!;
      if (
        a.label !== b.label ||
        a.iconName !== b.iconName ||
        a.gradient !== b.gradient ||
        (a.badge ?? "") !== (b.badge ?? "") ||
        a.hidden !== b.hidden ||
        a.sortOrder !== b.sortOrder
      ) {
        return true;
      }
    }
    return false;
  }, [items, iconSize, iconShape, groupedLayout, initialItems, initialIconSize, initialIconShape, initialGroupedLayout]);

  function patch(idx: number, partial: Partial<CategoryRow>) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx]!, ...partial };
      return next;
    });
  }

  function applyAllGradient(gradient: string) {
    setItems((prev) => prev.map((c) => ({ ...c, gradient })));
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      return next.map((it, i) => ({ ...it, sortOrder: (i + 1) * 10 }));
    });
  }

  function reset() {
    setItems(initialItems);
    setIconSize(initialIconSize);
    setIconShape(initialIconShape);
    setGroupedLayout(initialGroupedLayout);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          iconSize,
          iconShape,
          groupedLayout,
          categories: items.map((c) => ({
            category: c.category,
            label: c.label,
            iconName: c.iconName,
            gradient: c.gradient,
            badge: c.badge && c.badge.trim() ? c.badge.trim().toUpperCase() : null,
            hidden: c.hidden,
            sortOrder: c.sortOrder,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal simpan");
      toast.success("Pengaturan kategori tersimpan");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Icon size slider */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          Ukuran Icon ({iconSize}px)
        </Label>
        <div className="flex items-center gap-3">
          <Minimize className="h-4 w-4 text-muted-foreground" />
          <input
            type="range"
            min={24}
            max={96}
            step={4}
            value={iconSize}
            onChange={(e) => setIconSize(Number(e.target.value))}
            className="h-2 flex-1 cursor-pointer rounded-full bg-muted accent-primary"
          />
          <Maximize className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground">
          Ukuran kotak icon di grid kategori halaman /topup. Default: 56px.
        </p>
      </div>

      {/* Icon shape toggle */}
      <div className="space-y-2">
        <Label>Bentuk Icon Container</Label>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setIconShape("rounded")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
              iconShape === "rounded"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Square className="h-4 w-4" />
            Box (Rounded)
          </button>
          <button
            type="button"
            onClick={() => setIconShape("circle")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
              iconShape === "circle"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Circle className="h-4 w-4" />
            Bulat
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Bentuk container icon kategori &mdash; box rounded atau lingkaran sempurna.
        </p>
      </div>

      {/* Grouped layout toggle — box section seperti Pembelian/Pembayaran */}
      <div className="space-y-2">
        <Label>Tata Letak Kategori</Label>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setGroupedLayout(false)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
              !groupedLayout
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Grid Polos
          </button>
          <button
            type="button"
            onClick={() => setGroupedLayout(true)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
              groupedLayout
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutPanelTop className="h-4 w-4" />
            Box Section
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Box Section mengelompokkan kategori ke dalam kartu bertajuk (mis.
          <em> Pembelian</em> &amp; <em>Pembayaran</em>) seperti aplikasi PPOB.
          Grid Polos menampilkan semua kategori dalam satu grid.
        </p>
      </div>

      {/* Bulk color — set warna semua kategori sekaligus */}
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
        <Label className="flex items-center gap-1.5">
          <Wand2 className="h-3.5 w-3.5 text-muted-foreground" />
          Warna Massal Semua Kategori
        </Label>
        <p className="text-xs text-muted-foreground">
          Set satu warna untuk semua kategori sekaligus &mdash; biar gak perlu
          atur satu-satu. Klik salah satu warna di bawah untuk apply ke semua
          kategori.
        </p>
        <div className="grid grid-cols-6 gap-1.5 pt-1 sm:grid-cols-9 md:grid-cols-12">
          {PRESET_GRADIENTS.map((g) => {
            const allSame = items.every((c) => c.gradient === g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => applyAllGradient(g)}
                className={cn(
                  "group relative aspect-square rounded-lg bg-gradient-to-br ring-1 ring-black/5 transition-all hover:scale-110 hover:shadow-md",
                  g,
                  allSame && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
                title={`Apply ke semua: ${g}`}
                aria-label={`Apply ${g} ke semua kategori`}
              />
            );
          })}
        </div>
        <p className="pt-1 text-[11px] text-muted-foreground">
          <Palette className="mr-1 inline h-3 w-3" />
          Tip: Setelah apply massal, kamu masih bisa override warna per kategori di bawah.
        </p>
      </div>

      {/* List kategori */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <Tags className="h-3.5 w-3.5 text-muted-foreground" />
            Daftar Kategori ({items.filter((c) => !c.hidden).length} aktif /{" "}
            {items.length} total)
          </Label>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Atur label, icon, warna, badge, urutan, dan visibility per kategori.
          Drag tombol panah untuk geser urutan.
        </p>        <div className="space-y-2">
          {items.map((c, idx) => (
            <CategoryEditor
              key={c.category}
              row={c}
              iconSize={iconSize}
              iconShape={iconShape}
              onChange={(partial) => patch(idx, partial)}
              onMoveUp={idx > 0 ? () => move(idx, -1) : undefined}
              onMoveDown={idx < items.length - 1 ? () => move(idx, 1) : undefined}
            />
          ))}
        </div>
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

interface EditorProps {
  row: CategoryRow;
  iconSize: number;
  iconShape: IconShape;
  onChange: (p: Partial<CategoryRow>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function CategoryEditor({
  row,
  iconSize,
  iconShape,
  onChange,
  onMoveUp,
  onMoveDown,
}: EditorProps) {
  const [expanded, setExpanded] = useState(false);
  const shapeCls = iconShape === "circle" ? "rounded-full" : "rounded-2xl";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-colors",
        row.hidden ? "border-border/50 opacity-60" : "border-border",
      )}
    >
      {/* Header row — preview + quick actions */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Reorder controls */}
        <div className="flex flex-col gap-0.5 text-muted-foreground">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!onMoveUp}
            className="grid h-3 w-5 place-items-center rounded text-[10px] hover:bg-muted hover:text-foreground disabled:opacity-30"
            aria-label="Geser ke atas"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!onMoveDown}
            className="grid h-3 w-5 place-items-center rounded text-[10px] hover:bg-muted hover:text-foreground disabled:opacity-30"
            aria-label="Geser ke bawah"
          >
            ▼
          </button>
        </div>

        {/* Icon preview */}
        <div className="relative shrink-0">
          <div
            className={`grid place-items-center bg-gradient-to-br text-white shadow-sm ring-1 ring-black/5 ${shapeCls} ${row.gradient}`}
            style={{ width: iconSize, height: iconSize }}
          >
            <CategoryIcon name={row.iconName} className="h-1/2 w-1/2" />
          </div>
          {row.badge && (
            <span className="absolute -right-1 -top-1 rounded-full bg-destructive px-1.5 py-0.5 text-[9px] font-semibold uppercase text-destructive-foreground shadow">
              {row.badge}
            </span>
          )}
        </div>

        {/* Label + meta */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{row.label}</div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">
            {row.category}
          </div>
        </div>

        {/* Hide toggle */}
        <button
          type="button"
          onClick={() => onChange({ hidden: !row.hidden })}
          className={cn(
            "grid h-8 w-8 place-items-center rounded-md border transition-colors",
            row.hidden
              ? "border-border bg-muted text-muted-foreground hover:bg-muted/80"
              : "border-border bg-card text-foreground hover:bg-muted",
          )}
          title={row.hidden ? "Munculkan kategori" : "Sembunyikan kategori"}
        >
          {row.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          {expanded ? "Tutup" : "Edit"}
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="space-y-4 border-t border-border/60 px-3 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input
                value={row.label}
                onChange={(e) => onChange({ label: e.target.value })}
                placeholder="Pulsa, Token PLN, dll."
                maxLength={40}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Badge{" "}
                <span className="font-normal text-muted-foreground">
                  (opsional, mis. BARU)
                </span>
              </Label>
              <Input
                value={row.badge ?? ""}
                onChange={(e) => onChange({ badge: e.target.value })}
                placeholder="BARU / PROMO / HOT"
                maxLength={20}
              />
            </div>
          </div>

          {/* Icon picker */}
          <div className="space-y-1.5">
            <Label className="text-xs">Icon (Lucide)</Label>
            <div className="flex gap-2">
              <Input
                value={row.iconName}
                onChange={(e) => onChange({ iconName: e.target.value })}
                placeholder="Smartphone"
                className="font-mono"
                maxLength={40}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ICON_SUGGESTIONS.map((name) => {
                const active = row.iconName === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onChange({ iconName: name })}
                    title={name}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-md border transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <CategoryIcon name={name} className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Pilih dari preset di atas, atau ketik manual.
              <br />
              Format Iconify:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                set:nama-icon
              </code>{" "}
              (mis. <code>solar:wallet-bold-duotone</code>, <code>ph:phone-fill</code>).
              Browse:{" "}
              <a
                href="https://icon-sets.iconify.design"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                icon-sets.iconify.design
              </a>
              {" / "}
              <a
                href="https://lucide.dev/icons"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                lucide.dev
              </a>
              .
            </p>
          </div>

          {/* Gradient picker */}
          <div className="space-y-1.5">
            <Label className="text-xs">Warna Gradient</Label>
            <div className="grid grid-cols-6 gap-1.5 md:grid-cols-9">
              {PRESET_GRADIENTS.map((g) => {
                const active = row.gradient === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => onChange({ gradient: g })}
                    title={g}
                    className={cn(
                      `h-8 w-full rounded-md bg-gradient-to-br ring-1 ring-black/5 transition-transform ${g}`,
                      active && "scale-110 ring-2 ring-primary",
                    )}
                  />
                );
              })}
            </div>
            <Input
              value={row.gradient}
              onChange={(e) => onChange({ gradient: e.target.value })}
              placeholder="from-emerald-500 to-teal-600"
              className="font-mono text-xs"
              maxLength={120}
            />
          </div>
        </div>
      )}
    </div>
  );
}
