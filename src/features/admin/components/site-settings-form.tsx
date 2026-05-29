"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Image as ImageIcon, Zap, Type, RotateCcw, Palette, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { THEME_PRESETS, resolveTheme } from "@/lib/theme-presets";
import { cn } from "@/lib/utils";

interface Props {
  initial: {
    name: string;
    tagline: string;
    logoUrl: string;
    theme: string;
  };
}

export function SiteSettingsForm({ initial }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.name);
  const [tagline, setTagline] = useState(initial.tagline);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [theme, setTheme] = useState(initial.theme);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Form text-fields dirty (logo di-upload langsung, jadi gak ikut dirty di sini)
  const dirty =
    name !== initial.name ||
    tagline !== initial.tagline ||
    theme !== initial.theme;

  function handleReset() {
    setName(initial.name);
    setTagline(initial.tagline);
    setTheme(initial.theme);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tagline, logoUrl, theme }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal simpan");
      toast.success("Konfigurasi tersimpan, halaman akan refresh...");
      // Hard reload supaya theme + nama di layout root ikut update
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran file maks 2MB");
      return;
    }
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/site/logo", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Upload gagal");
      setLogoUrl(json.data.logoUrl);
      toast.success("Logo berhasil di-upload, halaman akan refresh...");
      // Hard reload supaya layout (navbar + favicon di tab browser) ikut update
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleLogoDelete() {
    if (!confirm("Hapus logo? Akan kembali ke icon default.")) return;
    setUploadingLogo(true);
    try {
      const res = await fetch("/api/admin/site/logo", { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal hapus");
      setLogoUrl("");
      toast.success("Logo dihapus, halaman akan refresh...");
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingLogo(false);
    }
  }

  const logoOk = logoUrl.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Live Preview */}
      <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/5 via-background to-violet-500/5">
        <div className="border-b border-border/60 bg-card/80 px-5 py-2.5 backdrop-blur">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Pratinjau Navbar
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-2.5">
            {logoOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo"
                className="h-9 w-9 shrink-0 rounded-md object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm ring-1 ring-black/5">
                <Zap className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-base font-semibold tracking-tight">
                {name || "Nama Website"}
              </div>
              {tagline && (
                <div className="truncate text-[11px] text-muted-foreground">
                  {tagline}
                </div>
              )}
            </div>
          </div>
          <span className="hidden rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 sm:inline">
            Live
          </span>
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="site-name" className="flex items-center gap-1.5">
            <Type className="h-3.5 w-3.5 text-muted-foreground" />
            Nama Website
          </Label>
          <Input
            id="site-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="PTopup"
            maxLength={80}
            required
          />
          <p className="text-xs text-muted-foreground">
            Tampil di navbar, judul tab browser, dan email notifikasi.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="site-tagline">Tagline</Label>
          <Input
            id="site-tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Topup PPOB & Game — cepat, aman, anti-ribet."
            maxLength={160}
          />
          <p className="text-xs text-muted-foreground">
            Deskripsi singkat untuk SEO &amp; metadata sosial.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="site-logo" className="flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
            Logo Website
          </Label>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-card ring-1 ring-border">
              {logoOk ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-16 w-16 object-contain"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <input
                ref={fileInputRef}
                id="site-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,.ico"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingLogo ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {logoOk ? "Ganti Logo" : "Upload Logo"}
                </Button>
                {logoOk && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingLogo}
                    onClick={handleLogoDelete}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                PNG / JPG / WEBP / SVG / ICO &mdash; maks 2MB. Otomatis terapan ke navbar dan icon tab browser.
              </p>
            </div>
          </div>
        </div>

        {/* Theme picker */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
            Warna Tema
          </Label>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {THEME_PRESETS.map((p) => {
              const active = theme === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setTheme(p.key)}
                  className={cn(
                    "group relative flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all",
                    active
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/50",
                  )}
                  title={p.label}
                >
                  <span
                    className="h-8 w-8 rounded-full ring-1 ring-black/5 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: p.hex }}
                  />
                  <span className="line-clamp-1 text-[10px] font-medium">
                    {p.label.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Warna utama mempengaruhi tombol, link, badge, dan pattern batik di
            background. Saat ini:{" "}
            <span className="font-medium text-foreground">
              {resolveTheme(theme).label}
            </span>
          </p>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="text-xs text-muted-foreground">
          {dirty ? (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Ada perubahan belum disimpan
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Tersinkron
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {dirty && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={saving}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
          <Button type="submit" disabled={saving || !dirty}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan
          </Button>
        </div>
      </div>
    </form>
  );
}
