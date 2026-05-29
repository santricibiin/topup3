import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { digiflazzService } from "@/services/digiflazz.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdminApi(req);
  try {
    const deposit = await digiflazzService.cekSaldo();
    return NextResponse.json({
      success: true,
      data: { provider: "digiflazz", deposit },
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: {
        code: "PROVIDER_ERROR",
        message: (err as Error).message ?? "Gagal cek saldo provider.",
      },
    });
  }
});
