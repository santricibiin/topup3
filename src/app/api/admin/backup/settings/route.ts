/**
 * GET /api/admin/backup/settings   → ambil konfigurasi auto-backup
 * PUT /api/admin/backup/settings   → simpan konfigurasi auto-backup
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler, ok } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { settingsService, SETTING_KEYS } from "@/services/settings.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Schema = z.object({
  enabled: z.boolean(),
  interval: z.enum(["minutes", "hours", "days"]),
  value: z.coerce.number().int().positive().max(10_000),
  keepDays: z.coerce.number().int().min(0).max(3650),
});

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);
  const cfg = await settingsService.getBackupConfig();
  return ok(cfg);
});

export const PUT = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);
  const json = await req.json().catch(() => ({}));
  const parsed = Schema.parse(json);

  await settingsService.setMany([
    {
      key: SETTING_KEYS.BACKUP_ENABLED,
      value: parsed.enabled ? "true" : "false",
    },
    { key: SETTING_KEYS.BACKUP_INTERVAL, value: parsed.interval },
    { key: SETTING_KEYS.BACKUP_VALUE, value: String(parsed.value) },
    { key: SETTING_KEYS.BACKUP_KEEP_DAYS, value: String(parsed.keepDays) },
  ]);

  return ok({ updated: 4, config: parsed });
});
