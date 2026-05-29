import { NextRequest } from "next/server";
import { apiHandler, ok } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { getCurrentUserFromRequest } from "@/server/auth";
import { depositService } from "@/services/deposit.service";

export const dynamic = "force-dynamic";

/**
 * GET    /api/deposits/[id]  — ambil detail deposit (admin bypass ownership)
 * DELETE /api/deposits/[id]  — cancel deposit pending milik user sendiri
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await getCurrentUserFromRequest(req);
  if (!user) throw Errors.unauthorized();

  const id = req.nextUrl.pathname.split("/").pop();
  if (!id) throw Errors.notFound("Deposit");

  const deposit = await depositService.getById(
    id,
    user.role === "ADMIN" ? undefined : user.id,
  );
  if (!deposit) throw Errors.notFound("Deposit");

  return ok({
    id: deposit.id,
    userId: deposit.userId,
    method: deposit.method,
    amount: deposit.amount.toString(),
    uniqueCode: deposit.uniqueCode,
    totalAmount: deposit.totalAmount.toString(),
    status: deposit.status,
    qrisPayload: deposit.qrisPayload,
    description: deposit.description,
    paidAt: deposit.paidAt,
    expiresAt: deposit.expiresAt,
    createdAt: deposit.createdAt,
  });
});

export const DELETE = apiHandler(async (req: NextRequest) => {
  const user = await getCurrentUserFromRequest(req);
  if (!user) throw Errors.unauthorized();

  const id = req.nextUrl.pathname.split("/").pop();
  if (!id) throw Errors.notFound("Deposit");

  const cancelled = await depositService.cancelPending(id, user.id);
  return ok({ id: cancelled.id, status: cancelled.status });
});
