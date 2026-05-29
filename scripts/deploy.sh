#!/usr/bin/env bash
# =================================================================
# PTopup - VPS Deploy (clean rewrite) - Ubuntu 22.04 / 24.04
# =================================================================
#
# Idempotent: aman di-run ulang. Deploy Next.js (port 3000) + WA OTP
# worker Baileys (port 3002) di belakang Nginx + SSL.
#
# Pakai (repo publik):
#   curl -fsSL "https://raw.githubusercontent.com/<user>/<repo>/main/scripts/deploy.sh?$(date +%s)" \
#     | sudo bash -s -- --domain=DOMAIN --email=EMAIL --repo=REPO_URL
#
# Pakai (code sudah di /opt/ptopup):
#   sudo bash scripts/deploy.sh --domain=DOMAIN --email=EMAIL
#
# Flags:
#   --domain=<domain>   wajib
#   --email=<email>     wajib (SSL)
#   --repo=<git-url>    opsional kalau code sudah ada
#   --token=<gh-pat>    opsional, repo private
#   --branch=<name>     opsional, default: main
#   --no-ssl            skip SSL (mis. di belakang Cloudflare)
#   --skip-mysql        pakai DB eksternal
# =================================================================
set -euo pipefail

# ----------------------- args -----------------------
DOMAIN=""; EMAIL=""; REPO=""; TOKEN=""; BRANCH="main"; NO_SSL=0; SKIP_MYSQL=0
for arg in "$@"; do
  case $arg in
    --domain=*)   DOMAIN="${arg#*=}" ;;
    --email=*)    EMAIL="${arg#*=}" ;;
    --repo=*)     REPO="${arg#*=}" ;;
    --token=*)    TOKEN="${arg#*=}" ;;
    --branch=*)   BRANCH="${arg#*=}" ;;
    --no-ssl)     NO_SSL=1 ;;
    --skip-mysql) SKIP_MYSQL=1 ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

[[ -z "$DOMAIN" || -z "$EMAIL" ]] && {
  echo "Usage: $0 --domain=<domain> --email=<email> [--repo=<git>] [--token=<pat>] [--branch=<name>] [--no-ssl] [--skip-mysql]"
  exit 1
}
[[ $EUID -ne 0 ]] && { echo "ERROR: harus run sebagai root (sudo)."; exit 1; }

# ----------------------- logging -----------------------
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "${GREEN}OK${NC} $1"; }
warn() { echo -e "${YELLOW}!!${NC} $1"; }
err()  { echo -e "${RED}XX${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

# ----------------------- constants -----------------------
APP_DIR="/opt/ptopup"
APP_USER="ptopup"
DB_NAME="ptopup"
DB_USER="ptopup"
NODE_VERSION="20"
WA_DIR="$APP_DIR/wa-worker"
WA_ENV="$WA_DIR/.env"
WA_KEY_FILE="/root/.ptopup-waotp-key"
DB_PASS_FILE="/root/.ptopup-db-password"
ENV_FILE="$APP_DIR/.env"

# Jalankan command sebagai user app (login shell biar PATH/pm2 ke-load)
as_app() { sudo -u "$APP_USER" bash -lc "$1"; }

# ============================================================
# 1 - Pre-flight: RAM/swap + disk
# ============================================================
step "1/11 Pre-flight"
RAM_MB=$(( $(grep MemTotal /proc/meminfo | awk '{print $2}') / 1024 ))
log "RAM: ${RAM_MB} MB"
if [[ $RAM_MB -lt 1800 && ! -f /swapfile ]]; then
  log "RAM < 1.8 GB, bikin swap 2 GB..."
  fallocate -l 2G /swapfile && chmod 600 /swapfile
  mkswap /swapfile >/dev/null 2>&1 && swapon /swapfile
  grep -q "/swapfile" /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
  ok "Swap 2 GB aktif"
else
  ok "Swap OK / RAM cukup"
fi
DISK_FREE_GB=$(df -BG / | awk 'NR==2 {gsub("G",""); print $4}')
[[ $DISK_FREE_GB -lt 5 ]] && err "Disk < 5 GB free."
ok "Disk free: ${DISK_FREE_GB} GB"

# ============================================================
# 2 - System packages (Node, MySQL, Nginx, Certbot, PM2)
# ============================================================
step "2/11 System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl wget git ufw build-essential ca-certificates gnupg openssl lsof

if ! command -v node >/dev/null || [[ "$(node -v)" != v${NODE_VERSION}.* ]]; then
  log "Install Node.js ${NODE_VERSION} LTS..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs
fi
chmod 755 /usr/bin/node /usr/bin/npm /usr/bin/npx 2>/dev/null || true
ok "Node $(node -v) / npm $(npm -v)"

if [[ $SKIP_MYSQL -eq 0 ]]; then
  if ! command -v mysql >/dev/null; then
    log "Install MySQL Server..."
    apt-get install -y -qq mysql-server
    systemctl enable mysql >/dev/null; systemctl start mysql
  fi
  ok "MySQL $(mysql --version | awk '{print $3}' | head -1)"
fi

command -v nginx >/dev/null || { apt-get install -y -qq nginx; systemctl enable nginx >/dev/null; }
ok "Nginx ready"

if [[ $NO_SSL -eq 0 ]] && ! command -v certbot >/dev/null; then
  apt-get install -y -qq certbot python3-certbot-nginx
fi
[[ $NO_SSL -eq 0 ]] && ok "Certbot ready"

command -v pm2 >/dev/null || npm install -g pm2 >/dev/null 2>&1
chmod 755 -R /usr/lib/node_modules 2>/dev/null || true
chmod +x /usr/bin/pm2 2>/dev/null || true
ok "PM2 $(pm2 -v)"

# ============================================================
# 3 - App user
# ============================================================
step "3/11 App user"
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd -m -d /home/$APP_USER -s /bin/bash $APP_USER
  ok "User $APP_USER dibuat"
else
  [[ "$(getent passwd $APP_USER | cut -d: -f7)" != "/bin/bash" ]] && usermod -s /bin/bash $APP_USER
  ok "User $APP_USER siap"
fi
[[ ! -d /home/$APP_USER ]] && mkdir -p /home/$APP_USER && chown $APP_USER:$APP_USER /home/$APP_USER

# ============================================================
# 4 - Get application code
# ============================================================
step "4/11 Application code"
if [[ -n "$REPO" ]]; then
  CLONE_URL="$REPO"
  if [[ -n "$TOKEN" ]]; then
    CLONE_URL=$(echo "$REPO" | sed -E "s#https://(github\.com)#https://oauth2:${TOKEN}@\1#")
    log "Token terdeteksi, pakai authenticated URL"
  fi
  if [[ -d "$APP_DIR/.git" ]]; then
    log "Pull code terbaru (branch: $BRANCH)..."
    chown -R $APP_USER:$APP_USER "$APP_DIR"
    [[ -n "$TOKEN" ]] && as_app "git -C $APP_DIR remote set-url origin '$CLONE_URL'"
    as_app "git -C $APP_DIR fetch origin"
    as_app "git -C $APP_DIR reset --hard origin/$BRANCH"
  else
    log "Clone repo (branch: $BRANCH)..."
    [[ -d "$APP_DIR" ]] && rm -rf "$APP_DIR"
    git clone --depth 1 -b "$BRANCH" "$CLONE_URL" "$APP_DIR"
    chown -R $APP_USER:$APP_USER "$APP_DIR"
  fi
  if [[ -n "$TOKEN" ]]; then
    as_app "git -C $APP_DIR config credential.helper store"
    echo "https://oauth2:${TOKEN}@github.com" > /home/$APP_USER/.git-credentials
    chown $APP_USER:$APP_USER /home/$APP_USER/.git-credentials
    chmod 600 /home/$APP_USER/.git-credentials
  fi
  ok "Code synced ke $APP_DIR"
elif [[ -f "$APP_DIR/package.json" ]]; then
  chown -R $APP_USER:$APP_USER "$APP_DIR"
  ok "Code sudah ada, skip clone"
else
  err "$APP_DIR kosong & --repo tidak diisi."
fi

# ============================================================
# 5 - MySQL database
# ============================================================
step "5/11 MySQL database"
if [[ $SKIP_MYSQL -eq 0 ]]; then
  if [[ -f "$DB_PASS_FILE" ]]; then
    DB_PASS=$(cat "$DB_PASS_FILE"); ok "Re-use DB password"
  else
    DB_PASS=$(openssl rand -hex 24)
    echo "$DB_PASS" > "$DB_PASS_FILE"; chmod 600 "$DB_PASS_FILE"
    ok "DB password baru (di $DB_PASS_FILE)"
  fi
  mysql -u root <<SQL >/dev/null 2>&1
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP USER IF EXISTS '$DB_USER'@'localhost';
CREATE USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
SQL
  ok "DB siap: $DB_NAME / $DB_USER"
fi

# ============================================================
# 6 - .env aplikasi
# ============================================================
step "6/11 Configure .env"
if [[ ! -f "$ENV_FILE" ]]; then
  SESSION_SECRET=$(openssl rand -hex 32)
  if [[ $SKIP_MYSQL -eq 0 ]]; then
    DB_URL="mysql://$DB_USER:$DB_PASS@localhost:3306/$DB_NAME"
  else
    DB_URL="mysql://USER:PASS@HOST:3306/DBNAME"
  fi
  cat > "$ENV_FILE" <<EOF
# Auto-generated by deploy.sh on $(date)
DATABASE_URL="$DB_URL"
NEXT_PUBLIC_APP_URL="https://$DOMAIN"
SESSION_PASSWORD="$SESSION_SECRET"

DIGIFLAZZ_USERNAME=""
DIGIFLAZZ_API_KEY=""
DIGIFLAZZ_PROD_API_KEY=""
DIGIFLAZZ_MODE="development"
DIGIFLAZZ_BASE_URL="https://api.digiflazz.com/v1"

NODE_ENV="production"
EOF
  chown $APP_USER:$APP_USER "$ENV_FILE"; chmod 600 "$ENV_FILE"
  ok ".env dibuat"
else
  if [[ $SKIP_MYSQL -eq 0 ]] && grep -q "DATABASE_URL" "$ENV_FILE"; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"mysql://$DB_USER:$DB_PASS@localhost:3306/$DB_NAME\"|" "$ENV_FILE"
  fi
  sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=\"https://$DOMAIN\"|" "$ENV_FILE"
  ok ".env ada, DATABASE_URL & APP_URL di-refresh"
fi

# ============================================================
# 7 - Install deps + Prisma + build
# ============================================================
step "7/11 Install, Prisma, build"
chown -R $APP_USER:$APP_USER "$APP_DIR"
log "npm install (3-5 menit)..."
as_app "cd $APP_DIR && npm install --no-audit --no-fund --production=false" 2>&1 | tail -5
ok "Dependencies installed"

log "Prisma generate + db push..."
as_app "cd $APP_DIR && npx prisma generate >/dev/null 2>&1 && npx prisma db push --skip-generate" 2>&1 | tail -3
ok "Schema synced"

log "Build Next.js (5-10 menit)..."
as_app "cd $APP_DIR && NODE_OPTIONS='--max-old-space-size=1536' npm run build" 2>&1 | tail -10 || \
  err "Build gagal. Cek: RAM/swap, .env, atau rm -rf $APP_DIR/node_modules lalu re-run."
ok "Build complete"

# ============================================================
# 8 - Seed admin + folder uploads
# ============================================================
step "8/11 Seed admin"
mkdir -p "$APP_DIR/public/uploads/avatars"
chown -R $APP_USER:$APP_USER "$APP_DIR/public/uploads"
SEED_FILE="$APP_DIR/.seed-admin.js"
cat > "$SEED_FILE" <<'JS'
const{PrismaClient}=require('@prisma/client');
const bcrypt=require('bcryptjs');
const p=new PrismaClient();
(async()=>{
  const h=await bcrypt.hash('Admin#12345',12);
  await p.user.upsert({
    where:{email:'admin@ptopup.local'},
    update:{},
    create:{email:'admin@ptopup.local',username:'admin',passwordHash:h,
      fullName:'Super Admin',role:'ADMIN',balance:{create:{amount:0}}},
  });
  console.log('Admin OK'); await p.$disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
JS
chown $APP_USER:$APP_USER "$SEED_FILE"
as_app "cd $APP_DIR && node .seed-admin.js"
rm -f "$SEED_FILE"
ok "Admin siap (admin / Admin#12345)"

# ============================================================
# 9 - PM2 (app) + Nginx + SSL
# ============================================================
step "9/11 PM2 + Nginx + SSL"
[[ -d /home/$APP_USER/.pm2 ]] && chown -R $APP_USER:$APP_USER /home/$APP_USER/.pm2 2>/dev/null || true

as_app "pm2 delete ptopup 2>/dev/null || true"
as_app "cd $APP_DIR && PORT=3000 pm2 start npm --name ptopup -- run start"
as_app "pm2 save"
env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER >/dev/null 2>&1 || true
systemctl enable pm2-$APP_USER >/dev/null 2>&1 || true
ok "PM2 'ptopup' jalan di port 3000"

log "Tunggu app ready..."
for _ in $(seq 1 30); do
  curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000" 2>/dev/null | grep -qE "^(2|3)" && { ok "App respond di 3000"; break; }
  sleep 1
done

cat > /etc/nginx/sites-available/ptopup <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 5M;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/ptopup /etc/nginx/sites-enabled/ptopup
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ok "Nginx configured untuk $DOMAIN"

if command -v ufw >/dev/null; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 'Nginx Full' >/dev/null 2>&1 || true
  echo "y" | ufw enable >/dev/null 2>&1 || true
  ok "Firewall aktif (SSH + HTTP/HTTPS)"
fi

if [[ $NO_SSL -eq 0 ]]; then
  log "Request SSL cert..."
  if certbot --nginx -d "$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email --redirect --non-interactive 2>&1 | tail -5; then
    ok "SSL aktif: https://$DOMAIN"
  else
    warn "SSL gagal (DNS belum propagate?). Re-run: sudo certbot --nginx -d $DOMAIN"
  fi
fi

# ============================================================
# 10 - WA OTP Worker (Baileys, port 3002)
# ============================================================
step "10/11 WA OTP Worker"
if [[ ! -d "$WA_DIR" ]]; then
  warn "Folder wa-worker/ tidak ada di repo, skip worker."
else
  # Worker key: re-use kalau ada, generate kalau belum (idempotent)
  if [[ -f "$WA_KEY_FILE" ]]; then
    WA_KEY=$(cat "$WA_KEY_FILE"); ok "Re-use worker key"
  elif [[ -f "$WA_ENV" ]] && grep -q "^WAOTP_WORKER_KEY=" "$WA_ENV"; then
    WA_KEY=$(grep "^WAOTP_WORKER_KEY=" "$WA_ENV" | head -1 | cut -d= -f2-)
    echo "$WA_KEY" > "$WA_KEY_FILE"; chmod 600 "$WA_KEY_FILE"
    ok "Import worker key dari .env"
  else
    WA_KEY=$(openssl rand -hex 32)
    echo "$WA_KEY" > "$WA_KEY_FILE"; chmod 600 "$WA_KEY_FILE"
    ok "Worker key baru (di $WA_KEY_FILE)"
  fi

  # .env worker
  if [[ ! -f "$WA_ENV" ]]; then
    cat > "$WA_ENV" <<EOF
# Auto-generated by deploy.sh on $(date)
PORT=3002
HOST=127.0.0.1
WAOTP_WORKER_KEY=$WA_KEY
AUTH_DIR=./auth
OTP_LENGTH=6
OTP_EXPIRES_SECONDS=300
OTP_MAX_ATTEMPTS=5
EOF
    ok "wa-worker/.env dibuat"
  else
    grep -q "^WAOTP_WORKER_KEY=$WA_KEY$" "$WA_ENV" || \
      sed -i "s|^WAOTP_WORKER_KEY=.*|WAOTP_WORKER_KEY=$WA_KEY|" "$WA_ENV"
    ok "wa-worker/.env ada, key di-sync"
  fi
  chown $APP_USER:$APP_USER "$WA_ENV"; chmod 600 "$WA_ENV"

  # PENTING: JANGAN bikin folder auth/ kosong di sini. Worker auto-start hanya
  # kalau ada creds.json (sesi nyata). Folder kosong = worker loop bikin QR di
  # background tanpa di-scan -> 408 "QR refs attempts ended" -> QR basi & gagal
  # scan. Folder auth/ dibuat sendiri oleh worker saat admin klik Connect.
  chown -R $APP_USER:$APP_USER "$WA_DIR"

  log "npm install wa-worker (1-2 menit)..."
  as_app "cd $WA_DIR && npm install --no-audit --no-fund --omit=dev" 2>&1 | tail -5
  ok "wa-worker deps installed"

  if as_app "pm2 describe wa-worker >/dev/null 2>&1"; then
    as_app "pm2 restart wa-worker --update-env"
    ok "PM2 'wa-worker' restarted"
  else
    as_app "cd $WA_DIR && pm2 start src/index.js --name wa-worker --time"
    ok "PM2 'wa-worker' started (port 3002)"
  fi
  as_app "pm2 save >/dev/null 2>&1 || true"

  # Sync setting ke DB biar admin UI auto-isi
  if [[ $SKIP_MYSQL -eq 0 ]]; then
    mysql -u root "$DB_NAME" <<SQL >/dev/null 2>&1 || warn "Sync setting ke DB gagal (skip)"
INSERT INTO settings (\`key\`, value, is_secret, updated_at)
VALUES ('waotp.url', 'http://127.0.0.1:3002/api/v1', 0, NOW())
ON DUPLICATE KEY UPDATE value=VALUES(value), updated_at=NOW();
INSERT INTO settings (\`key\`, value, is_secret, updated_at)
VALUES ('waotp.apiKey', '$WA_KEY', 1, NOW())
ON DUPLICATE KEY UPDATE value=VALUES(value), updated_at=NOW();
SQL
    ok "Setting waotp.url & waotp.apiKey tersimpan di DB"
  fi

  log "Tunggu worker ready..."
  for _ in $(seq 1 15); do
    curl -s -o /dev/null -w "%{http_code}" -H "x-api-key: $WA_KEY" \
      "http://127.0.0.1:3002/api/v1/session/status" 2>/dev/null | grep -qE "^(2|4)" && \
      { ok "Worker respond di 3002"; break; }
    sleep 1
  done
fi

# ============================================================
# 11 - CLI shortcut aliases (system-wide)
# ============================================================
step "11/11 CLI shortcuts"
ALIAS_FILE="/etc/profile.d/ptopup.sh"
cat > "$ALIAS_FILE" <<'EOF'
# PTopup CLI shortcuts (auto-installed by deploy.sh)
alias ptopup-status='sudo -u ptopup pm2 status'
alias ptopup-logs='sudo -u ptopup pm2 logs ptopup --lines 50'
alias ptopup-restart='sudo -u ptopup pm2 restart ptopup'
alias ptopup-update='sudo bash /opt/ptopup/scripts/update.sh'
alias ptopup-db='sudo mysql ptopup'
alias wa-status='sudo -u ptopup pm2 describe wa-worker | head -30'
alias wa-logs='sudo -u ptopup pm2 logs wa-worker --lines 50'
alias wa-restart='sudo -u ptopup pm2 restart wa-worker'
alias wa-key='sudo cat /root/.ptopup-waotp-key && echo'
ptopup-help() {
  echo "PTopup shortcuts:"
  echo "  ptopup-status / ptopup-logs / ptopup-restart / ptopup-update / ptopup-db"
  echo "  wa-status / wa-logs / wa-restart / wa-key"
}
EOF
chmod 644 "$ALIAS_FILE"
# shellcheck disable=SC1090
source "$ALIAS_FILE" 2>/dev/null || true
ok "Aliases di $ALIAS_FILE"

# ============================================================
# DONE
# ============================================================
echo ""
echo -e "${GREEN}===============================================================${NC}"
echo -e "${GREEN}DEPLOY SELESAI${NC}"
echo -e "${GREEN}===============================================================${NC}"
echo ""
echo -e "  URL         : ${BLUE}https://$DOMAIN${NC}"
echo -e "  Admin login : ${BLUE}admin / Admin#12345${NC}  ${YELLOW}(GANTI di /profile)${NC}"
echo -e "  App path    : ${BLUE}$APP_DIR${NC}"
echo ""
if [[ $SKIP_MYSQL -eq 0 ]]; then
  echo -e "${YELLOW}DATABASE${NC}"
  echo -e "  Name/User   : ${BLUE}$DB_NAME / $DB_USER${NC} @ localhost:3306"
  echo -e "  Password    : ${GREEN}$(cat "$DB_PASS_FILE" 2>/dev/null || echo '?')${NC}  (file: $DB_PASS_FILE)"
  echo -e "  Login cepat : ${BLUE}sudo mysql $DB_NAME${NC}"
  echo ""
fi
if [[ -d "$WA_DIR" ]]; then
  echo -e "${YELLOW}WA OTP WORKER${NC}"
  echo -e "  URL         : ${BLUE}http://127.0.0.1:3002/api/v1${NC} (localhost only)"
  echo -e "  API key     : ${GREEN}$(cat "$WA_KEY_FILE" 2>/dev/null || echo '?')${NC}  (file: $WA_KEY_FILE)"
  echo -e "  Auth folder : ${BLUE}$WA_DIR/auth${NC}  ${YELLOW}(dibuat saat klik Connect, jangan dihapus)${NC}"
  echo ""
  echo -e "  ${YELLOW}Aktivasi WA:${NC}"
  echo -e "    1. Login admin > ${BLUE}/admin/waotp${NC} (URL & key auto-terisi)"
  echo -e "    2. Toggle ${GREEN}Aktifkan OTP WhatsApp${NC} > Save"
  echo -e "    3. Section Sesi WhatsApp > ${GREEN}Connect${NC} > scan QR PERTAMA dalam ~15 detik"
  echo ""
fi
echo -e "${YELLOW}NEXT STEPS${NC}"
echo -e "  1. Buka ${BLUE}https://$DOMAIN${NC} > login > ganti password admin"
echo -e "  2. Edit ${BLUE}$ENV_FILE${NC} > isi DIGIFLAZZ_USERNAME & API_KEY"
echo -e "  3. Restart: ${BLUE}sudo -u $APP_USER pm2 restart ptopup${NC}"
echo ""
echo -e "${YELLOW}SHORTCUTS${NC} (re-login atau: source /etc/profile.d/ptopup.sh)"
echo -e "  ${GREEN}ptopup-status ptopup-logs ptopup-restart ptopup-update ptopup-db${NC}"
echo -e "  ${GREEN}wa-status wa-logs wa-restart wa-key ptopup-help${NC}"
echo ""
