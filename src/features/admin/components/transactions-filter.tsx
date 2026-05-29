"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  Loader2,
  Search,
  Layers,
  Clock,
  CreditCard,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Ban,
  Hourglass,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_OPTS = [
  { value: "ALL", label: "Semua", icon: Layers, tone: "" },
  { value: "PENDING", label: "Pending", icon: Clock, tone: "text-amber-500" },
  { value: "PAID", label: "Paid", icon: CreditCard, tone: "text-blue-500" },
  { value: "PROCESSING", label: "Process", icon: RefreshCw, tone: "text-violet-500" },
  { value: "SUCCESS", label: "Sukses", icon: CheckCircle2, tone: "text-emerald-500" },
  { value: "FAILED", label: "Gagal", icon: XCircle, tone: "text-destructive" },
  { value: "REFUNDED", label: "Refund", icon: AlertCircle, tone: "text-orange-500" },
  { value: "EXPIRED", label: "Expired", icon: Hourglass, tone: "text-muted-foreground" },
  { value: "CANCELLED", label: "Cancel", icon: Ban, tone: "text-muted-foreground" },
] as const;

interface Props {
  initialQ?: string;
  initialStatus?: string;
}

export function TransactionsFilter({ initialQ = "", initialStatus = "ALL" }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    const handle = setTimeout(() => apply(q, status), 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function apply(nextQ: string, nextStatus: string) {
    const sp = new URLSearchParams(params?.toString() ?? "");
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    else sp.delete("q");
    if (nextStatus && nextStatus !== "ALL") sp.set("status", nextStatus);
    else sp.delete("status");
    sp.delete("page");
    const qs = sp.toString();
    start(() => {
      router.replace(qs ? `/admin/transactions?${qs}` : "/admin/transactions");
    });
  }

  function onStatus(value: string) {
    setStatus(value);
    apply(q, value);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari Order ID, nomor tujuan, produk, username, atau email..."
          className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-10 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {pending && (
          <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="-mx-1 flex flex-wrap gap-1.5 overflow-x-auto pb-1">
        {STATUS_OPTS.map(({ value, label, icon: Icon, tone }) => {
          const active = status === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onStatus(value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", !active && tone)} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
