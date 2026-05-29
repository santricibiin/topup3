import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { settingsService, SETTING_KEYS } from "@/services/settings.service";

export const dynamic = "force-dynamic";

const Schema = z.object({
  digiflazz: z
    .object({
      username: z.string().trim().min(1).optional(),
      apiKey: z.string().trim().min(1).optional(),
      mode: z.enum(["development", "production"]).optional(),
    })
    .optional(),
  markup: z
    .object({
      type: z.enum(["PERCENT", "FIXED"]),
      value: z.number().nonnegative(),
      min: z.number().nonnegative().default(0),
      roundTo: z.number().int().positive().default(100),
    })
    .partial()
    .optional(),
  // Markup khusus pascabayar (admin fee inquiry → totalAmount).
  markupPasca: z
    .object({
      type: z.enum(["PERCENT", "FIXED"]),
      value: z.number().nonnegative(),
      min: z.number().nonnegative().default(0),
      roundTo: z.number().int().positive().default(100),
    })
    .partial()
    .optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);
  const [creds, markup, markupPasca] = await Promise.all([
    settingsService.getDigiflazzCredentials(),
    settingsService.getMarkupConfig(),
    settingsService.getMarkupPascaConfig(),
  ]);
  return NextResponse.json({
    success: true,
    data: {
      digiflazz: {
        username: creds.username,
        apiKey: settingsService.mask(creds.apiKey),
        apiKeyHasValue: Boolean(creds.apiKey),
        mode: creds.mode,
      },
      markup,
      markupPasca,
    },
  });
});

export const PUT = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);
  const json = await req.json();
  const parsed = Schema.parse(json);

  const entries: Array<{ key: (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]; value: string }> = [];

  if (parsed.digiflazz) {
    if (parsed.digiflazz.username !== undefined)
      entries.push({ key: SETTING_KEYS.DIGIFLAZZ_USERNAME, value: parsed.digiflazz.username });
    if (parsed.digiflazz.apiKey !== undefined)
      entries.push({ key: SETTING_KEYS.DIGIFLAZZ_API_KEY, value: parsed.digiflazz.apiKey });
    if (parsed.digiflazz.mode !== undefined)
      entries.push({ key: SETTING_KEYS.DIGIFLAZZ_MODE, value: parsed.digiflazz.mode });
  }
  if (parsed.markup) {
    if (parsed.markup.type !== undefined)
      entries.push({ key: SETTING_KEYS.MARKUP_TYPE, value: parsed.markup.type });
    if (parsed.markup.value !== undefined)
      entries.push({ key: SETTING_KEYS.MARKUP_VALUE, value: String(parsed.markup.value) });
    if (parsed.markup.min !== undefined)
      entries.push({ key: SETTING_KEYS.MARKUP_MIN, value: String(parsed.markup.min) });
    if (parsed.markup.roundTo !== undefined)
      entries.push({ key: SETTING_KEYS.MARKUP_ROUND_TO, value: String(parsed.markup.roundTo) });
  }
  if (parsed.markupPasca) {
    if (parsed.markupPasca.type !== undefined)
      entries.push({ key: SETTING_KEYS.MARKUP_PASCA_TYPE, value: parsed.markupPasca.type });
    if (parsed.markupPasca.value !== undefined)
      entries.push({ key: SETTING_KEYS.MARKUP_PASCA_VALUE, value: String(parsed.markupPasca.value) });
    if (parsed.markupPasca.min !== undefined)
      entries.push({ key: SETTING_KEYS.MARKUP_PASCA_MIN, value: String(parsed.markupPasca.min) });
    if (parsed.markupPasca.roundTo !== undefined)
      entries.push({ key: SETTING_KEYS.MARKUP_PASCA_ROUND_TO, value: String(parsed.markupPasca.roundTo) });
  }

  if (entries.length > 0) await settingsService.setMany(entries);

  return NextResponse.json({ success: true, data: { updated: entries.length } });
});
