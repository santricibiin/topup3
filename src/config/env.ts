/**
 * ENV validator — fail-fast saat boot kalau ada kredensial yang hilang.
 * Dipakai di seluruh service. JANGAN baca process.env langsung di tempat lain.
 *
 * Field opsional (Duitku, NextAuth, Socket) hanya diperlukan kalau fitur-nya
 * dipakai. Untuk MVP PTopup yang fokus ke Digiflazz + DANA QRIS, mereka aman
 * dikosongkan.
 */
import { z } from "zod";

// SESSION_PASSWORD adalah nama lama. Sekarang accept SESSION_SECRET (lebih
// umum) dan auto-fallback ke SESSION_PASSWORD untuk backward compatibility.
const sessionSecret =
  process.env.SESSION_SECRET ?? process.env.SESSION_PASSWORD ?? "";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  APP_NAME: z.string().default("PTopup"),

  DATABASE_URL: z.string().min(1),

  // Auth
  SESSION_PASSWORD: z.string().min(32, "SESSION_SECRET / SESSION_PASSWORD min 32 karakter"),
  NEXTAUTH_SECRET: z.string().min(16).optional().default("not-used-in-this-build"),
  NEXTAUTH_URL: z.string().url().optional().default("http://localhost:3000"),

  // Digiflazz — boleh kosong saat first deploy, di-set lewat admin UI
  DIGIFLAZZ_USERNAME: z.string().optional().default(""),
  DIGIFLAZZ_API_KEY: z.string().optional().default(""),
  DIGIFLAZZ_PROD_API_KEY: z.string().optional().default(""),
  DIGIFLAZZ_MODE: z.enum(["development", "production"]).default("development"),
  DIGIFLAZZ_BASE_URL: z.string().url().default("https://api.digiflazz.com/v1"),

  // Duitku — opsional. Hanya wajib kalau fitur Duitku payment di-enable.
  DUITKU_MERCHANT_CODE: z.string().optional().default(""),
  DUITKU_API_KEY: z.string().optional().default(""),
  DUITKU_BASE_URL: z.string().url().optional().default("https://passport.duitku.com/webapi/api/merchant"),
  DUITKU_CALLBACK_URL: z.string().url().optional().default("http://localhost:3000/api/webhooks/duitku"),
  DUITKU_RETURN_URL: z.string().url().optional().default("http://localhost:3000/transaction/status"),

  // Realtime / Socket.IO — opsional. App ini pakai polling, gak butuh socket.
  SOCKET_PORT: z.coerce.number().int().positive().default(3001),
  NEXT_PUBLIC_SOCKET_URL: z.string().url().optional().default("http://localhost:3001"),

  // WhatsApp OTP gateway (untuk verifikasi nomor & reset password).
  // Default: localhost:3002 yang diserve oleh `wa-worker/` (Baileys + Express).
  // Production: ganti URL gateway publik kamu kalau pakai instance terpisah,
  // atau biarkan localhost kalau worker jalan di mesin yang sama via PM2.
  WAOTP_API_URL: z.string().url().optional().default("http://127.0.0.1:3002/api/v1"),
  WAOTP_API_KEY: z.string().optional().default(""),
});

// Inject sessionSecret manual agar backward compat dengan SESSION_PASSWORD lama.
const inputEnv = {
  ...process.env,
  SESSION_PASSWORD: sessionSecret,
};

const parsed = envSchema.safeParse(inputEnv);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables. See logs above.");
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
