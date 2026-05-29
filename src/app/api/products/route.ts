import { NextRequest } from "next/server";
import { apiHandler, ok } from "@/server/api-handler";
import { ProductFilterSchema } from "@/schemas/topup.schema";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const filter = ProductFilterSchema.parse({
    category: searchParams.get("category") ?? undefined,
    brand: searchParams.get("brand") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  });

  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      ...(filter.category ? { category: filter.category as never } : {}),
      ...(filter.brand ? { brand: filter.brand } : {}),
      ...(filter.q
        ? {
            OR: [
              { name: { contains: filter.q } },
              { brand: { contains: filter.q } },
            ],
          }
        : {}),
    },
    orderBy: [{ brand: "asc" }, { sellPrice: "asc" }],
    select: {
      id: true,
      sku: true,
      name: true,
      brand: true,
      category: true,
      type: true,
      sellPrice: true,
      description: true,
      multi: true,
    },
  });

  return ok(
    products.map((p) => ({ ...p, sellPrice: p.sellPrice.toString() })),
  );
});
