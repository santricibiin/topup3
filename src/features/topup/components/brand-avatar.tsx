import { cn } from "@/lib/utils";

/**
 * Avatar inisial brand dengan gradient warna deterministik.
 * Warna di-hash dari nama brand → konsisten setiap render, tanpa perlu asset.
 */

function hashCode(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function initials(brand: string): string {
  const words = brand.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

const PALETTES = [
  "from-violet-500 to-fuchsia-500",
  "from-fuchsia-500 to-pink-500",
  "from-pink-500 to-rose-500",
  "from-rose-500 to-orange-500",
  "from-orange-500 to-amber-500",
  "from-amber-500 to-yellow-500",
  "from-emerald-500 to-teal-500",
  "from-teal-500 to-cyan-500",
  "from-cyan-500 to-sky-500",
  "from-sky-500 to-blue-500",
  "from-blue-500 to-indigo-500",
  "from-indigo-500 to-violet-500",
  "from-lime-500 to-emerald-500",
  "from-red-500 to-rose-500",
] as const;

export interface BrandAvatarProps {
  brand: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
}

export function BrandAvatar({
  brand,
  size = "md",
  className,
  style,
}: BrandAvatarProps) {
  const palette = PALETTES[hashCode(brand) % PALETTES.length]!;
  const text = initials(brand);

  // Kalau `style.width/height` di-set (override), jangan apply class sizing.
  const hasOverride = Boolean(style?.width || style?.height);
  const sizing = hasOverride
    ? "text-base"
    : {
        sm: "h-9 w-9 text-[11px]",
        md: "h-12 w-12 text-sm",
        lg: "h-16 w-16 text-base",
      }[size];

  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-xl bg-gradient-to-br font-display font-bold tracking-tight text-white shadow-sm ring-1 ring-black/5",
        palette,
        sizing,
        className,
      )}
    >
      <span className="drop-shadow-sm">{text}</span>
      <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-tr from-white/0 via-white/10 to-white/30 opacity-60" />
    </div>
  );
}
