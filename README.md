# 🚀 PTopup — Topup PPOB & Game

Platform topup pulsa, data, PLN, e-wallet, game, voucher, dll. Dibangun dengan **Next.js 14 + TypeScript + Prisma (MySQL)**, terintegrasi **Digiflazz** (PPOB H2H) dan **DANA QRIS** (deposit otomatis via Android Notification Forwarder).

---

## ✨ Fitur Utama

**User**: Login/register, topup 19 kategori (Digiflazz), deposit saldo via QRIS DANA dengan kode unik, riwayat transaksi, edit profile + avatar, dark mode.

**Admin**: Dashboard + grafik, manajemen produk (sync Digiflazz, atur margin), kelola transaksi/user/saldo, pengaturan deposit (QRIS + webhook secret), branding (logo, theme, kategori icon).

---

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript strict
- **UI**: Tailwind + Radix UI + Lucide/Iconify
- **DB**: MySQL 8 + Prisma 5
- **Auth**: iron-session + bcrypt
- **Validation**: Zod
- **Form**: React Hook Form

---

## 🚀 Quick Start (Lokal)

```bash
# 1. Install deps
npm install

# 2. Copy env (lalu edit DATABASE_URL & SESSION_PASSWORD)
cp .env.example .env

# 3. Push schema ke DB
npx prisma db push

# 4. Seed admin pertama
npm run db:seed

# 5. Jalanin
npm run dev
# → http://localhost:3000
```

Login default: `admin` / `Admin#12345` (ganti setelah login).

---

## 🌐 Deploy ke VPS

Lihat **[`deploy.md`](./deploy.md)** untuk panduan lengkap (bahasa simpel + copy-paste ready).

Singkatnya: 1 command untuk deploy fresh:
```bash
curl -fsSL "https://raw.githubusercontent.com/<user>/<repo>/main/scripts/vps-deploy.sh?$(date +%s)" | sudo bash -s -- \
    --domain=DOMAIN --email=EMAIL --repo=REPO_URL
```

Auto-install: Node.js, MySQL, Nginx, SSL Let's Encrypt, PM2, build app, seed admin. Total 5–10 menit.

---

## 🔐 Environment Variables

File `.env` (auto-generated saat deploy VPS):

```env
DATABASE_URL="mysql://ptopup:PASSWORD@localhost:3306/ptopup"
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
SESSION_PASSWORD="<64-char-hex>"

DIGIFLAZZ_USERNAME=""
DIGIFLAZZ_API_KEY=""
DIGIFLAZZ_PROD_API_KEY=""
DIGIFLAZZ_MODE="development"
DIGIFLAZZ_BASE_URL="https://api.digiflazz.com/v1"

NODE_ENV="production"
```

> Setting non-rahasia (logo, theme, QRIS, webhook secret, dll) dikelola dari `/admin/settings` dan `/admin/deposits` — **tidak perlu di `.env`**.

---

## 🔔 Webhook DANA (Android Forwarder)

**Endpoint**: `https://yourdomain.com/api/webhooks/dana-callback`

**Setup**:
1. Login admin → `/admin/deposits` → Generate **Webhook Secret** → copy
2. Set di app forwarder Android (yang ada akun DANA Bisnis):
   - URL: endpoint di atas
   - Method: `POST`
   - Header: `X-Forwarder-Secret: <secret>`
   - Body: `pkg={android.pkg}&title={android.title}&text={android.text}&bigtext={android.bigText}`
   - Filter package: `id.dana`

Detail lengkap di `deploy.md` section webhook.

---

## 🗄 Database Schema (10 Tabel)

| Tabel | Fungsi |
|---|---|
| `User` | Akun (USER/ADMIN/RESELLER) |
| `Session` | Cookie session (revokable) |
| `Balance` + `BalanceMutation` | Saldo + audit trail |
| `Product` | Katalog Digiflazz (19 kategori) |
| `Transaction` | Transaksi topup |
| `Deposit` | Deposit pending (kode unik QRIS) |
| `PaymentGatewayLog` | Log webhook |
| `Setting` + `CategorySetting` | Config runtime + kustomisasi kategori |

Schema lengkap: `prisma/schema.prisma`. Semua kolom uang pakai `Decimal(18,2)`, **tidak pernah Float**.

---

## 📜 Scripts npm

```bash
npm run dev              # Dev server (port 3000)
npm run build            # Build production (+ iconify + prisma generate)
npm run start            # Start production
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run db:seed          # Seed admin pertama
npm run prisma:studio    # GUI database
```

---

## 🛡 Security Highlights

- ✅ bcrypt password hash (10 rounds)
- ✅ Session httpOnly + secure (production)
- ✅ Webhook signature validation (DANA secret + Digiflazz MD5)
- ✅ Decimal untuk semua field uang (no float)
- ✅ Atomic `prisma.$transaction()` untuk mutasi saldo
- ✅ Audit trail di `BalanceMutation`
- ✅ Strict TypeScript (`noUncheckedIndexedAccess`)
- ✅ CSP headers di `next.config.mjs`

---

## 🐛 Troubleshooting Cepat

| Masalah | Solusi |
|---|---|
| Cache corrupt / module error | `rm -rf .next && npm run dev` |
| Prisma client error | `npx prisma generate` |
| Schema out of sync | `npx prisma db push` |
| Avatar upload error | `chmod 755 public/uploads/avatars` |
| App down di VPS | `sudo -u ptopup pm2 restart ptopup` |
| Lihat password DB di VPS | `sudo cat /root/.ptopup-db-password` |

---

## 📁 Struktur Folder

```
src/
├── app/              # Next.js App Router (pages + API routes)
│   ├── (auth)/       # Login, register
│   ├── (dashboard)/  # Dashboard user, transactions
│   ├── admin/        # Admin panel
│   ├── api/          # API endpoints
│   └── topup/, deposit/, profile/, transaction/
├── components/       # UI components (layout, providers, ui)
├── features/         # Feature modules (topup, deposit, admin, dll)
├── services/         # Business logic (transaction, balance, digiflazz, dll)
├── server/           # API handler, auth, admin guards
├── lib/              # Utils (prisma, money, errors, logger)
├── schemas/          # Zod validation schemas
└── types/            # TypeScript types

prisma/               # Schema + migrations + seed
public/uploads/       # Avatar uploads
scripts/              # Deploy/cleanup/update scripts (.sh)
```

---

## 📝 Dokumentasi Lain

- **[`deploy.md`](./deploy.md)** — Panduan deploy/update/cleanup VPS (bahasa simpel)
- **[`DEPLOY_VPS.md`](./DEPLOY_VPS.md)** — Versi panjang + troubleshooting detail

---

## 📄 License

Private / proprietary. Hubungi pemilik untuk lisensi komersial.
