/**
 * POST /api/admin/backup/restore   → restore database dari file backup yang ada di server
 * Body: { filename: string }
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler, ok } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { backupService } from "@/services/backup.service";
import { Errors } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 5 menit (restore bisa lama)

const Schema = z.object({
  filename: z.string().trim().min(1, "Filename wajib diisi"),
});

export const POST = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);
  const json = await req.json().catch(() => ({}));
  const { filename } = Schema.parse(json);

  // basic validation — service juga sudah anti path-traversal
  if (!filename.match(/\.(sql|sql\.gz)$/i)) {
    throw Errors.badRequest("File harus .sql atau .sql.gz");
  }

  const result = await backupService.restore(filename);
  return ok({
    filename,
    tables: result.tables,
    users: result.users,
  });
});
