#!/usr/bin/env bash
# =================================================================
# PTopup — VPS Auto-Deploy untuk Ubuntu 22.04 / 24.04
# =================================================================
#
# Idempotent — aman di-run ulang tanpa rusak install yg sudah ada.
# Auto-handle: swap memory kecil, permission node, shell user, build memory,
# clone permission, dll.
#
# Cara pakai (1 command):
#   curl -fsSL "https://raw.githubusercontent.com/<user>/<repo>/main/scripts/vps-deploy.sh?$(date +%s)" | \
#     sudo bash -s -- --domain=DOMAIN --email=EMAIL --repo=REPO_URL
#
# Atau kalau code sudah di-clone:
#   sudo bash scripts/vps-deploy.sh --domain=DOMAIN --email=EMAIL
#
# Argumen:
#   --domain=<domain>   (wajib)
#   --email=<email>     (wajib, untuk SSL)
#   --repo=<git-url>    (opsional kalau code sudah ada di /opt/ptopup)
#   --token=<gh-token>  (opsional, untuk repo PRIVATE — pakai GitHub PAT)
#   --no-ssl            skip SSL (mis. pakai Cloudflare proxy)
#   --skip-mysql        pakai DB external
#
# =================================================================
set -euo pipefail

# ----------------------- args -----------------------
DOMAIN=""
EMAIL=""
REPO=""
TOKEN=""
NO_SSL=0
SKIP_MYSQL=0

for arg in "$@"; do
  case $arg in
    --domain=*)     DOMAIN="${arg#*=}" ;;
    --email=*)      EMAIL="${arg#*=}" ;;
    --repo=*)       REPO="${arg#*=}" ;;
    --token=*)      TOKEN="${arg#*=}" ;;
    --no-ssl)       NO_SSL=1 ;;
    --skip-mysql)   SKIP_MYSQL=1 ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

[[ -z "$DOMAIN" || -z "$EMAIL" ]] && {
  echo "Usage: $0 --domain=<domain> --email=<email> [--repo=<git>] [--token=<gh-pat>] [--no-ssl] [--skip-mysql]"
  exit 1
}

# Auto re-exec sebagai root kalau dijalanin user biasa (mis. ubuntu@vps).
# Jadi kamu bisa pakai `bash vps-deploy.sh ...` apa pun login user-nya.
# `sudo -E` preserve env supaya argumen & variabel dibawa ke root shell.
if [[ $EUID -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    echo "[INFO] Bukan root — re-exec lewat sudo..."
    exec sudo -E bash "$0" "$@"
  else
    echo "ERROR: Harus root, dan sudo tidak tersedia. Login pakai 'sudo su' atau 'sudo -i' dulu."
    exit 1
  fi
fi

# ----------------------- APT lock helper -----------------------
# unattended-upgrades / cloud-init / apt-daily timer kadang nge-hold
# /var/lib/dpkg/lock-frontend di VPS yang baru. Kalau kita hit apt-get
# saat lock dipegang → fail. Helper ini tunggu sampai lock dilepas
# (max 5 menit), supaya deploy gak gampang gagal di awal.
wait_for_apt() {
  local timeout=300
  local elapsed=0
  while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 \
        || fuser /var/lib/dpkg/lock >/dev/null 2>&1 \
        || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 \
        || pgrep -x unattended-upgr >/dev/null 2>&1; do
    if [ "$elapsed" -ge "$timeout" ]; then
      echo "[WARN] APT lock masih ditahan setelah ${timeout}s — coba lagi nanti."
      return 1
    fi
    [ "$elapsed" -eq 0 ] && echo "[INFO] Menunggu apt/dpkg lock dilepas (mis. unattended-upgrades)..."
    sleep 5
    elapsed=$((elapsed + 5))
  done
  return 0
}

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
NODE_VERSION="20"

# ============================================================
# STEP 0 — Pre-flight (RAM check, auto-swap)
# ============================================================
step "0/9 — Pre-flight check"

# Auto-create swap kalau total RAM < 2 GB (cegah build OOM)
RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
RAM_MB=$((RAM_KB / 1024))
log "RAM: ${RAM_MB} MB"

if [[ $RAM_MB -lt 1800 && ! -f /swapfile ]]; then
  log "RAM kurang dari 1.8 GB → membuat swap 2 GB..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null 2>&1
  swapon /swapfile
  if ! grep -q "/swapfile" /etc/fstab; then
    echo "/swapfile none swap sw 0 0" >> /etc/fstab
  fi
  ok "Swap 2 GB aktif"
elif [[ -f /swapfile ]]; then
  ok "Swap sudah ada"
else
  ok "RAM cukup, no swap needed"
fi

# Disk check (perlu min 5 GB free)
DISK_FREE_GB=$(df -BG / | awk 'NR==2 {gsub("G",""); print $4}')
[[ $DISK_FREE_GB -lt 5 ]] && err "Disk < 5 GB free. Tambah disk dulu."
ok "Disk free: ${DISK_FREE_GB} GB"

# ============================================================
# STEP 1 — System packages
# ============================================================
step "1/9 — Install system packages"

export DEBIAN_FRONTEND=noninteractive
wait_for_apt
apt-get update -qq
wait_for_apt
apt-get install -y -qq curl wget git ufw build-essential ca-certificates gnupg openssl

# Node.js 20 LTS
NODE_OK=0
if command -v node >/dev/null && [[ "$(node -v)" == v${NODE_VERSION}.* ]]; then
  NODE_OK=1
fi
if [[ $NODE_OK -eq 0 ]]; then
  log "Installing Node.js ${NODE_VERSION} LTS..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - >/dev/null 2>&1
  wait_for_apt
  apt-get install -y -qq nodejs
fi
ok "Node.js $(node -v) — npm $(npm -v)"

# FIX: pastikan node binary executable oleh semua user (root install kadang permission ketat)
chmod 755 /usr/bin/node /usr/bin/npm /usr/bin/npx 2>/dev/null || true

# MySQL
if [[ $SKIP_MYSQL -eq 0 ]]; then
  if ! command -v mysql >/dev/null; then
    log "Installing MySQL Server..."
    wait_for_apt
    apt-get install -y -qq mysql-server
    systemctl enable mysql >/dev/null
    systemctl start mysql
  fi
  ok "MySQL $(mysql --version | head -1 | awk '{print $3}')"
fi

# Nginx
if ! command -v nginx >/dev/null; then
  wait_for_apt
  apt-get install -y -qq nginx
  systemctl enable nginx >/dev/null
fi
ok "Nginx installed"

# Certbot (kalau perlu SSL)
if [[ $NO_SSL -eq 0 ]] && ! command -v certbot >/dev/null; then
  wait_for_apt
  apt-get install -y -qq certbot python3-certbot-nginx
fi
[[ $NO_SSL -eq 0 ]] && ok "Certbot installed"

# PM2
if ! command -v pm2 >/dev/null; then
  npm install -g pm2 >/dev/null 2>&1
fi
ok "PM2 $(pm2 -v)"
chmod 755 /usr/lib/node_modules -R 2>/dev/null || true
chmod +x /usr/bin/pm2 2>/dev/null || true

# ============================================================
# STEP 2 — App user & directory
# ============================================================
step "2/9 — Setup app user"

if ! id "$APP_USER" >/dev/null 2>&1; then
  # FIX: useradd dengan shell /bin/bash (default useradd kadang nologin di Ubuntu minimal)
  useradd -m -d /home/$APP_USER -s /bin/bash $APP_USER
  ok "Created user: $APP_USER"
else
  # FIX: kalau user sudah ada tapi shell-nya nologin, fix sekarang
  CURRENT_SHELL=$(getent passwd $APP_USER | cut -d: -f7)
  if [[ "$CURRENT_SHELL" != "/bin/bash" ]]; then
    usermod -s /bin/bash $APP_USER
    ok "Fixed shell user $APP_USER → /bin/bash"
  else
    ok "User $APP_USER ready"
  fi
fi

# Pastikan home dir ada
[[ ! -d /home/$APP_USER ]] && mkdir -p /home/$APP_USER && chown $APP_USER:$APP_USER /home/$APP_USER

# ============================================================
# STEP 3 — Get application code
# ============================================================
step "3/9 — Get application code"

if [[ -n "$REPO" ]]; then
  # Inject token ke URL kalau ada (repo private)
  CLONE_URL="$REPO"
  if [[ -n "$TOKEN" ]]; then
    # Convert https://github.com/user/repo.git → https://oauth2:TOKEN@github.com/user/repo.git
    CLONE_URL=$(echo "$REPO" | sed -E "s#https://(github\.com)#https://oauth2:${TOKEN}@\1#")
    log "Token detected, using authenticated URL"
  fi

  if [[ -d "$APP_DIR/.git" ]]; then
    log "Pulling latest code..."
    # Pastikan ownership benar dulu
    chown -R $APP_USER:$APP_USER $APP_DIR
    # Update remote URL kalau token berubah
    [[ -n "$TOKEN" ]] && sudo -u $APP_USER git -C $APP_DIR remote set-url origin "$CLONE_URL"
    sudo -u $APP_USER git -C $APP_DIR fetch origin
    sudo -u $APP_USER git -C $APP_DIR reset --hard origin/main
  else
    log "Cloning repo from $REPO ..."
    # FIX: clone sebagai root dulu (root selalu bisa write ke /opt), baru chown
    [[ -d "$APP_DIR" ]] && rm -rf "$APP_DIR"
    git clone --depth 1 "$CLONE_URL" "$APP_DIR"
    chown -R $APP_USER:$APP_USER "$APP_DIR"
  fi

  # Save token ke git config user ptopup biar pull selanjutnya gak minta auth
  if [[ -n "$TOKEN" ]]; then
    sudo -u $APP_USER git -C $APP_DIR config credential.helper store
    echo "https://oauth2:${TOKEN}@github.com" > /home/$APP_USER/.git-credentials
    chown $APP_USER:$APP_USER /home/$APP_USER/.git-credentials
    chmod 600 /home/$APP_USER/.git-credentials
    ok "Git credential saved (token persistent)"
  fi

  ok "Code synced to $APP_DIR"
elif [[ -f "$APP_DIR/package.json" ]]; then
  chown -R $APP_USER:$APP_USER "$APP_DIR"
  ok "Code already exists, skip clone"
else
  err "$APP_DIR kosong dan --repo tidak diisi. Pakai --repo=<url> atau upload code manual."
fi

# ============================================================
# STEP 4 — MySQL database
# ============================================================
step "4/9 — Setup MySQL"

if [[ $SKIP_MYSQL -eq 0 ]]; then
  DB_PASS_FILE="/root/.ptopup-db-password"
  if [[ -f "$DB_PASS_FILE" ]]; then
    DB_PASS=$(cat "$DB_PASS_FILE")
    ok "Re-using DB password"
  else
    DB_PASS=$(openssl rand -hex 24)
    echo "$DB_PASS" > "$DB_PASS_FILE"
    chmod 600 "$DB_PASS_FILE"
    ok "Generated DB password (saved at $DB_PASS_FILE)"
  fi

  # Idempotent — drop user lama kalau password mismatch, recreate fresh
  mysql -u root <<SQL >/dev/null 2>&1
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP USER IF EXISTS '$DB_USER'@'localhost';
CREATE USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
SQL
  ok "MySQL ready: $DB_NAME / $DB_USER"
fi

# ============================================================
# STEP 5 — .env
# ============================================================
step "5/9 — Configure .env"

ENV_FILE="$APP_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  SESSION_SECRET=$(openssl rand -hex 32)
  if [[ $SKIP_MYSQL -eq 0 ]]; then
    DB_URL="mysql://$DB_USER:$DB_PASS@localhost:3306/$DB_NAME"
  else
    DB_URL="mysql://USER:PASS@HOST:3306/DBNAME"
  fi

  # FIX: pakai SESSION_PASSWORD (env validator backward compat)
  cat > "$ENV_FILE" <<EOF
# Auto-generated by vps-deploy.sh on $(date)

DATABASE_URL="$DB_URL"
NEXT_PUBLIC_APP_URL="https://$DOMAIN"
SESSION_PASSWORD="$SESSION_SECRET"

# Digiflazz (isi setelah deploy lewat /admin/provider atau edit file ini)
DIGIFLAZZ_USERNAME=""
DIGIFLAZZ_API_KEY=""
DIGIFLAZZ_PROD_API_KEY=""
DIGIFLAZZ_MODE="development"
DIGIFLAZZ_BASE_URL="https://api.digiflazz.com/v1"

NODE_ENV="production"
EOF
  chown $APP_USER:$APP_USER "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok ".env created"
else
  # FIX: kalau env existing tapi DATABASE_URL stale (pwd lama), regenerate
  if [[ $SKIP_MYSQL -eq 0 ]] && grep -q "DATABASE_URL" "$ENV_FILE"; then
    EXPECTED_URL="mysql://$DB_USER:$DB_PASS@localhost:3306/$DB_NAME"
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$EXPECTED_URL\"|" "$ENV_FILE"
  fi
  # Pastikan APP_URL sesuai domain sekarang
  sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=\"https://$DOMAIN\"|" "$ENV_FILE"
  ok ".env existing — refreshed DATABASE_URL & APP_URL"
fi

# ============================================================
# STEP 6 — Install + DB push + build
# ============================================================
step "6/9 — Install dependencies"

# FIX: ensure ownership benar sebelum install
chown -R $APP_USER:$APP_USER "$APP_DIR"

log "npm install (3-5 menit)..."
sudo -u $APP_USER bash -lc "cd $APP_DIR && npm install --no-audit --no-fund --production=false" 2>&1 | tail -5
ok "Dependencies installed"

log "Pushing Prisma schema to DB..."
sudo -u $APP_USER bash -lc "cd $APP_DIR && npx prisma generate >/dev/null 2>&1 && npx prisma db push --skip-generate" 2>&1 | tail -3
ok "Schema synced"

# FIX: build dengan memory limit untuk VPS RAM kecil
step "7/9 — Build Next.js production"
log "Building (5-10 menit, sabar)..."
sudo -u $APP_USER bash -lc "cd $APP_DIR && NODE_OPTIONS='--max-old-space-size=1536' npm run build" 2>&1 | tail -10 || {
  err "Build failed. Cek log di atas. Common fix:
    1. RAM tidak cukup → tambah swap (script seharusnya auto-handle)
    2. Env var hilang → cek $ENV_FILE
    3. Module corrupt → rm -rf $APP_DIR/node_modules dan re-run script"
}
ok "Build complete"

# ============================================================
# STEP 8 — Seed admin + folder
# ============================================================
step "8/9 — Seed admin user"

mkdir -p "$APP_DIR/public/uploads/avatars"
chown -R $APP_USER:$APP_USER "$APP_DIR/public/uploads"

# FIX: tulis seed script di $APP_DIR (bukan /tmp) supaya module resolution
# bisa nemu node_modules. Node cari node_modules relatif dari lokasi script,
# bukan cwd.
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
    create:{
      email:'admin@ptopup.local',
      username:'admin',
      passwordHash:h,
      fullName:'Super Admin',
      role:'ADMIN',
      balance:{create:{amount:0}},
    },
  });
  console.log('Admin OK');
  await p.$disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
JS

chown $APP_USER:$APP_USER "$SEED_FILE"
sudo -u $APP_USER bash -lc "cd $APP_DIR && node .seed-admin.js"
rm -f "$SEED_FILE"
ok "Admin user ready (admin / Admin#12345)"

# ============================================================
# STEP 9 — PM2 + Nginx + SSL
# ============================================================
step "9/9 — Setup PM2 + Nginx + SSL"

# FIX: pastikan pm2 home folder permission benar (kadang bekas run gagal)
[[ -d /home/$APP_USER/.pm2 ]] && {
  chown -R $APP_USER:$APP_USER /home/$APP_USER/.pm2 2>/dev/null || true
}

# Stop & start fresh
sudo -u $APP_USER bash -lc "pm2 delete ptopup 2>/dev/null || true"
sudo -u $APP_USER bash -lc "cd $APP_DIR && PORT=3000 pm2 start npm --name ptopup -- run start"
sudo -u $APP_USER bash -lc "pm2 save"

# Auto-restart on boot
env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER >/dev/null 2>&1 || true
systemctl enable pm2-$APP_USER >/dev/null 2>&1 || true
ok "PM2 running 'ptopup' on port 3000"

# Tunggu app ready (max 30s)
log "Waiting for app to be ready..."
for i in {1..30}; do
  if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000" 2>/dev/null | grep -qE "^(2|3)"; then
    ok "App responding on port 3000"
    break
  fi
  sleep 1
done

# Nginx config
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
ok "Nginx configured for $DOMAIN"

# UFW firewall
if command -v ufw >/dev/null; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 'Nginx Full' >/dev/null 2>&1 || true
  echo "y" | ufw enable >/dev/null 2>&1 || true
  ok "Firewall enabled (SSH + HTTP/HTTPS allowed)"
fi

# SSL Let's Encrypt
if [[ $NO_SSL -eq 0 ]]; then
  log "Requesting SSL certificate..."
  if certbot --nginx -d "$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email --redirect --non-interactive 2>&1 | tail -5; then
    ok "SSL active. https://$DOMAIN ready"
  else
    warn "SSL gagal. DNS belum propagate? Re-run nanti:"
    warn "  sudo certbot --nginx -d $DOMAIN"
  fi
fi

# ============================================================
# DONE
# ============================================================
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 DEPLOY SELESAI${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  URL          : ${BLUE}https://$DOMAIN${NC}"
echo -e "  Admin Login  : ${BLUE}admin / Admin#12345${NC}  ${YELLOW}(GANTI di /profile)${NC}"
echo -e "  App Path     : ${BLUE}$APP_DIR${NC}"
echo ""

# ─── DATABASE INFO ──────────────────────────────────────────
if [[ $SKIP_MYSQL -eq 0 ]]; then
  CURRENT_DB_PASS=$(cat "$DB_PASS_FILE" 2>/dev/null || echo "?")
  echo -e "${YELLOW}═══ DATABASE INFO ═══${NC}"
  echo -e "  DB Name      : ${BLUE}$DB_NAME${NC}"
  echo -e "  DB User      : ${BLUE}$DB_USER${NC}"
  echo -e "  DB Host      : ${BLUE}localhost:3306${NC}"
  echo -e "  DB Password  : ${GREEN}$CURRENT_DB_PASS${NC}"
  echo -e "  Password File: ${BLUE}$DB_PASS_FILE${NC}"
  echo ""
  echo -e "${YELLOW}LOGIN MYSQL:${NC}"
  echo -e "  Cara cepat (root, no password):"
  echo -e "    ${BLUE}sudo mysql ${DB_NAME}${NC}"
  echo ""
  echo -e "  Cara user ptopup (auto-fetch password):"
  echo -e "    ${BLUE}DB_PASS=\$(sudo cat ${DB_PASS_FILE})${NC}"
  echo -e "    ${BLUE}mysql -u ${DB_USER} -p\"\$DB_PASS\" ${DB_NAME}${NC}"
  echo ""
  echo -e "  Lihat password kapan saja:"
  echo -e "    ${BLUE}sudo cat ${DB_PASS_FILE}${NC}"
  echo ""
  echo -e "  Quick check tabel:"
  echo -e "    ${BLUE}sudo mysql -e \"USE ${DB_NAME}; SHOW TABLES;\"${NC}"
  echo ""
fi

echo -e "${YELLOW}NEXT STEPS:${NC}"
echo -e "  1. Buka ${BLUE}https://$DOMAIN${NC} → login → ganti password admin"
echo -e "  2. Edit ${BLUE}$ENV_FILE${NC} → isi DIGIFLAZZ_USERNAME & API_KEY"
echo -e "  3. Restart: ${BLUE}sudo -u $APP_USER pm2 restart ptopup${NC}"
echo -e "  4. Setup di /admin/settings + /admin/provider + /admin/deposits"
echo ""
echo -e "${YELLOW}USEFUL COMMANDS:${NC}"
echo -e "  Status app   : ${BLUE}sudo -u $APP_USER pm2 status${NC}"
echo -e "  Logs         : ${BLUE}sudo -u $APP_USER pm2 logs ptopup${NC}"
echo -e "  Restart      : ${BLUE}sudo -u $APP_USER pm2 restart ptopup${NC}"
echo -e "  Update code  : ${BLUE}sudo bash $APP_DIR/scripts/vps-update.sh${NC}"
echo -e "  Pull only    : ${BLUE}cd $APP_DIR && sudo -u $APP_USER git fetch origin && sudo -u $APP_USER git reset --hard origin/main${NC}"
echo ""
