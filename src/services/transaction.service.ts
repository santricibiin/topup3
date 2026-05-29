/**
 * Transaction Service — orchestrasi pembelian.
 *
 * Alur:
 * 1) checkout(): validasi produk → buat Transaction (PENDING)
 *    - Jika method = BALANCE: debit saldo (ACID), langsung lanjut ke executeProvider().
 *    - Jika method = DUITKU_*: bikin invoice Duitku, return paymentUrl.
 * 2) markPaid(): dipanggil oleh webhook Duitku setelah signature valid.
 *    - Update transaksi → PAID, lalu trigger executeProvider().
 * 3) executeProvider(): hit Digiflazz, update status sesuai response.
 * 4) applyDigiflazzCallback(): dipanggil webhook Digiflazz untuk finalisasi.
 *
 * Setiap perubahan saldo + status transaksi dibungkus prisma.$transaction().
 * Jika provider gagal → rollback otomatis (refund saldo).
 */
import { Prisma, PaymentMethod, ProductCategory, TransactionStatus } from "@prisma/client";
import { POSTPAID_INQUIRY_EXPIRY_MINUTES, TX_EXPIRY_MINUTES } from "@/config/constants";
import { env } from "@/config/env";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateOrderId } from "@/lib/order-id";
import { prisma } from "@/lib/prisma";
import { balanceService } from "./balance.service";
import { digiflazzService } from "./digiflazz.service";
import { duitkuService } from "./duitku.service";
import { gatewayLogService } from "./gateway-log.service";
import { settingsService, applyMarkup } from "./settings.service";
import type { DigiflazzPostpaidData } from "@/types/digiflazz";

export interface CheckoutInput {
  userId: string;
  productSku: string;
  customerNo: string;
  serverId?: string;
  paymentMethod: PaymentMethod;
  paymentChannel?: string;
}

export interface CheckoutResult {
  orderId: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  paymentUrl?: string;
  amount: string;
  expiredAt: Date;
}

export const transactionService = {
  /**
   * Checkout — buat transaksi + (debit saldo / create invoice).
   * Semua DB write dibungkus dalam $transaction.
   */
  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const product = await prisma.product.findUnique({
      where: { sku: input.productSku },
    });
    if (!product) throw Errors.notFound("Produk");
    if (product.status !== "ACTIVE") {
      throw Errors.conflict("Produk sedang tidak tersedia.");
    }

    const orderId = generateOrderId();
    const now = new Date();
    const expiredAt = new Date(now.getTime() + TX_EXPIRY_MINUTES * 60_000);

    const totalAmount = product.sellPrice; // adminFee bisa ditambah dari Duitku fee

    // 1) Buat transaksi (PENDING) di dalam $transaction.
    const tx = await prisma.$transaction(async (db) => {
      const created = await db.transaction.create({
        data: {
          orderId,
          userId: input.userId,
          productId: product.id,
          productSku: product.sku,
          productName: product.name,
          basePrice: product.basePrice,
          sellPrice: product.sellPrice,
          adminFee: 0,
          totalAmount,
          customerNo: input.customerNo,
          serverId: input.serverId,
          paymentMethod: input.paymentMethod,
          paymentChannel: input.paymentChannel,
          expiredAt,
          status: TransactionStatus.PENDING,
        },
      });

      // Jika bayar pakai saldo: debit langsung di sini (ACID).
      if (input.paymentMethod === PaymentMethod.BALANCE) {
        await balanceService.debit(db, {
          userId: input.userId,
          amount: totalAmount,
          type: "PURCHASE",
          description: `Pembelian ${product.name}`,
          referenceId: created.id,
          referenceType: "TRANSACTION",
        });

        await db.transaction.update({
          where: { id: created.id },
          data: {
            status: TransactionStatus.PAID,
            paidAt: new Date(),
          },
        });
      }

      return created;
    });

    // 2) Untuk metode Duitku → buat invoice di luar $transaction (network call).
    if (input.paymentMethod !== PaymentMethod.BALANCE) {
      const channel = input.paymentChannel ?? "VC"; // default VC (Virtual Account BCA)
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: input.userId },
      });

      try {
        const invoice = await duitkuService.createInvoice({
          orderId,
          amount: Number(totalAmount),
          productName: product.name,
          paymentMethod: channel,
          customer: {
            email: user.email,
            name: user.fullName ?? user.username,
            phone: user.phone ?? undefined,
          },
          expiryMinutes: TX_EXPIRY_MINUTES,
        });

        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: tx.id },
            data: {
              paymentChannel: channel,
              paymentRef: invoice.reference,
              paymentUrl: invoice.paymentUrl,
            },
          }),
          prisma.paymentGatewayLog.create({
            data: {
              transactionId: tx.id,
              provider: "DUITKU",
              direction: "RESPONSE",
              endpoint: "/v2/inquiry",
              httpStatus: 200,
              payload: invoice as unknown as Prisma.InputJsonValue,
            },
          }),
        ]);

        return {
          orderId,
          status: TransactionStatus.PENDING,
          paymentMethod: input.paymentMethod,
          paymentUrl: invoice.paymentUrl,
          amount: totalAmount.toString(),
          expiredAt,
        };
      } catch (err) {
        // gagal create invoice → tandai transaksi FAILED
        await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            status: TransactionStatus.FAILED,
            providerMessage: "Gagal membuat invoice pembayaran.",
          },
        });
        throw err;
      }
    }

    // BALANCE → langsung eksekusi provider
    void this.executeProvider(tx.id).catch((e) =>
      logger.error("tx.executeProvider.async.fail", { id: tx.id, err: String(e) }),
    );

    return {
      orderId,
      status: TransactionStatus.PAID,
      paymentMethod: input.paymentMethod,
      amount: totalAmount.toString(),
      expiredAt,
    };
  },

  /**
   * Tandai transaksi sebagai PAID (dipanggil dari webhook Duitku).
   * Triggers executeProvider() setelahnya.
   */
  async markPaid(orderId: string, paymentRef: string) {
    const tx = await prisma.transaction.findUnique({ where: { orderId } });
    if (!tx) throw Errors.notFound("Transaksi");

    if (
      tx.status === TransactionStatus.PAID ||
      tx.status === TransactionStatus.PROCESSING ||
      tx.status === TransactionStatus.SUCCESS
    ) {
      // idempotent — sudah pernah diproses
      return tx;
    }

    const updated = await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: TransactionStatus.PAID,
        paidAt: new Date(),
        paymentRef,
      },
    });

    // jalankan provider (async)
    void this.executeProvider(updated.id).catch((e) =>
      logger.error("tx.executeProvider.async.fail", { id: updated.id, err: String(e) }),
    );

    return updated;
  },

  /**
   * Eksekusi order ke Digiflazz.
   * Idempotent: ref_id = orderId (Digiflazz akan deduplikasi sendiri).
   *
   * Branching:
   * - Prepaid → POST /transaction (cmd implisit, body order normal).
   * - Postpaid → POST /transaction dengan commands: "pay-pasca".
   */
  async executeProvider(transactionId: string) {
    const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw Errors.notFound("Transaksi");
    if (tx.status !== TransactionStatus.PAID) {
      logger.warn("tx.executeProvider.skip", { id: tx.id, status: tx.status });
      return tx;
    }

    // Klasifikasi prepaid/postpaid via produk.
    const product = tx.productId
      ? await prisma.product.findUnique({ where: { id: tx.productId } })
      : null;
    const isPostpaid = product
      ? product.isPostpaid || POSTPAID_CATEGORIES.has(product.category)
      : false;

    await prisma.transaction.update({
      where: { id: tx.id },
      data: { status: TransactionStatus.PROCESSING },
    });

    try {
      if (isPostpaid) {
        const res = await digiflazzService.payPostpaid({
          refId: tx.orderId,
          sku: tx.productSku,
          customerNo: tx.customerNo,
        });
        await gatewayLogService.write(prisma, {
          transactionId: tx.id,
          provider: "DIGIFLAZZ",
          direction: "RESPONSE",
          endpoint: "/transaction (pay-pasca)",
          httpStatus: 200,
          payload: res,
        });
        return await this.applyDigiflazzPostpaidResult(tx.id, res);
      }

      const res = await digiflazzService.order({
        refId: tx.orderId,
        sku: tx.productSku,
        customerNo: tx.customerNo,
        cbUrl: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/digiflazz`,
      });

      await gatewayLogService.write(prisma, {
        transactionId: tx.id,
        provider: "DIGIFLAZZ",
        direction: "RESPONSE",
        endpoint: "/transaction",
        httpStatus: 200,
        payload: res,
      });

      return await this.applyDigiflazzResult(tx.id, res);
    } catch (err) {
      logger.error("tx.executeProvider.fail", { id: tx.id, err: String(err) });
      // Refund saldo bila bayar pakai BALANCE.
      await this.failAndRefund(tx.id, "Gagal menghubungi provider.");
      throw err;
    }
  },

  /**
   * Refund + tandai FAILED. ACID.
   */
  async failAndRefund(transactionId: string, reason: string) {
    return prisma.$transaction(async (db) => {
      const tx = await db.transaction.findUniqueOrThrow({ where: { id: transactionId } });
      if (
        tx.status === TransactionStatus.FAILED ||
        tx.status === TransactionStatus.REFUNDED
      ) {
        return tx; // idempotent
      }

      if (tx.paymentMethod === PaymentMethod.BALANCE) {
        await balanceService.credit(db, {
          userId: tx.userId,
          amount: tx.totalAmount,
          type: "REFUND",
          description: `Refund: ${reason}`,
          referenceId: tx.id,
          referenceType: "TRANSACTION",
        });
      }

      return db.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.FAILED,
          providerMessage: reason,
        },
      });
    });
  },

  /**
   * Apply hasil dari Digiflazz (response sync atau webhook).
   * - Sukses → SUCCESS, simpan SN.
   * - Gagal  → FAILED + refund (jika BALANCE).
   * - Pending → PROCESSING.
   */
  async applyDigiflazzResult(
    transactionId: string,
    data: { status: string; rc?: string; sn?: string; message?: string },
  ) {
    const tx = await prisma.transaction.findUniqueOrThrow({
      where: { id: transactionId },
    });

    if (data.status === "Sukses") {
      return prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.SUCCESS,
          providerSn: data.sn ?? null,
          providerMessage: data.message ?? "Sukses",
        },
      });
    }

    if (data.status === "Gagal") {
      return this.failAndRefund(tx.id, data.message ?? "Gagal di provider");
    }

    // Pending
    return prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: TransactionStatus.PROCESSING,
        providerMessage: data.message ?? "Sedang diproses",
      },
    });
  },

  /**
   * Apply hasil pay-pasca dari Digiflazz.
   *
   * Berbeda dari prepaid: response pasca punya `sn`, `price` (harga deposit),
   * `selling_price`, dan `desc` (struk detail). Snapshot ini perlu disimpan
   * supaya struk pasca tetap akurat meski produk di-edit kemudian.
   */
  async applyDigiflazzPostpaidResult(
    transactionId: string,
    data: DigiflazzPostpaidData,
  ) {
    const tx = await prisma.transaction.findUniqueOrThrow({
      where: { id: transactionId },
    });

    if (data.status === "Sukses") {
      return prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.SUCCESS,
          providerSn: data.sn ?? null,
          providerMessage: data.message ?? "Sukses",
          periode: data.periode ?? tx.periode,
          inquiryDetail: (data.desc as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        },
      });
    }

    if (data.status === "Gagal") {
      return this.failAndRefund(tx.id, data.message ?? "Gagal di provider");
    }

    // Pending — Digiflazz bisa balas pending kalau provider belum konfirmasi.
    return prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: TransactionStatus.PROCESSING,
        providerMessage: data.message ?? "Sedang diproses",
      },
    });
  },

  /**
   * Inquiry tagihan pascabayar (`inq-pasca`).
   *
   * Flow:
   *  1) Validasi produk → harus `isPostpaid=true`.
   *  2) Insert Transaction (PENDING + isInquiryOnly=true).
   *  3) Call Digiflazz inq-pasca pakai orderId sebagai ref_id.
   *  4) Kalau sukses: snapshot harga (price → basePrice, sellPrice, adminFee
   *     dari markup pasca, totalAmount = sellPrice + adminFee), simpan
   *     `desc` ke `inquiryDetail`, `customerName`, `periode`.
   *  5) Kalau gagal: hapus transaksi (atau mark FAILED) — pilihan kita
   *     mark FAILED supaya audit trail tetap ada.
   *
   * Tidak memotong saldo. Saldo baru dipotong saat user `confirmPostpaidPay`.
   */
  async inquiryPostpaid(input: {
    userId: string;
    productSku: string;
    customerNo: string;
  }) {
    const product = await prisma.product.findUnique({
      where: { sku: input.productSku },
    });
    if (!product) throw Errors.notFound("Produk");
    if (!product.isPostpaid) throw Errors.conflict("Produk bukan pascabayar.");
    if (product.status !== "ACTIVE") {
      throw Errors.conflict("Produk sedang tidak tersedia.");
    }

    const orderId = generateOrderId();
    const now = new Date();
    // expiry: min(POSTPAID_INQUIRY_EXPIRY_MINUTES, akhir hari ini)
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const minExpiry = new Date(
      now.getTime() + POSTPAID_INQUIRY_EXPIRY_MINUTES * 60_000,
    );
    const expiredAt = minExpiry < endOfDay ? minExpiry : endOfDay;

    // Insert dengan harga 0 dulu — di-update setelah inquiry sukses.
    const tx = await prisma.transaction.create({
      data: {
        orderId,
        userId: input.userId,
        productId: product.id,
        productSku: product.sku,
        productName: product.name,
        basePrice: new Prisma.Decimal(0),
        sellPrice: new Prisma.Decimal(0),
        adminFee: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(0),
        customerNo: input.customerNo,
        // Default placeholder — di-overwrite saat `confirmPostpaidPay`.
        paymentMethod: PaymentMethod.BALANCE,
        expiredAt,
        status: TransactionStatus.PENDING,
        isInquiryOnly: true,
      },
    });

    let res: DigiflazzPostpaidData;
    try {
      res = await digiflazzService.inquiryPostpaid({
        refId: orderId,
        sku: product.sku,
        customerNo: input.customerNo,
      });
    } catch (err) {
      // Tandai FAILED supaya tidak nyangkut PENDING.
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.FAILED,
          providerMessage: "Gagal inquiry ke provider.",
        },
      });
      throw err;
    }

    await gatewayLogService.write(prisma, {
      transactionId: tx.id,
      provider: "DIGIFLAZZ",
      direction: "RESPONSE",
      endpoint: "/transaction (inq-pasca)",
      httpStatus: 200,
      payload: res,
    });

    if (res.status !== "Sukses") {
      const updated = await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.FAILED,
          providerMessage: res.message ?? "Inquiry gagal",
          customerName: res.customer_name ?? null,
        },
      });
      return { transaction: updated, raw: res };
    }

    // Hitung admin fee user dari markup pasca (terpisah dari prepaid).
    const markupCfg = await settingsService.getMarkupPascaConfig();
    // basePrice = harga yang dipotong dari deposit kita = res.price
    // adminFee  = selisih yang kita kenakan ke user (markup pasca)
    // Tapi `applyMarkup` mengembalikan total (base + margin), bukan margin saja.
    // Jadi: totalUserPrice = applyMarkup(res.price, cfg); adminFee = total - res.price.
    const totalUserPrice = applyMarkup(res.price, markupCfg);
    const adminFee = Math.max(totalUserPrice - res.price, 0);

    const updated = await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        basePrice: new Prisma.Decimal(res.price),
        sellPrice: new Prisma.Decimal(res.price),
        adminFee: new Prisma.Decimal(adminFee),
        totalAmount: new Prisma.Decimal(totalUserPrice),
        customerName: res.customer_name ?? null,
        periode: res.periode ?? null,
        providerMessage: res.message ?? "Inquiry sukses",
        inquiryDetail: (res.desc as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
      },
    });

    return { transaction: updated, raw: res };
  },

  /**
   * Konfirmasi bayar tagihan pasca yang sudah di-inquiry.
   *
   * - Wajib `isInquiryOnly=true` & status `PENDING`.
   * - Doc Digiflazz: pay-pasca hanya valid pada tanggal yang sama dengan
   *   inquiry → reject kalau hari sudah beda.
   * - Reject kalau melewati `expiredAt`.
   * - BALANCE: debit saldo + langsung executeProvider().
   * - DUITKU_*: bikin invoice, balas paymentUrl. executeProvider akan jalan
   *   setelah webhook Duitku markPaid.
   */
  async confirmPostpaidPay(input: {
    userId: string;
    orderId: string;
    paymentMethod: PaymentMethod;
    paymentChannel?: string;
  }) {
    const tx = await prisma.transaction.findUnique({
      where: { orderId: input.orderId },
    });
    if (!tx) throw Errors.notFound("Transaksi");
    if (tx.userId !== input.userId) throw Errors.notFound("Transaksi");
    if (!tx.isInquiryOnly || tx.status !== TransactionStatus.PENDING) {
      throw Errors.conflict("Transaksi tidak dalam status inquiry.");
    }
    const now = new Date();
    if (tx.expiredAt && tx.expiredAt < now) {
      throw Errors.conflict("Inquiry sudah kedaluwarsa. Lakukan inquiry ulang.");
    }
    // Aturan Digiflazz: bayar harus di tanggal yg sama dengan inquiry.
    if (sameDay(tx.createdAt, now) === false) {
      throw Errors.conflict("Bayar tagihan harus di hari yang sama dengan inquiry.");
    }
    if (Number(tx.totalAmount) <= 0) {
      throw Errors.conflict("Nominal tagihan belum tersedia.");
    }

    const totalAmount = tx.totalAmount;

    // ---- BALANCE ----
    if (input.paymentMethod === PaymentMethod.BALANCE) {
      const updated = await prisma.$transaction(async (db) => {
        await balanceService.debit(db, {
          userId: input.userId,
          amount: totalAmount,
          type: "PURCHASE",
          description: `Bayar tagihan ${tx.productName}`,
          referenceId: tx.id,
          referenceType: "TRANSACTION",
        });
        return db.transaction.update({
          where: { id: tx.id },
          data: {
            paymentMethod: PaymentMethod.BALANCE,
            isInquiryOnly: false,
            status: TransactionStatus.PAID,
            paidAt: new Date(),
          },
        });
      });

      void this.executeProvider(updated.id).catch((e) =>
        logger.error("tx.executeProvider.async.fail", {
          id: updated.id,
          err: String(e),
        }),
      );

      return updated;
    }

    // ---- DUITKU ----
    const channel = input.paymentChannel ?? "VC";
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: input.userId },
    });
    const invoice = await duitkuService.createInvoice({
      orderId: tx.orderId,
      amount: Number(totalAmount),
      productName: tx.productName,
      paymentMethod: channel,
      customer: {
        email: user.email,
        name: user.fullName ?? user.username,
        phone: user.phone ?? undefined,
      },
      expiryMinutes: TX_EXPIRY_MINUTES,
    });

    const updated = await prisma.$transaction(async (db) => {
      const next = await db.transaction.update({
        where: { id: tx.id },
        data: {
          paymentMethod: input.paymentMethod,
          paymentChannel: channel,
          paymentRef: invoice.reference,
          paymentUrl: invoice.paymentUrl,
          isInquiryOnly: false,
        },
      });
      await db.paymentGatewayLog.create({
        data: {
          transactionId: tx.id,
          provider: "DUITKU",
          direction: "RESPONSE",
          endpoint: "/v2/inquiry",
          httpStatus: 200,
          payload: invoice as unknown as Prisma.InputJsonValue,
        },
      });
      return next;
    });

    return updated;
  },

  /** Helper: cari transaksi by orderId. */
  async findByOrderId(orderId: string) {
    return prisma.transaction.findUnique({ where: { orderId } });
  },

  /**
   * Reconcile status dari Digiflazz — dipakai saat webhook telat / tidak masuk.
   *
   * - Hanya jalan untuk status non-final (PAID/PROCESSING).
   * - Cooldown default 8 detik. Doc Digiflazz menyarankan tidak <1 menit untuk
   *   menghindari race condition, tapi karena kita pakai `ref_id` idempotent
   *   dan state-machine ACID (tidak menulis ulang saldo saat hasil sama),
   *   polling cepat aman. Kecil saja agar UX terasa realtime.
   * - `force=true` mengabaikan cooldown.
   * - Guard 90 hari (PREPAID): doc Digiflazz memperingatkan cek status PREPAID
   *   untuk transaksi >= 90 hari akan dianggap transaksi BARU. Kita refuse
   *   untuk mencegah double-charge.
   *
   * Return transaksi terbaru (mungkin belum berubah jika provider belum update).
   */
  async reconcileWithProvider(
    orderId: string,
    opts: { force?: boolean; minStaleMs?: number } = {},
  ) {
    const { force = false, minStaleMs = 8_000 } = opts;
    const tx = await prisma.transaction.findUnique({ where: { orderId } });
    if (!tx) throw Errors.notFound("Transaksi");

    const RECONCILABLE: TransactionStatus[] = [
      TransactionStatus.PAID,
      TransactionStatus.PROCESSING,
    ];
    if (!RECONCILABLE.includes(tx.status)) return tx;

    if (!force) {
      const ageMs = Date.now() - tx.updatedAt.getTime();
      if (ageMs < minStaleMs) return tx;
    }

    // Klasifikasi prepaid vs postpaid berdasarkan kategori produk.
    // Untuk produk yang sudah dihapus (productId null) kita default ke
    // prepaid karena itu mayoritas alur transaksi.
    const product = tx.productId
      ? await prisma.product.findUnique({ where: { id: tx.productId } })
      : null;
    const isPostpaid = product
      ? POSTPAID_CATEGORIES.has(product.category)
      : false;

    // Guard umur transaksi 90 hari (PREPAID): kalau dipaksa cek, Digiflazz
    // akan bikin transaksi BARU dan saldo bisa kepotong dua kali.
    const ageDays =
      (Date.now() - tx.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (!isPostpaid && ageDays >= 90) {
      logger.warn("tx.reconcile.skip_age_90d", { id: tx.id, ageDays });
      return tx;
    }

    try {
      const res = isPostpaid
        ? await digiflazzService.checkStatusPostpaid({
            refId: tx.orderId,
            sku: tx.productSku,
            customerNo: tx.customerNo,
          })
        : await digiflazzService.checkStatusPrepaid({
            refId: tx.orderId,
            sku: tx.productSku,
            customerNo: tx.customerNo,
          });

      await gatewayLogService.write(prisma, {
        transactionId: tx.id,
        provider: "DIGIFLAZZ",
        direction: "RESPONSE",
        endpoint: isPostpaid
          ? "/transaction (status-pasca)"
          : "/transaction (status-check)",
        httpStatus: 200,
        payload: res,
      });
      return await this.applyDigiflazzResult(tx.id, res);
    } catch (err) {
      logger.warn("tx.reconcile.fail", { id: tx.id, err: String(err) });
      // Bump updatedAt biar tidak retry brutal — tapi pertahankan status.
      return prisma.transaction.update({
        where: { id: tx.id },
        data: { updatedAt: new Date() },
      });
    }
  },
};

// Kategori yang oleh Digiflazz diperlakukan sebagai pascabayar
// (cek status pakai command `status-pasca`).
const POSTPAID_CATEGORIES = new Set<ProductCategory>([
  ProductCategory.PASCABAYAR,
  ProductCategory.TV_KABEL,
  ProductCategory.GAS,
  ProductCategory.BPJS,
  ProductCategory.ASURANSI,
  ProductCategory.PDAM,
]);

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
