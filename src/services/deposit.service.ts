/**
 * DepositService
 *
 * Flow utama:
 *  1. createPending()   — user request deposit. Generate uniqueCode, totalAmount,
 *     QRIS dynamic. Simpan record PENDING dengan expiresAt.
 *  2. handleDanaCallback() — endpoint webhook menerima notif Android forwarder.
 *     Match totalAmount dengan deposit pending, mark SUCCESS, kredit balance
 *     atomically (Balance + BalanceMutation).
 *  3. expirePending()   — cron / on-the-fly check; tandai EXPIRED jika lewat
 *     expiresAt tanpa pembayaran.
 *
 * Concurrency:
 *  - Schema punya unique([totalAmount, status]) → cegah 2 deposit pending
 *    dengan totalAmount sama (jika collision random, retry).
 *  - Match webhook dilakukan di dalam $transaction utk avoid race.
 */
import { randomInt } from "node:crypto";
import axios from "axios";
import { Prisma, type Deposit, type DepositStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Errors } from "@/lib/errors";
import { settingsService } from "./settings.service";

interface CreateDepositInput {
  userId: string;
  amount: number;
  description?: string;
}

interface CreateDepositResult {
  deposit: Deposit;
  /** EMVCo string (QR yang harus di-render menjadi gambar) */
  qrisPayload: string;
}

const QRIS_CONVERTER_URL = "https://qris-statis-to-dinamis.vercel.app/generate-qris";

class DepositService {
  /** Generate uniqueCode 3 digit (100-999) yang belum dipakai oleh deposit PENDING. */
  private async pickUniqueAmount(amount: number): Promise<{ uniqueCode: number; totalAmount: number }> {
    const MAX_TRIES = 20;
    for (let i = 0; i < MAX_TRIES; i++) {
      // CSPRNG biar gak predictable (meski hanya 3 digit, principle benar)
      const uniqueCode = randomInt(100, 1000); // 100-999
      const totalAmount = amount + uniqueCode;

      const existing = await prisma.deposit.findFirst({
        where: { totalAmount: new Prisma.Decimal(totalAmount), status: "PENDING" },
        select: { id: true },
      });
      if (!existing) return { uniqueCode, totalAmount };
    }
    throw Errors.conflict("Sistem sedang sibuk. Coba lagi sebentar.");
  }

  /** Convert QRIS statis → dinamis (dengan nominal terkunci). */
  private async generateDynamicQRIS(qrisCode: string, amount: number): Promise<string> {
    try {
      const res = await axios.post(
        QRIS_CONVERTER_URL,
        {
          qrisCode,
          nominal: amount.toString(),
          feeType: "r",
          fee: "0",
          includeFee: false,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 15_000,
        },
      );

      // API return either { qrCode: "data:image/png;base64,..." } atau payload string EMVCo.
      // Berdasarkan contoh di referensi, mereka return base64 PNG dataUrl.
      // Kita return raw payload kalau ada, atau dataUrl PNG sebagai fallback.
      const data = res.data as { qrCode?: string; payload?: string };
      const payload = data.payload ?? data.qrCode;
      if (!payload) {
        throw new Error("QRIS converter response empty.");
      }
      return payload;
    } catch (err) {
      logger.error("deposit.qris.generate_fail", {
        amount,
        err: (err as Error).message,
      });
      throw Errors.internal("Gagal generate QRIS dinamis. Coba lagi.");
    }
  }

  /**
   * Create deposit pending — user-facing.
   * Validasi: amount >= min, <= max, kelipatan 1 (no fractional Rupiah).
   */
  async createPending(input: CreateDepositInput): Promise<CreateDepositResult> {
    const cfg = await settingsService.getDepositConfig();

    if (!cfg.qrisCode) {
      throw Errors.internal("Admin belum mengatur QRIS. Hubungi admin.");
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw Errors.validation({ message: "Nominal tidak valid." });
    }
    if (input.amount < cfg.min) {
      throw Errors.validation({
        message: `Minimal deposit Rp ${cfg.min.toLocaleString("id-ID")}.`,
      });
    }
    if (input.amount > cfg.max) {
      throw Errors.validation({
        message: `Maksimal deposit Rp ${cfg.max.toLocaleString("id-ID")}.`,
      });
    }

    // Pastikan integer Rupiah
    const amount = Math.floor(input.amount);

    const { uniqueCode, totalAmount } = await this.pickUniqueAmount(amount);
    const qrisPayload = await this.generateDynamicQRIS(cfg.qrisCode, totalAmount);

    const expiresAt = new Date(Date.now() + cfg.expiryMin * 60_000);

    const deposit = await prisma.deposit.create({
      data: {
        userId: input.userId,
        method: "DANA",
        amount: new Prisma.Decimal(amount),
        uniqueCode,
        totalAmount: new Prisma.Decimal(totalAmount),
        status: "PENDING",
        qrisPayload,
        description: input.description,
        expiresAt,
      },
    });

    logger.info("deposit.created", {
      id: deposit.id,
      userId: input.userId,
      amount,
      totalAmount,
    });

    return { deposit, qrisPayload };
  }

  /** Cek satu deposit milik user (atau admin). Auto-expire kalau lewat waktu. */
  async getById(id: string, userId?: string): Promise<Deposit | null> {
    const deposit = await prisma.deposit.findUnique({ where: { id } });
    if (!deposit) return null;
    if (userId && deposit.userId !== userId) return null;

    // Auto-expire kalau pending tapi sudah lewat waktu
    if (deposit.status === "PENDING" && deposit.expiresAt < new Date()) {
      const updated = await prisma.deposit.update({
        where: { id },
        data: { status: "EXPIRED" },
      });
      return updated;
    }

    return deposit;
  }

  /**
   * Cancel deposit pending oleh user. Aman karena belum ada saldo dikredit.
   */
  async cancelPending(id: string, userId: string): Promise<Deposit> {
    const deposit = await prisma.deposit.findUnique({ where: { id } });
    if (!deposit || deposit.userId !== userId) {
      throw Errors.notFound("Deposit");
    }
    if (deposit.status !== "PENDING") {
      throw Errors.conflict("Deposit ini sudah tidak aktif.");
    }
    return prisma.deposit.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
  }

  /** List deposit milik user — untuk halaman riwayat. */
  async listByUser(userId: string, limit = 20) {
    return prisma.deposit.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Process notif DANA dari Android forwarder.
   * Forwarder mengirim raw notification (querystring) berisi pkg, title, text.
   *
   * Format text yang kita kenali:
   *   "Kamu berhasil menerima Rp10000 via Gopay ke akunmu. Cek yuk!"
   *   "Kamu berhasil menerima Rp 25.500 ..."
   *   "menerima Rp10000"
   *
   * Sekarang juga cek bigtext, subtext, infotext, dan title sebagai fallback
   * karena tiap aplikasi forwarder bisa kirim format berbeda.
   */
  async handleDanaCallback(payload: {
    pkg?: string;
    title?: string;
    text?: string;
    bigtext?: string;
    subtext?: string;
    infotext?: string;
    raw?: string;
  }): Promise<{ matched: boolean; depositId?: string; reason?: string }> {
    if (payload.pkg && payload.pkg !== "id.dana") {
      return { matched: false, reason: "pkg-mismatch" };
    }

    // Coba parse dari semua field yg mungkin berisi nominal.
    const candidates = [
      payload.text,
      payload.bigtext,
      payload.subtext,
      payload.infotext,
      payload.title,
    ].filter(Boolean) as string[];

    let amount: number | null = null;
    for (const c of candidates) {
      amount = parseDanaAmount(c);
      if (amount) break;
    }
    if (!amount) {
      logger.warn("deposit.callback.parse_fail", {
        text: payload.text,
        bigtext: payload.bigtext,
      });
      return { matched: false, reason: "amount-parse-fail" };
    }

    // Cari pending deposit dengan totalAmount yang match.
    // Pakai $transaction utk lock-and-update.
    const result = await prisma.$transaction(async (tx) => {
      const candidate = await tx.deposit.findFirst({
        where: {
          totalAmount: new Prisma.Decimal(amount),
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "asc" },
      });

      if (!candidate) {
        return { matched: false as const, reason: "no-match" };
      }

      // Mark deposit success
      const updated = await tx.deposit.update({
        where: { id: candidate.id },
        data: {
          status: "SUCCESS",
          paidAt: new Date(),
          callbackRaw: payload.raw ?? JSON.stringify(payload),
        },
      });

      // Kredit balance user
      const balance = await tx.balance.upsert({
        where: { userId: candidate.userId },
        create: {
          userId: candidate.userId,
          amount: new Prisma.Decimal(0),
        },
        update: {},
      });

      const before = new Prisma.Decimal(balance.amount);
      const after = before.plus(updated.amount); // amount asli (tanpa unique code)

      await tx.balance.update({
        where: { userId: candidate.userId },
        data: { amount: after, version: { increment: 1 } },
      });

      await tx.balanceMutation.create({
        data: {
          userId: candidate.userId,
          type: "TOPUP",
          amount: new Prisma.Decimal(updated.amount),
          balanceBefore: before,
          balanceAfter: after,
          description: `Deposit DANA · ${formatRp(Number(updated.amount))}`,
          referenceType: "DEPOSIT",
          referenceId: updated.id,
        },
      });

      return { matched: true as const, deposit: updated };
    });

    if (result.matched) {
      logger.info("deposit.callback.matched", {
        depositId: result.deposit.id,
        amount,
      });
      return { matched: true, depositId: result.deposit.id };
    }
    logger.warn("deposit.callback.no_match", { amount });
    return { matched: false, reason: result.reason };
  }

  /** Expire all pending deposits yg sudah lewat waktu (dipanggil dari cron / on-demand). */
  async expireOverdue(): Promise<number> {
    const result = await prisma.deposit.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });
    if (result.count > 0) {
      logger.info("deposit.expire.batch", { count: result.count });
    }
    return result.count;
  }

  // ===== Admin =====

  async listAll(opts: {
    status?: DepositStatus;
    q?: string;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.DepositWhereInput = {
      ...(opts.status && { status: opts.status }),
      ...(opts.q && {
        OR: [
          { id: { contains: opts.q } },
          { user: { username: { contains: opts.q } } },
          { user: { email: { contains: opts.q } } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      prisma.deposit.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: opts.skip ?? 0,
        take: opts.take ?? 20,
        include: {
          user: { select: { username: true, email: true } },
        },
      }),
      prisma.deposit.count({ where }),
    ]);
    return { items, total };
  }
}

/** Parse "Rp10.000", "Rp 10000", "Rp10,000.00" dst → integer rupiah. */
export function parseDanaAmount(text: string): number | null {
  if (!text) return null;
  // Cari pattern "Rp <digits/dots/commas>"
  const match = text.match(/Rp\s?([0-9.,]+)/i);
  if (!match) return null;
  // Buang semua titik & koma → asumsi format Indonesia/notasi nominal.
  // Sebenarnya bisa berisiko untuk currency yg pakai pemisah desimal, tapi
  // saldo DANA selalu integer rupiah (gak ada sen).
  const numeric = match[1]!.replace(/[^0-9]/g, "");
  if (!numeric) return null;
  const n = Number(numeric);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export const depositService = new DepositService();
