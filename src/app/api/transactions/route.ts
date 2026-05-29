import { NextRequest } from "next/server";
import { apiHandler, ok } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { TopupCheckoutSchema } from "@/schemas/topup.schema";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getCurrentUserFromRequest } from "@/server/auth";
import { transactionService } from "@/services/transaction.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest) => {
  const user = await getCurrentUserFromRequest(req);
  if (!user) throw Errors.unauthorized();

  // Rate limit: max 10 checkout / menit per user + 20 / menit per IP
  // (cegah spam / race condition exploit)
  rateLimit({
    key: `tx:user:${user.id}`,
    max: 10,
    windowMs: 60_000,
    message: "Terlalu banyak transaksi. Coba lagi sebentar.",
  });
  rateLimit({
    key: `tx:ip:${getClientIp(req)}`,
    max: 20,
    windowMs: 60_000,
  });

  const body = await req.json();
  const input = TopupCheckoutSchema.parse(body);

  const result = await transactionService.checkout({
    userId: user.id,
    productSku: input.productSku,
    customerNo: input.customerNo,
    serverId: input.serverId,
    paymentMethod: input.paymentMethod,
    paymentChannel: input.paymentChannel,
  });

  return ok(result);
});
