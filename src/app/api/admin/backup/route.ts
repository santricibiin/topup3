/**
 * GET  /api/admin/backup            → list backup files + meta (last run, next run, dir)
 * POST /api/admin/backup            → trigger manual "Backup Now"
 */
import { NextRequest, NextResponse } from "next/server";
import { apiHandler, ok } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { backupService } from "@/services/backup.service";
import { backupScheduler } from "@/services/backup-scheduler.service";
import { settingsService } from "@/services/settings.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);

  const [files, lastRun, nextRun, cfg] = await Promise.all([
    backupService.list(),
    backupScheduler.getLastRunInfo(),
    backupScheduler.getNextRun(),
    settingsService.getBackupConfig(),
  ]);

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return ok({
    dir: backupService.getDir(),
    files: files.map((f) => ({
      name: f.name,
      size: f.size,
      sizeText: f.sizeText,
      createdAt: f.createdAt.toISOString(),
      compressed: f.compressed,
    })),
    summary: {
      count: files.length,
      totalSize,
      totalSizeText: formatBytes(totalSize),
    },
    lastRun: {
      ts: lastRun.ts,
      filename: lastRun.filename,
    },
    nextRun: {
      enabled: nextRun.enabled,
      nextRunAt: nextRun.nextRunAt ? nextRun.nextRunAt.toISOString() : null,
      intervalText: nextRun.intervalText,
    },
    config: cfg,
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);
  const result = await backupScheduler.runOnce();
  return NextResponse.json({
    success: true,
    data: {
      filename: result.filename,
      size: result.size,
      sizeText: formatBytes(result.size),
    },
  });
});

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
