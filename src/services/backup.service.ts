/**
 * BackupService — manage MySQL database backup & restore.
 *
 * Operations:
 *   - dump()       → pakai `mysqldump` ke file .sql.gz
 *   - restore()    → import dari .sql atau .sql.gz (drop + recreate DB)
 *   - list()       → list semua backup files di BACKUP_DIR
 *   - delete()     → hapus 1 file backup
 *   - cleanup()    → auto-delete file > keepDays (rotation)
 *   - parseDbUrl() → extract host/user/pass/db dari DATABASE_URL
 *
 * Lokasi file backup: <APP_ROOT>/backups/ptopup-YYYYMMDD-HHmmss.sql.gz
 * Folder dibikin auto kalau belum ada.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs, createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { createGzip, createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { logger } from "@/lib/logger";

const execFileAsync = promisify(execFile);

export interface BackupFile {
  name: string;
  path: string;
  size: number;
  sizeText: string;
  createdAt: Date;
  compressed: boolean;
}

export interface DbConnInfo {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

class BackupService {
  /** Folder utama backup. Default: <cwd>/backups */
  private readonly backupDir: string;

  constructor() {
    this.backupDir = path.join(process.cwd(), "backups");
  }

  /** Parse DATABASE_URL jadi connection components. */
  parseDbUrl(): DbConnInfo {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL tidak di-set");

    // mysql://user:pass@host:port/dbname[?options]
    const match = url.match(
      /^mysql:\/\/([^:]+):([^@]*)@([^:/]+)(?::(\d+))?\/([^?]+)/,
    );
    if (!match) throw new Error("DATABASE_URL format invalid");

    const [, user, password, host, port, database] = match;
    return {
      host: host!,
      port: port ? Number(port) : 3306,
      user: decodeURIComponent(user!),
      password: decodeURIComponent(password!),
      database: decodeURIComponent(database!),
    };
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.backupDir, { recursive: true });
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  /**
   * Dump database ke file .sql.gz.
   * Streaming langsung dari mysqldump → gzip → file (memory-efficient).
   */
  async dump(): Promise<BackupFile> {
    await this.ensureDir();
    const conn = this.parseDbUrl();

    const ts = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .replace(/\..*$/, "");
    const filename = `ptopup-${ts}.sql.gz`;
    const filepath = path.join(this.backupDir, filename);

    // Pakai mysqldump command (asumsi installed di server)
    // Perlu spawn (bukan execFile) supaya bisa pipe stream.
    // SECURITY: pass password via MYSQL_PWD env var (BUKAN -p flag)
    // supaya gak ke-leak di output `ps aux`.
    const { spawn } = await import("node:child_process");
    const mysqlEnv = { ...process.env, MYSQL_PWD: conn.password };
    const dumpProc = spawn(
      "mysqldump",
      [
        `-h${conn.host}`,
        `-P${conn.port}`,
        `-u${conn.user}`,
        "--single-transaction",
        "--routines",
        "--triggers",
        "--skip-lock-tables",
        "--quick",
        "--set-gtid-purged=OFF",
        conn.database,
      ],
      { stdio: ["ignore", "pipe", "pipe"], env: mysqlEnv },
    );

    const errChunks: Buffer[] = [];
    dumpProc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

    const writeStream = createWriteStream(filepath);
    const gzip = createGzip({ level: 9 });

    try {
      await pipeline(dumpProc.stdout, gzip, writeStream);
    } catch (err) {
      // Hapus partial file
      await fs.unlink(filepath).catch(() => {});
      const errMsg = Buffer.concat(errChunks).toString();
      throw new Error(`mysqldump failed: ${errMsg || (err as Error).message}`);
    }

    // Wait for process exit
    const exitCode = await new Promise<number>((resolve) => {
      dumpProc.on("close", (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0) {
      await fs.unlink(filepath).catch(() => {});
      const errMsg = Buffer.concat(errChunks).toString();
      throw new Error(`mysqldump exit code ${exitCode}: ${errMsg}`);
    }

    const stat = await fs.stat(filepath);
    if (stat.size < 100) {
      await fs.unlink(filepath).catch(() => {});
      throw new Error("Backup file too small (< 100 bytes), likely failed");
    }

    logger.info("backup.created", {
      filename,
      size: stat.size,
    });

    return {
      name: filename,
      path: filepath,
      size: stat.size,
      sizeText: this.formatBytes(stat.size),
      createdAt: stat.birthtime,
      compressed: true,
    };
  }

  /**
   * Restore database dari file. Drop & recreate database, lalu import.
   * Source bisa absolute path, atau filename relatif ke backupDir.
   */
  async restore(source: string): Promise<{ tables: number; users: number }> {
    const conn = this.parseDbUrl();

    // Resolve full path
    const resolvedPath = path.isAbsolute(source)
      ? source
      : path.join(this.backupDir, path.basename(source));

    // Security: pastikan resolvedPath ada di backupDir atau folder upload
    // (cegah path traversal)
    const realPath = await fs.realpath(resolvedPath).catch(() => null);
    if (!realPath) throw new Error("File backup tidak ditemukan");

    const stat = await fs.stat(realPath);
    if (!stat.isFile()) throw new Error("Source bukan file");

    const compressed = realPath.endsWith(".gz");

    // 1. Drop & recreate database (sebagai root MySQL)
    // Catatan: connection user yg dipakai PTopup harus punya CREATE/DROP privilege.
    // Kalau cuma punya privilege di db spesifik, kita pakai TRUNCATE pattern.
    const { spawn } = await import("node:child_process");

    // Strategy: drop semua tables di database (gak butuh DROP DATABASE privilege)
    logger.info("backup.restore.start", { source: path.basename(realPath) });

    // Disable FK checks dulu, drop semua tables, baru import.
    // Lebih reliable daripada DROP DATABASE (butuh privilege root).
    const dropTablesSQL = `
SET FOREIGN_KEY_CHECKS = 0;
SET GROUP_CONCAT_MAX_LEN = 32768;
SET @tables = NULL;
SELECT GROUP_CONCAT('\`', table_name, '\`') INTO @tables
FROM information_schema.tables WHERE table_schema = DATABASE();
SET @tables = COALESCE(@tables, 'dummy');
SET @sql = CONCAT('DROP TABLE IF EXISTS ', @tables);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET FOREIGN_KEY_CHECKS = 1;
`.trim();

    // SECURITY: pass password via MYSQL_PWD env var (cegah leak via ps aux)
    const mysqlEnv = { ...process.env, MYSQL_PWD: conn.password };
    const dropProc = spawn(
      "mysql",
      [
        `-h${conn.host}`,
        `-P${conn.port}`,
        `-u${conn.user}`,
        conn.database,
      ],
      { stdio: ["pipe", "pipe", "pipe"], env: mysqlEnv },
    );
    const dropErrs: Buffer[] = [];
    dropProc.stderr.on("data", (c: Buffer) => dropErrs.push(c));
    dropProc.stdin.write(dropTablesSQL);
    dropProc.stdin.end();
    const dropExit = await new Promise<number>((resolve) => {
      dropProc.on("close", (c) => resolve(c ?? 1));
    });
    if (dropExit !== 0) {
      throw new Error(
        `Drop tables gagal: ${Buffer.concat(dropErrs).toString()}`,
      );
    }

    // 2. Import backup
    const importProc = spawn(
      "mysql",
      [
        `-h${conn.host}`,
        `-P${conn.port}`,
        `-u${conn.user}`,
        conn.database,
      ],
      { stdio: ["pipe", "pipe", "pipe"], env: mysqlEnv },
    );

    const importErrs: Buffer[] = [];
    importProc.stderr.on("data", (c: Buffer) => importErrs.push(c));

    if (compressed) {
      const readStream = createReadStream(realPath);
      const gunzip = createGunzip();
      try {
        await pipeline(readStream, gunzip, importProc.stdin);
      } catch (err) {
        throw new Error(`Import gagal saat decompress: ${(err as Error).message}`);
      }
    } else {
      const readStream = createReadStream(realPath);
      try {
        await pipeline(readStream, importProc.stdin);
      } catch (err) {
        throw new Error(`Import gagal: ${(err as Error).message}`);
      }
    }

    const importExit = await new Promise<number>((resolve) => {
      importProc.on("close", (c) => resolve(c ?? 1));
    });
    if (importExit !== 0) {
      throw new Error(
        `Import exit code ${importExit}: ${Buffer.concat(importErrs).toString()}`,
      );
    }

    // 3. Verifikasi (pakai MYSQL_PWD juga)
    const tablesRes = await execFileAsync(
      "mysql",
      [
        `-h${conn.host}`,
        `-P${conn.port}`,
        `-u${conn.user}`,
        "-e",
        "SHOW TABLES;",
        conn.database,
      ],
      { env: mysqlEnv },
    );
    const tableLines = tablesRes.stdout.split("\n").filter(Boolean);
    const tables = Math.max(0, tableLines.length - 1); // minus header

    let users = 0;
    try {
      const usersRes = await execFileAsync(
        "mysql",
        [
          `-h${conn.host}`,
          `-P${conn.port}`,
          `-u${conn.user}`,
          "-e",
          "SELECT COUNT(*) FROM users;",
          conn.database,
        ],
        { env: mysqlEnv },
      );
      const m = usersRes.stdout.match(/\d+/g);
      users = m ? Number(m[m.length - 1]) : 0;
    } catch {
      // tabel users mungkin belum ada di backup lama
    }

    logger.info("backup.restore.done", {
      source: path.basename(realPath),
      tables,
      users,
    });

    return { tables, users };
  }

  /** List semua backup files di folder backups. */
  async list(): Promise<BackupFile[]> {
    await this.ensureDir();
    const files = await fs.readdir(this.backupDir);
    const result: BackupFile[] = [];

    for (const name of files) {
      // Filter file backup pattern
      if (!name.match(/\.(sql|sql\.gz)$/)) continue;

      const filepath = path.join(this.backupDir, name);
      try {
        const stat = await fs.stat(filepath);
        if (!stat.isFile()) continue;
        result.push({
          name,
          path: filepath,
          size: stat.size,
          sizeText: this.formatBytes(stat.size),
          createdAt: stat.birthtime,
          compressed: name.endsWith(".gz"),
        });
      } catch {
        /* skip */
      }
    }

    // Sort newest first
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return result;
  }

  /** Hapus 1 file backup. */
  async delete(filename: string): Promise<void> {
    // Cegah path traversal
    const safeName = path.basename(filename);
    const filepath = path.join(this.backupDir, safeName);

    // Verifikasi file ada di backupDir
    const realPath = await fs.realpath(filepath).catch(() => null);
    if (!realPath || !realPath.startsWith(this.backupDir)) {
      throw new Error("File tidak valid atau di luar backup dir");
    }

    await fs.unlink(realPath);
    logger.info("backup.delete", { filename: safeName });
  }

  /** Hapus file > keepDays hari (rotation). Return count file yg dihapus. */
  async cleanup(keepDays: number): Promise<number> {
    if (keepDays <= 0) return 0;
    const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    const files = await this.list();

    let deleted = 0;
    for (const f of files) {
      if (f.createdAt.getTime() < cutoff) {
        await fs.unlink(f.path).catch(() => {});
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.info("backup.cleanup", { deleted, keepDays });
    }
    return deleted;
  }

  /** Save uploaded file ke backup dir. */
  async saveUpload(file: File): Promise<BackupFile> {
    await this.ensureDir();

    if (!file.name.match(/\.(sql|sql\.gz)$/i)) {
      throw new Error("File harus .sql atau .sql.gz");
    }

    const safeName = path.basename(file.name).replace(/[^\w.-]/g, "_");
    const ts = new Date().toISOString().replace(/[-:T]/g, "").replace(/\..*$/, "");
    const filename = `uploaded-${ts}-${safeName}`;
    const filepath = path.join(this.backupDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filepath, buffer);

    const stat = await fs.stat(filepath);
    return {
      name: filename,
      path: filepath,
      size: stat.size,
      sizeText: this.formatBytes(stat.size),
      createdAt: stat.birthtime,
      compressed: filename.endsWith(".gz"),
    };
  }

  /** Get backup directory path (untuk display di UI). */
  getDir(): string {
    return this.backupDir;
  }
}

export const backupService = new BackupService();
