import { NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { apiHandler, ok } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { settingsService, SETTING_KEYS } from "@/services/settings.service";
import { THEME_PRESETS } from "@/lib/theme-presets";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const VALID_THEMES = THEME_PRESETS.map((p) => p.key) as [string, ...string[]];

const SiteSchema = z.object({
  name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(160).optional().default(""),
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === "" || /^(https?:)?\/\/|^\//.test(v),
      "URL logo harus berupa URL absolut atau path relatif (mis. /logo.png)",
    )
    .optional()
    .default(""),
  theme: z.enum(VALID_THEMES).optional().default("emerald"),
});

/**
 * GET — ambil konfigurasi site (branding).
 * POST — update konfigurasi site (branding).
 */
export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);
  const branding = await settingsService.getSiteBranding();
  return ok(branding);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const admin = await requireAdminApi(req);
  const body = await req.json().catch(() => ({}));
  const data = SiteSchema.parse(body);

  await settingsService.setMany([
    { key: SETTING_KEYS.SITE_NAME, value: data.name },
    { key: SETTING_KEYS.SITE_TAGLINE, value: data.tagline ?? "" },
    { key: SETTING_KEYS.SITE_LOGO_URL, value: data.logoUrl ?? "" },
    { key: SETTING_KEYS.SITE_THEME, value: data.theme ?? "emerald" },
  ]);
  // Force-clear cache + revalidate semua page biar nama/theme/logo langsung kepakai
  settingsService.invalidate();
  revalidatePath("/", "layout");

  logger.info("admin.site.update", {
    by: admin.id,
    name: data.name,
    theme: data.theme,
  });

  return ok({ updated: true, ...data });
});
