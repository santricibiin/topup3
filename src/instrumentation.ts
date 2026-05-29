/**
 * Next.js instrumentation hook — dipanggil sekali saat app boot.
 *
 * Dipakai untuk start scheduler-scheduler background:
 *  - BackupScheduler: auto-backup DB sesuai config
 *  - InquiryCleanupScheduler: auto-expired inquiry pasca yg nyangkut
 *
 * Hanya jalan di runtime "nodejs" (skip edge runtime).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { backupScheduler } = await import(
      "@/services/backup-scheduler.service"
    );
    backupScheduler.start();
  } catch (err) {
    // jangan crash app boot karena scheduler gagal start
    // (mis. saat build / introspection)
    // eslint-disable-next-line no-console
    console.warn("[instrumentation] backupScheduler start failed:", err);
  }

  try {
    const { inquiryCleanupScheduler } = await import(
      "@/services/inquiry-cleanup.service"
    );
    inquiryCleanupScheduler.start();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[instrumentation] inquiryCleanupScheduler start failed:",
      err,
    );
  }
}
