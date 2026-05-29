"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/utils";

interface Props {
  date: Date | string | number;
  /** Refresh interval dalam detik. Default 30. */
  refreshSec?: number;
  className?: string;
}

/**
 * Tampilkan waktu relatif tanpa hydration error.
 *
 * Trik: saat SSR & first paint client, render `null` (atau string kosong).
 * Setelah `useEffect` jalan (post-hydration), baru render text relatif yg
 * dihitung di client. Server gak ikut compute → tidak ada mismatch.
 *
 * Bonus: auto-refresh setiap 30s supaya "5 menit lalu" jadi "6 menit lalu" tanpa reload.
 */
export function RelativeTime({ date, refreshSec = 30, className }: Props) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    function tick() {
      setText(formatRelativeTime(date));
    }
    tick();
    const id = setInterval(tick, refreshSec * 1000);
    return () => clearInterval(id);
  }, [date, refreshSec]);

  // SSR & sebelum mount: render placeholder absolute (gak menyebabkan mismatch
  // karena server & client menghasilkan output identik dari Date object).
  if (text === null) {
    const d = date instanceof Date ? date : new Date(date);
    return (
      <span className={className} suppressHydrationWarning>
        {d.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </span>
    );
  }

  return <span className={className}>{text}</span>;
}
