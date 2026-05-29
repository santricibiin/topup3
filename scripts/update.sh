#!/usr/bin/env bash
# =================================================================
# PTopup - VPS Update (clean rewrite)
# =================================================================
#
# Pull code terbaru, install deps, sync schema, build, restart.
# Sesi WhatsApp (folder auth/) TIDAK pernah disentuh -> tetap konek.
#
# Pakai:
#   sudo bash scripts/update.sh
#   sudo bash scripts/update.sh --branch=main
#   sudo bash scripts/update.sh --skip-build   (cuma restart, mis. ubah .env)
# =================================================================
set -euo pipefail

BRANCH="main"; SKIP_BUILD=0
for arg in "$@"; do
  case $arg in
    --branch=*)  BRANCH="${arg#*=}" ;;
    --skip-build) SKIP_BUILD=1 ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "${GREEN}OK${NC} $1"; }
warn() { echo -e "${YELLOW}!!${NC} $1"; }
err()  { echo -e "${RED}XX${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

[[ $EUID -ne 0 ]] && err "Harus run sebagai root (sudo)."

APP_DIR="/opt/ptopup"
APP_USER="ptopup"
WA_DIR="$APP_DIR/wa-worker"
WA_ENV="$WA_DIR/.env"
WA_KEY_FILE="/root/.ptopup-waotp-key"

as_app() { sudo -u "$APP_USER" bash -lc "$1"; }

[[ -f "$APP_DIR/package.json" ]] || err "App tidak ada di $APP_DIR. Run deploy.sh dulu."

step "1/5 Pull code (branch: $BRANCH)"
chown -R $APP_USER:$APP_USER "$APP_DIR" 2>/dev/null || true
as_app "git -C $APP_DIR fetch origin"
as_app "git -C $APP_DIR reset --hard origin/$BRANCH"
ok "Code synced (force-reset ke origin/$BRANCH)"

step "2/5 Install dependencies"
as_app "cd $APP_DIR && npm install --no-audit --no-fund --production=false" 2>&1 | tail -3
ok "Dependencies updated"

step "3/5 Sync DB schema"
as_app "cd $APP_DIR && npx prisma generate >/dev/null 2>&1 && npx prisma db push --skip-generate" 2>&1 | tail -3
ok "Schema synced"

if [[ $SKIP_BUILD -eq 1 ]]; then
  step "4/5 Build (SKIPPED via --skip-build)"
  warn "Build dilewati"
else
  step "4/5 Build production"
  log "Building (3-7 menit, memory limit 1.5GB)..."
  as_app "cd $APP_DIR && NODE_OPTIONS='--max-old-space-size=1536' npm run build" 2>&1 | tail -8 || \
    err "Build gagal. App lama tetap jalan. Cek log di atas."
  ok "Build complete"
fi

step "5/5 Restart"
as_app "pm2 restart ptopup"
ok "App 'ptopup' restarted"

# ---- WA OTP Worker (kalau ada) ----
if [[ -d "$WA_DIR" ]]; then
  step "BONUS Update WA worker"

  # Self-heal .env kalau hilang
  if [[ ! -f "$WA_ENV" ]]; then
    if [[ -f "$WA_KEY_FILE" ]]; then
      WA_KEY=$(cat "$WA_KEY_FILE"); log "Re-use worker key"
    else
      WA_KEY=$(openssl rand -hex 32)
      echo "$WA_KEY" > "$WA_KEY_FILE"; chmod 600 "$WA_KEY_FILE"
      log "Worker key baru"
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
    chown $APP_USER:$APP_USER "$WA_ENV"; chmod 600 "$WA_ENV"
    ok "wa-worker/.env recreated"
  fi

  # JANGAN bikin/hapus folder auth/ di sini. Sesi WA harus tetap utuh.
  # Ownership di-set selektif tanpa menyentuh isi auth (chown -R aman karena
  # tidak menghapus, cuma set owner).
  chown -R $APP_USER:$APP_USER "$WA_DIR"

  log "Update wa-worker deps..."
  as_app "cd $WA_DIR && npm install --no-audit --no-fund --omit=dev" 2>&1 | tail -3

  if as_app "pm2 describe wa-worker >/dev/null 2>&1"; then
    as_app "pm2 restart wa-worker --update-env"
    ok "PM2 'wa-worker' restarted (sesi WA tetap utuh)"
  else
    as_app "cd $WA_DIR && pm2 start src/index.js --name wa-worker --time"
    ok "PM2 'wa-worker' started"
  fi
  as_app "pm2 save >/dev/null 2>&1 || true"
fi

echo ""
echo -e "${GREEN}===============================================================${NC}"
echo -e "${GREEN}UPDATE SELESAI${NC}"
echo -e "${GREEN}===============================================================${NC}"
echo ""
echo -e "  Status : ${BLUE}sudo -u $APP_USER pm2 status${NC}"
echo -e "  Logs   : ${BLUE}sudo -u $APP_USER pm2 logs ptopup --lines 50${NC}"
echo -e "  WA logs: ${BLUE}sudo -u $APP_USER pm2 logs wa-worker --lines 50${NC}"
echo ""
