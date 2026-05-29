"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Purpose =
  | "VERIFY_PHONE"
  | "RESET_PASSWORD"
  | "REGISTER"
  | "LOGIN"
  | "CONFIRM_TX";

interface SettingsResp {
  enabled: boolean;
  loginRequired: boolean;
  url: string;
  apiKey: string;          // masked
  apiKeyHasValue: boolean;
  templates: Record<Purpose, string>;
}

const PURPOSE_META: Record<
  Purpose,
  { label: string; helper: string }
> = {
  VERIFY_PHONE: {
    label: "Verifikasi Nomor",
    helper: "Dipakai saat user verifikasi nomor WA di /profile.",
  },
  RESET_PASSWORD: {
    label: "Reset Password",
    helper: "Dipakai saat user lupa password (lewat /forgot-password).",
  },
  REGISTER: {
    label: "Pendaftaran",
    helper: "Dipakai saat user daftar akun baru (kalau WAOTP enabled).",
  },
  LOGIN: {
    label: "Login (Reserved)",
    helper: "Belum dipakai. Disiapkan untuk fitur login lewat OTP.",
  },
  CONFIRM_TX: {
    label: "Konfirmasi Transaksi (Reserved)",
    helper: "Belum dipakai. Disiapkan untuk konfirmasi transaksi besar.",
  },
};

const PURPOSE_ORDER: Purpose[] = [
  "VERIFY_PHONE",
  "RESET_PASSWORD",
  "REGISTER",
  "LOGIN",
  "CONFIRM_TX",
];

const DEFAULT_TPL: Record<Purpose, string> = {
  VERIFY_PHONE:
    "Kode verifikasi nomor PTopup: *{code}*. Berlaku {minutes} menit. Jangan bagikan ke siapapun.",
  RESET_PASSWORD:
    "Kode reset password PTopup: *{code}*. Berlaku {minutes} menit. Abaikan jika kamu tidak meminta reset.",
  REGISTER:
    "Kode pendaftaran PTopup: *{code}*. Berlaku {minutes} menit. Jangan bagikan ke siapapun.",
  LOGIN: "Kode login PTopup: *{code}*. Berlaku {minutes} menit.",
  CONFIRM_TX:
    "Kode konfirmasi transaksi PTopup: *{code}*. Berlaku {minutes} menit.",
};

/** Substitute placeholder dengan contoh value untuk preview di UI. */
function renderPreview(tpl: string): string {
  return tpl
    .replace(/\{code\}/g, "483921")
    .replace(/\{otp\}/g, "483921")
    .replace(/\{minutes\}/g, "5")
    .replace(/\{seconds\}/g, "300")
    .replace(/\{phone\}/g, "628123456789")
    .replace(/\{purpose\}/g, "verify_phone")
    .replace(/\{var:[^}]+\}/g, "");
}

export function WaOtpSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsResp | null>(null);

  // form state — gateway config
  const [enabled, setEnabled] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState(""); // kosong = tidak ubah

  // form state — templates per purpose
  const [templates, setTemplates] = useState<Record<Purpose, string>>(
    DEFAULT_TPL,
  );

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/waotp/settings");
      const json = await res.json();
      if (!json.success)
        throw new Error(json.error?.message ?? "Gagal memuat");
      const d = json.data as SettingsResp;
      setSettings(d);
      setEnabled(d.enabled);
      setLoginRequired(d.loginRequired);
      setUrl(d.url);
      setTemplates({ ...DEFAULT_TPL, ...d.templates });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        enabled,
        loginRequired,
        url: url.trim(),
        templates,
      };
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
      const res = await fetch("/api/admin/waotp/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success)
        throw new Error(json.error?.message ?? "Gagal menyimpan");
      toast.success("Pengaturan WA OTP tersimpan");
      setApiKey("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function resetTemplate(purpose: Purpose) {
    setTemplates((cur) => ({ ...cur, [purpose]: DEFAULT_TPL[purpose] }));
    toast.success("Template dikembalikan ke default. Klik Simpan untuk apply.");
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat pengaturan…
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* Toggle aktif */}
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Aktifkan OTP WhatsApp</span>
            {settings?.enabled ? (
              <Badge variant="success" className="text-[10px]">
                ON
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                OFF
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Saat aktif: user bisa verifikasi nomor di /profile dan reset
            password lewat WhatsApp. Saat off: fitur disembunyikan & endpoint
            menolak request.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
            enabled ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-background shadow-md transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Toggle: wajibkan OTP saat login (2FA) */}
      <div
        className={`flex items-start justify-between gap-4 rounded-lg border p-4 transition-opacity ${
          enabled
            ? "border-border bg-muted/30"
            : "border-border/40 bg-muted/10 opacity-60"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Wajibkan OTP saat login (2FA)</span>
            {settings?.loginRequired ? (
              <Badge variant="success" className="text-[10px]">
                ON
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                OFF
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Berlaku untuk user yang sudah verifikasi nomor WhatsApp. User tanpa
            nomor terverifikasi tetap login dengan password saja (cegah lockout
            kalau gateway down). Wajib OTP utama (toggle di atas) harus aktif.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={loginRequired}
          onClick={() => setLoginRequired((v) => !v)}
          disabled={!enabled}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed ${
            loginRequired && enabled
              ? "bg-primary"
              : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-background shadow-md transition-transform ${
              loginRequired && enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* URL gateway */}
      <div className="space-y-2">
        <Label htmlFor="waotp-url">Base URL gateway</Label>
        <Input
          id="waotp-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://localhost:3001/api/v1"
          disabled={saving}
        />
        <p className="text-xs text-muted-foreground">
          Format: <span className="font-mono">https://wa.domain.com/api/v1</span>{" "}
          (sertakan path <span className="font-mono">/api/v1</span>).
        </p>
      </div>

      {/* API Key */}
      <div className="space-y-2">
        <Label htmlFor="waotp-key">
          API Key{" "}
          {settings?.apiKeyHasValue && (
            <Badge variant="secondary" className="ml-1 font-mono">
              {settings.apiKey}
            </Badge>
          )}
        </Label>
        <Input
          id="waotp-key"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={
            settings?.apiKeyHasValue
              ? "Kosongkan jika tidak diubah"
              : "waotp_xxx_xxx..."
          }
          disabled={saving}
        />
        <p className="text-xs text-muted-foreground">
          Dapatkan API key di dashboard gateway. Format:{" "}
          <span className="font-mono">waotp_&lt;prefix&gt;_&lt;secret&gt;</span>.
        </p>
      </div>

      {/* Templates */}
      <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
        <div className="space-y-1">
          <h3 className="font-semibold">Template Pesan WhatsApp</h3>
          <p className="text-xs text-muted-foreground">
            Placeholder tersedia:{" "}
            <code className="rounded bg-muted px-1 font-mono text-[11px]">
              {"{code}"}
            </code>{" "}
            <code className="rounded bg-muted px-1 font-mono text-[11px]">
              {"{minutes}"}
            </code>{" "}
            <code className="rounded bg-muted px-1 font-mono text-[11px]">
              {"{seconds}"}
            </code>{" "}
            <code className="rounded bg-muted px-1 font-mono text-[11px]">
              {"{phone}"}
            </code>
            . Markdown WA didukung: <code className="font-mono">*tebal*</code>,{" "}
            <code className="font-mono">_miring_</code>.
          </p>
        </div>

        <div className="space-y-5">
          {PURPOSE_ORDER.map((p) => {
            const meta = PURPOSE_META[p];
            const value = templates[p] ?? "";
            const preview = renderPreview(value || DEFAULT_TPL[p]);
            const isDefault = value === DEFAULT_TPL[p] || value === "";
            return (
              <div key={p} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`tpl-${p}`} className="font-medium">
                    {meta.label}{" "}
                    {!isDefault && (
                      <Badge variant="secondary" className="ml-1 text-[9px]">
                        DIUBAH
                      </Badge>
                    )}
                  </Label>
                  <button
                    type="button"
                    onClick={() => resetTemplate(p)}
                    disabled={saving || isDefault}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset default
                  </button>
                </div>
                <textarea
                  id={`tpl-${p}`}
                  value={value}
                  onChange={(e) =>
                    setTemplates((cur) => ({ ...cur, [p]: e.target.value }))
                  }
                  disabled={saving}
                  rows={3}
                  maxLength={1000}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  placeholder={DEFAULT_TPL[p]}
                />
                <p className="text-[11px] text-muted-foreground">
                  {meta.helper}
                </p>
                <div className="rounded-md border border-dashed border-border bg-background/50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Preview
                  </div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-sm">
                    {preview}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Simpan
        </Button>
      </div>
    </form>
  );
}
