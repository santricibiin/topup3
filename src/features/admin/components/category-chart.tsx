"use client";

import { formatIDR } from "@/lib/utils";

interface CategoryData {
  category: string;
  revenue: number;
  count: number;
}

interface Props {
  data: CategoryData[];
}

const CATEGORY_COLORS: Record<string, string> = {
  PULSA: "hsl(152 76% 40%)",       // emerald
  DATA: "hsl(199 89% 48%)",        // sky
  PLN: "hsl(38 92% 50%)",          // amber
  EWALLET: "hsl(262 83% 58%)",     // violet
  GAME: "hsl(292 84% 61%)",        // fuchsia
  VOUCHER: "hsl(346 77% 49%)",     // rose
  STREAMING: "hsl(220 90% 56%)",   // blue
  PASCABAYAR: "hsl(215 16% 47%)",  // slate
  OTHER: "hsl(220 9% 46%)",        // zinc
};

const LABELS: Record<string, string> = {
  PULSA: "Pulsa",
  DATA: "Paket Data",
  PLN: "Token PLN",
  EWALLET: "E-Wallet",
  GAME: "Game",
  VOUCHER: "Voucher",
  STREAMING: "Streaming",
  PASCABAYAR: "Pascabayar",
  OTHER: "Lainnya",
};

/**
 * Horizontal bar chart breakdown revenue per kategori.
 * Tampil sebagai daftar bar yg ratio-nya relatif ke max kategori.
 */
export function CategoryChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="grid h-32 place-items-center text-sm text-muted-foreground">
        Belum ada data per kategori.
      </div>
    );
  }

  const maxRev = Math.max(1, ...data.map((d) => d.revenue));
  const total = data.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = (d.revenue / maxRev) * 100;
        const sharePct = total > 0 ? (d.revenue / total) * 100 : 0;
        const color = CATEGORY_COLORS[d.category] ?? CATEGORY_COLORS.OTHER!;
        return (
          <div key={d.category} className="space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: color }}
                />
                <span className="font-medium">
                  {LABELS[d.category] ?? d.category}
                </span>
                <span className="text-muted-foreground">
                  · {d.count} tx
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">
                  {formatIDR(d.revenue)}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {sharePct.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
