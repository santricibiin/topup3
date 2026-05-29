"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  Loader2,
  Search,
  Smartphone,
  Wifi,
  Zap,
  Wallet,
  Gamepad2,
  Gift,
  Tv,
  Receipt,
  Package,
  LayoutGrid,
  Phone,
  CalendarClock,
  Ticket,
  Tv2,
  Flame,
  Heart,
  ShieldCheck,
  Droplet,
  Bus,
  ShoppingBasket,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "ALL", label: "Semua", icon: LayoutGrid },
  { value: "PULSA", label: "Pulsa", icon: Smartphone },
  { value: "DATA", label: "Data", icon: Wifi },
  { value: "PAKET_SMS_TELPON", label: "SMS & Telpon", icon: Phone },
  { value: "MASA_AKTIF", label: "Masa Aktif", icon: CalendarClock },
  { value: "AKTIVASI_VOUCHER", label: "Aktivasi", icon: Ticket },
  { value: "PLN", label: "PLN", icon: Zap },
  { value: "EWALLET", label: "E-Wallet", icon: Wallet },
  { value: "GAME", label: "Game", icon: Gamepad2 },
  { value: "VOUCHER", label: "Voucher", icon: Gift },
  { value: "STREAMING", label: "Streaming", icon: Tv },
  { value: "TV_KABEL", label: "TV Kabel", icon: Tv2 },
  { value: "GAS", label: "Gas", icon: Flame },
  { value: "BPJS", label: "BPJS", icon: Heart },
  { value: "ASURANSI", label: "Asuransi", icon: ShieldCheck },
  { value: "PDAM", label: "PDAM", icon: Droplet },
  { value: "TRANSPORTASI", label: "Transportasi", icon: Bus },
  { value: "SEMBAKO", label: "Sembako", icon: ShoppingBasket },
  { value: "PASCABAYAR", label: "Pascabayar", icon: Receipt },
  { value: "OTHER", label: "Lainnya", icon: Package },
] as const;

interface Props {
  initialQ?: string;
  initialCategory?: string;
}

/**
 * Filter produk dengan UX polished:
 * - Search debounce 350ms
 * - Kategori sebagai pill chips dengan ikon — auto-submit saat dipilih
 */
export function ProductsFilter({ initialQ = "", initialCategory = "ALL" }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(initialQ);
  const [category, setCategory] = useState(initialCategory);

  useEffect(() => {
    const handle = setTimeout(() => apply(q, category), 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function apply(nextQ: string, nextCat: string) {
    const sp = new URLSearchParams(params?.toString() ?? "");
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    else sp.delete("q");
    if (nextCat && nextCat !== "ALL") sp.set("category", nextCat);
    else sp.delete("category");
    const qs = sp.toString();
    start(() => {
      router.replace(qs ? `/admin/products?${qs}` : "/admin/products");
    });
  }

  function onCategory(value: string) {
    setCategory(value);
    apply(q, value);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama produk, SKU, atau brand..."
          className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-10 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {pending && (
          <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="-mx-1 flex flex-wrap gap-1.5 overflow-x-auto pb-1">
        {CATEGORIES.map(({ value, label, icon: Icon }) => {
          const active = category === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onCategory(value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
