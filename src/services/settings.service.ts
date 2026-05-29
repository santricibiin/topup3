/**
 * Settings Service — runtime config (kredensial provider, markup, dll).
 *
 * - Default value diambil dari env saat key belum ada di DB.
 * - In-memory cache 30 detik agar tidak hit DB di setiap request.
 * - `isSecret` true → value tidak boleh dikirim ke client (UI hanya tampilkan masked).
 */
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";

export const SETTING_KEYS = {
  // Digiflazz
  DIGIFLAZZ_USERNAME: "digiflazz.username",
  DIGIFLAZZ_API_KEY: "digiflazz.apiKey",
  DIGIFLAZZ_MODE: "digiflazz.mode", // "development" | "production"
  // Markup
  MARKUP_TYPE: "markup.type", // "PERCENT" | "FIXED"
  MARKUP_VALUE: "markup.value", // angka — persen (mis 5) atau rupiah (mis 1000)
  MARKUP_MIN: "markup.min", // minimal margin Rp
  MARKUP_ROUND_TO: "markup.roundTo", // pembulatan harga akhir (mis 100)
  // Markup khusus PASCABAYAR (admin fee yang ditambahkan ke nilai_tagihan).
  // Pisah dari prepaid karena karakter biaya admin pasca berbeda
  // (umumnya flat fee, bukan persen dari tagihan).
  MARKUP_PASCA_TYPE: "markup.pasca.type", // "PERCENT" | "FIXED"
  MARKUP_PASCA_VALUE: "markup.pasca.value",
  MARKUP_PASCA_MIN: "markup.pasca.min",
  MARKUP_PASCA_ROUND_TO: "markup.pasca.roundTo",
  // Site / Branding
  SITE_NAME: "site.name",
  SITE_TAGLINE: "site.tagline",
  SITE_LOGO_URL: "site.logoUrl",
  SITE_THEME: "site.theme",                    // preset key (mis. "emerald", "violet", "amber") atau "custom:HSL"
  // Deposit / Payment
  DEPOSIT_QRIS_CODE: "deposit.qrisCode",       // EMVCo string QRIS statis
  DEPOSIT_CALLBACK_SECRET: "deposit.callbackSecret", // secret utk validasi webhook
  DEPOSIT_MIN: "deposit.min",                  // minimal nominal (Rp)
  DEPOSIT_MAX: "deposit.max",                  // maksimal nominal (Rp)
  DEPOSIT_EXPIRY_MIN: "deposit.expiryMin",     // expiry pending deposit (menit)
  DEPOSIT_DANA_OWNER_NAME: "deposit.danaOwnerName", // utk validasi optional
  // Topup catalog UI
  TOPUP_ICON_SIZE: "topup.iconSize",           // 24-96 (px) — ukuran ikon kategori
  TOPUP_ICON_SHAPE: "topup.iconShape",         // "rounded" | "circle" — bentuk container
  // Backup
  BACKUP_ENABLED: "backup.enabled",            // "true" | "false" — auto-backup on/off
  BACKUP_INTERVAL: "backup.interval",          // "minutes" | "hours" | "days"
  BACKUP_VALUE: "backup.value",                // angka — frekuensi
  BACKUP_KEEP_DAYS: "backup.keepDays",         // berapa hari sebelum auto-delete
  // WhatsApp OTP gateway (verifikasi nomor & reset password)
  WAOTP_ENABLED: "waotp.enabled",              // "true" | "false" — default false
  WAOTP_URL: "waotp.url",                      // base URL gateway, fallback ke env WAOTP_API_URL
  WAOTP_API_KEY: "waotp.apiKey",               // API key gateway, fallback ke env WAOTP_API_KEY
  // Wajibkan OTP saat login untuk user yang phone-nya sudah verified.
  // User tanpa phone verified tetap login normal (password saja). Default false.
  WAOTP_LOGIN_REQUIRED: "waotp.loginRequired",
  // Template pesan WA per purpose. Placeholder yang didukung gateway:
  // {code} {otp} {minutes} {seconds} {phone} {purpose} {var:NAMA}.
  WAOTP_TPL_VERIFY_PHONE: "waotp.tpl.verify_phone",
  WAOTP_TPL_RESET_PASSWORD: "waotp.tpl.reset_password",
  WAOTP_TPL_REGISTER: "waotp.tpl.register",
  WAOTP_TPL_LOGIN: "waotp.tpl.login",
  WAOTP_TPL_CONFIRM_TX: "waotp.tpl.confirm_tx",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

const SECRET_KEYS: SettingKey[] = [
  SETTING_KEYS.DIGIFLAZZ_API_KEY,
  SETTING_KEYS.DEPOSIT_CALLBACK_SECRET,
  SETTING_KEYS.WAOTP_API_KEY,
];

/** Default fallback dari env. */
function envDefault(key: SettingKey): string {
  switch (key) {
    case SETTING_KEYS.DIGIFLAZZ_USERNAME:
      return env.DIGIFLAZZ_USERNAME ?? "";
    case SETTING_KEYS.DIGIFLAZZ_API_KEY:
      return env.DIGIFLAZZ_MODE === "production"
        ? env.DIGIFLAZZ_PROD_API_KEY || env.DIGIFLAZZ_API_KEY
        : env.DIGIFLAZZ_API_KEY;
    case SETTING_KEYS.DIGIFLAZZ_MODE:
      return env.DIGIFLAZZ_MODE;
    case SETTING_KEYS.MARKUP_TYPE:
      return "PERCENT";
    case SETTING_KEYS.MARKUP_VALUE:
      return String(process.env.DIGIFLAZZ_MARGIN_PERCENT ?? "5");
    case SETTING_KEYS.MARKUP_MIN:
      return String(process.env.DIGIFLAZZ_MARGIN_MIN ?? "500");
    case SETTING_KEYS.MARKUP_ROUND_TO:
      return "100";
    case SETTING_KEYS.MARKUP_PASCA_TYPE:
      return "FIXED";
    case SETTING_KEYS.MARKUP_PASCA_VALUE:
      return "1000";
    case SETTING_KEYS.MARKUP_PASCA_MIN:
      return "0";
    case SETTING_KEYS.MARKUP_PASCA_ROUND_TO:
      return "100";
    case SETTING_KEYS.SITE_NAME:
      return "PTopup";
    case SETTING_KEYS.SITE_TAGLINE:
      return "Topup PPOB & Game — cepat, aman, anti-ribet.";
    case SETTING_KEYS.SITE_LOGO_URL:
      return "";
    case SETTING_KEYS.SITE_THEME:
      return "emerald";
    case SETTING_KEYS.DEPOSIT_QRIS_CODE:
      return "";
    case SETTING_KEYS.DEPOSIT_CALLBACK_SECRET:
      return "";
    case SETTING_KEYS.DEPOSIT_MIN:
      return "10000";
    case SETTING_KEYS.DEPOSIT_MAX:
      return "10000000";
    case SETTING_KEYS.DEPOSIT_EXPIRY_MIN:
      return "15";
    case SETTING_KEYS.DEPOSIT_DANA_OWNER_NAME:
      return "";
    case SETTING_KEYS.TOPUP_ICON_SIZE:
      return "56";
    case SETTING_KEYS.TOPUP_ICON_SHAPE:
      return "rounded";
    case SETTING_KEYS.BACKUP_ENABLED:
      return "false";
    case SETTING_KEYS.BACKUP_INTERVAL:
      return "days";
    case SETTING_KEYS.BACKUP_VALUE:
      return "1";
    case SETTING_KEYS.BACKUP_KEEP_DAYS:
      return "7";
    case SETTING_KEYS.WAOTP_ENABLED:
      return "false";
    case SETTING_KEYS.WAOTP_URL:
      return env.WAOTP_API_URL;
    case SETTING_KEYS.WAOTP_API_KEY:
      return env.WAOTP_API_KEY ?? "";
    case SETTING_KEYS.WAOTP_LOGIN_REQUIRED:
      return "false";
    case SETTING_KEYS.WAOTP_TPL_VERIFY_PHONE:
      return "Kode verifikasi nomor PTopup: *{code}*. Berlaku {minutes} menit. Jangan bagikan ke siapapun.";
    case SETTING_KEYS.WAOTP_TPL_RESET_PASSWORD:
      return "Kode reset password PTopup: *{code}*. Berlaku {minutes} menit. Abaikan jika kamu tidak meminta reset.";
    case SETTING_KEYS.WAOTP_TPL_REGISTER:
      return "Kode pendaftaran PTopup: *{code}*. Berlaku {minutes} menit. Jangan bagikan ke siapapun.";
    case SETTING_KEYS.WAOTP_TPL_LOGIN:
      return "Kode login PTopup: *{code}*. Berlaku {minutes} menit.";
    case SETTING_KEYS.WAOTP_TPL_CONFIRM_TX:
      return "Kode konfirmasi transaksi PTopup: *{code}*. Berlaku {minutes} menit.";
    default:
      return "";
  }
}

const TTL_MS = 30_000;
const cache = new Map<SettingKey, { value: string; ts: number }>();
let allCache: { data: Map<SettingKey, string>; ts: number } | null = null;

class SettingsService {
  /** Fetch semua settings dalam 1 query — paling efisien. */
  private async loadAll(): Promise<Map<SettingKey, string>> {
    if (allCache && Date.now() - allCache.ts < TTL_MS) {
      return allCache.data;
    }
    const rows = await prisma.setting.findMany();
    const map = new Map<SettingKey, string>();
    for (const r of rows) {
      map.set(r.key as SettingKey, r.value);
    }
    allCache = { data: map, ts: Date.now() };
    // Sync per-key cache supaya .get() solo juga cepat
    for (const [k, v] of map.entries()) {
      cache.set(k, { value: v, ts: Date.now() });
    }
    return map;
  }

  async get(key: SettingKey): Promise<string> {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL_MS) return hit.value;

    // Trigger batch load — di-share antar pemanggil yang concurrent.
    const all = await this.loadAll();
    const value = all.get(key) ?? envDefault(key);
    return value;
  }

  async getMany(keys: SettingKey[]): Promise<Record<SettingKey, string>> {
    const all = await this.loadAll();
    const result = {} as Record<SettingKey, string>;
    for (const k of keys) {
      result[k] = all.get(k) ?? envDefault(k);
    }
    return result;
  }

  async set(key: SettingKey, value: string): Promise<void> {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value, isSecret: SECRET_KEYS.includes(key) },
      update: { value },
    });
    cache.delete(key);
    allCache = null;
  }

  async setMany(entries: Array<{ key: SettingKey; value: string }>): Promise<void> {
    await prisma.$transaction(
      entries.map((e) =>
        prisma.setting.upsert({
          where: { key: e.key },
          create: { key: e.key, value: e.value, isSecret: SECRET_KEYS.includes(e.key) },
          update: { value: e.value },
        }),
      ),
    );
    entries.forEach((e) => cache.delete(e.key));
    allCache = null;
  }

  /** Hapus setting key dari DB → getter akan fallback ke envDefault. */
  async unset(key: SettingKey): Promise<void> {
    await prisma.setting.delete({ where: { key } }).catch(() => {
      /* ignore "row not found" */
    });
    cache.delete(key);
    allCache = null;
  }

  invalidate(key?: SettingKey) {
    if (key) cache.delete(key);
    else cache.clear();
    allCache = null;
  }

  isSecret(key: SettingKey): boolean {
    return SECRET_KEYS.includes(key);
  }

  /** Sensor secret: tampilkan 4 char terakhir saja. */
  mask(value: string): string {
    if (!value) return "";
    if (value.length <= 4) return "••••";
    return "•".repeat(Math.max(value.length - 4, 4)) + value.slice(-4);
  }

  // ----- Convenience getters -----

  async getDigiflazzCredentials() {
    const [username, apiKey, mode] = await Promise.all([
      this.get(SETTING_KEYS.DIGIFLAZZ_USERNAME),
      this.get(SETTING_KEYS.DIGIFLAZZ_API_KEY),
      this.get(SETTING_KEYS.DIGIFLAZZ_MODE),
    ]);
    return { username, apiKey, mode: mode === "production" ? "production" : "development" };
  }

  async getMarkupConfig() {
    const [type, value, min, roundTo] = await Promise.all([
      this.get(SETTING_KEYS.MARKUP_TYPE),
      this.get(SETTING_KEYS.MARKUP_VALUE),
      this.get(SETTING_KEYS.MARKUP_MIN),
      this.get(SETTING_KEYS.MARKUP_ROUND_TO),
    ]);
    return {
      type: type === "FIXED" ? ("FIXED" as const) : ("PERCENT" as const),
      value: Number(value) || 0,
      min: Number(min) || 0,
      roundTo: Math.max(Number(roundTo) || 1, 1),
    };
  }

  /**
   * Markup khusus pascabayar (admin fee). Default FIXED Rp 1.000.
   * Diterapkan saat inq-pasca: totalAmount = price + adminFee.
   */
  async getMarkupPascaConfig() {
    const [type, value, min, roundTo] = await Promise.all([
      this.get(SETTING_KEYS.MARKUP_PASCA_TYPE),
      this.get(SETTING_KEYS.MARKUP_PASCA_VALUE),
      this.get(SETTING_KEYS.MARKUP_PASCA_MIN),
      this.get(SETTING_KEYS.MARKUP_PASCA_ROUND_TO),
    ]);
    return {
      type: type === "PERCENT" ? ("PERCENT" as const) : ("FIXED" as const),
      value: Number(value) || 0,
      min: Number(min) || 0,
      roundTo: Math.max(Number(roundTo) || 1, 1),
    };
  }

  async getSiteBranding() {
    const [name, tagline, logoUrl, theme] = await Promise.all([
      this.get(SETTING_KEYS.SITE_NAME),
      this.get(SETTING_KEYS.SITE_TAGLINE),
      this.get(SETTING_KEYS.SITE_LOGO_URL),
      this.get(SETTING_KEYS.SITE_THEME),
    ]);
    return { name: name || "PTopup", tagline, logoUrl, theme: theme || "emerald" };
  }

  async getDepositConfig() {
    const [qrisCode, callbackSecret, min, max, expiryMin, danaOwnerName] =
      await Promise.all([
        this.get(SETTING_KEYS.DEPOSIT_QRIS_CODE),
        this.get(SETTING_KEYS.DEPOSIT_CALLBACK_SECRET),
        this.get(SETTING_KEYS.DEPOSIT_MIN),
        this.get(SETTING_KEYS.DEPOSIT_MAX),
        this.get(SETTING_KEYS.DEPOSIT_EXPIRY_MIN),
        this.get(SETTING_KEYS.DEPOSIT_DANA_OWNER_NAME),
      ]);
    return {
      qrisCode,
      callbackSecret,
      min: Number(min) || 10_000,
      max: Number(max) || 10_000_000,
      expiryMin: Math.max(Number(expiryMin) || 15, 1),
      danaOwnerName,
    };
  }

  async getBackupConfig() {
    const [enabled, interval, value, keepDays] = await Promise.all([
      this.get(SETTING_KEYS.BACKUP_ENABLED),
      this.get(SETTING_KEYS.BACKUP_INTERVAL),
      this.get(SETTING_KEYS.BACKUP_VALUE),
      this.get(SETTING_KEYS.BACKUP_KEEP_DAYS),
    ]);
    const intervalNorm = (
      interval === "minutes" || interval === "hours" || interval === "days"
        ? interval
        : "days"
    ) as "minutes" | "hours" | "days";
    return {
      enabled: enabled === "true",
      interval: intervalNorm,
      value: Math.max(1, Number(value) || 1),
      keepDays: Math.max(0, Number(keepDays) || 7),
    };
  }

  /**
   * Konfigurasi WA OTP gateway. Default disabled.
   * URL & apiKey fallback ke env saat DB belum di-set, supaya backward
   * compatible dengan deployment yang sebelumnya cuma pakai env.
   */
  async getWaOtpConfig() {
    const [enabled, url, apiKey, loginRequired] = await Promise.all([
      this.get(SETTING_KEYS.WAOTP_ENABLED),
      this.get(SETTING_KEYS.WAOTP_URL),
      this.get(SETTING_KEYS.WAOTP_API_KEY),
      this.get(SETTING_KEYS.WAOTP_LOGIN_REQUIRED),
    ]);
    return {
      enabled: enabled === "true",
      url: url || env.WAOTP_API_URL,
      apiKey: apiKey || env.WAOTP_API_KEY,
      loginRequired: loginRequired === "true",
    };
  }

  /**
   * Template pesan WA per purpose.
   * Value berisi placeholder yang akan disubstitusi oleh gateway:
   * {code} {minutes} {phone} dst.
   */
  async getWaOtpTemplates() {
    const [verifyPhone, resetPassword, register, login, confirmTx] =
      await Promise.all([
        this.get(SETTING_KEYS.WAOTP_TPL_VERIFY_PHONE),
        this.get(SETTING_KEYS.WAOTP_TPL_RESET_PASSWORD),
        this.get(SETTING_KEYS.WAOTP_TPL_REGISTER),
        this.get(SETTING_KEYS.WAOTP_TPL_LOGIN),
        this.get(SETTING_KEYS.WAOTP_TPL_CONFIRM_TX),
      ]);
    return {
      VERIFY_PHONE: verifyPhone,
      RESET_PASSWORD: resetPassword,
      REGISTER: register,
      LOGIN: login,
      CONFIRM_TX: confirmTx,
    };
  }
}

export const settingsService = new SettingsService();

/**
 * Hitung harga jual berdasarkan markup config.
 * - PERCENT: basePrice * (1 + value/100)
 * - FIXED  : basePrice + value
 * Margin minimum diterapkan, lalu dibulatkan ke kelipatan `roundTo` ke atas.
 */
export function applyMarkup(
  basePrice: number,
  cfg: { type: "PERCENT" | "FIXED"; value: number; min: number; roundTo: number },
): number {
  const margin =
    cfg.type === "PERCENT"
      ? Math.ceil(basePrice * (cfg.value / 100))
      : Math.ceil(cfg.value);
  const finalMargin = Math.max(margin, cfg.min);
  const total = basePrice + finalMargin;
  return Math.ceil(total / cfg.roundTo) * cfg.roundTo;
}
