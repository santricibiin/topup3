"use client";

/**
 * Hot-register bundled icons ke Iconify cache.
 *
 * Pakai side-effect import — `addCollection()` dipanggil **saat module di-evaluate**,
 * bukan setelah hydration. Karena CategoryIcon component import dari sini
 * (lewat re-export atau lewat root layout), iconify cache sudah terisi
 * sebelum render pertama → render instan, no flicker.
 */
import { addCollection } from "@iconify/react";
import { BUNDLED_ICONS } from "@/lib/iconify-bundled";

let registered = false;

if (!registered) {
  registered = true;
  for (const set of BUNDLED_ICONS) {
    try {
      addCollection(set);
    } catch (err) {
      console.warn("[iconify] addCollection failed:", err);
    }
  }
}

/**
 * Component placeholder — gak render apa2, fungsi-nya cuma supaya file ini
 * di-import oleh layout (memicu side-effect register di atas).
 */
export function IconifyBootstrap() {
  return null;
}
