import { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler, ok } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { Errors } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

const BulkUpdateSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  status: z.enum(["ACTIVE", "INACTIVE", "GANGGUAN"]).optional(),
  marginAdd: z.number().int().min(-1_000_000).max(1_000_000).optional(),
});

/**
 * POST   /api/admin/products/bulk    → bulk update status / margin
 * DELETE /api/admin/products/bulk    → bulk delete by ids
 *
 * Catatan: produk yg sudah pernah dipakai di transaksi tetap aman dihapus
 * karena Transaction menyimpan snapshot productSku/productName, bukan FK.
 */
export const DELETE = apiHandler(async (req: NextRequest) => {
  const admin = await requireAdminApi(req);
  const json = await req.json().catch(() => ({}));
  const { ids } = BulkDeleteSchema.parse(json);

  const result = await prisma.product.deleteMany({
    where: { id: { in: ids } },
  });

  logger.info("admin.products.bulk_delete", {
    by: admin.id,
    ids: ids.length,
    deleted: result.count,
  });

  return ok({ deleted: result.count });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const admin = await requireAdminApi(req);
  const json = await req.json().catch(() => ({}));
  const { ids, status, marginAdd } = BulkUpdateSchema.parse(json);

  if (status === undefined && marginAdd === undefined) {
    throw Errors.validation({
      message: "Minimal satu field perubahan (status / marginAdd) wajib diisi.",
    });
  }

  // Status: simple updateMany.
  if (status !== undefined && marginAdd === undefined) {
    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
    logger.info("admin.products.bulk_update_status", {
      by: admin.id,
      ids: ids.length,
      updated: result.count,
      status,
    });
    return ok({ updated: result.count });
  }

  // marginAdd: per-row update karena tergantung sellPrice existing.
  // Pakai transaction supaya atomic.
  const updated = await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, sellPrice: true },
    });
    let count = 0;
    for (const p of products) {
      const newPrice = Number(p.sellPrice) + (marginAdd ?? 0);
      await tx.product.update({
        where: { id: p.id },
        data: {
          sellPrice: newPrice < 0 ? 0 : newPrice,
          ...(status !== undefined && { status }),
        },
      });
      count++;
    }
    return count;
  });

  logger.info("admin.products.bulk_update_margin", {
    by: admin.id,
    ids: ids.length,
    updated,
    marginAdd,
    status,
  });

  return ok({ updated });
});
