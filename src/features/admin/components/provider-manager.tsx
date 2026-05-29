"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/utils";

interface SettingsResp {
  digiflazz: {
    username: string;
    apiKey: string; // masked
    apiKeyHasValue: boolean;
    mode: "development" | "production";
  };
  markup: {
    type: "PERCENT" | "FIXED";
    value: number;
    min: number;
    roundTo: number;
  };
  markupPasca: {
    type: "PERCENT" | "FIXED";
    value: number;
    min: number;
    roundTo: number;
  };
}

export function ProviderManager() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsResp | null>(null);
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceErr, setBalanceErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // form state
  const [username, setUsername] = useState("");
  const [apiKey, setApiKey] = useState(""); // user input (kosong = tidak ubah)
  const [mode, setMode] = useState<"development" | "production">("development");
  const [markupType, setMarkupType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [markupValue, setMarkupValue] = useState("0");
  const [markupMin, setMarkupMin] = useState("0");
  const [roundTo, setRoundTo] = useState("100");
  // Markup pascabayar (admin fee)
  const [pascaType, setPascaType] = useState<"PERCENT" | "FIXED">("FIXED");
  const [pascaValue, setPascaValue] = useState("1000");
  const [pascaMin, setPascaMin] = useState("0");
  const [pascaRoundTo, setPascaRoundTo] = useState("100");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/provider/settings");
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal memuat");
      const d = json.data as SettingsResp;
      setSettings(d);
      setUsername(d.digiflazz.username);
      setMode(d.digiflazz.mode);
      setMarkupType(d.markup.type);
      setMarkupValue(String(d.markup.value));
      setMarkupMin(String(d.markup.min));
      setRoundTo(String(d.markup.roundTo));
      setPascaType(d.markupPasca.type);
      setPascaValue(String(d.markupPasca.value));
      setPascaMin(String(d.markupPasca.min));
      setPascaRoundTo(String(d.markupPasca.roundTo));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function checkBalance() {
    setChecking(true);
    setBalanceErr(null);
    try {
      const res = await fetch("/api/admin/provider/balance");
      const json = await res.json();
      if (!json.success) {
        setBalanceErr(json.error?.message ?? "Gagal cek saldo");
        return;
      }
      setBalance(Number(json.data.deposit) || 0);
    } catch (err) {
      setBalanceErr((err as Error).message);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveCredentials(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: { digiflazz: Record<string, unknown> } = {
        digiflazz: { username: username.trim(), mode },
      };
      if (apiKey.trim()) payload.digiflazz.apiKey = apiKey.trim();
      const res = await fetch("/api/admin/provider/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal menyimpan");
      toast.success("Kredensial Digiflazz tersimpan");
      setApiKey("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveMarkup(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/provider/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markup: {
            type: markupType,
            value: Number(markupValue) || 0,
            min: Number(markupMin) || 0,
            roundTo: Math.max(Number(roundTo) || 1, 1),
          },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal menyimpan");
      toast.success("Markup tersimpan. Sync ulang produk untuk menerapkan.");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveMarkupPasca(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/provider/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markupPasca: {
            type: pascaType,
            value: Number(pascaValue) || 0,
            min: Number(pascaMin) || 0,
            roundTo: Math.max(Number(pascaRoundTo) || 1, 1),
          },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal menyimpan");
      toast.success(
        "Markup pascabayar tersimpan. Akan dipakai di inquiry berikutnya.",
      );
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat pengaturan provider…
      </div>
    );
  }

  // Preview perhitungan — simulasi beberapa harga modal
  const round = Math.max(Number(roundTo) || 1, 1);
  const minMargin = Number(markupMin) || 0;
  const calcSell = (modal: number) => {
    const margin =
      markupType === "PERCENT"
        ? Math.ceil(modal * ((Number(markupValue) || 0) / 100))
        : Math.ceil(Number(markupValue) || 0);
    const finalMargin = Math.max(margin, minMargin);
    const sell = Math.ceil((modal + finalMargin) / round) * round;
    return { finalMargin, sell };
  };
  const samples = [5000, 10000, 25000, 50000];

  // Preview pasca: tagihan + admin fee → total
  const pascaRound = Math.max(Number(pascaRoundTo) || 1, 1);
  const pascaMinMargin = Number(pascaMin) || 0;
  const calcPasca = (tagihan: number) => {
    const margin =
      pascaType === "PERCENT"
        ? Math.ceil(tagihan * ((Number(pascaValue) || 0) / 100))
        : Math.ceil(Number(pascaValue) || 0);
    const finalMargin = Math.max(margin, pascaMinMargin);
    const total = Math.ceil((tagihan + finalMargin) / pascaRound) * pascaRound;
    const adminFee = total - tagihan;
    return { adminFee, total };
  };
  const pascaSamples = [50000, 150000, 500000, 1000000];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* SALDO PROVIDER */}
      <Card className="xl:col-span-2">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" /> Saldo Digiflazz
            </CardTitle>
            <CardDescription>
              Saldo deposit live dari API Digiflazz. Pakai untuk eksekusi transaksi PPOB.
            </CardDescription>
          </div>
          <Button onClick={checkBalance} disabled={checking} variant="outline" size="sm">
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Cek Saldo
          </Button>
        </CardHeader>
        <CardContent>
          {balance !== null && (
            <div className="text-3xl font-semibold tabular-nums text-primary">
              {formatIDR(balance)}
            </div>
          )}
          {balance === null && !balanceErr && (
            <p className="text-sm text-muted-foreground">
              Klik tombol di kanan untuk cek saldo Digiflazz.
            </p>
          )}
          {balanceErr && (
            <p className="text-sm text-destructive">
              {balanceErr}. Pastikan kredensial benar dan IP whitelist Digiflazz sudah disetting.
            </p>
          )}
        </CardContent>
      </Card>

      {/* KREDENSIAL DIGIFLAZZ */}
      <Card>
        <CardHeader>
          <CardTitle>Kredensial Digiflazz</CardTitle>
          <CardDescription>
            Username & API Key. Disimpan terenkripsi di DB; perubahan langsung berlaku tanpa restart.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={saveCredentials}>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username Digiflazz"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">
                API Key{" "}
                {settings?.digiflazz.apiKeyHasValue && (
                  <Badge variant="secondary" className="ml-1 font-mono">
                    {settings.digiflazz.apiKey}
                  </Badge>
                )}
              </Label>
              <Input
                id="apiKey"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={settings?.digiflazz.apiKeyHasValue ? "Kosongkan jika tidak diubah" : "API Key Digiflazz"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mode">Mode</Label>
              <select
                id="mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as "development" | "production")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="development">Development (testing=true)</option>
                <option value="production">Production (live)</option>
              </select>
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan kredensial
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* MARKUP */}
      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Markup (Untung)</CardTitle>
          <CardDescription>
            Markup diterapkan saat sync produk. Sync ulang untuk update harga jual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={saveMarkup}>
            <div className="space-y-2">
              <Label>Tipe</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["PERCENT", "FIXED"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMarkupType(t)}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      markupType === t
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {t === "PERCENT" ? "Persen (%)" : "Rupiah tetap (Rp)"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="markupValue">Nilai markup</Label>
              <div className="relative">
                {markupType === "FIXED" && (
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    Rp
                  </span>
                )}
                <Input
                  id="markupValue"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={markupType === "PERCENT" ? 100 : undefined}
                  step={markupType === "PERCENT" ? "0.1" : "100"}
                  value={markupValue}
                  onChange={(e) => setMarkupValue(e.target.value)}
                  className={
                    markupType === "PERCENT"
                      ? "pr-9 tabular-nums"
                      : "pl-10 tabular-nums"
                  }
                />
                {markupType === "PERCENT" && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {markupType === "PERCENT"
                  ? "Persentase dari harga modal Digiflazz."
                  : "Nominal tetap yang ditambahkan ke setiap produk."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="markupMin">Minimum margin (Rp)</Label>
                <Input
                  id="markupMin"
                  type="number"
                  min={0}
                  step="100"
                  value={markupMin}
                  onChange={(e) => setMarkupMin(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roundTo">Pembulatan ke (Rp)</Label>
                <Input
                  id="roundTo"
                  type="number"
                  min={1}
                  step="50"
                  value={roundTo}
                  onChange={(e) => setRoundTo(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-md border border-dashed border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Preview perhitungan
                </span>
                <span className="text-xs text-muted-foreground">
                  {markupType === "PERCENT"
                    ? `${Number(markupValue) || 0}% • min ${formatIDR(minMargin)} • bulat ${formatIDR(round)}`
                    : `+${formatIDR(Number(markupValue) || 0)} • min ${formatIDR(minMargin)} • bulat ${formatIDR(round)}`}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <span>Modal</span>
                <span className="text-right">Margin</span>
                <span className="text-right">Harga jual</span>
              </div>
              <div className="mt-1 space-y-1">
                {samples.map((modal) => {
                  const { finalMargin, sell } = calcSell(modal);
                  return (
                    <div
                      key={modal}
                      className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-sm tabular-nums"
                    >
                      <span>{formatIDR(modal)}</span>
                      <span className="text-right text-muted-foreground">
                        + {formatIDR(finalMargin)}
                      </span>
                      <span className="text-right font-semibold text-primary">
                        {formatIDR(sell)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan markup
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* MARKUP PASCABAYAR */}
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Markup Pascabayar (Admin Fee Tagihan)</CardTitle>
          <CardDescription>
            Biaya admin yang ditambahkan ke nilai tagihan saat user cek tagihan
            (PLN, BPJS, PDAM, dll). Berlaku langsung untuk inquiry berikutnya
            tanpa perlu sync ulang.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={saveMarkupPasca}>
            <div className="space-y-2">
              <Label>Tipe</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["PERCENT", "FIXED"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPascaType(t)}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      pascaType === t
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {t === "PERCENT" ? "Persen (%)" : "Rupiah tetap (Rp)"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pascaValue">Nilai admin fee</Label>
              <div className="relative">
                {pascaType === "FIXED" && (
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    Rp
                  </span>
                )}
                <Input
                  id="pascaValue"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={pascaType === "PERCENT" ? 100 : undefined}
                  step={pascaType === "PERCENT" ? "0.1" : "100"}
                  value={pascaValue}
                  onChange={(e) => setPascaValue(e.target.value)}
                  className={
                    pascaType === "PERCENT"
                      ? "pr-9 tabular-nums"
                      : "pl-10 tabular-nums"
                  }
                />
                {pascaType === "PERCENT" && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {pascaType === "PERCENT"
                  ? "Persentase dari nilai tagihan."
                  : "Nominal flat — direkomendasikan untuk tagihan listrik/air."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pascaMin">Minimum admin fee (Rp)</Label>
                <Input
                  id="pascaMin"
                  type="number"
                  min={0}
                  step="100"
                  value={pascaMin}
                  onChange={(e) => setPascaMin(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pascaRoundTo">Pembulatan ke (Rp)</Label>
                <Input
                  id="pascaRoundTo"
                  type="number"
                  min={1}
                  step="50"
                  value={pascaRoundTo}
                  onChange={(e) => setPascaRoundTo(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-md border border-dashed border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Preview tagihan + admin
                </span>
                <span className="text-xs text-muted-foreground">
                  {pascaType === "PERCENT"
                    ? `${Number(pascaValue) || 0}% • min ${formatIDR(pascaMinMargin)}`
                    : `+${formatIDR(Number(pascaValue) || 0)} • min ${formatIDR(pascaMinMargin)}`}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <span>Tagihan</span>
                <span className="text-right">Admin</span>
                <span className="text-right">Total bayar</span>
              </div>
              <div className="mt-1 space-y-1">
                {pascaSamples.map((tagihan) => {
                  const { adminFee, total } = calcPasca(tagihan);
                  return (
                    <div
                      key={tagihan}
                      className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-sm tabular-nums"
                    >
                      <span>{formatIDR(tagihan)}</span>
                      <span className="text-right text-muted-foreground">
                        + {formatIDR(adminFee)}
                      </span>
                      <span className="text-right font-semibold text-primary">
                        {formatIDR(total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan markup pasca
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
