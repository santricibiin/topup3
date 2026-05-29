/**
 * Prisma seed — data awal (admin, sample products).
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ---- Admin user ----
  const adminEmail = "admin@ptopup.local";
  const passwordHash = await bcrypt.hash("Admin#12345", 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      username: "admin",
      passwordHash,
      fullName: "Super Admin",
      role: "ADMIN",
      balance: { create: { amount: 0 } },
    },
  });

  // ---- Sample product (Mobile Legends 86 Diamond) ----
  await prisma.product.upsert({
    where: { sku: "MLBB86" },
    update: {},
    create: {
      sku: "MLBB86",
      name: "Mobile Legends 86 Diamond",
      brand: "MOBILE LEGENDS",
      category: "GAME",
      type: "Diamond",
      basePrice: 21500,
      sellPrice: 23000,
      status: "ACTIVE",
    },
  });

  // eslint-disable-next-line no-console
  console.log("Seed complete. Admin:", admin.email);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
