/**
 * Error domain — semua error bisnis harus pakai class ini.
 * API route akan menerjemahkan ke response standar via `apiHandler`.
 */
export const ErrorCode = {
  // umum
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL_ERROR",

  // domain — saldo & transaksi
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  TRANSACTION_LOCKED: "TRANSACTION_LOCKED",
  TRANSACTION_EXPIRED: "TRANSACTION_EXPIRED",
  INVALID_PIN: "INVALID_PIN",

  // provider
  DIGIFLAZZ_ERROR: "DIGIFLAZZ_ERROR",
  DUITKU_ERROR: "DUITKU_ERROR",
  INVALID_SIGNATURE: "INVALID_SIGNATURE",
} as const;

export type ErrorCodeT = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  public readonly code: ErrorCodeT;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    code: ErrorCodeT,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/* helper factory */
export const Errors = {
  validation: (details?: unknown) =>
    new AppError(ErrorCode.VALIDATION_ERROR, "Input tidak valid.", 422, details),
  badRequest: (msg = "Permintaan tidak valid.") =>
    new AppError(ErrorCode.VALIDATION_ERROR, msg, 400),
  unauthorized: (msg = "Anda harus login.") =>
    new AppError(ErrorCode.UNAUTHORIZED, msg, 401),
  forbidden: (msg = "Akses ditolak.") =>
    new AppError(ErrorCode.FORBIDDEN, msg, 403),
  notFound: (entity = "Resource") =>
    new AppError(ErrorCode.NOT_FOUND, `${entity} tidak ditemukan.`, 404),
  conflict: (msg: string) => new AppError(ErrorCode.CONFLICT, msg, 409),
  rateLimited: (msg = "Terlalu banyak permintaan.") =>
    new AppError(ErrorCode.RATE_LIMITED, msg, 429),
  insufficientBalance: () =>
    new AppError(ErrorCode.INSUFFICIENT_BALANCE, "Saldo tidak mencukupi.", 400),
  transactionExpired: () =>
    new AppError(ErrorCode.TRANSACTION_EXPIRED, "Transaksi sudah kadaluarsa.", 410),
  invalidPin: () => new AppError(ErrorCode.INVALID_PIN, "PIN salah.", 401),
  digiflazz: (msg: string, details?: unknown) =>
    new AppError(ErrorCode.DIGIFLAZZ_ERROR, msg, 502, details),
  duitku: (msg: string, details?: unknown) =>
    new AppError(ErrorCode.DUITKU_ERROR, msg, 502, details),
  invalidSignature: () =>
    new AppError(ErrorCode.INVALID_SIGNATURE, "Signature tidak valid.", 401),
  internal: (msg = "Terjadi kesalahan internal.") =>
    new AppError(ErrorCode.INTERNAL, msg, 500),
};
