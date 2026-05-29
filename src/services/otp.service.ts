/**
 * OTP Service — orchestrator untuk WA OTP gateway.
 *
 * Tanggung jawab:
 *  - Per-purpose business logic (VERIFY_PHONE, RESET_PASSWORD, dst).
 *  - Validate ownership: requestId hanya bisa diverify oleh user yang request,
 *    atau anonim untuk forgot-password (dengan rate-limit ketat di route).
 *  - Persist OtpRequest mapping (gateway sudah simpan kode-nya, kita simpan
 *    metadata aplikasi: userId, purpose, status).
 *  - Side-effect setelah verified (set User.phoneVerified, ganti password).
 *
 * Kode OTP plain TIDAK PERNAH masuk ke service ini — flow:
 *   client → API → otp.send() → gateway (kirim WA) → user dapat kode
 *   user → API → otp.verify(code, requestId) → gateway validate
 */
import { OtpPurpose, OtpStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { settingsService } from "./settings.service";
import { waOtpService } from "./wa-otp.service";

interface SendInput {
  phone: string;
  purpose: OtpPurpose;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface SendResult {
  requestId: string;
  phone: string; // normalized
  expiresAt: Date;
  expiresInSeconds: number;
}

class OtpService {
  /**
   * Throttle per-(phone, purpose): max 1 request per 60 detik.
   * Cegah spam WA gateway billing & abuse.
   */
  private async assertNotThrottled(phone: string, purpose: OtpPurpose) {
    const last = await prisma.otpRequest.findFirst({
      where: { phone, purpose },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (!last) return;
    const ageMs = Date.now() - last.createdAt.getTime();
    if (ageMs < 60_000) {
      const wait = Math.ceil((60_000 - ageMs) / 1000);
      throw Errors.conflict(
        `Tunggu ${wait} detik sebelum minta kode baru.`,
      );
    }
  }

  async send(input: SendInput): Promise<SendResult> {
    // Gate: kalau admin disable WA OTP, langsung tolak.
    const cfg = await settingsService.getWaOtpConfig();
    if (!cfg.enabled) {
      throw Errors.conflict("Fitur OTP WhatsApp belum diaktifkan oleh admin.");
    }

    const phone = normalizePhone(input.phone);
    if (!phone) throw Errors.badRequest("Nomor WhatsApp tidak valid.");

    await this.assertNotThrottled(phone, input.purpose);

    const expiresInSeconds = 300;
    // Ambil template dari DB (setting). Placeholder seperti {code}, {minutes},
    // {phone} akan disubstitusi oleh gateway. Kalau admin set string kosong,
    // kita fallback ke null supaya gateway pakai default-nya sendiri.
    const templates = await settingsService.getWaOtpTemplates();
    const tpl = templates[input.purpose];
    const template = tpl && tpl.trim().length > 0 ? tpl : undefined;

    const res = await waOtpService.send({
      phone,
      purpose: input.purpose.toLowerCase(),
      length: 6,
      expiresInSeconds,
      template,
    });

    // Simpan mapping aplikasi.
    await prisma.otpRequest.create({
      data: {
        requestId: res.requestId,
        userId: input.userId ?? null,
        phone: res.phone,
        purpose: input.purpose,
        status: OtpStatus.SENT,
        expiresAt: new Date(res.expiresAt),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });

    logger.info("otp.send", {
      requestId: res.requestId,
      purpose: input.purpose,
      userId: input.userId,
    });

    return {
      requestId: res.requestId,
      phone: res.phone,
      expiresAt: new Date(res.expiresAt),
      expiresInSeconds: res.expiresInSeconds,
    };
  }

  /**
   * Verify kode untuk requestId tertentu dan execute side-effect.
   *
   * @param expectUserId - kalau di-set, requestId harus milik userId ini
   *                       (cegah user A pakai requestId user B).
   *                       Forgot-password (anonim) pakai null.
   */
  async verify(input: {
    requestId: string;
    code: string;
    purpose: OtpPurpose;
    expectUserId?: string | null;
  }): Promise<{ phone: string; userId: string | null }> {
    const cfg = await settingsService.getWaOtpConfig();
    if (!cfg.enabled) {
      throw Errors.conflict("Fitur OTP WhatsApp belum diaktifkan oleh admin.");
    }
    const record = await prisma.otpRequest.findUnique({
      where: { requestId: input.requestId },
    });
    if (!record) throw Errors.notFound("OTP");
    if (record.purpose !== input.purpose) {
      // Cegah cross-purpose abuse: user pakai requestId VERIFY_PHONE buat reset password.
      throw Errors.conflict("OTP tidak cocok dengan permintaan ini.");
    }
    if (record.status === OtpStatus.VERIFIED) {
      throw Errors.conflict("OTP sudah pernah digunakan.");
    }
    if (record.status === OtpStatus.EXPIRED || record.expiresAt < new Date()) {
      throw Errors.conflict("Kode OTP sudah kedaluwarsa.");
    }
    if (input.expectUserId !== undefined && record.userId !== input.expectUserId) {
      // expectUserId === null hanya boleh untuk forgot-password yang record-nya
      // memang menyimpan userId target — tapi user anonim, tidak boleh akses
      // requestId orang lain. Caller wajib lewat path khusus.
      throw Errors.notFound("OTP");
    }

    try {
      await waOtpService.verify({
        requestId: input.requestId,
        code: input.code,
      });
    } catch (err) {
      // Update status FAILED hanya kalau jelas-jelas dia gagal final
      // (mis. expired / max attempts). Code salah biasa tidak update status.
      throw err;
    }

    await prisma.otpRequest.update({
      where: { id: record.id },
      data: { status: OtpStatus.VERIFIED, verifiedAt: new Date() },
    });

    logger.info("otp.verified", {
      requestId: record.requestId,
      purpose: record.purpose,
      userId: record.userId,
    });

    return { phone: record.phone, userId: record.userId };
  }

  // ---- High-level wrappers per purpose ----

  /** VERIFY_PHONE: butuh user login, simpan userId, set User.phoneVerified saat sukses. */
  async sendVerifyPhone(opts: {
    userId: string;
    phone: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.send({
      phone: opts.phone,
      purpose: "VERIFY_PHONE",
      userId: opts.userId,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    });
  }

  async confirmVerifyPhone(opts: {
    userId: string;
    requestId: string;
    code: string;
  }) {
    const { phone } = await this.verify({
      requestId: opts.requestId,
      code: opts.code,
      purpose: "VERIFY_PHONE",
      expectUserId: opts.userId,
    });
    // Set User.phoneVerified + sync User.phone (kalau berbeda, mis. user
    // verifikasi nomor yg lebih baru).
    await prisma.user.update({
      where: { id: opts.userId },
      data: { phoneVerified: new Date(), phone },
    });
    return { phone };
  }

  /**
   * REGISTER step 1: kirim OTP ke nomor calon user (anonim, belum ada akun).
   *
   * SECURITY:
   *  - Cek phone belum dipakai user lain (cegah enumeration via OTP juga).
   *  - userId di OtpRequest = null karena akun belum ada.
   *  - Identitas pendaftar dijaga via requestId + phone match saat verify.
   */
  async sendRegister(opts: {
    phone: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const phone = normalizePhone(opts.phone);
    if (!phone) throw Errors.badRequest("Nomor WhatsApp tidak valid.");

    // Pre-check: phone tidak boleh sudah terdaftar.
    const existing = await prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (existing) {
      throw Errors.conflict("Nomor sudah terdaftar. Silakan login.");
    }

    return this.send({
      phone,
      purpose: "REGISTER",
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    });
  }

  /**
   * REGISTER step 2: verify OTP, return phone yang sudah confirmed.
   * Caller (register endpoint) harus pakai phone ini saat insert User
   * dan langsung set User.phoneVerified.
   *
   * Tidak update DB user di sini — itu tanggung jawab register service.
   */
  async confirmRegisterOtp(opts: { requestId: string; code: string }) {
    const { phone } = await this.verify({
      requestId: opts.requestId,
      code: opts.code,
      purpose: "REGISTER",
      // Anonim — userId di record memang null saat REGISTER.
      expectUserId: null,
    });
    return { phone };
  }

  /**
   * LOGIN step 1: kirim OTP setelah password sudah diverifikasi.
   * Caller (POST /api/auth/login) wajib pre-check password dulu — service
   * ini tidak verifikasi password.
   */
  async sendLogin(opts: {
    userId: string;
    phone: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.send({
      phone: opts.phone,
      purpose: "LOGIN",
      userId: opts.userId,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    });
  }

  /**
   * LOGIN step 2: verify OTP, return userId yang boleh dibikinkan session.
   * Ownership: requestId harus milik user yang sama (record.userId match).
   */
  async confirmLoginOtp(opts: {
    requestId: string;
    code: string;
    expectUserId: string;
  }) {
    await this.verify({
      requestId: opts.requestId,
      code: opts.code,
      purpose: "LOGIN",
      expectUserId: opts.expectUserId,
    });
    return { userId: opts.expectUserId };
  }

  /**
   * RESET_PASSWORD step 1: kirim OTP ke nomor user.
   * SECURITY: tidak boleh leak apakah user/phone exist atau tidak — apa pun
   * hasilnya (akun tak ada, phone tak ada, gateway error, throttled) caller
   * dapat shape yang sama: { requestId, phoneMasked }. requestId null kalau
   * tidak terkirim. Caller WAJIB return generic message ke client.
   */
  async sendResetPassword(opts: {
    identifier: string; // email atau username
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ requestId: string | null; phoneMasked: string | null }> {
    const id = opts.identifier.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        OR: [{ email: id }, { username: id }],
      },
      select: { id: true, phone: true },
    });
    if (!user || !user.phone) {
      logger.warn("otp.reset.no_target", { identifier: id });
      return { requestId: null, phoneMasked: null };
    }
    try {
      const sent = await this.send({
        phone: user.phone,
        purpose: "RESET_PASSWORD",
        userId: user.id,
        ipAddress: opts.ipAddress,
        userAgent: opts.userAgent,
      });
      const masked = `+${sent.phone.slice(0, 5)}****${sent.phone.slice(-4)}`;
      return { requestId: sent.requestId, phoneMasked: masked };
    } catch (err) {
      // SECURITY: jangan propagate error ke client supaya tidak leak existence.
      // Loop possible failures: throttle, gateway down, no WA session, etc.
      logger.warn("otp.reset.send_fail", {
        userId: user.id,
        err: String(err),
      });
      return { requestId: null, phoneMasked: null };
    }
  }

  /**
   * RESET_PASSWORD step 2: verify OTP & ganti password.
   * Ownership: requestId harus milik user (record.userId), tapi user belum
   * login. Solusi: kita validate via record.userId yang tersimpan saat send.
   */
  async confirmResetPassword(opts: {
    requestId: string;
    code: string;
    newPasswordHash: string;
  }) {
    const cfg = await settingsService.getWaOtpConfig();
    if (!cfg.enabled) {
      throw Errors.conflict("Fitur OTP WhatsApp belum diaktifkan oleh admin.");
    }
    const record = await prisma.otpRequest.findUnique({
      where: { requestId: opts.requestId },
    });
    if (!record) throw Errors.notFound("OTP");
    if (record.purpose !== "RESET_PASSWORD") {
      throw Errors.conflict("OTP tidak cocok dengan permintaan ini.");
    }
    if (!record.userId) {
      throw Errors.conflict("OTP tidak terikat ke user.");
    }
    if (record.status === OtpStatus.VERIFIED) {
      throw Errors.conflict("OTP sudah pernah digunakan.");
    }
    if (record.status === OtpStatus.EXPIRED || record.expiresAt < new Date()) {
      throw Errors.conflict("Kode OTP sudah kedaluwarsa.");
    }

    await waOtpService.verify({
      requestId: opts.requestId,
      code: opts.code,
    });

    // Ganti password + invalidate semua session aktif user.
    await prisma.$transaction([
      prisma.otpRequest.update({
        where: { id: record.id },
        data: { status: OtpStatus.VERIFIED, verifiedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: opts.newPasswordHash },
      }),
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    logger.info("otp.reset_password.done", {
      requestId: record.requestId,
      userId: record.userId,
    });

    return { userId: record.userId };
  }
}

export const otpService = new OtpService();

/** Helper hash password — supaya route gak import bcrypt langsung. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
