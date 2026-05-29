#!/usr/bin/env bash
# =================================================================
# PTopup — Database Restore Script
# =================================================================
#
# Restore database dari file backup .sql atau .sql.gz.
# Otomatis pakai password dari /root/.ptopup-db-password.
#
# DESTRUCTIVE — akan DROP & recreate database `ptopup`. Wajib confirm.
#
# Cara pakai:
#   sudo bash restore-db.sh --input=/path/to/backup.sql.gz
#   sudo bash restore-db.sh --input=/path/to/backup.sql       # uncompressed
#   sudo bash restore-db.sh --input=backup.sql.gz --yes       # skip confirm
#
# Use cases:
#   1. Restore dari backup harian
#   2. Migrasi DB dari server lain (export di server A → upload → restore)
#   3. Sync staging ke production (atau sebaliknya)
#
# =================================================================
set -euo pipefail

DB_NAME="ptopup"
DB_USER="ptopup"
DB_PASS_FILE="/root/.ptopup-db-password"
INPUT=""
SKIP_CONFIRM=0

for arg in "$@"; do
  case $arg in
    --input=*) INPUT="${arg#*=}" ;;
    --yes|-y)  SKIP_CONFIRM=1 ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

[[ -z "$INPUT" ]] && {
  echo "Usage: $0 --input=<backup-file.sql[.gz]> [--yes]"
  echo ""
  echo "Examples:"
  echo "  sudo bash $0 --input=/var/backups/ptopup/ptopup-20260528-030000.sql.gz"
  echo "  sudo bash $0 --input=/tmp/migrate.sql --yes"
  exit 1
}

[[ $EUID -ne 0 ]] && { echo "ERROR: Harus run dengan sudo (root)."; exit 1; }
[[ ! -f "$INPUT" ]] && { echo "ERROR: File tidak ditemukan: $INPUT"; exit 1; }

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }

# Cek password file
[[ ! -f "$DB_PASS_FILE" ]] && err "Password file tidak ada: $DB_PASS_FILE"
DB_PASS=$(cat "$DB_PASS_FILE")

# Cek mysql
command -v mysql >/dev/null 2>&1 || err "mysql client tidak ada"

# Cek file size + format
SIZE=$(du -h "$INPUT" | awk '{print $1}')
log "Source: $INPUT ($SIZE)"

# Konfirmasi DESTRUCTIVE
echo ""
echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║${NC} ${RED}DESTRUCTIVE${NC} — akan ${RED}DROP${NC} database ${BLUE}$DB_NAME${NC} dan re-import dari      ${YELLOW}║${NC}"
echo -e "${YELLOW}║${NC} backup file. Data lama akan ${RED}HILANG TOTAL${NC}.                  ${YELLOW}║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [[ $SKIP_CONFIRM -eq 0 ]]; then
  echo -ne "${YELLOW}Lanjut restore? Ketik 'yes' untuk konfirmasi: ${NC}"
  read -r CONFIRM
  [[ "$CONFIRM" != "yes" ]] && { echo "Cancelled."; exit 0; }
fi

# Auto-detect compressed vs plain
if [[ "$INPUT" == *.gz ]]; then
  COMPRESSED=1
  log "Format: gzip-compressed"
else
  COMPRESSED=0
  log "Format: plain SQL"
fi

# Cek app sedang jalan? Stop dulu supaya gak ada concurrent write saat restore.
APP_USER="ptopup"
APP_RUNNING=0
if id "$APP_USER" >/dev/null 2>&1; then
  if sudo -u $APP_USER pm2 list 2>/dev/null | grep -q "ptopup.*online"; then
    APP_RUNNING=1
    log "App sedang jalan — stopping PM2 sementara..."
    sudo -u $APP_USER pm2 stop ptopup >/dev/null 2>&1
    ok "App stopped"
  fi
fi

# Drop & recreate database (clean slate)
log "Dropping & recreating database '$DB_NAME'..."
mysql -u root <<SQL
DROP DATABASE IF EXISTS \`$DB_NAME\`;
CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
SQL
ok "Database recreated"

# Restore
log "Importing backup (bisa beberapa menit utk DB besar)..."
if [[ $COMPRESSED -eq 1 ]]; then
  gunzip -c "$INPUT" | mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" 2>/dev/null
else
  mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$INPUT" 2>/dev/null
fi
ok "Import selesai"

# Verifikasi: hitung tables
TABLE_COUNT=$(mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SHOW TABLES;" 2>/dev/null | tail -n +2 | wc -l)
USER_COUNT=$(mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT COUNT(*) FROM users;" 2>/dev/null | tail -n +2 || echo "?")

ok "Tables restored: $TABLE_COUNT"
ok "Users in DB    : $USER_COUNT"

# Restart app kalau tadi sempat di-stop
if [[ $APP_RUNNING -eq 1 ]]; then
  log "Restarting app..."
  sudo -u $APP_USER pm2 restart ptopup >/dev/null 2>&1
  ok "App restarted"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 RESTORE SELESAI${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Source       : ${BLUE}$INPUT${NC}"
echo -e "  Tables       : ${BLUE}$TABLE_COUNT${NC}"
echo -e "  Users        : ${BLUE}$USER_COUNT${NC}"
[[ $APP_RUNNING -eq 1 ]] && echo -e "  App status   : ${BLUE}restarted${NC}"
echo ""
echo -e "${YELLOW}Verifikasi:${NC}"
echo -e "  Login admin & cek apakah data lengkap"
echo -e "  ${BLUE}pm2 logs ptopup${NC} untuk cek error startup"
echo ""
