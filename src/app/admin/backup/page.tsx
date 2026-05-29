import {
  Database,
  Archive,
  HardDriveDownload,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { backupService } from "@/services/backup.service";
import { backupScheduler } from "@/services/backup-scheduler.service";
import { settingsService } from "@/services/settings.service";
import { BackupSettingsForm } from "@/features/admin/components/backup-settings-form";
import { BackupActions } from "@/features/admin/components/backup-actions";
import { BackupList } from "@/features/admin/components/backup-list";

export const metadata = { title: "Admin · Backup Database" };
export const dynamic = "force-dynamic";

export default async function AdminBackupPage() {
  const [files, lastRun, nextRun, cfg] = await Promise.all([
    backupService.list(),
    backupScheduler.getLastRunInfo(),
    backupScheduler.getNextRun(),
    settingsService.getBackupConfig(),
  ]);

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
            <Database className="h-6 w-6 text-primary md:h-7 md:w-7" />
            Backup Database
          </h1>
          <p className="text-sm text-muted-foreground">
            Snapshot, restore, dan auto-backup database MySQL.
          </p>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Total File"
          value={files.length.toLocaleString("id-ID")}
          icon={Archive}
          tone="text-foreground"
        />
        <Stat
          label="Total Ukuran"
          value={formatBytes(totalSize)}
          icon={HardDriveDownload}
          tone="text-primary"
        />
        <Stat
          label="Backup Terakhir"
          value={
            lastRun.ts
              ? new Date(lastRun.ts).toLocaleString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"
          }
          sub={lastRun.filename ?? undefined}
          icon={Clock}
          tone="text-emerald-500"
        />
        <Stat
          label={cfg.enabled ? "Backup Berikut" : "Auto-Backup"}
          value={
            cfg.enabled && nextRun.nextRunAt
              ? new Date(nextRun.nextRunAt).toLocaleString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Off"
          }
          sub={cfg.enabled ? nextRun.intervalText : "Aktifkan di pengaturan"}
          icon={cfg.enabled ? CheckCircle2 : XCircle}
          tone={cfg.enabled ? "text-emerald-500" : "text-muted-foreground"}
        />
      </div>

      {/* AUTO BACKUP SETTINGS */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Pengaturan Auto-Backup</CardTitle>
              <CardDescription>
                Atur frekuensi dan retensi snapshot otomatis.
              </CardDescription>
            </div>
            <Badge variant={cfg.enabled ? "success" : "secondary"}>
              {cfg.enabled ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <BackupSettingsForm initial={cfg} />
        </CardContent>
      </Card>

      {/* AKSI */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aksi</CardTitle>
          <CardDescription>
            Buat backup baru atau upload file backup dari komputer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <BackupActions />
          <p className="break-all text-[11px] text-muted-foreground">
            Lokasi:{" "}
            <span className="font-mono">{backupService.getDir()}</span>
          </p>
        </CardContent>
      </Card>

      {/* DAFTAR FILE */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Daftar Backup</CardTitle>
              <CardDescription>
                {files.length} file · total {formatBytes(totalSize)}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <BackupList
            files={files.map((f) => ({
              name: f.name,
              size: f.size,
              sizeText: f.sizeText,
              createdAt: f.createdAt.toISOString(),
              compressed: f.compressed,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Database;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div
        className={`mt-2 truncate text-lg font-semibold tabular-nums ${tone} md:text-xl`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 truncate text-[10px] text-muted-foreground">
          {sub}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
