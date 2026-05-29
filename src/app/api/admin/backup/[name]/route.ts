/**
 * GET    /api/admin/backup/[name]   → download file (stream)
 * DELETE /api/admin/backup/[name]   → hapus 1 file backup
 */
import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { apiHandler, ok } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { backupService } from "@/services/backup.service";
import { Errors } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Ctx {
  params: { name: string };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdminApi(req);

    const safeName = path.basename(ctx.params.name);
    if (!safeName.match(/\.(sql|sql\.gz)$/i)) {
      throw Errors.badRequest("Nama file tidak valid");
    }
    const filepath = path.join(backupService.getDir(), safeName);
    const realPath = await fs.realpath(filepath).catch(() => null);
    if (!realPath || !realPath.startsWith(backupService.getDir())) {
      throw Errors.notFound("File backup tidak ditemukan");
    }
    const stat = await fs.stat(realPath);

    const nodeStream = createReadStream(realPath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const isGz = safeName.endsWith(".gz");
    return new Response(webStream, {
      headers: {
        "Content-Type": isGz ? "application/gzip" : "application/sql",
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return apiHandler(async () => {
      throw err;
    })(req);
  }
}

export const DELETE = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);
  const url = new URL(req.url);
  const name = decodeURIComponent(url.pathname.split("/").pop() || "");
  if (!name) throw Errors.badRequest("Nama file kosong");
  await backupService.delete(name);
  return ok({ deleted: name });
});
