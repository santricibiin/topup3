import { NextRequest } from "next/server";
import { apiHandler } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { callWorker, passthrough } from "@/lib/waotp-proxy";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);
  const r = await callWorker("POST", "/session/start");
  return passthrough(r);
});
