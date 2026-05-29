"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [20, 50, 100, 200] as const;

interface Props {
  page: number;
  pageSize: number;
  total: number;
  shown: number;
}

/**
 * Page size selector + pagination controls untuk admin tables.
 * Semua state via URL param: ?page=N&perPage=20
 */
export function Pagination({ page, pageSize, total, shown }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + shown;

  function go(nextPage: number, nextSize?: number) {
    const sp = new URLSearchParams(params?.toString() ?? "");
    if (nextPage <= 1) sp.delete("page");
    else sp.set("page", String(nextPage));
    if (nextSize) {
      if (nextSize === 20) sp.delete("perPage");
      else sp.set("perPage", String(nextSize));
    }
    const qs = sp.toString();
    const path =
      typeof window !== "undefined" ? window.location.pathname : "/";
    start(() => {
      router.replace(qs ? `${path}?${qs}` : path);
    });
  }

  function changeSize(size: number) {
    // Saat ganti pageSize, reset ke page 1.
    go(1, size);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-xs md:px-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>Tampilkan</span>
        <select
          value={pageSize}
          onChange={(e) => changeSize(Number(e.target.value))}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="hidden sm:inline">per halaman</span>
      </div>

      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="tabular-nums">
          {from}-{to} dari{" "}
          <span className="font-semibold text-foreground">
            {total.toLocaleString("id-ID")}
          </span>
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => go(page - 1)}
            disabled={page <= 1 || pending}
            aria-label="Halaman sebelumnya"
            className={cn(
              "grid h-8 w-8 place-items-center rounded-md border border-border transition-colors",
              "hover:bg-muted hover:text-foreground",
              "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="min-w-[60px] px-2 text-center font-medium tabular-nums text-foreground">
            {pending ? (
              <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                {page} <span className="text-muted-foreground">/ {totalPages}</span>
              </>
            )}
          </span>

          <button
            type="button"
            onClick={() => go(page + 1)}
            disabled={page >= totalPages || pending}
            aria-label="Halaman berikutnya"
            className={cn(
              "grid h-8 w-8 place-items-center rounded-md border border-border transition-colors",
              "hover:bg-muted hover:text-foreground",
              "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
