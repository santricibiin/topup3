#!/usr/bin/env bash
# =================================================================
# PTopup - VPS Cleanup (clean rewrite)
# =================================================================
#
# Default: teardown penuh artifact PTopup (app, DB, PM2, nginx, key).
# TIDAK menghapus: Node/MySQL/Nginx/PM2/Certbot binaries, swap, UFW,
# dan /root/backups (backup DB tetap aman).
#
# Pakai:
#   sudo bash scripts/cleanup.sh                 teardown penuh (tanya konfirmasi)
#   sudo bash scripts/cleanup.sh --remove-user   + hapus user ptopup
#   sudo bash scripts/cleanup.sh --remove-ssl --domain=DOMAIN
#   sudo bash scripts/cleanup.sh --hard          full nuke (user + ssl)
#   sudo bash scripts/cleanup.sh --wa-reset      HANYA reset sesi WhatsApp
#                                                (hapus auth/, restart worker)
# =================================================================
set -euo pipefail

REMOVE_USER=0; REMOVE_SSL=0; WA_RESET=0; DOMAIN=""
for arg in "$@"; do
  case $arg in
    --remove-user) REMOVE_USER=1 ;;
    --remove-ssl)  REMOVE_SSL=1 ;;
    --wa-reset)    WA_RESET=1 ;;
    --domain=*)    DOMAIN="${arg#*=}" ;;
    --hard)        REMOVE_USER=1; REMOVE_SSL=1 ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

[[ $EUID -ne 0 ]] && { echo "ERROR: harus run sebagai root (sudo)."; exit 1; }

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "${GREEN}OK${NC} $1"; }
warn() { echo -e "${YELLOW}!!${NC} $1"; }
step() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

APP_DIR="/opt/ptopup"
APP_USER="ptopup"
DB_NAME="ptopup"
DB_USER="ptopup"
DB_PASS_FILE="/root/.ptopup-db-password"
WA_KEY_FILE="/root/.ptopup-waotp-key"
WA_DIR="$APP_DIR/wa-worker"

# ============================================================
# MODE: --wa-reset  (cuma reset sesi WhatsApp, app tetap jalan)
# ============================================================
# Berguna kalau QR "gak bisa di-scan" / sesi nyangkut: hapus auth state,
# restart worker, lalu admin scan QR fresh dari /admin/waotp.
if [[ $WA_RESET -eq 1 ]]; then
  step "WA RESET - reset sesi WhatsApp saja"
  if [[ ! -d "$WA_DIR" ]]; then
    warn "Folder wa-worker tidak ada di $WA_DIR. Tidak ada yang direset."
    exit 0
  fi
  # Logout dulu lewat API (kalau worker hidup) biar device ke-unlink di HP juga
  if [[ -f "$WA_KEY_FILE" ]]; then
    WA_KEY=$(cat "$WA_KEY_FILE")
    curl -s -m 10 -X POST -H "x-api-key: $WA_KEY" \
      "http://127.0.0.1:3002/api/v1/session/logout" >/dev/null 2>&1 && \
      ok "Logout sesi via API" || warn "Worker tidak respond (skip logout API)"
  fi
  # Hapus auth state di disk
  if [[ -d "$WA_DIR/auth" ]]; then
    rm -rf "$WA_DIR/auth"
    ok "Folder auth/ dihapus (sesi WA dibersihkan)"
  else
    warn "Folder auth/ sudah tidak ada"
  fi
  # Restart worker (akan idle nunggu admin klik Connect karena belum ada creds.json)
  if id "$APP_USER" >/dev/null 2>&1 && sudo -u "$APP_USER" pm2 describe wa-worker >/dev/null 2>&1; then
    sudo -u "$APP_USER" pm2 restart wa-worker --update-env >/dev/null 2>&1 || true
    ok "wa-worker di-restart"
  else
    warn "PM2 wa-worker tidak ditemukan, skip restart"
  fi
  echo ""
  echo -e "${GREEN}WA RESET SELESAI${NC}"
  echo -e "  Buka ${BLUE}/admin/waotp${NC} > Connect > scan QR PERTAMA dalam ~15 detik."
  echo ""
  exit 0
fi

# ============================================================
# MODE: full teardown
# ============================================================
echo -e "${YELLOW}=== PTopup VPS Cleanup ===${NC}"
echo ""
echo -e "  Folder $APP_DIR         : ${RED}DIHAPUS${NC}"
echo -e "  Database $DB_NAME       : ${RED}DI-DROP${NC}"
echo -e "  PM2 'ptopup'+'wa-worker': ${RED}DIHAPUS${NC} (port 3000 & 3002 + sesi WA)"
echo -e "  Key files               : ${RED}DIHAPUS${NC}"
echo -e "  Nginx config            : ${RED}DIHAPUS${NC}"
[[ $REMOVE_USER -eq 1 ]] && echo -e "  User $APP_USER          : ${RED}DIHAPUS${NC}"
[[ $REMOVE_SSL -eq 1 && -n "$DOMAIN" ]] && echo -e "  SSL cert $DOMAIN        : ${RED}REVOKE${NC}"
echo ""
echo -ne "${YELLOW}Lanjut? (ketik 'yes'): ${NC}"
read -r CONFIRM
[[ "$CONFIRM" != "yes" ]] && { echo "Cancelled."; exit 0; }

# ---- 1. Stop PM2 + free ports ----
step "1/6 Stop PM2 & free ports 3000/3002"
pm2 kill 2>/dev/null || true
if id "$APP_USER" >/dev/null 2>&1; then
  sudo -u $APP_USER pm2 delete ptopup 2>/dev/null || true
  sudo -u $APP_USER pm2 delete wa-worker 2>/dev/null || true
  sudo -u $APP_USER pm2 kill 2>/dev/null || true
fi
pkill -9 -f "next start" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
pkill -9 -f "/opt/ptopup" 2>/dev/null || true
pkill -9 -f "wa-worker/src/index.js" 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 3002/tcp 2>/dev/null || true
sleep 2
lsof -i :3000 >/dev/null 2>&1 && warn "Port 3000 masih dipakai (cek: sudo lsof -i :3000)" || ok "Port 3000 free"
systemctl disable pm2-$APP_USER 2>/dev/null || true
systemctl stop pm2-$APP_USER 2>/dev/null || true
rm -f /etc/systemd/system/pm2-$APP_USER.service 2>/dev/null || true
systemctl daemon-reload 2>/dev/null || true
ok "PM2 stopped"

# ---- 2. Remove app dir ----
step "2/6 Remove app directory"
[[ -d "$APP_DIR" ]] && { rm -rf "$APP_DIR"; ok "Removed $APP_DIR"; } || warn "$APP_DIR sudah tidak ada"
rm -rf /home/$APP_USER/.pm2 /home/$APP_USER/.npm /home/$APP_USER/.cache 2>/dev/null || true
ok "PM2/npm cache user dibersihkan"

# ---- 3. Drop DB + key files ----
step "3/6 Drop MySQL & hapus key files"
if command -v mysql >/dev/null 2>&1; then
  mysql -u root <<SQL 2>/dev/null || true
DROP DATABASE IF EXISTS \`$DB_NAME\`;
DROP USER IF EXISTS '$DB_USER'@'localhost';
DROP USER IF EXISTS '$DB_USER'@'%';
FLUSH PRIVILEGES;
SQL
  ok "Database '$DB_NAME' + user dropped"
else
  warn "MySQL tidak ada"
fi
[[ -f "$DB_PASS_FILE" ]] && rm -f "$DB_PASS_FILE" && ok "Removed $DB_PASS_FILE"
[[ -f "$WA_KEY_FILE" ]] && rm -f "$WA_KEY_FILE" && ok "Removed $WA_KEY_FILE"
[[ -f "/etc/profile.d/ptopup.sh" ]] && rm -f "/etc/profile.d/ptopup.sh" && ok "Removed alias file"

# ---- 4. Nginx ----
step "4/6 Remove Nginx config"
rm -f /etc/nginx/sites-enabled/ptopup /etc/nginx/sites-available/ptopup 2>/dev/null || true
ok "Nginx config dihapus"
if systemctl is-active --quiet nginx; then
  nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null && ok "Nginx reloaded" || warn "Nginx config invalid, cek: sudo nginx -t"
fi

# ---- 5. SSL (opsional) ----
if [[ $REMOVE_SSL -eq 1 ]]; then
  step "5/6 Revoke SSL"
  if command -v certbot >/dev/null 2>&1; then
    if [[ -n "$DOMAIN" ]]; then
      certbot delete --cert-name "$DOMAIN" --non-interactive 2>/dev/null || true
      ok "SSL $DOMAIN revoked"
    else
      certbot certificates 2>/dev/null | grep "Certificate Name:" | awk '{print $3}' | while read -r CERT; do
        certbot delete --cert-name "$CERT" --non-interactive 2>/dev/null || true
        log "Revoked: $CERT"
      done
      ok "SSL certs checked"
    fi
  else
    warn "Certbot tidak ada"
  fi
else
  step "5/6 Skip SSL revoke (pakai --remove-ssl)"
fi

# ---- 6. User (opsional) ----
if [[ $REMOVE_USER -eq 1 ]]; then
  step "6/6 Remove user $APP_USER"
  if id "$APP_USER" >/dev/null 2>&1; then
    pkill -u "$APP_USER" 2>/dev/null || true; sleep 1
    pkill -9 -u "$APP_USER" 2>/dev/null || true
    userdel -r "$APP_USER" 2>/dev/null || userdel "$APP_USER" 2>/dev/null || true
    [[ -d "/home/$APP_USER" ]] && rm -rf "/home/$APP_USER"
    ok "User $APP_USER removed"
  else
    warn "User $APP_USER tidak ada"
  fi
else
  step "6/6 Skip user removal (pakai --remove-user)"
fi

echo ""
echo -e "${GREEN}===============================================================${NC}"
echo -e "${GREEN}CLEANUP SELESAI${NC}"
echo -e "${GREEN}===============================================================${NC}"
echo ""
if [[ -d "/root/backups" ]] && [[ $(ls -1 /root/backups 2>/dev/null | wc -l) -gt 0 ]]; then
  echo -e "${GREEN}Backup DB lama tetap aman: /root/backups${NC}"
  echo ""
fi
echo -e "${YELLOW}Re-deploy fresh:${NC}"
echo -e "  ${BLUE}sudo bash $APP_DIR/scripts/deploy.sh --domain=DOMAIN --email=EMAIL --repo=REPO_URL${NC}"
echo ""

