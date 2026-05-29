/**
 * Standardized API response — semua API Route /app/api/* wajib pakai ini.
 */
import { NextResponse } from "next/server";

type Ok<T> = { success: true; data: T };
type Err = { success: false; error: { code: string; message: string; details?: unknown } };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<Ok<T>>({ success: true, data }, init);
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  return NextResponse.json<Err>(
    { success: false, error: { code, message, details } },
    { status },
  );
}

export const ApiError = {
  Unauthorized: () => fail("UNAUTHORIZED", "Anda harus login.", 401),
  Forbidden: () => fail("FORBIDDEN", "Akses ditolak.", 403),
  NotFound: (entity = "Resource") => fail("NOT_FOUND", `${entity} tidak ditemukan.`, 404),
  Validation: (details: unknown) =>
    fail("VALIDATION_ERROR", "Input tidak valid.", 422, details),
  Conflict: (msg = "Konflik data.") => fail("CONFLICT", msg, 409),
  Internal: (msg = "Terjadi kesalahan internal.") => fail("INTERNAL_ERROR", msg, 500),
};
