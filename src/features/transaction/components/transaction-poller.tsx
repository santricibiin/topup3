"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { POLLING_INTERVAL_MS } from "@/config/constants";
import { Button } from "@/components/ui/button";

interface Props {
  orderId: string;
}

const FINAL = new Set(["SUCCESS", "FAILED", "REFUNDED", "EXPIRED", "CANCELLED"]);

/**
 * Polling otomatis + tombol cek manual.
 * Server-side debounce 8s berlaku — tombol manual tetap aman dipencet.
 */
export function TransactionPoller({ orderId }: Props) {
  const router = useRouter();
  const lastStatus = useRef<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  async function tick(manual = false) {
    try {
      if (manual) setChecking(true);
      const res = await fetch(`/api/transactions/${orderId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!json.success) return;
      const status = json.data.status as string;
      setLastChecked(new Date());

      if (lastStatus.current && lastStatus.current !== status) {
        router.refresh();
      }
      lastStatus.current = status;

      if (FINAL.has(status)) {
        router.refresh();
      }
    } catch {
      /* abaikan */
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    let stopped = false;
    const id = setInterval(() => {
      if (!stopped) tick(false);
    }, POLLING_INTERVAL_MS);
    tick(false);
    return () => {
      stopped = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Memantau real-time
        {lastChecked && (
          <span className="text-muted-foreground/70">
            · cek terakhir{" "}
            {lastChecked.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="ml-auto h-7 text-xs"
        disabled={checking}
        onClick={() => tick(true)}
      >
        {checking ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        Cek sekarang
      </Button>
    </div>
  );
}
