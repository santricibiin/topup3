/**
 * BackupScheduler — auto-run backup berdasar cron expression dari settings.
 *
 * Strategi:
 *  - Pakai setInterval ringan yang tiap menit cek "saatnya backup atau belum"
 *  - State terakhir backup disimpan di file `.last-backup` di backup dir
 *  - Re-load setting tiap kali tick (jadi perubahan UI langsung effective)
 *  - Cleanup file lama otomatis berdasarkan keepDays
 *
 * Init di app boot via instrumentation hook Next.js.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { backupService } from "./backup.service";
import { settingsService, SETTING_KEYS } from "./settings.service";
import { logger } from "@/lib/logger";

const TICK_INTERVAL = 60_000; // cek tiap 1 menit
const STATE_FILE = ".last-backup";

class BackupScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private isExecuting = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info("backup.scheduler.start");

    // Tick pertama setelah delay singkat (biar app fully booted)
    setTimeout(() => this.tick(), 5_000);
    this.timer = setInterval(() => this.tick(), TICK_INTERVAL);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    logger.info("backup.scheduler.stop");
  }

  /** Manual trigger — buat dipanggil dari API saat user klik "Backup Now". */
  async runOnce(): Promise<{ filename: string; size: number }> {
    if (this.isExecuting) {
      throw new Error("Backup sedang berjalan, coba lagi sebentar.");
    }
    this.isExecuting = true;
    try {
      const file = await backupService.dump();
      await this.saveLastRun(file.name);
      // Cleanup file lama setelah backup baru sukses
      const cfg = await this.loadConfig();
      await backupService.cleanup(cfg.keepDays);
      return { filename: file.name, size: file.size };
    } finally {
      this.isExecuting = false;
    }
  }

  private async tick(): Promise<void> {
    if (this.isExecuting) return;

    let cfg;
    try {
      cfg = await this.loadConfig();
    } catch (err) {
      logger.warn("backup.scheduler.config_fail", { err: String(err) });
      return;
    }

    if (!cfg.enabled) return;

    // Cek kapan backup terakhir
    const lastRun = await this.getLastRun();
    const intervalMs = this.toMs(cfg.interval, cfg.value);
    if (intervalMs <= 0) return;

    const now = Date.now();
    if (lastRun && now - lastRun < intervalMs) {
      return; // belum waktunya
    }

    // Saatnya backup
    this.isExecuting = true;
    try {
      logger.info("backup.scheduler.run");
      const file = await backupService.dump();
      await this.saveLastRun(file.name);
      const deleted = await backupService.cleanup(cfg.keepDays);
      logger.info("backup.scheduler.done", {
        filename: file.name,
        size: file.size,
        deletedOld: deleted,
      });
    } catch (err) {
      logger.error("backup.scheduler.fail", { err: String(err) });
    } finally {
      this.isExecuting = false;
    }
  }

  private async loadConfig() {
    const enabled =
      (await settingsService.get(SETTING_KEYS.BACKUP_ENABLED)) === "true";
    const interval = await settingsService.get(SETTING_KEYS.BACKUP_INTERVAL); // "minutes" | "hours" | "days"
    const valueRaw = await settingsService.get(SETTING_KEYS.BACKUP_VALUE);
    const keepRaw = await settingsService.get(SETTING_KEYS.BACKUP_KEEP_DAYS);

    return {
      enabled,
      interval: interval || "days",
      value: Math.max(1, Number(valueRaw) || 1),
      keepDays: Math.max(0, Number(keepRaw) || 7),
    };
  }

  private toMs(interval: string, value: number): number {
    switch (interval) {
      case "minutes":
        return value * 60_000;
      case "hours":
        return value * 60 * 60_000;
      case "days":
        return value * 24 * 60 * 60_000;
      default:
        return 0;
    }
  }

  private statePath(): string {
    return path.join(backupService.getDir(), STATE_FILE);
  }

  async getLastRun(): Promise<number | null> {
    try {
      const txt = await fs.readFile(this.statePath(), "utf-8");
      const parsed = JSON.parse(txt) as { ts: number };
      return parsed.ts;
    } catch {
      return null;
    }
  }

  async getLastRunInfo(): Promise<{ ts: number | null; filename: string | null }> {
    try {
      const txt = await fs.readFile(this.statePath(), "utf-8");
      const parsed = JSON.parse(txt) as { ts: number; filename: string };
      return { ts: parsed.ts, filename: parsed.filename };
    } catch {
      return { ts: null, filename: null };
    }
  }

  private async saveLastRun(filename: string): Promise<void> {
    try {
      await fs.mkdir(backupService.getDir(), { recursive: true });
      await fs.writeFile(
        this.statePath(),
        JSON.stringify({ ts: Date.now(), filename }, null, 2),
      );
    } catch (err) {
      logger.warn("backup.scheduler.state_save_fail", { err: String(err) });
    }
  }

  /** Untuk UI — preview waktu backup berikutnya berdasar config sekarang. */
  async getNextRun(): Promise<{
    enabled: boolean;
    nextRunAt: Date | null;
    intervalText: string;
  }> {
    const cfg = await this.loadConfig();
    if (!cfg.enabled) {
      return {
        enabled: false,
        nextRunAt: null,
        intervalText: "Auto-backup off",
      };
    }
    const lastRun = await this.getLastRun();
    const intervalMs = this.toMs(cfg.interval, cfg.value);
    const baseTs = lastRun ?? Date.now();
    const nextRunAt = new Date(baseTs + intervalMs);
    const intervalText = `${cfg.value} ${cfg.interval}`;
    return { enabled: true, nextRunAt, intervalText };
  }
}

export const backupScheduler = new BackupScheduler();
