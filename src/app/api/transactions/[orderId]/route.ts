import { NextRequest } from "next/server";
import { apiHandler, ok } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUserFromRequest } from "@/server/auth";
import { transactionService } from "@/services/transaction.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(
  async (req: NextRequest) => {
    const user = await getCurrentUserFromRequest(req);
    if (!user) throw Errors.unauthorized();

    // Rate limit polling: 60 request / menit / user (frontend polling tiap 1.5s = ~40/menit, ada margin).
    rateLimit({
      key: `tx:detail:${user.id}`,
      max: 60,
      windowMs: 60_000,
      message: "Terlalu banyak pengecekan transaksi. Coba lagi sebentar.",
    });

    const orderId = req.nextUrl.pathname.split("/").pop();
    if (!orderId) throw Errors.notFound("Transaksi");

    let tx = await prisma.transaction.findUnique({ where: { orderId } });
    if (!tx || (tx.userId !== user.id && user.role !== "ADMIN"))
      throw Errors.notFound("Transaksi");

    // Auto-reconcile saat status non-final.
    // SECURITY: TIDAK menerima `force` dari client (bypass debounce → abuse).
    // Server-side debounce 8s tetap berlaku.
    if (tx.status === "PAID" || tx.status === "PROCESSING") {
      tx = await transactionService.reconcileWithProvider(orderId, { force: false });
    }

    return ok({
      orderId: tx.orderId,
      status: tx.status,
      productName: tx.productName,
      customerNo: tx.customerNo,
      totalAmount: tx.totalAmount.toString(),
      paymentMethod: tx.paymentMethod,
      paymentChannel: tx.paymentChannel,
      paymentUrl: tx.paymentUrl,
      paidAt: tx.paidAt,
      providerSn: tx.providerSn,
      providerMessage: tx.providerMessage,
      createdAt: tx.createdAt,
      expiredAt: tx.expiredAt,
      // SECURITY: paymentRef (Duitku internal ref) sengaja TIDAK di-expose.
    });
  },
);
