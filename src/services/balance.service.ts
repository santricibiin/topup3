/**
 * Balance Service — semua perubahan saldo HARUS via service ini.
 * Dirancang untuk dipakai DI DALAM prisma.$transaction(tx => ...).
 *
 * Aturan:
 * - Locking optimistic via field `version` pada Balance.
 * - Menulis BalanceMutation untuk audit trail di setiap operasi.
 * - Return Balance terbaru.
 */
import { Prisma, BalanceMutationType } from "@prisma/client";
import { Errors } from "@/lib/errors";

export interface MutateParams {
  userId: string;
  amount: Prisma.Decimal | number | string; // selalu positif (besaran)
  type: BalanceMutationType;
  description?: string;
  referenceId?: string;
  referenceType?: string;
}

type Tx = Prisma.TransactionClient;

export const balanceService = {
  /** Tambah saldo (TOPUP, REFUND, ADJUSTMENT (+), COMMISSION). */
  async credit(tx: Tx, p: MutateParams) {
    return mutate(tx, p, "CREDIT");
  },

  /** Kurangi saldo (PURCHASE, ADJUSTMENT (-)). */
  async debit(tx: Tx, p: MutateParams) {
    return mutate(tx, p, "DEBIT");
  },

  async getOrCreate(tx: Tx, userId: string) {
    const balance = await tx.balance.findUnique({ where: { userId } });
    if (balance) return balance;
    return tx.balance.create({ data: { userId, amount: 0 } });
  },
};

async function mutate(tx: Tx, p: MutateParams, dir: "CREDIT" | "DEBIT") {
  const amount = new Prisma.Decimal(p.amount);
  if (amount.lte(0)) throw Errors.validation({ amount: "harus > 0" });

  const balance = await tx.balance.findUnique({ where: { userId: p.userId } });
  if (!balance) throw Errors.notFound("Balance");

  const before = balance.amount;
  const after = dir === "CREDIT" ? before.add(amount) : before.sub(amount);

  if (dir === "DEBIT" && after.lt(0)) {
    throw Errors.insufficientBalance();
  }

  // Optimistic locking: update hanya jika version sama dengan yang kita baca.
  const updated = await tx.balance.updateMany({
    where: { userId: p.userId, version: balance.version },
    data: {
      amount: after,
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw Errors.conflict("Saldo sedang diubah oleh proses lain. Coba lagi.");
  }

  await tx.balanceMutation.create({
    data: {
      userId: p.userId,
      type: p.type,
      amount: dir === "CREDIT" ? amount : amount.neg(),
      balanceBefore: before,
      balanceAfter: after,
      description: p.description,
      referenceId: p.referenceId,
      referenceType: p.referenceType,
    },
  });

  return tx.balance.findUniqueOrThrow({ where: { userId: p.userId } });
}
