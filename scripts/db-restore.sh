#!/usr/bin/env bash
# =================================================================
# PTopup — DB Restore Script
# =================================================================
#
# Restore database `ptopup` dari file SQL backup.
# Otomatis backup DB current dulu sebelum restore (safety net).
#
# Cara pakai:
#   sudo bash db-restore.sh /path/to/backup.sql
#   sudo bash db-restore.sh https://example.com/backup.sql
#   sudo bash db-restore.sh /path/to/backup.sql.gz       (auto-decompress)
#   sudo bash db-restore.sh --yes /path/to/backup.sql    (skip konfirmasi)
#   sudo bash db-restore.sh --no-restart backup.sql      (tidak restart app)
#
# Yang dilakukan:
#   1. Validasi file SQL (atau download kalau URL)
#   2. Backup DB current → /root/backups/pre-restore-YYYYMMDD-HHMMSS.sql
#   3. Drop semua tabel di DB ptopup
#   4. Import file SQL backup
#   5. Run `prisma db push` (sync schema kalau ada kolom baru)
#   6. Restart PM2 ptopup (kecuali --no-restart)
#
# =================================================================
set -euo pipefail

# ----------------------- args -----------------------
SKIP_CONFIRM=0
NO_RESTART=0
BACKUP_SOURCE=""

for arg in "$@"; do
  case $arg in
    --yes|-y)       SKIP_CONFIRM=1 ;;
    --no-restart)   NO_RESTART=1 ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    -*)
      echo "Unknown flag: $arg"
      exit 1
      ;;
    *)
      if [[ -z "$BACKUP_SOURCE" ]]; then
        BACKUP_SOURCE="$arg"
      else
        echo "Multiple sources tidak didukung. Sumber pertama: $BACKUP_SOURCE"
        exit 1
      fi
      ;;
  esac
done

[[ -z "$BACKUP_SOURCE" ]] && {
  echo "Usage: $0 <file.sql | url> [--yes] [--no-restart]"
  echo "Contoh:"
  echo "  sudo bash $0 /root/backup.sql"
  echo "  sudo bash $0 https://example.com/backup.sql.gz"
  exit 1
}

[[ $EUID -ne 0 ]] && { echo "ERROR: Harus run dengan sudo (root)."; exit 1; }

# ----------------------- logging -----------------------
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}═══ $1 ═══${NC}"; }

APP_DIR="/opt/ptopup"
APP_USER="ptopup"
DB_NAME="ptopup"
DB_USER="ptopup"
DB_PASS_FILE="/root/.ptopup-db-password"
BACKUP_DIR="/root/backups"
TMP_DIR=$(mktemp -d)

# Cleanup tmp dir saat exit
trap 'rm -rf "$TMP_DIR"' EXIT

# ============================================================
# STEP 1 — Validasi & resolve source
# ============================================================
step "1/6 — Validasi sumber backup"

# Cek mysql tersedia
command -v mysql >/dev/null || err "MySQL client gak ada. Install dulu: apt install mysql-client"

# Cek password file
[[ ! -f "$DB_PASS_FILE" ]] && err "Password file gak ada: $DB_PASS_FILE. App belum di-deploy?"
DB_PASS=$(cat "$DB_PASS_FILE")

# ----------------------- detect MySQL auth -----------------------
# Deteksi metode auth SEKALI di awal, pakai konsisten di semua call.
# Penting: jangan pakai pattern 'mysql cmd1 || mysql cmd2' untuk import,
# karena kalau cmd1 sukses partial (misal sampai CREATE TABLE),
# fallback cmd2 akan retry dari awal -> error duplicate table.
if mysql -u root -e "SELECT 1" >/dev/null 2>&1; then
  MYSQL_AUTH=(-u root)
  MYSQLDUMP_AUTH=(-u root)
  AUTH_INFO="root (auth_socket)"
elif mysql -u "$DB_USER" -p"$DB_PASS" -e "SELECT 1" >/dev/null 2>&1; then
  MYSQL_AUTH=(-u "$DB_USER" "-p$DB_PASS")
  MYSQLDUMP_AUTH=(-u "$DB_USER" "-p$DB_PASS")
  AUTH_INFO="$DB_USER (password)"
else
  err "Gak bisa connect MySQL (root maupun $DB_USER). Cek password di $DB_PASS_FILE."
fi
ok "MySQL auth: $AUTH_INFO"

# Resolve source: URL atau file
SQL_FILE=""
if [[ "$BACKUP_SOURCE" =~ ^https?:// ]]; then
  log "Download backup dari URL..."
  SQL_FILE="$TMP_DIR/download.sql"
  if [[ "$BACKUP_SOURCE" == *.gz ]]; then
    SQL_FILE="${SQL_FILE}.gz"
  fi
  curl -fsSL "$BACKUP_SOURCE" -o "$SQL_FILE" || err "Download gagal: $BACKUP_SOURCE"
  ok "Downloaded: $(du -h "$SQL_FILE" | awk '{print $1}')"
else
  [[ ! -f "$BACKUP_SOURCE" ]] && err "File gak ada: $BACKUP_SOURCE"
  SQL_FILE="$BACKUP_SOURCE"
  ok "File: $SQL_FILE ($(du -h "$SQL_FILE" | awk '{print $1}'))"
fi

# Decompress kalau .gz
if [[ "$SQL_FILE" == *.gz ]]; then
  log "Decompress .gz..."
  command -v gunzip >/dev/null || err "gunzip gak ada. Install: apt install gzip"
  DECOMPRESSED="$TMP_DIR/restore.sql"
  gunzip -c "$SQL_FILE" > "$DECOMPRESSED"
  SQL_FILE="$DECOMPRESSED"
  ok "Decompressed: $(du -h "$SQL_FILE" | awk '{print $1}')"
fi

# Quick sanity check — file harus ada SQL statement
if ! grep -qiE "(CREATE TABLE|INSERT INTO|DROP TABLE)" "$SQL_FILE"; then
  warn "File ini gak terlihat seperti SQL dump valid. Lanjut anyway?"
  if [[ $SKIP_CONFIRM -eq 0 ]]; then
    echo -ne "${YELLOW}Lanjut? (yes/no): ${NC}"
    read -r ANS
    [[ "$ANS" != "yes" ]] && { echo "Dibatalkan."; exit 0; }
  fi
fi

# ============================================================
# STEP 2 — Konfirmasi
# ============================================================
if [[ $SKIP_CONFIRM -eq 0 ]]; then
  step "2/6 — Konfirmasi"

  # Hitung jumlah tabel & row di DB current
  CURRENT_TABLES=$(mysql "${MYSQL_AUTH[@]}" -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME';" 2>/dev/null || echo "?")
  CURRENT_USERS=$(mysql "${MYSQL_AUTH[@]}" -N -e "SELECT COUNT(*) FROM $DB_NAME.User;" 2>/dev/null || echo "?")

  echo ""
  echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║${NC}  PTopup — DB RESTORE                                       ${YELLOW}║${NC}"
  echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  Database         : ${BLUE}$DB_NAME${NC}"
  echo -e "  Tabel current    : ${BLUE}$CURRENT_TABLES tabel${NC}"
  echo -e "  User current     : ${BLUE}$CURRENT_USERS user${NC}"
  echo -e "  Source           : ${BLUE}$BACKUP_SOURCE${NC}"
  echo -e "  Auto-backup ke   : ${BLUE}$BACKUP_DIR/${NC}"
  echo ""
  echo -e "${RED}⚠ SEMUA DATA SAAT INI AKAN DI-OVERWRITE!${NC}"
  echo -e "${YELLOW}  (tapi auto-backup dulu, jadi masih bisa di-rollback)${NC}"
  echo ""
  echo -ne "${YELLOW}Lanjut? (ketik 'yes' untuk konfirmasi): ${NC}"
  read -r CONFIRM
  [[ "$CONFIRM" != "yes" ]] && { echo "Dibatalkan."; exit 0; }
else
  step "2/6 — Skip konfirmasi (--yes)"
fi

# ============================================================
# STEP 3 — Auto-backup DB current
# ============================================================
step "3/6 — Backup DB current (safety net)"

mkdir -p "$BACKUP_DIR"
PRE_BACKUP="$BACKUP_DIR/pre-restore-$(date +%Y%m%d-%H%M%S).sql"

log "Dump DB current ke $PRE_BACKUP..."
mysqldump "${MYSQLDUMP_AUTH[@]}" \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    "$DB_NAME" > "$PRE_BACKUP" || err "mysqldump gagal. Cek MySQL access."

BACKUP_SIZE=$(du -h "$PRE_BACKUP" | awk '{print $1}')
ok "Backup tersimpan: $PRE_BACKUP ($BACKUP_SIZE)"
echo -e "  ${YELLOW}Rollback command:${NC} sudo bash $0 $PRE_BACKUP --yes"

# ============================================================
# STEP 4 — Drop semua tabel & restore
# ============================================================
step "4/6 — Restore database"

# Stop app dulu biar gak ada query connection masuk pas restore
if [[ $NO_RESTART -eq 0 ]]; then
  log "Stop PM2 ptopup sementara..."
  sudo -u "$APP_USER" pm2 stop ptopup >/dev/null 2>&1 || true
fi

log "Drop & recreate database $DB_NAME..."
DROP_SQL="DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql "${MYSQL_AUTH[@]}" -e "$DROP_SQL" || err "Gagal drop/create database."
ok "Database fresh"

log "Import SQL (bisa lama tergantung size)..."
# Disable FK & unique checks selama import biar gak fail karena urutan tabel
# (mysqldump kadang gak include SET FOREIGN_KEY_CHECKS=0 di header)
{
  echo "SET FOREIGN_KEY_CHECKS=0;"
  echo "SET UNIQUE_CHECKS=0;"
  echo "SET AUTOCOMMIT=0;"
  cat "$SQL_FILE"
  echo "SET FOREIGN_KEY_CHECKS=1;"
  echo "SET UNIQUE_CHECKS=1;"
  echo "COMMIT;"
} | mysql "${MYSQL_AUTH[@]}" "$DB_NAME" || err "Import SQL gagal. Cek format file."
ok "SQL imported"

# Verifikasi
NEW_TABLES=$(mysql "${MYSQL_AUTH[@]}" -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME';" 2>/dev/null || echo "?")
NEW_USERS=$(mysql "${MYSQL_AUTH[@]}" -N -e "SELECT COUNT(*) FROM $DB_NAME.User;" 2>/dev/null || echo "0")
ok "Hasil: $NEW_TABLES tabel, $NEW_USERS user"

# ============================================================
# STEP 5 — Sync schema (kalau ada kolom baru di code)
# ============================================================
step "5/6 — Sync schema dengan Prisma"

if [[ -d "$APP_DIR" && -f "$APP_DIR/prisma/schema.prisma" ]]; then
  log "Run prisma db push (sync kolom baru kalau ada)..."
  sudo -u "$APP_USER" bash -lc "cd $APP_DIR && npx prisma db push --skip-generate --accept-data-loss=false" 2>&1 | tail -5 || {
    warn "Prisma db push gagal/ada warning. Cek manual:"
    warn "  cd $APP_DIR && sudo -u $APP_USER npx prisma db push"
  }
  ok "Schema synced"
else
  warn "App dir gak ditemukan, skip prisma sync"
fi

# ============================================================
# STEP 6 — Restart app
# ============================================================
step "6/6 — Restart app"

if [[ $NO_RESTART -eq 1 ]]; then
  warn "Skip restart (--no-restart). Restart manual:"
  warn "  sudo -u $APP_USER pm2 restart ptopup"
else
  sudo -u "$APP_USER" pm2 restart ptopup >/dev/null 2>&1 || \
  sudo -u "$APP_USER" bash -lc "cd $APP_DIR && PORT=3000 pm2 start npm --name ptopup -- run start" >/dev/null 2>&1 || \
    warn "Gagal restart. Run manual: sudo -u $APP_USER pm2 restart ptopup"
  ok "App restarted"
fi

# ============================================================
# DONE
# ============================================================
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ RESTORE SELESAI${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Database     : ${BLUE}$DB_NAME${NC}"
echo -e "  Hasil        : ${BLUE}$NEW_TABLES tabel, $NEW_USERS user${NC}"
echo -e "  Source       : ${BLUE}$BACKUP_SOURCE${NC}"
echo -e "  Pre-restore  : ${BLUE}$PRE_BACKUP${NC}"
echo ""
echo -e "${YELLOW}KALAU ADA MASALAH (rollback ke kondisi sebelum restore):${NC}"
echo -e "  ${BLUE}sudo bash $0 $PRE_BACKUP --yes${NC}"
echo ""
echo -e "${YELLOW}VERIFIKASI:${NC}"
echo -e "  ${BLUE}sudo mysql ${DB_NAME} -e \"SHOW TABLES; SELECT COUNT(*) AS users FROM User;\"${NC}"
echo -e "  Buka app : ${BLUE}https://yourdomain.com${NC}"
echo ""
