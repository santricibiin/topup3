/**
 * POST /api/admin/backup/upload    → upload file backup (.sql atau .sql.gz)
 * Multipart form: field "file"
 */
import { NextRequest } from "next/server";
import { apiHandler, ok } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { backupService } from "@/services/backup.service";
import { Errors } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

// Batas ukuran file upload (MB). Default 200 MB.
const MAX_UPLOAD_MB = Number(process.env.BACKUP_UPLOAD_MAX_MB ?? "200");

export const POST = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);

  const ct = req.headers.get("content-type") || "";
  if (!ct.toLowerCase().startsWith("multipart/form-data")) {
    throw Errors.badRequest("Content-Type harus multipart/form-data");
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw Errors.badRequest('Field "file" wajib diisi');
  }

  if (file.size === 0) {
    throw Errors.badRequest("File kosong");
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    throw Errors.badRequest(
      `Ukuran file melebihi batas ${MAX_UPLOAD_MB} MB`,
    );
  }
  if (!file.name.match(/\.(sql|sql\.gz)$/i)) {
    throw Errors.badRequest("File harus .sql atau .sql.gz");
  }

  const saved = await backupService.saveUpload(file);
  return ok({
    filename: saved.name,
    size: saved.size,
    sizeText: saved.sizeText,
  });
});
