"use client";

import { Icon as IconifyIcon, addCollection } from "@iconify/react";
import {
  Smartphone,
  Wifi,
  Phone,
  CalendarClock,
  Ticket,
  Zap,
  Wallet,
  Gamepad2,
  Gift,
  Tv,
  Tv2,
  Flame,
  Heart,
  ShieldCheck,
  Droplet,
  Bus,
  ShoppingBasket,
  Receipt,
  Package,
  type LucideIcon,
} from "lucide-react";
import { BUNDLED_ICONS } from "@/lib/iconify-bundled";

// Side-effect: pre-register bundled icons saat module di-evaluate.
// Ini memastikan icon ready sebelum render pertama, tanpa flicker.
let _registered = false;
if (!_registered) {
  _registered = true;
  for (const set of BUNDLED_ICONS) {
    try {
      addCollection(set);
    } catch {
      /* ignore */
    }
  }
}

const LUCIDE_MAP: Record<string, LucideIcon> = {
  Smartphone,
  Wifi,
  Phone,
  CalendarClock,
  Ticket,
  Zap,
  Wallet,
  Gamepad2,
  Gift,
  Tv,
  Tv2,
  Flame,
  Heart,
  ShieldCheck,
  Droplet,
  Bus,
  ShoppingBasket,
  Receipt,
  Package,
};

interface Props {
  name: string;
  className?: string;
}

/**
 * Auto-detect icon source:
 *
 *  - "set:name"  (mengandung ":")  → render via Iconify (pre-bundled atau fetch CDN).
 *    Contoh: "solar:phone-bold-duotone", "ph:wallet-fill".
 *
 *  - "Smartphone" (PascalCase, tanpa ":")  → fallback ke Lucide React.
 *
 *  - Tidak match keduanya → render Package (Lucide) sebagai placeholder.
 */
export function CategoryIcon({ name, className }: Props) {
  if (name.includes(":")) {
    return <IconifyIcon icon={name} className={className} />;
  }

  const Icon =
    LUCIDE_MAP[name] ??
    LUCIDE_MAP[
      Object.keys(LUCIDE_MAP).find(
        (k) => k.toLowerCase() === name.toLowerCase(),
      ) ?? ""
    ] ??
    Package;
  return <Icon className={className} />;
}

export const SUPPORTED_ICONS = Object.keys(LUCIDE_MAP);
