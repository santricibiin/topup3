import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Pending deposits dalam 30 menit terakhir
  const pending = await prisma.deposit.findMany({
    where: {
      status: "PENDING",
      createdAt: { gte: new Date(Date.now() - 30 * 60_000) },
    },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { username: true, email: true } } },
  });

  // Setting secret saat ini (utk verify)
  const secret = await prisma.setting.findUnique({
    where: { key: "deposit.callbackSecret" },
  });

  console.log(
    JSON.stringify(
      {
        currentSecret: secret?.value
          ? secret.value.slice(0, 8) + "..." + secret.value.slice(-8)
          : null,
        currentSecretLength: secret?.value?.length ?? 0,
        pendingDeposits: pending.map((d) => ({
          id: d.id,
          username: d.user.username,
          amount: d.amount.toString(),
          totalAmount: d.totalAmount.toString(),
          uniqueCode: d.uniqueCode,
          status: d.status,
          createdAt: d.createdAt,
          expiresAt: d.expiresAt,
          minutesAgo: Math.floor(
            (Date.now() - d.createdAt.getTime()) / 60_000,
          ),
        })),
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main();
