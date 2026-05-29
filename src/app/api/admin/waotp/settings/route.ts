/**
 * GET/PUT /api/admin/waotp/settings
 * Konfigurasi WA OTP gateway (admin-only).
 *
 * GET return: { enabled, url, apiKey: "masked", apiKeyHasValue, templates }
 * PUT body  : {
 *   enabled?: boolean,
 *   url?: string,
 *   apiKey?: string,
 *   templates?: Partial<Record<OtpPurpose, string>>
 * }
 *
 * apiKey kosong di PUT = tidak diubah.
 * Template dengan string kosong = reset ke default (kita simpan "" di DB,
 * service akan fallback ke envDefault).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { settingsService, SETTING_KEYS } from "@/services/settings.service";

export const dynamic = "force-dynamic";

const TemplateSchema = z
  .object({
    VERIFY_PHONE: z.string().max(1000).optional(),
    RESET_PASSWORD: z.string().max(1000).optional(),
    REGISTER: z.string().max(1000).optional(),
    LOGIN: z.string().max(1000).optional(),
    CONFIRM_TX: z.string().max(1000).optional(),
  })
  .optional();

const Schema = z.object({
  enabled: z.boolean().optional(),
  loginRequired: z.boolean().optional(),
  url: z.string().url("URL tidak valid").optional(),
  apiKey: z.string().trim().optional(),
  templates: TemplateSchema,
});

const TEMPLATE_KEY_MAP = {
  VERIFY_PHONE: SETTING_KEYS.WAOTP_TPL_VERIFY_PHONE,
  RESET_PASSWORD: SETTING_KEYS.WAOTP_TPL_RESET_PASSWORD,
  REGISTER: SETTING_KEYS.WAOTP_TPL_REGISTER,
  LOGIN: SETTING_KEYS.WAOTP_TPL_LOGIN,
  CONFIRM_TX: SETTING_KEYS.WAOTP_TPL_CONFIRM_TX,
} as const;

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);
  const [cfg, templates] = await Promise.all([
    settingsService.getWaOtpConfig(),
    settingsService.getWaOtpTemplates(),
  ]);
  return NextResponse.json({
    success: true,
    data: {
      enabled: cfg.enabled,
      loginRequired: cfg.loginRequired,
      url: cfg.url,
      apiKey: settingsService.mask(cfg.apiKey),
      apiKeyHasValue: Boolean(cfg.apiKey),
      templates,
    },
  });
});

export const PUT = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);
  const body = await req.json();
  const parsed = Schema.parse(body);

  const entries: Array<{ key: (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]; value: string }> = [];
  // Keys to delete (revert to default).
  const unsetKeys: Array<(typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]> = [];

  if (parsed.enabled !== undefined) {
    entries.push({
      key: SETTING_KEYS.WAOTP_ENABLED,
      value: parsed.enabled ? "true" : "false",
    });
  }
  if (parsed.loginRequired !== undefined) {
    entries.push({
      key: SETTING_KEYS.WAOTP_LOGIN_REQUIRED,
      value: parsed.loginRequired ? "true" : "false",
    });
  }
  if (parsed.url !== undefined) {
    entries.push({ key: SETTING_KEYS.WAOTP_URL, value: parsed.url });
  }
  if (parsed.apiKey !== undefined && parsed.apiKey.length > 0) {
    entries.push({ key: SETTING_KEYS.WAOTP_API_KEY, value: parsed.apiKey });
  }
  if (parsed.templates) {
    for (const [purpose, value] of Object.entries(parsed.templates)) {
      if (value === undefined) continue;
      const key = TEMPLATE_KEY_MAP[purpose as keyof typeof TEMPLATE_KEY_MAP];
      if (!key) continue;
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        // Reset ke default → hapus row supaya getter fallback ke envDefault.
        unsetKeys.push(key);
      } else {
        entries.push({ key, value: trimmed });
      }
    }
  }

  if (entries.length > 0) await settingsService.setMany(entries);
  for (const k of unsetKeys) await settingsService.unset(k);

  return NextResponse.json({
    success: true,
    data: { updated: entries.length + unsetKeys.length },
  });
});
