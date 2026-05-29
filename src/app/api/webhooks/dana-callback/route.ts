import { NextRequest, NextResponse } from "next/server";
import { apiHandler, ok } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/lib/crypto";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { settingsService } from "@/services/settings.service";
import { depositService } from "@/services/deposit.service";

export const dynamic = "force-dynamic";

/**
 * Webhook untuk Android Notification Forwarder.
 *
 * Body diterima dalam beberapa format yg umum dipakai aplikasi forwarder:
 *  - application/x-www-form-urlencoded   → pkg=id.dana&title=...&text=...
 *  - application/json                    → { pkg, title, text }
 *  - text/plain (raw body)               → kita parse manual sebagai querystring
 *
 * Authentication:
 *  - Header `X-Forwarder-Secret` HARUS match SETTING_KEYS.DEPOSIT_CALLBACK_SECRET.
 *    Kalau secret di setting kosong → tolak semua (untuk safety).
 *
 * Response:
 *  - 200 selalu kalau payload diterima (forwarder gak retry kalau gak 2xx).
 *  - { matched: true, depositId } kalau ketemu, atau { matched: false, reason }.
 *
 * Catatan keamanan:
 *  - Endpoint ini publik (gak ada cookie session). Andalkan secret + IP allowlist
 *    di reverse-proxy untuk hardening tambahan.
 *  - Tidak boleh return detail user / saldo di response (info disclosure).
 */

// Healthcheck — supaya orang bisa GET endpoint utk verifikasi up.
export async function GET() {
  return NextResponse.json({
    status: "ok",
    name: "dana-callback",
    note: "POST notif via Android forwarder",
  });
}

export const POST = apiHandler(async (req: NextRequest) => {
  // Rate limit per IP (cegah spam / brute-force secret)
  const ip = getClientIp(req);
  rateLimit({
    key: `dana-callback:${ip}`,
    max: 30,
    windowMs: 60_000,
    message: "Terlalu banyak request. Coba lagi nanti.",
  });

  const cfg = await settingsService.getDepositConfig();

  // ---- 1) Read body once (kita butuh utk auth fallback + parse payload) ----
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  const raw = await req.text();
  let payload: {
    pkg?: string;
    title?: string;
    text?: string;
    bigtext?: string;
    subtext?: string;
    infotext?: string;
    secret?: string;
  };

  try {
    if (ct.includes("application/json")) {
      payload = JSON.parse(raw);
    } else {
      // urlencoded atau plain text — pakai querystring parser
      payload = parseUrlEncoded(raw);
    }
  } catch (err) {
    logger.warn("deposit.callback.parse_fail", { ct, raw, err: String(err) });
    return ok({ matched: false, reason: "parse-fail" });
  }

  // ---- 2) Auth: cek secret dari header ATAU body ----
  // SECURITY: secret WAJIB di-set. Kalau kosong → tolak (jangan return ok).
  if (!cfg.callbackSecret) {
    logger.error("deposit.callback.secret_missing");
    throw Errors.internal("Webhook secret belum di-set. Hubungi admin.");
  }
  // Prioritas: header → body field `secret`
  const supplied =
    req.headers.get("x-forwarder-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    payload.secret ??
    "";
  // Pakai safeEqual untuk cegah timing attack
  if (!supplied || !safeEqual(supplied, cfg.callbackSecret)) {
    logger.warn("deposit.callback.bad_secret", {
      ip,
      hasHeader: Boolean(req.headers.get("x-forwarder-secret")),
      hasBody: Boolean(payload.secret),
    });
    // 401 Unauthorized — bukan 200 ok (cegah blind brute-force)
    throw Errors.unauthorized("Invalid forwarder secret.");
  }

  logger.info("deposit.callback.received", {
    pkg: payload.pkg,
    title: payload.title?.slice(0, 80),
    text: payload.text?.slice(0, 120),
    bigtext: payload.bigtext?.slice(0, 120),
  });

  // ---- 3) Forward ke service untuk match & kredit ----
  const result = await depositService.handleDanaCallback({
    ...payload,
    raw,
  });

  return ok(result);
});

function parseUrlEncoded(raw: string): {
  pkg?: string;
  title?: string;
  text?: string;
  bigtext?: string;
  subtext?: string;
  infotext?: string;
  secret?: string;
} {
  const params = new URLSearchParams(raw);
  return {
    pkg: params.get("pkg") ?? undefined,
    title: params.get("title") ?? undefined,
    text: params.get("text") ?? undefined,
    bigtext: params.get("bigtext") ?? undefined,
    subtext: params.get("subtext") ?? undefined,
    infotext: params.get("infotext") ?? undefined,
    // Field secret bisa pakai berbagai nama yg umum di forwarder app
    secret:
      params.get("secret") ??
      params.get("token") ??
      params.get("apikey") ??
      params.get("api_key") ??
      params.get("X-Forwarder-Secret") ??
      undefined,
  };
}
