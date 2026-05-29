import { NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { ProductCategory } from "@prisma/client";
import { apiHandler, ok } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { categorySettingsService } from "@/services/category-settings.service";
import { settingsService, SETTING_KEYS } from "@/services/settings.service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const VALID_CATEGORY = new Set(Object.keys(ProductCategory));

const UpdateSchema = z.object({
  category: z.string().refine((v) => VALID_CATEGORY.has(v), "Kategori tidak valid"),
  label: z.string().trim().max(40).optional().nullable(),
  iconName: z.string().trim().max(40).optional().nullable(),
  gradient: z.string().trim().max(120).optional().nullable(),
  badge: z.string().trim().max(20).optional().nullable(),
  hidden: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

const BulkSchema = z.object({
  iconSize: z.number().int().min(24).max(96).optional(),
  iconShape: z.enum(["rounded", "circle"]).optional(),
  groupedLayout: z.boolean().optional(),
  categories: z.array(UpdateSchema).optional(),
});

const ResetSchema = z.object({
  category: z.string().refine((v) => VALID_CATEGORY.has(v), "Kategori tidak valid"),
});

/**
 * GET    /api/admin/categories  → list semua kategori + iconSize + iconShape
 * POST   /api/admin/categories  → bulk update (icon size, shape, per-category overrides)
 * DELETE /api/admin/categories  → reset 1 kategori ke default (hapus row override)
 */
export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);

  const [items, iconSizeRaw, iconShapeRaw, groupedRaw] = await Promise.all([
    categorySettingsService.getAll(),
    settingsService.get(SETTING_KEYS.TOPUP_ICON_SIZE),
    settingsService.get(SETTING_KEYS.TOPUP_ICON_SHAPE),
    settingsService.get(SETTING_KEYS.TOPUP_GROUPED_LAYOUT),
  ]);
  const iconSize = Math.max(24, Math.min(96, Number(iconSizeRaw) || 56));
  const iconShape: "rounded" | "circle" =
    iconShapeRaw === "circle" ? "circle" : "rounded";
  const groupedLayout = groupedRaw === "true";

  return ok({ items, iconSize, iconShape, groupedLayout });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const admin = await requireAdminApi(req);
  const body = await req.json().catch(() => ({}));
  const data = BulkSchema.parse(body);

  if (data.iconSize !== undefined) {
    await settingsService.set(SETTING_KEYS.TOPUP_ICON_SIZE, String(data.iconSize));
  }
  if (data.iconShape !== undefined) {
    await settingsService.set(SETTING_KEYS.TOPUP_ICON_SHAPE, data.iconShape);
  }
  if (data.groupedLayout !== undefined) {
    await settingsService.set(
      SETTING_KEYS.TOPUP_GROUPED_LAYOUT,
      data.groupedLayout ? "true" : "false",
    );
  }

  if (data.categories) {
    for (const c of data.categories) {
      await categorySettingsService.update(c.category as ProductCategory, {
        label: c.label,
        iconName: c.iconName,
        gradient: c.gradient,
        badge: c.badge,
        hidden: c.hidden,
        sortOrder: c.sortOrder,
      });
    }
  }

  logger.info("admin.categories.update", {
    by: admin.id,
    iconSize: data.iconSize,
    iconShape: data.iconShape,
    groupedLayout: data.groupedLayout,
    catCount: data.categories?.length ?? 0,
  });

  // Revalidate /topup biar warna kategori langsung update
  revalidatePath("/topup");
  revalidatePath("/admin/settings");

  return ok({ updated: true });
});

export const DELETE = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);
  const body = await req.json().catch(() => ({}));
  const { category } = ResetSchema.parse(body);

  await categorySettingsService.reset(category as ProductCategory);
  return ok({ reset: true });
});
