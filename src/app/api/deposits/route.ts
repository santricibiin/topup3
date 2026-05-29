import { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler, ok } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getCurrentUserFromRequest } from "@/server/auth";
import { depositService } from "@/services/deposit.service";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  amount: z
    .number()
    .int("Nominal harus bilangan bulat (Rupiah).")
    .positive("Nominal harus lebih dari 0."),
  description: z.string().trim().max(160).optional(),
});

/**
 * POST /api/deposits  — buat deposit baru (pending) untuk user yg login
 * GET  /api/deposits  — list deposit milik user
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const user = await getCurrentUserFromRequest(req);
  if (!user) throw Errors.unauthorized();

  // Rate limit: max 5 deposit / menit per user + 10 / menit per IP
  // (cegah spam request QRIS yg potensi timeout / collision)
  rateLimit({
    key: `deposit:user:${user.id}`,
    max: 5,
    windowMs: 60_000,
    message: "Terlalu banyak request deposit. Coba lagi sebentar.",
  });
  rateLimit({
    key: `deposit:ip:${getClientIp(req)}`,
    max: 10,
    windowMs: 60_000,
  });

  const body = await req.json().catch(() => ({}));
  const data = CreateSchema.parse(body);

  const result = await depositService.createPending({
    userId: user.id,
    amount: data.amount,
    description: data.description,
  });

  return ok({
    id: result.deposit.id,
    amount: result.deposit.amount.toString(),
    uniqueCode: result.deposit.uniqueCode,
    totalAmount: result.deposit.totalAmount.toString(),
    status: result.deposit.status,
    qrisPayload: result.qrisPayload,
    expiresAt: result.deposit.expiresAt,
    createdAt: result.deposit.createdAt,
  });
});

export const GET = apiHandler(async (req: NextRequest) => {
  const user = await getCurrentUserFromRequest(req);
  if (!user) throw Errors.unauthorized();

  const items = await depositService.listByUser(user.id, 30);
  return ok(
    items.map((d) => ({
      id: d.id,
      amount: d.amount.toString(),
      totalAmount: d.totalAmount.toString(),
      uniqueCode: d.uniqueCode,
      status: d.status,
      method: d.method,
      paidAt: d.paidAt,
      expiresAt: d.expiresAt,
      createdAt: d.createdAt,
    })),
  );
});
