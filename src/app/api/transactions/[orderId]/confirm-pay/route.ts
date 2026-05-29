/**
 * POST /api/transactions/[orderId]/confirm-pay
 * Konfirmasi bayar tagihan pascabayar yang sudah di-inquiry.
 *
 * Validasi di service (transactionService.confirmPostpaidPay):
 *  - Wajib milik user yang sama
 *  - Wajib isInquiryOnly=true & status PENDING
 *  - Belum lewat expiredAt
 *  - Tanggal sama dengan inquiry (aturan Digiflazz)
 *
 * - BALANCE → debit saldo + langsung executeProvider() (pay-pasca).
 * - DUITKU_* → bikin invoice, balas paymentUrl. executeProvider akan
 *   jalan setelah webhook Duitku markPaid.
 */
import { NextRequest } from "next/server";
import { apiHandler, ok } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { PostpaidConfirmPaySchema } from "@/schemas/topup.schema";
import { getCurrentUserFromRequest } from "@/server/auth";
import { transactionService } from "@/services/transaction.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest) => {
  const user = await getCurrentUserFromRequest(req);
  if (!user) throw Errors.unauthorized();

  rateLimit({
    key: `tx:confirm:${user.id}`,
    max: 10,
    windowMs: 60_000,
    message: "Terlalu banyak konfirmasi pembayaran. Coba lagi sebentar.",
  });
  rateLimit({
    key: `tx:confirm:ip:${getClientIp(req)}`,
    max: 20,
    windowMs: 60_000,
  });

  // orderId dari pathname /api/transactions/<orderId>/confirm-pay
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  const orderId = segments.at(-2); // sebelum "confirm-pay"
  if (!orderId) throw Errors.notFound("Transaksi");

  const body = await req.json();
  const input = PostpaidConfirmPaySchema.parse(body);

  const tx = await transactionService.confirmPostpaidPay({
    userId: user.id,
    orderId,
    paymentMethod: input.paymentMethod,
    paymentChannel: input.paymentChannel,
  });

  return ok({
    orderId: tx.orderId,
    status: tx.status,
    paymentMethod: tx.paymentMethod,
    paymentChannel: tx.paymentChannel,
    paymentUrl: tx.paymentUrl,
    totalAmount: tx.totalAmount.toString(),
    expiredAt: tx.expiredAt,
  });
});
