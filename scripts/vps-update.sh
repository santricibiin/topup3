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

# ============================================================
# BONUS — WA OTP Worker (kalau folder wa-worker/ ada)
# ============================================================
WA_DIR="$APP_DIR/wa-worker"
WA_ENV="$WA_DIR/.env"
WA_KEY_FILE="/root/.ptopup-waotp-key"

if [[ -d "$WA_DIR" ]]; then
  step "BONUS — Update WA OTP Worker"

  # Bikin .env kalau hilang (mis. user lupa atau file kebabakar)
  if [[ ! -f "$WA_ENV" ]]; then
    if [[ -f "$WA_KEY_FILE" ]]; then
      WA_KEY=$(cat "$WA_KEY_FILE")
      log "Re-using saved worker key"
    else
      WA_KEY=$(openssl rand -hex 32)
      echo "$WA_KEY" > "$WA_KEY_FILE"
      chmod 600 "$WA_KEY_FILE"
      log "Generated new worker key"
    fi
    cat > "$WA_ENV" <<EOF
PORT=3002
HOST=127.0.0.1
WAOTP_WORKER_KEY=$WA_KEY
AUTH_DIR=./auth
OTP_LENGTH=6
OTP_EXPIRES_SECONDS=300
OTP_MAX_ATTEMPTS=5
EOF
    chown $APP_USER:$APP_USER "$WA_ENV"
    chmod 600 "$WA_ENV"
    ok "wa-worker/.env recreated"
  fi

  mkdir -p "$WA_DIR/auth"
  chown -R $APP_USER:$APP_USER "$WA_DIR"

  log "Update wa-worker dependencies..."
  sudo -u $APP_USER bash -c "cd $WA_DIR && npm install --no-audit --no-fund --omit=dev" 2>&1 | tail -3

  if sudo -u $APP_USER pm2 describe wa-worker >/dev/null 2>&1; then
    sudo -u $APP_USER pm2 restart wa-worker --update-env
    ok "PM2 'wa-worker' restarted"
  else
    sudo -u $APP_USER bash -c "cd $WA_DIR && pm2 start src/index.js --name wa-worker --time"
    ok "PM2 'wa-worker' started"
  fi
  sudo -u $APP_USER pm2 save >/dev/null 2>&1 || true
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Update selesai${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Cek status   : ${BLUE}pm2 status${NC}"
echo -e "  Cek log      : ${BLUE}pm2 logs ptopup --lines 50${NC}"
echo -e "  URL          : ${BLUE}buka domain kamu${NC}"
echo ""
