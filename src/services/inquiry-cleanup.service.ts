/**
 * InquiryCleanupScheduler — auto-mark inquiry pasca yang sudah expired.
 *
 * Inquiry pasca yang dibuat user (status=PENDING, isInquiryOnly=true) akan
 * jadi sampah kalau user tidak konfirmasi bayar sebelum:
 *  - `expiredAt` lewat (default 30 menit), atau
 *  - tanggal sudah ganti hari (Digiflazz reject pay-pasca beda hari).
 *
 * Scheduler ini scan tiap 5 menit dan flip status → EXPIRED supaya
 * tidak tercampur di histori PENDING aktif.
 *
 * Init via instrumentation hook (sama seperti BackupScheduler).
 */
import { TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const TICK_INTERVAL = 5 * 60_000; // 5 menit
const FIRST_RUN_DELAY = 10_000; // 10 detik setelah app boot

class InquiryCleanupScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private isExecuting = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info("inquiry.cleanup.start");
    setTimeout(() => this.tick(), FIRST_RUN_DELAY);
    this.timer = setInterval(() => this.tick(), TICK_INTERVAL);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    logger.info("inquiry.cleanup.stop");
  }

  /** Manual trigger — untuk tombol admin atau test. */
  async runOnce(): Promise<{ expired: number }> {
    return this.execute();
  }

  private async tick(): Promise<void> {
    if (this.isExecuting) return;
    try {
      await this.execute();
    } catch (err) {
      logger.warn("inquiry.cleanup.tick_fail", { err: String(err) });
    }
  }

  private async execute(): Promise<{ expired: number }> {
    this.isExecuting = true;
    try {
      const now = new Date();
      // Mulai hari ini (00:00) — semua inquiry sebelum tanggal hari ini
      // otomatis expired meski expiredAt-nya belum tercapai (aturan Digiflazz).
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const result = await prisma.transaction.updateMany({
        where: {
          isInquiryOnly: true,
          status: TransactionStatus.PENDING,
          OR: [
            { expiredAt: { lt: now } },
            { createdAt: { lt: startOfToday } },
          ],
        },
        data: {
          status: TransactionStatus.EXPIRED,
          providerMessage: "Inquiry kedaluwarsa.",
        },
      });

      if (result.count > 0) {
        logger.info("inquiry.cleanup.done", { expired: result.count });
      }
      return { expired: result.count };
    } finally {
      this.isExecuting = false;
    }
  }
}

export const inquiryCleanupScheduler = new InquiryCleanupScheduler();
