#!/usr/bin/env bash
# =================================================================
# PTopup — Database Backup Script
# =================================================================
#
# Dump database MySQL `ptopup` ke file .sql.gz (compressed).
# Otomatis pakai password dari /root/.ptopup-db-password (dari deploy script).
#
# Cara pakai:
#   sudo bash backup-db.sh                           # backup ke /var/backups/ptopup/
#   sudo bash backup-db.sh --output=/path/to/file    # backup ke file spesifik
#   sudo bash backup-db.sh --keep=14                 # rotate, hapus backup > 14 hari (default 7)
#   sudo bash backup-db.sh --no-compress             # output .sql tanpa gzip
#
# Output filename format: ptopup-YYYYMMDD-HHMMSS.sql.gz
#
# Setup auto-backup harian (jam 03:00):
#   sudo crontab -e
#   # Tambahkan baris:
#   0 3 * * * /opt/ptopup/scripts/backup-db.sh > /var/log/ptopup-backup.log 2>&1
#
# =================================================================
set -euo pipefail

DB_NAME="ptopup"
DB_USER="ptopup"
DB_PASS_FILE="/root/.ptopup-db-password"
BACKUP_DIR="/var/backups/ptopup"
KEEP_DAYS=7
COMPRESS=1
OUTPUT=""

for arg in "$@"; do
  case $arg in
    --output=*)    OUTPUT="${arg#*=}" ;;
    --keep=*)      KEEP_DAYS="${arg#*=}" ;;
    --no-compress) COMPRESS=0 ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

[[ $EUID -ne 0 ]] && { echo "ERROR: Harus run dengan sudo (root)."; exit 1; }

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }

# Cek password file
[[ ! -f "$DB_PASS_FILE" ]] && err "Password file tidak ada: $DB_PASS_FILE"
DB_PASS=$(cat "$DB_PASS_FILE")

# Cek mysql
command -v mysqldump >/dev/null 2>&1 || err "mysqldump tidak ada (install: apt install mysql-client)"

# Setup output path
if [[ -z "$OUTPUT" ]]; then
  mkdir -p "$BACKUP_DIR"
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  if [[ $COMPRESS -eq 1 ]]; then
    OUTPUT="$BACKUP_DIR/ptopup-${TIMESTAMP}.sql.gz"
  else
    OUTPUT="$BACKUP_DIR/ptopup-${TIMESTAMP}.sql"
  fi
fi

log "Dumping database '$DB_NAME' → $OUTPUT"

# Mysqldump options:
#   --single-transaction  : consistent snapshot tanpa lock tables (utk InnoDB)
#   --routines            : include stored procedures
#   --triggers            : include triggers
#   --skip-lock-tables    : tidak lock tables (lebih cepat, OK utk InnoDB)
#   --quick               : streaming mode (hemat memory utk DB besar)
#   --set-gtid-purged=OFF : skip GTID metadata yg gak relevan untuk single-server
DUMP_OPTS="--single-transaction --routines --triggers --skip-lock-tables --quick --set-gtid-purged=OFF"

if [[ $COMPRESS -eq 1 ]]; then
  mysqldump -u "$DB_USER" -p"$DB_PASS" $DUMP_OPTS "$DB_NAME" 2>/dev/null | gzip -9 > "$OUTPUT"
else
  mysqldump -u "$DB_USER" -p"$DB_PASS" $DUMP_OPTS "$DB_NAME" 2>/dev/null > "$OUTPUT"
fi

# Cek file ke-create + ukuran masuk akal (>1KB)
if [[ ! -s "$OUTPUT" ]]; then
  err "Backup file empty / gagal dibuat"
fi

SIZE=$(du -h "$OUTPUT" | awk '{print $1}')
ok "Backup selesai: $OUTPUT ($SIZE)"

# Rotate: hapus backup > KEEP_DAYS hari (kalau pakai default folder)
if [[ -z "$1" ]] || [[ "$1" == "--keep="* ]] || [[ "$1" == "--no-compress" ]]; then
  if [[ -d "$BACKUP_DIR" ]]; then
    DELETED=$(find "$BACKUP_DIR" -name "ptopup-*.sql*" -mtime +$KEEP_DAYS -delete -print 2>/dev/null | wc -l)
    [[ $DELETED -gt 0 ]] && ok "Rotated: hapus $DELETED file > $KEEP_DAYS hari"
  fi
fi

echo ""
echo -e "${YELLOW}Untuk restore:${NC}"
echo -e "  ${BLUE}sudo bash restore-db.sh --input=$OUTPUT${NC}"
echo ""
