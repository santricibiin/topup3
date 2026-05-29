import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { apiHandler, ok } from "@/server/api-handler";
import { requireAdminApi } from "@/server/admin";
import { Errors } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const AdjustSchema = z.object({
  userId: z.string().min(1),
  amount: z
    .number()
    .int("Nominal harus bilangan bulat (Rupiah).")
    .refine((v) => v !== 0, "Nominal tidak boleh 0.")
    .refine(
      (v) => Math.abs(v) <= 100_000_000,
      "Nominal melebihi batas Rp 100.000.000.",
    ),
  description: z.string().trim().max(200).optional().default(""),
});

/**
 * POST /api/admin/users/[id]/balance
 * Body: { amount: number, description?: string }
 *
 * Tambah saldo (positif) atau kurangi (negatif) ke user manapun.
 * Selalu mencatat audit trail di BalanceMutation dengan type ADJUSTMENT.
 *
 * Atomic via prisma.$transaction — Balance + BalanceMutation update bareng.
 */
export const POST = apiHandler(
  async (req: NextRequest) => {
    const admin = await requireAdminApi(req);

    // Rate limit: max 30 adjust / menit / admin.
    // Kalau akun admin compromised, attacker tetap dibatasi seberapa cepat
    // bisa transfer saldo ke akun pribadi.
    rateLimit({
      key: `admin:balance:${admin.id}`,
      max: 30,
      windowMs: 60_000,
      message: "Terlalu banyak penyesuaian saldo. Coba lagi sebentar.",
    });

    // Path: /api/admin/users/[id]/balance → ambil id dari pathname
    const parts = req.nextUrl.pathname.split("/");
    const userId = parts[parts.length - 2];
    if (!userId) throw Errors.notFound("User");

    const body = await req.json().catch(() => ({}));
    const { amount, description } = AdjustSchema.parse({ ...body, userId });

    // Pastikan user target ada
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true },
    });
    if (!target) throw Errors.notFound("User");

    const result = await prisma.$transaction(async (tx) => {
      // Lock balance row pakai upsert (handle case user belum punya record balance)
      let balance = await tx.balance.findUnique({ where: { userId } });
      if (!balance) {
        balance = await tx.balance.create({
          data: { userId, amount: new Prisma.Decimal(0) },
        });
      }

      const before = new Prisma.Decimal(balance.amount);
      const after = before.plus(new Prisma.Decimal(amount));

      if (after.lessThan(0)) {
        throw Errors.validation({
          message: `Saldo tidak cukup untuk pengurangan. Saldo saat ini ${before.toFixed(0)}.`,
        });
      }

      await tx.balance.update({
        where: { userId },
        data: {
          amount: after,
          version: { increment: 1 },
        },
      });

      const mutation = await tx.balanceMutation.create({
        data: {
          userId,
          type: "ADJUSTMENT",
          amount: new Prisma.Decimal(amount),
          balanceBefore: before,
          balanceAfter: after,
          description:
            description ||
            `Manual adjustment by admin ${admin.username} (${amount > 0 ? "credit" : "debit"})`,
          referenceType: "MANUAL",
          referenceId: admin.id,
        },
      });

      return {
        before: before.toString(),
        after: after.toString(),
        mutationId: mutation.id,
      };
    });

    logger.info("admin.balance.adjust", {
      by: admin.id,
      target: target.id,
      amount,
      after: result.after,
    });

    return ok({
      userId: target.id,
      username: target.username,
      amount,
      ...result,
    });
  },
);
