/**
 * Helper untuk mencatat log komunikasi Payment Gateway / Provider.
 * Sanitasi payload — buang field kredensial sebelum disimpan.
 */
import { Prisma, GatewayLogDirection, GatewayProvider } from "@prisma/client";

const REDACT_KEYS = new Set([
  "apiKey",
  "api_key",
  "sign",
  "signature",
  "password",
  "Authorization",
  "authorization",
]);

export function sanitizePayload<T>(payload: T): unknown {
  if (payload === null || typeof payload !== "object") return payload;
  if (Array.isArray(payload)) return payload.map((p) => sanitizePayload(p));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.has(k) ? "[REDACTED]" : sanitizePayload(v);
  }
  return out;
}

export interface GatewayLogParams {
  transactionId?: string | null;
  provider: GatewayProvider;
  direction: GatewayLogDirection;
  endpoint: string;
  httpStatus?: number;
  signature?: string;
  payload?: unknown;
  errorMessage?: string;
}

type Tx = Prisma.TransactionClient;

export const gatewayLogService = {
  async write(client: Tx | typeof import("@/lib/prisma").prisma, p: GatewayLogParams) {
    return client.paymentGatewayLog.create({
      data: {
        transactionId: p.transactionId ?? null,
        provider: p.provider,
        direction: p.direction,
        endpoint: p.endpoint,
        httpStatus: p.httpStatus,
        signature: p.signature,
        payload: sanitizePayload(p.payload) as Prisma.InputJsonValue,
        errorMessage: p.errorMessage,
      },
    });
  },
};
