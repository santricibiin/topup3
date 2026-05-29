#!/usr/bin/env bash
# =================================================================
# PTopup — Update Script untuk VPS yang sudah di-deploy
# =================================================================
#
# Yang dilakukan:
#   1. Pull code terbaru dari git
#   2. Install dependency baru (kalau ada)
#   3. Push schema (kalau ada migration)
#   4. Build production
#   5. Restart PM2
#
# Cara pakai:
#   sudo bash scripts/vps-update.sh
#
# =================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}═══ $1 ═══${NC}"; }

if [[ $EUID -ne 0 ]]; then
  err "Script harus dijalankan sebagai root (pakai sudo)."
fi

APP_DIR="/opt/ptopup"
APP_USER="ptopup"

if [[ ! -f "$APP_DIR/package.json" ]]; then
  err "App tidak ditemukan di $APP_DIR. Run vps-deploy.sh dulu."
fi

step "1/5 — Pull latest code"
# Force pull, override local changes (build artifacts, dll)
sudo -u $APP_USER git -C $APP_DIR fetch origin
sudo -u $APP_USER git -C $APP_DIR reset --hard origin/main
ok "Code synced (force-reset to origin/main)"

step "2/5 — Install dependencies"
sudo -u $APP_USER bash -c "cd $APP_DIR && npm install --production=false" 2>&1 | tail -3
ok "Dependencies updated"

step "3/5 — Sync database schema"
sudo -u $APP_USER bash -c "cd $APP_DIR && npx prisma db push" 2>&1 | tail -3
ok "DB schema synced"

step "4/5 — Build production"
log "Building (3-7 menit, dengan memory limit 1.5GB)..."
sudo -u $APP_USER bash -c "cd $APP_DIR && NODE_OPTIONS='--max-old-space-size=1536' npm run build" 2>&1 | tail -8
ok "Build complete"

step "5/5 — Restart app"
sudo -u $APP_USER pm2 restart ptopup
ok "App restarted"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Update selesai${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Cek status   : ${BLUE}pm2 status${NC}"
echo -e "  Cek log      : ${BLUE}pm2 logs ptopup --lines 50${NC}"
echo -e "  URL          : ${BLUE}buka domain kamu${NC}"
echo ""
