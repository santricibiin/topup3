import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Pesan opsional di bawah spinner. */
  label?: string;
  /** "page" → fullscreen vertikal center. "inline" → block kecil utk section loader. */
  variant?: "page" | "inline";
  className?: string;
}

/**
 * Spinner reusable untuk Suspense boundary / loading.tsx Next.js.
 * Default-nya pakai Loader2 dari Lucide dengan animasi spin.
 *
 * Pemakaian:
 *   // app/some-route/loading.tsx
 *   export default function Loading() { return <RouteSpinner />; }
 */
export function RouteSpinner({
  label = "Memuat halaman...",
  variant = "page",
  className,
}: Props) {
  return (
    <div
      className={cn(
        variant === "page"
          ? "flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3 px-4"
          : "flex items-center justify-center gap-2 py-8",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="relative">
        <span
          className="absolute inset-0 -m-2 animate-ping rounded-full bg-primary/15"
          aria-hidden
        />
        <Loader2 className="relative h-8 w-8 animate-spin text-primary" />
      </div>
      {label && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
