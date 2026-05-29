import { NextRequest } from "next/server";
import { apiHandler, ok } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { rateLimit } from "@/lib/rate-limit";
import { adminService } from "@/services/admin.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest) => {
  const admin = await requireAdminApi(req);

  // Rate limit: sync ke Digiflazz mahal (download katalog). Cegah abuse.
  rateLimit({
    key: `admin:sync:digiflazz:${admin.id}`,
    max: 3,
    windowMs: 60_000,
    message: "Sync sedang dijalankan. Tunggu 1 menit.",
  });

  const result = await adminService.syncDigiflazzProducts();
  return ok(result);
});
