/**
 * apiHandler — wrapper untuk seluruh route handler /app/api/*.
 * - Tangkap AppError → mapping ke response standar.
 * - Tangkap ZodError → 422 VALIDATION_ERROR.
 * - Tangkap error lain → log + 500 INTERNAL.
 */
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { ApiError, fail, ok } from "@/lib/api-response";

export type Handler = (req: NextRequest) => Promise<NextResponse | Response>;

export function apiHandler(h: Handler) {
  return async (req: NextRequest) => {
    try {
      return await h(req);
    } catch (err) {
      if (err instanceof ZodError) {
        return ApiError.Validation(err.flatten());
      }
      if (err instanceof AppError) {
        return fail(err.code, err.message, err.statusCode, err.details);
      }
      logger.error("api.unhandled", { err: String(err) });
      return ApiError.Internal();
    }
  };
}

export { ok };
