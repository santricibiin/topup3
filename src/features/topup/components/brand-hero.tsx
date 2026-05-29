"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { BrandAvatar } from "./brand-avatar";
import { getBrandImage } from "../data/brand-images";

interface Props {
  brand: string;
  slug: string;
  /** "card" untuk grid katalog, "banner" untuk header detail page. */
  variant?: "card" | "banner";
  className?: string;
  /** Hanya berlaku utk variant="card". Default 64. */
  size?: number;
}

/**
 * Render gambar hero brand. Kalau slug tidak punya entry di BRAND_IMAGES,
 * atau gambar gagal load (onError), fallback ke `BrandAvatar` (gradient inisial).
 */
export function BrandHero({
  brand,
  slug,
  variant = "card",
  className,
  size = 64,
}: Props) {
  const [failed, setFailed] = useState(false);
  const image = getBrandImage(slug);

  if (variant === "card") {
    if (!image || failed) {
      return (
        <BrandAvatar
          brand={brand}
          size="lg"
          className={className}
          style={{ width: size, height: size }}
        />
      );
    }
    const innerSize = Math.round(size * 0.75);
    return (
      <div
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br shadow-sm ring-1 ring-black/5",
          image.accent ?? "from-slate-700 to-slate-900",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Image
          src={image.src}
          alt={brand}
          width={innerSize}
          height={innerSize}
          unoptimized
          onError={() => setFailed(true)}
          className="object-contain drop-shadow-md"
          style={{ width: innerSize, height: innerSize }}
        />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/20" />
      </div>
    );
  }

  if (!image || failed) {
    return (
      <div
        className={cn(
          "relative h-32 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary/30 via-violet-600/30 to-fuchsia-600/30 ring-1 ring-border",
          className,
        )}
      >
        <div className="grid-bg absolute inset-0 opacity-60" aria-hidden />
        <div className="absolute inset-0 grid place-items-center">
          <BrandAvatar brand={brand} size="lg" className="h-20 w-20 text-lg" />
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "relative h-40 w-full overflow-hidden rounded-2xl bg-gradient-to-br shadow-md ring-1 ring-black/5 md:h-48",
        image.accent ?? "from-slate-700 to-slate-900",
        className,
      )}
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4) 0%, transparent 30%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.2) 0%, transparent 25%)",
        }}
        aria-hidden
      />
      <div className="absolute inset-y-0 right-4 grid place-items-center md:right-10">
        <Image
          src={image.src}
          alt={brand}
          width={140}
          height={140}
          unoptimized
          onError={() => setFailed(true)}
          className="h-24 w-24 object-contain drop-shadow-2xl md:h-32 md:w-32"
        />
      </div>
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/40 via-black/10 to-transparent" />
    </div>
  );
}
