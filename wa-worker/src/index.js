/**
 * WA OTP Worker — Baileys WebSocket client + HTTP API.
 *
 * Tanggung jawab:
 *  - Connect ke WhatsApp via Baileys, manage QR & reconnect.
 *  - Generate OTP (6 digit), simpan hash + expiry di-memory.
 *  - Endpoint HTTP yang dipakai Next.js (lewat localhost):
 *      POST /api/v1/otp/send
 *      POST /api/v1/otp/verify
 *      GET  /api/v1/otp/status/:requestId
 *      GET  /api/v1/session/status      — admin: cek status sesi WA
 *      POST /api/v1/session/start       — admin: mulai sesi (kalau belum konek)
 *      GET  /api/v1/session/qr          — admin: QR code (PNG base64)
 *      POST /api/v1/session/logout      — admin: putus sesi & hapus auth
 *
 * Auth: header `x-api-key` (env WAOTP_WORKER_KEY).
 *
 * Single-session, in-memory OTP store. Untuk production multi-instance
 * pindah ke DB-backed store (atau cukup pakai 1 instance worker karena
 * Baileys sendiri inheren single-process).
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const path = require("path");
const fs = require("fs");
const express = require("express");
const pino = require("pino");
const QRCode = require("qrcode");
const bcrypt = require("bcryptjs");
const { Boom } = require("@hapi/boom");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

// ============================================================
// CONFIG
// ============================================================
const PORT = Number(process.env.PORT) || 3002;
const HOST = process.env.HOST || "127.0.0.1";
const WORKER_KEY = process.env.WAOTP_WORKER_KEY || "";
// AUTH_DIR di-anchor ke folder worker (../auth), BUKAN ke CWD. Penting:
// saat redeploy/PM2 restart, CWD bisa berubah → path relatif "./auth" akan
// menunjuk folder berbeda/kosong sehingga sesi WhatsApp hilang & QR baru
// muncul (gejala "tidak dapat menautkan perangkat"). Path absolut tetap aman.
const _authEnv = process.env.AUTH_DIR || "./auth";
const AUTH_DIR = path.isAbsolute(_authEnv)
  ? _authEnv
  : path.resolve(__dirname, "..", _authEnv);
const DEFAULT_OTP_LEN = Number(process.env.OTP_LENGTH) || 6;
const DEFAULT_OTP_EXPIRES = Number(process.env.OTP_EXPIRES_SECONDS) || 300;
const DEFAULT_OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 5;

if (!WORKER_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    "[FATAL] WAOTP_WORKER_KEY env wajib diisi. Buat .env dari .env.example.",
  );
  process.exit(1);
}

const logger = pino({
  level: "info",
  transport: { target: "pino-pretty", options: { colorize: true } },
}).child({ scope: "wa-worker" });

// Log lokasi auth state biar gampang debug saat sesi "hilang" setelah deploy.
logger.info({ authDir: AUTH_DIR, cwd: process.cwd() }, "config.authDir");

// ============================================================
// PHONE NORMALIZE — match logic di src/lib/phone.ts (sederhana)
// ============================================================
function normalizePhone(input) {
  if (!input) return null;
  const cleaned = String(input).replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  let digits;
  if (cleaned.startsWith("+62")) digits = "62" + cleaned.slice(3);
  else if (cleaned.startsWith("62")) digits = cleaned;
  else if (cleaned.startsWith("0")) digits = "62" + cleaned.slice(1);
  else if (cleaned.startsWith("8")) digits = "62" + cleaned;
  else return null;
  if (digits.length < 11 || digits.length > 15) return null;
  if (!digits.startsWith("628")) return null;
  if (!/^\d+$/.test(digits)) return null;
  return digits;
}

// ============================================================
// OTP STORE — in-memory map: requestId → { phoneHash, codeHash, ... }
// ============================================================
class OtpStore {
  constructor() {
    /** @type {Map<string, OtpRecord>} */
    this.byId = new Map();
    /** @type {Map<string, string>} phone → latest requestId */
    this.byPhone = new Map();
  }
  /**
   * @typedef OtpRecord
   * @property {string} requestId
   * @property {string} phone
   * @property {string} codeHash         bcrypt hash dari kode plain
   * @property {string} purpose
   * @property {number} createdAt        epoch ms
   * @property {number} expiresAt        epoch ms
   * @property {number} attempts
   * @property {number} maxAttempts
   * @property {"PENDING"|"SENT"|"VERIFIED"|"EXPIRED"|"FAILED"} status
   * @property {number|null} verifiedAt
   * @property {number|null} failedAt
   * @property {string|null} sentAt
   */

  put(rec) {
    this.byId.set(rec.requestId, rec);
    this.byPhone.set(rec.phone, rec.requestId);
  }
  get(requestId) {
    return this.byId.get(requestId) || null;
  }
  getLatestByPhone(phone) {
    const rid = this.byPhone.get(phone);
    return rid ? this.byId.get(rid) : null;
  }
  /** Cleanup record yang sudah expire — panggil periodik. */
  prune() {
    const now = Date.now();
    let n = 0;
    for (const [id, r] of this.byId.entries()) {
      // Hapus record final yang lebih dari 1 jam (audit trail kecil)
      // atau pending yang sudah expire >24 jam.
      const ageMs = now - r.createdAt;
      if (
        (r.status === "VERIFIED" || r.status === "FAILED") &&
        ageMs > 60 * 60_000
      ) {
        this.byId.delete(id);
        if (this.byPhone.get(r.phone) === id) this.byPhone.delete(r.phone);
        n++;
      } else if (r.status === "SENT" && r.expiresAt < now - 24 * 3600_000) {
        this.byId.delete(id);
        if (this.byPhone.get(r.phone) === id) this.byPhone.delete(r.phone);
        n++;
      }
    }
    return n;
  }
}

const otpStore = new OtpStore();
setInterval(() => {
  const removed = otpStore.prune();
  if (removed > 0) logger.info({ removed }, "otp.prune");
}, 60_000);

// ============================================================
// BAILEYS SESSION MANAGER
// ============================================================
class WaSession {
  constructor() {
    this.sock = null;
    this.qr = null; // raw QR string
    this.qrImage = null; // data:image/png;base64,...
    /** @type {"DISCONNECTED"|"CONNECTING"|"QR_PENDING"|"CONNECTED"} */
    this.status = "DISCONNECTED";
    this.lastError = null;
    this.connectedAt = null;
    this.connectedNumber = null;
    this.starting = false;
  }

  async start() {
    if (this.starting || this.status === "CONNECTING" || this.status === "CONNECTED") {
      return;
    }
    this.starting = true;
    try {
      await fs.promises.mkdir(AUTH_DIR, { recursive: true });
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion();
      logger.info({ version }, "baileys.version");

      this.status = "CONNECTING";
      this.sock = makeWASocket({
        version,
        logger: pino({ level: "warn" }),
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        markOnlineOnConnect: false,
        browser: ["PTopup OTP", "Chrome", "1.0"],
      });

      this.sock.ev.on("creds.update", saveCreds);
      this.sock.ev.on("connection.update", async (u) => {
        const { connection, lastDisconnect, qr } = u;
        if (qr) {
          this.qr = qr;
          this.qrImage = await QRCode.toDataURL(qr, { margin: 1, scale: 6 });
          this.status = "QR_PENDING";
          logger.info("qr.received");
        }
        if (connection === "close") {
          const code =
            lastDisconnect?.error instanceof Boom
              ? lastDisconnect.error.output?.statusCode
              : 0;
          const loggedOut = code === DisconnectReason.loggedOut;
          this.status = "DISCONNECTED";
          this.lastError = lastDisconnect?.error?.message ?? "closed";
          this.qr = null;
          this.qrImage = null;
          logger.warn({ code, loggedOut, err: this.lastError }, "connection.close");
          if (!loggedOut) {
            // Auto-reconnect dengan delay kecil.
            setTimeout(() => this.start().catch(() => {}), 3000);
          } else {
            // Logged out — auth state tidak valid lagi, hapus folder
            // supaya next start mulai fresh dengan QR baru.
            await this.clearAuth().catch(() => {});
          }
        } else if (connection === "open") {
          this.status = "CONNECTED";
          this.connectedAt = Date.now();
          this.qr = null;
          this.qrImage = null;
          this.lastError = null;
          // sock.user = { id: "62xxx@s.whatsapp.net", name: "..." }
          const id = this.sock?.user?.id ?? "";
          this.connectedNumber = id.split(":")[0]?.split("@")[0] ?? null;
          logger.info({ number: this.connectedNumber }, "connection.open");
        }
      });
    } catch (err) {
      this.status = "DISCONNECTED";
      this.lastError = err?.message ?? String(err);
      logger.error({ err: this.lastError }, "session.start.fail");
      throw err;
    } finally {
      this.starting = false;
    }
  }

  async logout() {
    try {
      await this.sock?.logout?.();
    } catch (e) {
      logger.warn({ err: String(e) }, "logout.warn");
    }
    try {
      this.sock?.end?.(undefined);
    } catch {}
    this.sock = null;
    this.status = "DISCONNECTED";
    this.qr = null;
    this.qrImage = null;
    this.connectedAt = null;
    this.connectedNumber = null;
    await this.clearAuth();
  }

  async clearAuth() {
    try {
      await fs.promises.rm(AUTH_DIR, { recursive: true, force: true });
      await fs.promises.mkdir(AUTH_DIR, { recursive: true });
    } catch (e) {
      logger.warn({ err: String(e) }, "clearAuth.fail");
    }
  }

  /** Kirim teks ke nomor (62xxx). Throw kalau belum connected. */
  async sendText(phone62, text) {
    if (this.status !== "CONNECTED" || !this.sock) {
      throw new Error("WA session not connected");
    }
    const jid = `${phone62}@s.whatsapp.net`;
    await this.sock.sendMessage(jid, { text });
  }
}

const wa = new WaSession();
// Auto-start saat boot kalau auth state existing.
fs.promises
  .stat(AUTH_DIR)
  .then(() => wa.start().catch(() => {}))
  .catch(() => {
    /* folder belum ada, biarkan admin trigger manual */
  });

// ============================================================
// HELPERS — template render
// ============================================================
/** Substitusi placeholder {code}/{otp}/{minutes}/{seconds}/{phone}/{var:NAMA}. */
function renderTemplate(tpl, vars) {
  if (!tpl) return null;
  let out = tpl
    .replace(/\{code\}/g, vars.code)
    .replace(/\{otp\}/g, vars.code)
    .replace(/\{minutes\}/g, String(Math.round(vars.expiresInSeconds / 60)))
    .replace(/\{seconds\}/g, String(vars.expiresInSeconds))
    .replace(/\{phone\}/g, vars.phone)
    .replace(/\{purpose\}/g, vars.purpose ?? "");
  for (const [k, v] of Object.entries(vars.variables || {})) {
    out = out.replace(new RegExp(`\\{var:${k}\\}`, "g"), String(v));
  }
  // Hapus placeholder var:* yang tidak terisi
  out = out.replace(/\{var:[^}]+\}/g, "");
  return out;
}

const DEFAULT_TEMPLATE = "Kode OTP Anda adalah: *{code}*\nBerlaku {minutes} menit. Jangan bagikan ke siapa pun.";

function genCode(length) {
  let s = "";
  for (let i = 0; i < length; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function cuidLike() {
  // Lookalike cuid v1 (24-26 char). Bukan strict cuid tapi cukup unik.
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 12);
  return `cm${t}${r}`.slice(0, 25);
}

// ============================================================
// EXPRESS APP
// ============================================================
const app = express();
app.use(express.json({ limit: "100kb" }));

// Auth middleware — semua endpoint /api/* butuh x-api-key valid.
app.use("/api", (req, res, next) => {
  const key = req.header("x-api-key") ?? "";
  if (!key || key !== WORKER_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// ---- Health (no auth) ----
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    session: {
      status: wa.status,
      number: wa.connectedNumber,
      connectedAt: wa.connectedAt,
    },
  });
});

// ---- SESSION management (admin) ----
app.get("/api/v1/session/status", (_req, res) => {
  res.json({
    ok: true,
    session: {
      status: wa.status,
      number: wa.connectedNumber,
      connectedAt: wa.connectedAt
        ? new Date(wa.connectedAt).toISOString()
        : null,
      lastError: wa.lastError,
      hasQr: Boolean(wa.qrImage),
    },
  });
});

app.post("/api/v1/session/start", async (_req, res) => {
  try {
    if (wa.status === "CONNECTED") {
      return res.json({ ok: true, alreadyConnected: true });
    }
    await wa.start();
    res.json({ ok: true, status: wa.status });
  } catch (err) {
    res.status(500).json({ error: err?.message ?? "start failed" });
  }
});

app.get("/api/v1/session/qr", (_req, res) => {
  if (wa.status === "CONNECTED") {
    return res.status(409).json({ error: "Already connected" });
  }
  if (!wa.qrImage) {
    return res.status(404).json({ error: "QR belum tersedia. Mulai sesi dulu." });
  }
  res.json({ ok: true, qr: wa.qr, image: wa.qrImage, status: wa.status });
});

app.post("/api/v1/session/logout", async (_req, res) => {
  await wa.logout();
  res.json({ ok: true });
});

// ---- OTP endpoints ----
app.post("/api/v1/otp/send", async (req, res) => {
  try {
    const {
      phone,
      purpose,
      length,
      expiresInSeconds,
      template,
      variables,
    } = req.body || {};

    const phone62 = normalizePhone(phone);
    if (!phone62) {
      return res.status(400).json({ error: "Phone tidak valid" });
    }
    if (wa.status !== "CONNECTED") {
      return res.status(409).json({
        error: "Failed to send WhatsApp message",
        detail: `Session status: ${wa.status}`,
      });
    }

    const len = Math.max(4, Math.min(8, Number(length) || DEFAULT_OTP_LEN));
    const exp = Math.max(
      30,
      Math.min(1800, Number(expiresInSeconds) || DEFAULT_OTP_EXPIRES),
    );
    const code = genCode(len);
    const codeHash = await bcrypt.hash(code, 8);

    const text = renderTemplate(template ?? DEFAULT_TEMPLATE, {
      code,
      phone: phone62,
      purpose: purpose ?? "",
      expiresInSeconds: exp,
      variables: variables ?? {},
    });

    // Kirim ke WA dulu, baru simpan record. Kalau gagal kirim, jangan
    // simpan record (otherwise verify akan kebingungan).
    try {
      await wa.sendText(phone62, text);
    } catch (e) {
      logger.error({ err: String(e) }, "wa.send.fail");
      return res.status(502).json({
        error: "Failed to send WhatsApp message",
        detail: String(e?.message ?? e),
      });
    }

    const requestId = cuidLike();
    const now = Date.now();
    const rec = {
      requestId,
      phone: phone62,
      codeHash,
      purpose: purpose ?? null,
      createdAt: now,
      expiresAt: now + exp * 1000,
      attempts: 0,
      maxAttempts: DEFAULT_OTP_MAX_ATTEMPTS,
      status: "SENT",
      verifiedAt: null,
      failedAt: null,
      sentAt: new Date().toISOString(),
    };
    otpStore.put(rec);

    logger.info({ requestId, phone: phone62, purpose }, "otp.send");

    res.json({
      ok: true,
      requestId,
      phone: phone62,
      expiresAt: new Date(rec.expiresAt).toISOString(),
      expiresInSeconds: exp,
    });
  } catch (err) {
    logger.error({ err: String(err) }, "otp.send.err");
    res.status(500).json({ error: "Internal error" });
  }
});

app.post("/api/v1/otp/verify", async (req, res) => {
  try {
    const { requestId, phone, code } = req.body || {};
    if (!code) {
      return res.status(400).json({ error: "code required" });
    }
    let rec = null;
    if (requestId) rec = otpStore.get(requestId);
    else if (phone) {
      const phone62 = normalizePhone(phone);
      if (phone62) rec = otpStore.getLatestByPhone(phone62);
    }
    if (!rec) {
      return res.status(404).json({ error: "No active OTP found for this request" });
    }
    if (rec.status === "VERIFIED") {
      return res.status(409).json({ error: "OTP already used" });
    }
    if (rec.status === "EXPIRED" || rec.expiresAt < Date.now()) {
      rec.status = "EXPIRED";
      return res.status(410).json({ error: "OTP expired" });
    }
    if (rec.attempts >= rec.maxAttempts) {
      rec.status = "FAILED";
      rec.failedAt = Date.now();
      return res
        .status(429)
        .json({ error: "Maximum verification attempts exceeded" });
    }
    rec.attempts++;
    const ok = await bcrypt.compare(String(code), rec.codeHash);
    if (!ok) {
      const remaining = rec.maxAttempts - rec.attempts;
      if (remaining <= 0) {
        rec.status = "FAILED";
        rec.failedAt = Date.now();
        return res
          .status(429)
          .json({ error: "Maximum verification attempts exceeded" });
      }
      return res.status(400).json({
        error: "Invalid OTP code",
        attemptsRemaining: remaining,
      });
    }
    rec.status = "VERIFIED";
    rec.verifiedAt = Date.now();
    res.json({
      ok: true,
      verified: true,
      requestId: rec.requestId,
      phone: rec.phone,
      verifiedAt: new Date(rec.verifiedAt).toISOString(),
    });
  } catch (err) {
    logger.error({ err: String(err) }, "otp.verify.err");
    res.status(500).json({ error: "Internal error" });
  }
});

app.get("/api/v1/otp/status/:requestId", (req, res) => {
  const rec = otpStore.get(req.params.requestId);
  if (!rec) return res.status(404).json({ error: "Not found" });
  res.json({
    ok: true,
    request: {
      id: rec.requestId,
      phone: rec.phone,
      status: rec.status,
      purpose: rec.purpose,
      attempts: rec.attempts,
      maxAttempts: rec.maxAttempts,
      expiresAt: new Date(rec.expiresAt).toISOString(),
      sentAt: rec.sentAt,
      verifiedAt: rec.verifiedAt
        ? new Date(rec.verifiedAt).toISOString()
        : null,
      failedAt: rec.failedAt ? new Date(rec.failedAt).toISOString() : null,
      createdAt: new Date(rec.createdAt).toISOString(),
    },
  });
});

// ============================================================
// BOOT
// ============================================================
app.listen(PORT, HOST, () => {
  logger.info({ url: `http://${HOST}:${PORT}` }, "wa-worker.listen");
});

// Graceful shutdown
function shutdown() {
  logger.info("shutdown.signal");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
