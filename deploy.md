# 🍼 Panduan Deploy PTopup — Bahasa Bayi Edition

> Buat yang males baca panjang. Tinggal copy-paste, beres.

---

## 🎯 Singkatnya Apa Aja Bisa Dilakuin?

| Mau apa | Pakai apa |
|---|---|
| Pasang baru di VPS kosong | **Deploy** (section 1) |
| Hapus semua, mau pasang ulang | **Cleanup → Deploy** (section 2) |
| Ada update code di GitHub | **Update** (section 3) |
| Cuma mau sync file (gak rebuild) | **Pull only** (section 4) |
| Cek isi database | **Login MySQL** (section 5) |
| Restore DB dari backup / pindah VPS | **DB Restore** (section 6) |
| Repo private / jualan ke buyer | **Deploy Private** (section 12) |

---

## 🚀 1. DEPLOY (Pasang Pertama Kali)

### Langkah-langkah:

**1.** Login ke VPS lewat SSH (dari laptop/PC kamu):
```bash
ssh root@IP-VPS-KAMU
```
Contoh: `ssh root@103.123.45.67` → masukin password root.

**2.** Copy-paste 1 perintah ini (ganti domain & email-nya):
```bash
curl -fsSL "https://raw.githubusercontent.com/santricibiin/topup2/main/scripts/vps-deploy.sh?$(date +%s)" | sudo bash -s -- \
    --domain=butuhtopup.net \
    --email=muhfaiqyah@gmail.com \
    --repo=https://github.com/santricibiin/topup2.git
```

**3.** Tunggu 5–10 menit. Selesai.

### Yang harus diganti:
- `butuhtopup.net` → domain kamu
- `muhfaiqyah@gmail.com` → email kamu (buat SSL)
- `santricibiin/topup2` → username/repo GitHub kamu

### Habis selesai bakal nongol info kayak gini:
```
🎉 DEPLOY SELESAI

  URL          : https://butuhtopup.net
  Admin Login  : admin / Admin#12345
  App Path     : /opt/ptopup

═══ DATABASE INFO ═══
  DB Name      : ptopup
  DB User      : ptopup
  DB Password  : a13e3822921e3a4bb2702fb74536b6f8....   ← INI PASSWORD MYSQL KAMU
  Password File: /root/.ptopup-db-password

═══ WA OTP WORKER ═══
  Status       : running (PM2 process 'wa-worker')
  URL          : http://127.0.0.1:3002/api/v1
  API Key      : <auto-generate 64 char>
  Key file     : /root/.ptopup-waotp-key
  Auth folder  : /opt/ptopup/wa-worker/auth
```

📸 **Screenshot/catat password-nya** kalau kamu butuh nanti. Kalau lupa, masih bisa diliat lagi (lihat section MySQL di bawah).

### 📱 Aktifin WA Gateway (setelah deploy)

Worker udah jalan otomatis di port 3002, URL & API Key juga udah disync ke DB. Tinggal:

1. Login admin → buka `/admin/settings` → tab **WhatsApp**
2. Toggle **Enabled** → klik **Save**
3. Buka `/admin` → bagian **OTP WhatsApp** → klik **Connect** → scan QR pakai HP

Selesai, status sesi bakal `CONNECTED`. Kalau API Key di settings kosong, fetch lagi:
```bash
sudo cat /root/.ptopup-waotp-key
```

### ⚡ CLI Shortcuts (auto-installed)

Setelah deploy, shortcut command tersedia system-wide. **Re-login dulu** ke SSH (atau jalanin `source /etc/profile.d/ptopup.sh`), lalu:

| Alias | Apa yang dilakuin |
|---|---|
| `ptopup-status` | Lihat semua PM2 process |
| `ptopup-logs` | Tail log Next.js (50 baris terakhir) |
| `ptopup-restart` | Restart app utama |
| `ptopup-update` | Run script update (pull + build + restart) |
| `ptopup-db` | Login MySQL ke DB ptopup |
| `wa-status` | Detail PM2 wa-worker |
| `wa-logs` | Tail log Baileys worker |
| `wa-restart` | Restart wa-worker (sesi WA tetap utuh) |
| `wa-key` | Print API key worker |
| `ptopup-help` | Tampilan menu lengkap |

Contoh penggunaan:
```bash
ssh root@vps
ptopup-status     # langsung muncul list pm2
wa-logs           # tail log wa-worker
ptopup-update     # update code dari GitHub
```

---

## 🧹 2. CLEANUP (Hapus Semua, Mau Pasang Ulang)

Misal salah pasang, mau ulang fresh, atau mau ganti domain.

### Langkah-langkah:

**1.** SSH ke VPS:
```bash
ssh root@IP-VPS-KAMU
```

**2.** Run cleanup (akan ngasih konfirmasi, ketik `yes`):
```bash
curl -fsSL "https://raw.githubusercontent.com/santricibiin/topup2/main/scripts/cleanup-vps.sh?$(date +%s)" | sudo bash -s -- \
    --hard --domain=butuhtopup.net
```

**3.** Setelah selesai, langsung deploy lagi:
```bash
curl -fsSL "https://raw.githubusercontent.com/santricibiin/topup2/main/scripts/vps-deploy.sh?$(date +%s)" | sudo bash -s -- \
    --domain=butuhtopup.net \
    --email=muhfaiqyah@gmail.com \
    --repo=https://github.com/santricibiin/topup2.git
```

### Yang dihapus saat cleanup `--hard`:
- ✅ Folder `/opt/ptopup`
- ✅ Database `ptopup` + user-nya
- ✅ PM2 process
- ✅ Nginx config
- ✅ User `ptopup` di Linux
- ✅ SSL certificate
- ❌ **TIDAK** dihapus: Node.js, MySQL server, Nginx (biar redeploy cepet)

### Versi cleanup yang lebih ringan:
```bash
# Cuma hapus app + DB, user & SSL tetap ada
curl -fsSL "https://raw.githubusercontent.com/santricibiin/topup2/main/scripts/cleanup-vps.sh?$(date +%s)" | sudo bash
```

---

## 🔄 3. UPDATE (Ada Code Baru di GitHub)

### Cara Anti-Ribet (1 perintah, full update):

```bash
cd /opt/ptopup && sudo -u ptopup git fetch origin && sudo -u ptopup git reset --hard origin/main && sudo -u ptopup bash -c "cd /opt/ptopup && npm install && npx prisma db push && NODE_OPTIONS='--max-old-space-size=1536' npm run build" && sudo -u ptopup pm2 restart ptopup
```

Yang dilakuin:
1. Pull code terbaru dari GitHub (overwrite local)
2. Install dependency baru kalau ada
3. Sync database schema
4. Build production
5. Restart app

⏱ Waktu: 5–10 menit (tergantung perubahan).

### Atau pakai script update yang udah ada:
```bash
sudo bash /opt/ptopup/scripts/vps-update.sh
```

⚠️ Kalau ada error "unstaged changes", pakai cara di atas yang `git reset --hard` (paksa pakai versi GitHub).

---

## 📥 4. PULL ONLY (Cuma Sync, Gak Build)

Buat update **script `.sh`** atau **dokumentasi `.md`** doang. **Jangan** dipakai kalau ada perubahan di `src/` atau `prisma/`.

```bash
cd /opt/ptopup && sudo -u ptopup git fetch origin && sudo -u ptopup git reset --hard origin/main
```

Selesai. Cuma 5 detik.

---

## 🗄️ 5. CEK DATABASE MYSQL

### Cara Login (Pilih salah satu)

**Cara A — Cepat (pakai sudo, gak butuh password):**
```bash
sudo mysql ptopup
```

**Cara B — Pakai user `ptopup` (auto-fetch password):**
```bash
DB_PASS=$(sudo cat /root/.ptopup-db-password)
mysql -u ptopup -p"$DB_PASS" ptopup
```

**Cara C — Lihat password-nya doang:**
```bash
sudo cat /root/.ptopup-db-password
```

### Setelah Masuk MySQL Prompt (`mysql>`)

```sql
-- Lihat semua tabel
SHOW TABLES;

-- Lihat akun admin
SELECT id, email, username, role FROM User WHERE role='ADMIN';

-- Lihat semua user
SELECT id, email, username, role FROM User;

-- Lihat transaksi terakhir
SELECT id, status, amount, createdAt FROM Transaction ORDER BY createdAt DESC LIMIT 10;

-- Lihat saldo user
SELECT u.username, b.amount FROM User u JOIN Balance b ON b.userId = u.id;

-- Keluar
EXIT;
```

### One-Liner (Tanpa Masuk Prompt)
```bash
# Lihat tabel
sudo mysql -e "USE ptopup; SHOW TABLES;"

# Hitung user
sudo mysql -e "SELECT COUNT(*) AS total FROM ptopup.User;"

# Lihat admin
sudo mysql -e "SELECT email, username FROM ptopup.User WHERE role='ADMIN';"
```

### Daftar Tabel yang Dibikin Otomatis

| Tabel | Isinya apa |
|---|---|
| `User` | Akun user (admin, customer, reseller) |
| `Session` | Session login |
| `Balance` | Saldo per user |
| `BalanceMutation` | Riwayat saldo masuk/keluar |
| `Product` | Katalog Digiflazz (pulsa, data, dll) |
| `Transaction` | Transaksi topup |
| `PaymentGatewayLog` | Log webhook pembayaran |
| `Deposit` | Top-up saldo via QRIS DANA |
| `CategorySetting` | Setting kategori (icon, urutan) |
| `Setting` | Setting global site |

---

## � 6. RESTORE DATABASE (Pakai DB Lama / Pindah VPS)

Misal kamu punya backup `.sql` dari hosting/VPS lama, atau mau restore data setelah deploy fresh. Pakai script `db-restore.sh`.

### ⚠️ Yang Penting Tau Dulu

- **Deploy fresh = DB baru kosong**. Cuma ada 1 admin default (`admin / Admin#12345`).
- **Untuk pindah data lama**, harus restore dari file backup `.sql`.
- **Aman**: script auto-backup DB current dulu sebelum restore (kalau salah, bisa rollback).

### 🔄 Cara Pindah dari VPS Lama ke VPS Baru

**1.** Di VPS LAMA, backup DB dulu (di-zip biar kecil):
```bash
sudo mysqldump ptopup | gzip > /root/backup.sql.gz
```

**2.** Transfer ke VPS BARU pakai SCP (jalankan dari laptop):
```bash
# Download dari VPS lama ke laptop
scp root@IP-VPS-LAMA:/root/backup.sql.gz ./

# Upload ke VPS baru
scp ./backup.sql.gz root@IP-VPS-BARU:/root/
```

**3.** Di VPS BARU (yang udah deploy fresh), restore:
```bash
ssh root@IP-VPS-BARU
sudo bash /opt/ptopup/scripts/db-restore.sh /root/backup.sql.gz
```

Ketik `yes` saat konfirmasi → tunggu selesai. Done.

### 📥 Cara Restore dari File Backup Biasa

```bash
# Dari file .sql
sudo bash /opt/ptopup/scripts/db-restore.sh /root/backup.sql

# Dari file .sql.gz (auto-decompress)
sudo bash /opt/ptopup/scripts/db-restore.sh /root/backup.sql.gz

# Langsung dari URL
sudo bash /opt/ptopup/scripts/db-restore.sh https://example.com/backup.sql
```

### ⚙️ Flag Tambahan

```bash
# Skip konfirmasi (buat automation/cron)
sudo bash /opt/ptopup/scripts/db-restore.sh backup.sql --yes

# Tidak restart app otomatis
sudo bash /opt/ptopup/scripts/db-restore.sh backup.sql --no-restart
```

### 🛡️ Yang Dilakukan Script (6 Step Otomatis)

1. **Validasi sumber** — Cek file ada / download URL / decompress .gz
2. **Konfirmasi** — Tampilkan info DB current, tanya `yes`
3. **Auto-backup** DB current → `/root/backups/pre-restore-YYYYMMDD-HHMMSS.sql`
4. **Drop & restore** — Hapus tabel lama, import SQL baru
5. **Sync schema** — Run `prisma db push` (kalau ada kolom baru di code)
6. **Restart app** — PM2 ptopup di-restart

### 🆘 Kalau Salah Restore (Rollback)

Script ini auto-bikin backup sebelum overwrite. Kalau hasil restore salah, tinggal balikin:

```bash
# Lihat list backup
ls -lh /root/backups/

# Rollback (pakai file pre-restore yang baru aja dibikin)
sudo bash /opt/ptopup/scripts/db-restore.sh /root/backups/pre-restore-20260528-073500.sql --yes
```

Ganti tanggal sesuai file yang ada.

### ✅ Verifikasi Setelah Restore

```bash
# Cek jumlah tabel & user
sudo mysql ptopup -e "SHOW TABLES;"
sudo mysql ptopup -e "SELECT COUNT(*) AS total_user FROM User;"

# Cek admin yang ada
sudo mysql ptopup -e "SELECT id, email, username, role FROM User WHERE role='ADMIN';"

# Buka web → coba login pakai admin lama (password lama dari DB backup)
```

### 💡 Use Case Lain

| Skenario | Command |
|---|---|
| Pindah dari hosting cPanel | Export `.sql` dari phpMyAdmin → upload ke VPS → restore |
| Disaster recovery | Restore dari backup harian: `sudo bash db-restore.sh /root/backups/ptopup-YYYYMMDD.sql` |
| Test di staging | Copy backup production → restore di VPS staging |
| Reset ke kondisi lama | Pilih backup tanggal yang diinginkan |

---

## 🛠️ 7. PERINTAH HARIAN YANG SERING DIPAKAI

### Cek Status App
```bash
sudo -u ptopup pm2 status
```

### Lihat Log App
```bash
sudo -u ptopup pm2 logs ptopup --lines 100
```

### Restart App
```bash
sudo -u ptopup pm2 restart ptopup
```

### Stop App
```bash
sudo -u ptopup pm2 stop ptopup
```

### Edit File `.env` (Isi Digiflazz, dll)
```bash
sudo nano /opt/ptopup/.env
```
Save: `Ctrl+O` → `Enter` → `Ctrl+X`. Lalu restart:
```bash
sudo -u ptopup pm2 restart ptopup
```

### Cek Disk
```bash
df -h
```

### Cek RAM
```bash
free -h
```

---

## ⚡ 8. ALIAS PINTAR (Setup Sekali, Pake Selamanya)

Biar gak ngetik panjang-panjang. Run sekali aja di VPS:

```bash
cat >> ~/.bashrc <<'EOF'

# === PTopup Shortcuts ===
alias ptpull="cd /opt/ptopup && sudo -u ptopup git fetch origin && sudo -u ptopup git reset --hard origin/main"
alias ptupdate="cd /opt/ptopup && sudo -u ptopup git fetch origin && sudo -u ptopup git reset --hard origin/main && sudo -u ptopup bash -c 'cd /opt/ptopup && npm install && npx prisma db push && NODE_OPTIONS=\"--max-old-space-size=1536\" npm run build' && sudo -u ptopup pm2 restart ptopup"
alias ptrestart="sudo -u ptopup pm2 restart ptopup"
alias ptstatus="sudo -u ptopup pm2 status"
alias ptlogs="sudo -u ptopup pm2 logs ptopup --lines 100"
alias ptdb='DB_PASS=$(sudo cat /root/.ptopup-db-password); mysql -u ptopup -p"$DB_PASS" ptopup'
alias ptenv="sudo nano /opt/ptopup/.env"
alias ptrestore="sudo bash /opt/ptopup/scripts/db-restore.sh"
alias ptbackup="sudo mkdir -p /root/backups && sudo mysqldump ptopup | gzip > /root/backups/manual-\$(date +%Y%m%d-%H%M%S).sql.gz && echo 'Backup tersimpan di /root/backups/'"
EOF
source ~/.bashrc
```

Setelah itu tinggal ketik:

| Perintah | Fungsinya |
|---|---|
| `ptpull` | Sync code dari GitHub doang |
| `ptupdate` | Full update (pull + build + restart) |
| `ptrestart` | Restart app |
| `ptstatus` | Status app |
| `ptlogs` | Lihat log |
| `ptdb` | Masuk MySQL |
| `ptenv` | Edit `.env` |
| `ptbackup` | Backup DB manual ke `/root/backups/` |
| `ptrestore <file.sql>` | Restore DB dari file backup |

---

## 🚨 9. KALAU ADA MASALAH

### App gak bisa diakses (Error 502)
```bash
sudo -u ptopup pm2 logs ptopup --lines 50    # cek error
sudo -u ptopup pm2 restart ptopup            # restart
```

### Error pas `git pull` ("unstaged changes")
```bash
cd /opt/ptopup
sudo -u ptopup git fetch origin
sudo -u ptopup git reset --hard origin/main   # paksa samain dgn GitHub
```

### Port 3000 udah dipake
```bash
sudo fuser -k 3000/tcp                       # paksa kill yang pake port
sudo -u ptopup pm2 restart ptopup
```

### Lupa password MySQL
```bash
sudo cat /root/.ptopup-db-password
```

### MySQL gak nyala
```bash
sudo systemctl status mysql
sudo systemctl start mysql
```

### Avatar upload gak jalan
```bash
sudo chown -R ptopup:ptopup /opt/ptopup/public/uploads
sudo chmod -R 755 /opt/ptopup/public/uploads
```

### SSL gagal pas deploy
DNS belum nyambung. Tunggu 5–30 menit, lalu:
```bash
sudo certbot --nginx -d butuhtopup.net
```

### Restore DB gagal / DB jadi rusak
Rollback ke kondisi sebelum restore (script auto-bikin backup tiap restore):
```bash
ls -lh /root/backups/                        # cari file pre-restore-*.sql
sudo bash /opt/ptopup/scripts/db-restore.sh /root/backups/pre-restore-XXX.sql --yes
```

---

## 📋 10. CHEAT SHEET (Print & Tempel di Dinding)

```
╔══════════════════════════════════════════════════════════╗
║              PTOPUP — CHEAT SHEET                        ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  📍 Folder app    : /opt/ptopup                          ║
║  👤 User Linux    : ptopup                               ║
║  🗄️  Database      : ptopup (di MySQL localhost)          ║
║  🔑 DB Password   : sudo cat /root/.ptopup-db-password   ║
║  🌐 Login admin   : admin / Admin#12345                  ║
║                                                          ║
║  🚀 Deploy fresh  : (lihat section 1)                    ║
║  🧹 Cleanup       : (lihat section 2)                    ║
║  � Restore DB    : ptrestore <file.sql>  (section 6)    ║
║  🔄 Update        : ptupdate  (kalo udah setup alias)    ║
║  📥 Pull only     : ptpull                               ║
║  🗄️  Cek DB        : ptdb                                 ║
║  📊 Status        : ptstatus                             ║
║  📜 Log           : ptlogs                               ║
║  🔁 Restart       : ptrestart                            ║
║  💾 Backup manual : ptbackup                             ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

---

## 🔐 11. KEAMANAN — JANGAN LUPA!

Setelah deploy selesai, **WAJIB** lakukan:

- [ ] Login ke `https://domain-kamu.net` pakai `admin / Admin#12345`
- [ ] Ganti password admin di `/profile`
- [ ] Edit `.env` → isi `DIGIFLAZZ_USERNAME` & `DIGIFLAZZ_API_KEY`
- [ ] Set `DIGIFLAZZ_MODE="production"` saat siap go-live
- [ ] Generate webhook DANA secret di `/admin/deposits`
- [ ] Sync produk di `/admin/provider`
- [ ] Setup QRIS statis di `/admin/deposits`
- [ ] Backup database harian (lihat section di bawah)

### Setup Backup Otomatis
```bash
sudo mkdir -p /root/backups
sudo crontab -e
```
Tambah baris ini di paling bawah:
```
0 3 * * * mysqldump ptopup > /root/backups/ptopup-$(date +\%Y\%m\%d).sql && find /root/backups -name "ptopup-*.sql" -mtime +7 -delete
```

Selesai. Backup tiap jam 3 pagi, simpan 7 hari terakhir.

---

## 🛍️ 12. DEPLOY UNTUK REPO PRIVATE (Jualan / Reseller)

Kalau repo GitHub kamu **private** (mis. mau dijual ke buyer), command deploy biasa bakal gagal karena GitHub minta auth. Ada 2 cara:

### ✨ Cara A — Pakai Token (Recommended Buat Buyer Awam)

**1.** Generate Personal Access Token (PAT) di GitHub kamu (sebagai owner repo):

1. Buka: https://github.com/settings/tokens?type=beta
2. Klik **Generate new token** → **Fine-grained tokens**
3. Setting:
   - **Token name**: `buyer-domain-com` (kasih nama buyer biar gampang track)
   - **Expiration**: 1 tahun (atau custom)
   - **Repository access**: **Only select repositories** → pilih repo yang dijual
   - **Permissions** → Repository permissions:
     - **Contents**: `Read-only` ✅ (cukup ini doang)
4. Klik **Generate token** → **COPY** (cuma muncul sekali!)

Format token: `github_pat_11AAA...XYZ` (~93 karakter)

**2.** Kasih ke buyer command ini (udah include token):

```bash
curl -fsSL -H "Authorization: token github_pat_11AAA_TOKEN_BUYER_DISINI" \
  "https://raw.githubusercontent.com/santricibiin/topup2/main/scripts/vps-deploy.sh?$(date +%s)" | \
  sudo bash -s -- \
    --domain=DOMAIN-BUYER.com \
    --email=email-buyer@gmail.com \
    --repo=https://github.com/santricibiin/topup2.git \
    --token=github_pat_11AAA_TOKEN_BUYER_DISINI
```

Buyer tinggal **copy-paste**, ganti domain & email, jalan. Token otomatis disimpan di VPS, jadi `git pull` selanjutnya gak minta apa-apa.

**3.** Kalau buyer macam-macam (re-distribute, melanggar lisensi):
- Buka https://github.com/settings/tokens
- Klik **Revoke** di token buyer itu
- VPS buyer langsung gak bisa pull update lagi

### 👥 Cara B — Pakai Collaborator Access (Buat Buyer Techy)

Buyer punya GitHub account dan paham git. Kasih akses langsung ke repo:

**1.** Tambahkan buyer sebagai collaborator (di repo kamu):
- Buka https://github.com/santricibiin/topup2/settings/access
- Klik **Add people** → masukkan username GitHub buyer
- Pilih role **Read** (jangan write!)
- Buyer terima invitation via email

**2.** Buyer accept invitation, lalu generate PAT mereka sendiri di:
https://github.com/settings/tokens

**3.** Buyer pakai command yang sama kayak Cara A, tapi dengan token mereka sendiri.

**4.** Kalau buyer macam-macam:
- Buka https://github.com/santricibiin/topup2/settings/access
- Klik **Remove** di samping nama buyer
- Akses langsung putus

### 📦 Cleanup & Update Pakai Token

Cleanup (script ini public, gak perlu token tapi kalau repo private bisa kasih token juga):
```bash
curl -fsSL -H "Authorization: token TOKEN_KAMU" \
  "https://raw.githubusercontent.com/santricibiin/topup2/main/scripts/cleanup-vps.sh?$(date +%s)" | \
  sudo bash -s -- --hard --domain=DOMAIN-BUYER.com
```

Update (token udah disimpan di VPS, jadi gak perlu kasih token lagi):
```bash
sudo bash /opt/ptopup/scripts/vps-update.sh
```

Atau pakai `ptupdate` alias — sama jalan tanpa input token.

### 📊 Perbandingan Cara A vs Cara B

| Aspek | 🎫 Cara A (Token) | 👥 Cara B (Collaborator) |
|---|---|---|
| **Setup buyer** | Copy-paste 1 command | Wajib punya GitHub + accept invite + generate token |
| **Akses buyer** | Read-only via VPS | Bisa lihat semua di GitHub web |
| **Revoke** | 1 klik di settings/tokens | Remove dari collaborators |
| **Tracking** | Bisa rename token per buyer | Lihat collaborator list |
| **Cocok buat** | Buyer awam, jualan masal | Buyer techy, partnership |

### 💡 Tips Jualan

- **Generate token unik per buyer** — kasih nama yang jelas (`buyer-john-2026`) biar gampang revoke kalau perlu
- **Set expiration token** — 1 tahun cocok buat lisensi tahunan, force buyer renew
- **Simpan list token & buyer** di spreadsheet pribadi:
  | Tanggal | Buyer | Domain | Token Name | Expiration | Status |
  |---|---|---|---|---|---|
  | 2026-05-28 | John | example.com | buyer-john-2026 | 2027-05-28 | Active |
- **Jangan share token via public** (Telegram public group, screenshot di sosmed). Pakai DM atau email pribadi.
- **Token bocor** → langsung revoke di GitHub, generate baru, kirim ke buyer ulang.

### ⚠️ Yang Perlu Diingat

- Token tersimpan di `/home/ptopup/.git-credentials` (mode 600). Aman selama VPS-nya aman.
- Kalau token expired, buyer perlu hubungi kamu untuk minta token baru. Lalu update credential:
  ```bash
  sudo bash -c 'echo "https://oauth2:TOKEN_BARU@github.com" > /home/ptopup/.git-credentials'
  sudo chown ptopup:ptopup /home/ptopup/.git-credentials
  sudo chmod 600 /home/ptopup/.git-credentials
  ```

---

## 🆘 13. KALAU NYERAH

Kumpulin info ini, paste ke yang bantu:

```bash
echo "=== System ===" && lsb_release -a 2>/dev/null
echo "=== Node ===" && node -v && npm -v
echo "=== PM2 ===" && sudo -u ptopup pm2 status
echo "=== App logs ===" && sudo -u ptopup pm2 logs ptopup --lines 30 --nostream
echo "=== Nginx ===" && sudo nginx -t
echo "=== Disk ===" && df -h /
echo "=== RAM ===" && free -h
echo "=== Env (no secret) ===" && sudo grep -v "PASS\|KEY\|SECRET" /opt/ptopup/.env
```

Selesai. Selamat ngoprek! 🎉
