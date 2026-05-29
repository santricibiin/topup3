import { NextRequest } from "next/server";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { apiHandler, ok } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { requireAdminApi } from "@/server/admin";
import { settingsService, SETTING_KEYS } from "@/services/settings.service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "logos");

/**
 * POST   /api/admin/site/logo  (multipart/form-data, field "file")
 * DELETE /api/admin/site/logo
 *
 * Validasi: max 2MB, format JPG/PNG/WEBP/GIF/SVG/ICO.
 * File disimpan di public/uploads/logos/<random>.<ext>.
 * URL disimpan ke setting `site.logoUrl`. Logo lama otomatis dihapus.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const admin = await requireAdminApi(req);

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    throw Errors.validation({ message: "File wajib di-upload (field 'file')." });
  }
  if (file.size > MAX_SIZE) {
    throw Errors.validation({
      message: `Ukuran file melebihi ${(MAX_SIZE / 1024 / 1024).toFixed(0)}MB.`,
    });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw Errors.validation({
      message: "Format gambar tidak didukung. Pakai PNG / JPG / WEBP / GIF / SVG / ICO.",
    });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = EXT_MAP[file.type] ?? "bin";
  const random = crypto.randomBytes(8).toString("hex");
  const filename = `logo-${Date.now()}-${random}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  const publicUrl = `/uploads/logos/${filename}`;

  // Hapus logo lama (kalau ada di folder uploads) supaya gak orphan file numpuk.
  const oldUrl = await settingsService.get(SETTING_KEYS.SITE_LOGO_URL);
  if (oldUrl && oldUrl.startsWith("/uploads/logos/")) {
    const oldPath = path.join(process.cwd(), "public", oldUrl);
    await unlink(oldPath).catch(() => {});
  }

  await settingsService.set(SETTING_KEYS.SITE_LOGO_URL, publicUrl);
  // Force-clear cache + revalidate layout supaya navbar & favicon ikut update
  settingsService.invalidate();
  revalidatePath("/", "layout");

  logger.info("admin.site.logo.upload", {
    by: admin.id,
    size: file.size,
    type: file.type,
    url: publicUrl,
  });

  return ok({ logoUrl: publicUrl });
});

export const DELETE = apiHandler(async (req: NextRequest) => {
  const admin = await requireAdminApi(req);

  const oldUrl = await settingsService.get(SETTING_KEYS.SITE_LOGO_URL);
  if (oldUrl && oldUrl.startsWith("/uploads/logos/")) {
    const oldPath = path.join(process.cwd(), "public", oldUrl);
    await unlink(oldPath).catch(() => {});
  }

  await settingsService.set(SETTING_KEYS.SITE_LOGO_URL, "");
  settingsService.invalidate();
  revalidatePath("/", "layout");

  logger.info("admin.site.logo.delete", { by: admin.id });

  return ok({ logoUrl: "" });
});
