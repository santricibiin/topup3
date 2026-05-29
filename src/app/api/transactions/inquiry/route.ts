/**
 * POST /api/transactions/inquiry
 * Inquiry tagihan pascabayar (`inq-pasca` ke Digiflazz).
 *
 * Tidak memotong saldo. Membuat Transaction dgn isInquiryOnly=true,
 * status PENDING, dan snapshot detail tagihan dari Digiflazz.
 *
 * Setelah ini, user pilih metode bayar via
 * POST /api/transactions/[orderId]/confirm-pay.
 */
import { NextRequest } from "next/server";
import { apiHandler, ok } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { PostpaidInquirySchema } from "@/schemas/topup.schema";
import { getCurrentUserFromRequest } from "@/server/auth";
import { transactionService } from "@/services/transaction.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest) => {
  const user = await getCurrentUserFromRequest(req);
  if (!user) throw Errors.unauthorized();

  // Inquiry hit Digiflazz, jadi rate-limit ketat.
  rateLimit({
    key: `tx:inq:${user.id}`,
    max: 6,
    windowMs: 60_000,
    message: "Terlalu banyak cek tagihan. Coba lagi sebentar.",
  });
  rateLimit({
    key: `tx:inq:ip:${getClientIp(req)}`,
    max: 12,
    windowMs: 60_000,
  });

  const body = await req.json();
  const input = PostpaidInquirySchema.parse(body);

  const { transaction, raw } = await transactionService.inquiryPostpaid({
    userId: user.id,
    productSku: input.productSku,
    customerNo: input.customerNo,
  });

  return ok({
    orderId: transaction.orderId,
    status: transaction.status,
    productName: transaction.productName,
    customerNo: transaction.customerNo,
    customerName: transaction.customerName,
    periode: transaction.periode,
    basePrice: transaction.basePrice.toString(),
    sellPrice: transaction.sellPrice.toString(),
    adminFee: transaction.adminFee.toString(),
    totalAmount: transaction.totalAmount.toString(),
    inquiryDetail: transaction.inquiryDetail,
    providerMessage: transaction.providerMessage,
    expiredAt: transaction.expiredAt,
    // Status mentah dari provider supaya UI bisa beda treat
    // Sukses vs Gagal walau Transaction sudah di-mark FAILED.
    providerStatus: raw.status,
  });
});
