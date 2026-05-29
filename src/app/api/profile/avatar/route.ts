import { NextRequest } from "next/server";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { apiHandler, ok } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUserFromRequest } from "@/server/auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");

/**
 * Cek magic bytes — cegah MIME spoofing (upload PHP shell dengan Content-Type image/jpeg).
 * Returns MIME yg terdeteksi atau null kalau bukan image valid.
 */
function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  // GIF: 47 49 46 38 (37|39) 61
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return "image/gif";
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * POST   /api/profile/avatar  (multipart/form-data, field "file")
 * DELETE /api/profile/avatar
 *
 * Validasi: max 2MB, only JPG/PNG/WEBP/GIF (cek MIME + magic bytes).
 * File disimpan di public/uploads/avatars/<userId>-<random>.<ext>.
 * Avatar lama otomatis dihapus saat replace.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const user = await getCurrentUserFromRequest(req);
  if (!user) throw Errors.unauthorized();

  // Rate limit: max 10 upload / jam / user (cegah disk-fill DoS).
  rateLimit({
    key: `profile:avatar:${user.id}`,
    max: 10,
    windowMs: 60 * 60_000,
    message: "Terlalu banyak upload foto. Coba lagi 1 jam.",
  });

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
      message: "Format gambar tidak didukung. Pakai JPG / PNG / WEBP / GIF.",
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Magic bytes check — cegah upload file non-image dgn Content-Type spoofed.
  const sniffed = sniffImageMime(buffer);
  if (!sniffed || !ALLOWED_MIME.has(sniffed)) {
    logger.warn("user.avatar.mime_spoof", {
      userId: user.id,
      claimed: file.type,
      sniffed,
    });
    throw Errors.validation({
      message: "File bukan gambar valid. Upload JPG/PNG/WEBP/GIF asli.",
    });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  // Pakai ext dari hasil sniff (bukan dari client) supaya konsisten.
  const ext = EXT_MAP[sniffed] ?? "bin";
  const random = crypto.randomBytes(6).toString("hex");
  const filename = `${user.id}-${random}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  await writeFile(filepath, buffer);

  const publicUrl = `/uploads/avatars/${filename}`;

  // Hapus avatar lama (kalau ada) supaya gak orphan file numpuk.
  if (user.avatarUrl && user.avatarUrl.startsWith("/uploads/avatars/")) {
    const oldPath = path.join(process.cwd(), "public", user.avatarUrl);
    await unlink(oldPath).catch(() => {});
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: publicUrl },
  });

  logger.info("user.avatar.upload", {
    userId: user.id,
    size: file.size,
    type: file.type,
  });

  return ok({ avatarUrl: publicUrl });
});

export const DELETE = apiHandler(async (req: NextRequest) => {
  const user = await getCurrentUserFromRequest(req);
  if (!user) throw Errors.unauthorized();

  if (user.avatarUrl && user.avatarUrl.startsWith("/uploads/avatars/")) {
    const filepath = path.join(process.cwd(), "public", user.avatarUrl);
    await unlink(filepath).catch(() => {});
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: null },
  });

  logger.info("user.avatar.remove", { userId: user.id });

  return ok({ removed: true });
});
