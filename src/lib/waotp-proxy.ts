/**
 * Proxy ke wa-worker (Baileys) untuk endpoint admin (session/*).
 *
 * Worker hidup di URL `waotp.url` setting (default localhost:3002). Endpoint
 * admin Next.js fungsinya hanya forward request ke worker, plus admin guard.
 *
 * Body & response gak diubah — cukup re-emit JSON apa adanya supaya UI bisa
 * pakai shape yang sama dengan worker.
 */
import { NextResponse } from "next/server";
import { Errors } from "@/lib/errors";
import { settingsService } from "@/services/settings.service";

export async function callWorker(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const cfg = await settingsService.getWaOtpConfig();
  if (!cfg.apiKey) {
    throw Errors.conflict("API key worker belum diisi.");
  }
  const url = `${cfg.url}${path}`;
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "x-api-key": cfg.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, data: json };
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") {
      throw Errors.conflict("Worker timeout.");
    }
    throw Errors.conflict(`Tidak bisa menghubungi worker: ${String(err)}`);
  } finally {
    clearTimeout(timeout);
  }
}

export function passthrough(result: { status: number; data: unknown }) {
  return NextResponse.json(
    { success: result.status >= 200 && result.status < 300, data: result.data },
    { status: result.status },
  );
}
