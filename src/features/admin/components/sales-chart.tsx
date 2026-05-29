"use client";

import { useState } from "react";
import { formatIDR } from "@/lib/utils";

interface DataPoint {
  date: string;
  revenue: number;
  count: number;
}

interface Props {
  data: DataPoint[];
}

/**
 * Area chart sederhana untuk revenue 14 hari terakhir.
 * Pure SVG, no chart library dependency.
 * Hover → tooltip dengan tanggal + revenue + count.
 */
export function SalesChart({ data }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted-foreground">
        Belum ada data penjualan.
      </div>
    );
  }

  const W = 800;
  const H = 240;
  const padX = 24;
  const padTop = 20;
  const padBottom = 32;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;

  const maxRevenue = Math.max(1, ...data.map((d) => d.revenue));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    ...d,
    x: padX + i * stepX,
    y: padTop + innerH - (d.revenue / maxRevenue) * innerH,
  }));

  // Smooth path via simple Catmull-Rom-ish (Bezier interpolation antara titik-titik).
  const linePath = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      const prev = points[i - 1]!;
      const cx = (prev.x + p.x) / 2;
      return `Q ${cx.toFixed(1)} ${prev.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath =
    `${linePath} ` +
    `L ${points[points.length - 1]!.x.toFixed(1)} ${(padTop + innerH).toFixed(1)} ` +
    `L ${points[0]!.x.toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`;

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalCount = data.reduce((s, d) => s + d.count, 0);
  const avg = data.length > 0 ? totalRevenue / data.length : 0;

  // Bandingkan dengan paruh sebelumnya untuk trend %
  const half = Math.floor(data.length / 2);
  const recent = data.slice(half).reduce((s, d) => s + d.revenue, 0);
  const prev = data.slice(0, half).reduce((s, d) => s + d.revenue, 0);
  const trendPct = prev > 0 ? ((recent - prev) / prev) * 100 : 0;
  const trendUp = trendPct >= 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Revenue {data.length} hari
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {formatIDR(totalRevenue)}
            </span>
            {prev > 0 && (
              <span
                className={`text-xs font-medium ${trendUp ? "text-emerald-500" : "text-destructive"}`}
              >
                {trendUp ? "▲" : "▼"} {Math.abs(trendPct).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {totalCount} transaksi · rata-rata {formatIDR(avg)}/hari
          </div>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-56 w-full"
        >
          <defs>
            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid horizontal */}
          {[0.25, 0.5, 0.75].map((p) => {
            const y = padTop + innerH * p;
            return (
              <line
                key={p}
                x1={padX}
                x2={W - padX}
                y1={y}
                y2={y}
                stroke="hsl(var(--border))"
                strokeDasharray="2 4"
                strokeOpacity="0.6"
              />
            );
          })}

          {/* Area */}
          <path d={areaPath} fill="url(#salesGrad)" />
          {/* Line */}
          <path
            d={linePath}
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Hover hit areas */}
          {points.map((p, i) => (
            <g key={i}>
              <rect
                x={p.x - stepX / 2}
                y={padTop}
                width={stepX || padX * 2}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              />
              {hoverIdx === i && (
                <>
                  <line
                    x1={p.x}
                    x2={p.x}
                    y1={padTop}
                    y2={padTop + innerH}
                    stroke="hsl(var(--primary))"
                    strokeOpacity="0.4"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    fill="hsl(var(--background))"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2.5"
                  />
                </>
              )}
            </g>
          ))}

          {/* Date labels (max 7) */}
          {points
            .filter((_, i) => {
              const step = Math.max(1, Math.ceil(points.length / 7));
              return i % step === 0 || i === points.length - 1;
            })
            .map((p) => {
              const d = new Date(p.date);
              const label = d.toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
              });
              return (
                <text
                  key={p.date}
                  x={p.x}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {label}
                </text>
              );
            })}
        </svg>

        {hoverIdx !== null && points[hoverIdx] && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${(points[hoverIdx]!.x / W) * 100}%`,
              top: `${(points[hoverIdx]!.y / H) * 100}%`,
              transform: "translate(-50%, -120%)",
            }}
          >
            <div className="font-medium">
              {new Date(points[hoverIdx]!.date).toLocaleDateString("id-ID", {
                weekday: "short",
                day: "2-digit",
                month: "short",
              })}
            </div>
            <div className="font-semibold tabular-nums text-primary">
              {formatIDR(points[hoverIdx]!.revenue)}
            </div>
            <div className="text-muted-foreground">
              {points[hoverIdx]!.count} transaksi
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
