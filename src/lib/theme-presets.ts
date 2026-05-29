/**
 * Theme presets — kontrol warna primary di seluruh app.
 *
 * Setiap preset define HSL untuk `--primary` di mode light dan dark.
 * Saat aplikasi render, `<ThemeColor>` (di root layout) inject CSS variables
 * agar override default di globals.css.
 *
 * Format: "H S% L%" (HSL tanpa unit dan koma) — kompatibel dengan Tailwind
 * `hsl(var(--primary))` style.
 *
 * Background batik (body::before) juga ikut warna primary lewat
 * `background-color: hsl(var(--primary))`.
 */

export interface ThemePreset {
  key: string;
  label: string;
  /** Warna swatch utk preview di picker. Hex untuk display saja. */
  hex: string;
  light: { primary: string; ring: string };
  dark: { primary: string; ring: string };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    key: "emerald",
    label: "Emerald (Default)",
    hex: "#10b981",
    light: { primary: "152 76% 36%", ring: "152 76% 40%" },
    dark: { primary: "152 76% 46%", ring: "152 76% 50%" },
  },
  {
    key: "blue",
    label: "Blue",
    hex: "#2563eb",
    light: { primary: "221 83% 53%", ring: "221 83% 53%" },
    dark: { primary: "217 91% 60%", ring: "217 91% 60%" },
  },
  {
    key: "violet",
    label: "Violet",
    hex: "#7c3aed",
    light: { primary: "262 83% 58%", ring: "262 83% 58%" },
    dark: { primary: "263 70% 65%", ring: "263 70% 65%" },
  },
  {
    key: "rose",
    label: "Rose",
    hex: "#e11d48",
    light: { primary: "346 77% 49%", ring: "346 77% 49%" },
    dark: { primary: "346 84% 60%", ring: "346 84% 60%" },
  },
  {
    key: "amber",
    label: "Amber",
    hex: "#d97706",
    light: { primary: "32 95% 44%", ring: "32 95% 44%" },
    dark: { primary: "38 92% 55%", ring: "38 92% 55%" },
  },
  {
    key: "fuchsia",
    label: "Fuchsia",
    hex: "#c026d3",
    light: { primary: "292 84% 48%", ring: "292 84% 48%" },
    dark: { primary: "292 91% 60%", ring: "292 91% 60%" },
  },
  {
    key: "cyan",
    label: "Cyan",
    hex: "#0891b2",
    light: { primary: "192 91% 36%", ring: "192 91% 36%" },
    dark: { primary: "192 91% 50%", ring: "192 91% 50%" },
  },
  {
    key: "indigo",
    label: "Indigo",
    hex: "#4f46e5",
    light: { primary: "238 75% 58%", ring: "238 75% 58%" },
    dark: { primary: "239 84% 67%", ring: "239 84% 67%" },
  },
  {
    key: "teal",
    label: "Teal",
    hex: "#0d9488",
    light: { primary: "173 80% 36%", ring: "173 80% 36%" },
    dark: { primary: "172 66% 50%", ring: "172 66% 50%" },
  },
  {
    key: "orange",
    label: "Orange",
    hex: "#ea580c",
    light: { primary: "20 90% 48%", ring: "20 90% 48%" },
    dark: { primary: "21 90% 58%", ring: "21 90% 58%" },
  },
  {
    key: "slate",
    label: "Slate (Monochrome)",
    hex: "#475569",
    light: { primary: "215 25% 27%", ring: "215 25% 35%" },
    dark: { primary: "215 20% 65%", ring: "215 20% 65%" },
  },
];

const PRESET_MAP = new Map(THEME_PRESETS.map((p) => [p.key, p]));

export function resolveTheme(key: string): ThemePreset {
  return PRESET_MAP.get(key) ?? THEME_PRESETS[0]!;
}

/**
 * Generate CSS yang akan di-inject ke <head>. Override --primary, --ring, dan
 * primary-foreground (kalau perlu) baik untuk :root (light) maupun .dark.
 *
 * primary-foreground hampir selalu putih agar contrast cukup, jadi tidak
 * di-override per-theme; default dari globals.css cukup.
 */
export function generateThemeCSS(key: string): string {
  const t = resolveTheme(key);
  return `
:root {
  --primary: ${t.light.primary};
  --ring: ${t.light.ring};
}
.dark {
  --primary: ${t.dark.primary};
  --ring: ${t.dark.ring};
}
`.trim();
}
