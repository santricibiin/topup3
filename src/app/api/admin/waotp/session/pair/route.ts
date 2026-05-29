import { NextRequest } from "next/server";
import { apiHandler } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { callWorker, passthrough } from "@/lib/waotp-proxy";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);
  const body = await req.json().catch(() => ({}));
  // Worker bisa nunggu sampai ~12s buat dapetin pairing code dari WhatsApp,
  // jadi kasih timeout proxy lebih longgar (20s) biar gak false-timeout.
  const r = await callWorker("POST", "/session/pair", body, 20_000);
  return passthrough(r);
});
