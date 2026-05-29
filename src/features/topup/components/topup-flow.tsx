"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Wallet,
  Phone,
  Wifi,
  Zap,
  Gamepad2,
  User,
  Receipt,
  Gift,
  Tv,
  Smartphone,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn, formatIDR } from "@/lib/utils";

interface ProductDTO {
  id: string;
  sku: string;
  name: string;
  type: string;
  sellPrice: string;
  description: string | null;
}

interface Props {
  brand: string;
  category: string;
  products: ProductDTO[];
  /** Master scale (40-96 px). Berasal dari setting topup.iconSize. Default 56. */
  iconSize?: number;
}

const STEPS = ["Data Akun", "Pilih Nominal"] as const;

/**
 * Konfigurasi field input per kategori.
 * - Setiap kategori punya label, placeholder, helper, validasi minimum, dan ikon.
 * - `serverId` hanya muncul untuk GAME tertentu (ML, FF, dll).
 */
type FieldKind = "phone" | "meter" | "gameId" | "ewalletId" | "voucher" | "generic";

interface CategoryConfig {
  kind: FieldKind;
  label: string;
  placeholder: string;
  helper?: string;
  inputMode: "numeric" | "text" | "tel";
  minLength: number;
  pattern?: RegExp;
  icon: typeof Phone;
  showServerId: boolean;
  serverHelper?: string;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  PULSA: {
    kind: "phone",
    label: "Nomor HP",
    placeholder: "08xxxxxxxxxx",
    helper: "Masukkan nomor tujuan tanpa spasi.",
    inputMode: "tel",
    minLength: 10,
    pattern: /^(0|\+62)[0-9]{8,14}$/,
    icon: Phone,
    showServerId: false,
  },
  DATA: {
    kind: "phone",
    label: "Nomor HP",
    placeholder: "08xxxxxxxxxx",
    helper: "Pastikan nomor sudah aktif & sesuai operator.",
    inputMode: "tel",
    minLength: 10,
    pattern: /^(0|\+62)[0-9]{8,14}$/,
    icon: Wifi,
    showServerId: false,
  },
  PLN: {
    kind: "meter",
    label: "Nomor Meter / ID Pelanggan",
    placeholder: "11 atau 12 digit",
    helper: "Tertera di kWh meter atau struk PLN sebelumnya.",
    inputMode: "numeric",
    minLength: 11,
    pattern: /^[0-9]{10,13}$/,
    icon: Zap,
    showServerId: false,
  },
  EWALLET: {
    kind: "ewalletId",
    label: "Nomor HP / ID E-Wallet",
    placeholder: "Nomor terdaftar di akun e-wallet",
    helper: "Pastikan akun aktif & menerima top-up.",
    inputMode: "tel",
    minLength: 10,
    pattern: /^(0|\+62)?[0-9]{8,14}$/,
    icon: Smartphone,
    showServerId: false,
  },
  GAME: {
    kind: "gameId",
    label: "User ID",
    placeholder: "ID akun game",
    helper: "Cek di profil game-mu.",
    inputMode: "numeric",
    minLength: 4,
    icon: Gamepad2,
    showServerId: true,
    serverHelper: "Wajib utk Mobile Legends, Genshin, dll.",
  },
  STREAMING: {
    kind: "ewalletId",
    label: "Nomor / Email Akun",
    placeholder: "Nomor HP atau email",
    helper: "Sesuai akun langganan streaming-mu.",
    inputMode: "text",
    minLength: 5,
    icon: Tv,
    showServerId: false,
  },
  VOUCHER: {
    kind: "voucher",
    label: "Nomor / Email Penerima",
    placeholder: "Untuk pengiriman kode voucher",
    helper: "Kode dikirim ke nomor / email ini.",
    inputMode: "text",
    minLength: 5,
    icon: Gift,
    showServerId: false,
  },
  PASCABAYAR: {
    kind: "generic",
    label: "Nomor Pelanggan",
    placeholder: "Nomor pelanggan / tagihan",
    helper: "Sesuai nomor billing tagihanmu.",
    inputMode: "numeric",
    minLength: 6,
    icon: Receipt,
    showServerId: false,
  },
  AKTIVASI_VOUCHER: {
    kind: "phone",
    label: "Nomor HP",
    placeholder: "08xxxxxxxxxx",
    helper: "Voucher aktivasi akan diaktifkan ke nomor ini.",
    inputMode: "tel",
    minLength: 10,
    pattern: /^(0|\+62)[0-9]{8,14}$/,
    icon: Phone,
    showServerId: false,
  },
  PAKET_SMS_TELPON: {
    kind: "phone",
    label: "Nomor HP",
    placeholder: "08xxxxxxxxxx",
    helper: "Paket SMS / telpon untuk nomor tujuan.",
    inputMode: "tel",
    minLength: 10,
    pattern: /^(0|\+62)[0-9]{8,14}$/,
    icon: Phone,
    showServerId: false,
  },
  MASA_AKTIF: {
    kind: "phone",
    label: "Nomor HP",
    placeholder: "08xxxxxxxxxx",
    helper: "Perpanjangan masa aktif untuk nomor ini.",
    inputMode: "tel",
    minLength: 10,
    pattern: /^(0|\+62)[0-9]{8,14}$/,
    icon: Phone,
    showServerId: false,
  },
  TV_KABEL: {
    kind: "generic",
    label: "Nomor Pelanggan",
    placeholder: "Nomor pelanggan TV kabel",
    helper: "Tertera di tagihan / kartu pelanggan.",
    inputMode: "numeric",
    minLength: 6,
    icon: Receipt,
    showServerId: false,
  },
  GAS: {
    kind: "generic",
    label: "Nomor Pelanggan",
    placeholder: "Nomor pelanggan PGN",
    inputMode: "numeric",
    minLength: 6,
    icon: Receipt,
    showServerId: false,
  },
  BPJS: {
    kind: "generic",
    label: "Nomor BPJS",
    placeholder: "Nomor kartu BPJS",
    inputMode: "numeric",
    minLength: 11,
    icon: Receipt,
    showServerId: false,
  },
  ASURANSI: {
    kind: "generic",
    label: "Nomor Polis",
    placeholder: "Nomor polis asuransi",
    inputMode: "text",
    minLength: 5,
    icon: Receipt,
    showServerId: false,
  },
  PDAM: {
    kind: "generic",
    label: "Nomor Pelanggan PDAM",
    placeholder: "Nomor pelanggan air",
    inputMode: "numeric",
    minLength: 6,
    icon: Receipt,
    showServerId: false,
  },
  TRANSPORTASI: {
    kind: "generic",
    label: "Nomor Kartu",
    placeholder: "Nomor kartu (e-Toll / Flazz, dll)",
    inputMode: "numeric",
    minLength: 10,
    icon: Receipt,
    showServerId: false,
  },
  SEMBAKO: {
    kind: "phone",
    label: "Nomor HP",
    placeholder: "08xxxxxxxxxx",
    helper: "Sembako akan dikirim untuk nomor ini.",
    inputMode: "tel",
    minLength: 10,
    pattern: /^(0|\+62)[0-9]{8,14}$/,
    icon: Phone,
    showServerId: false,
  },
  OTHER: {
    kind: "generic",
    label: "Nomor / ID Tujuan",
    placeholder: "Masukkan nomor / ID tujuan",
    inputMode: "text",
    minLength: 3,
    icon: User,
    showServerId: false,
  },
};

/**
 * Brand-brand game yang TIDAK butuh server ID (override default).
 * Free Fire, PUBG, dsb cuma butuh User ID.
 */
const GAME_WITHOUT_SERVER = new Set([
  "FREE FIRE",
  "FREE FIRE MAX",
  "PUBG MOBILE",
  "CALL OF DUTY MOBILE",
  "ARENA OF VALOR",
  "FREEFIRE",
]);

const PAYMENT_METHOD = "BALANCE";
const PAYMENT_CHANNEL = "";

function getConfig(category: string, brand: string): CategoryConfig {
  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.OTHER!;
  // Override: game tanpa server ID
  if (cfg.kind === "gameId" && GAME_WITHOUT_SERVER.has(brand.toUpperCase())) {
    return { ...cfg, showServerId: false };
  }
  return cfg;
}

export function TopupFlow({ brand, category, products, iconSize = 56 }: Props) {
  const router = useRouter();
  const config = getConfig(category, brand);
  const FieldIcon = config.icon;

  const [step, setStep] = useState(0);
  const [customerNo, setCustomerNo] = useState("");
  const [serverId, setServerId] = useState("");
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedProduct = products.find((p) => p.sku === selectedSku);

  function handleSelectProduct(sku: string) {
    setSelectedSku(sku);
    setConfirmOpen(true);
  }

  function validateCustomer(): string | null {
    const v = customerNo.trim();
    if (v.length < config.minLength) {
      return `${config.label} minimal ${config.minLength} karakter.`;
    }
    if (config.pattern && !config.pattern.test(v)) {
      return `Format ${config.label.toLowerCase()} tidak valid.`;
    }
    if (config.showServerId && serverId.trim().length < 1) {
      return "Server / Zone ID wajib diisi untuk produk ini.";
    }
    return null;
  }

  function nextStep() {
    if (step === 0) {
      const err = validateCustomer();
      if (err) {
        toast.error(err);
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function prevStep() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleCheckout() {
    if (!selectedProduct) {
      toast.error("Pilih nominal terlebih dahulu");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productSku: selectedProduct.sku,
          customerNo: customerNo.trim(),
          serverId: serverId.trim() || undefined,
          paymentMethod: PAYMENT_METHOD,
          paymentChannel: PAYMENT_CHANNEL || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        if (json.error?.code === "UNAUTHORIZED") {
          toast.error("Silakan masuk terlebih dahulu");
          router.push("/login");
          return;
        }
        throw new Error(json.error?.message ?? "Checkout gagal");
      }
      const { orderId, paymentUrl } = json.data as {
        orderId: string;
        paymentUrl?: string;
      };
      if (paymentUrl) {
        window.location.href = paymentUrl;
        return;
      }
      setConfirmOpen(false);
      router.push(`/transaction/${orderId}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        {step === 0 && (
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle>Data akun {brand}</CardTitle>
              <CardDescription>
                Pastikan {config.label.toLowerCase()} benar. Transaksi tidak
                bisa dibatalkan setelah dieksekusi ke provider.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="customerNo">{config.label}</Label>
                <div className="relative">
                  <FieldIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="customerNo"
                    inputMode={config.inputMode}
                    autoComplete="off"
                    value={customerNo}
                    onChange={(e) => setCustomerNo(e.target.value)}
                    placeholder={config.placeholder}
                    className="pl-9"
                  />
                </div>
                {config.helper && (
                  <p className="text-xs text-muted-foreground">
                    {config.helper}
                  </p>
                )}
              </div>

              {config.showServerId && (
                <div className="space-y-2">
                  <Label htmlFor="serverId">Server / Zone ID</Label>
                  <Input
                    id="serverId"
                    inputMode="numeric"
                    autoComplete="off"
                    value={serverId}
                    onChange={(e) => setServerId(e.target.value)}
                    placeholder="Contoh: 2001"
                  />
                  {config.serverHelper && (
                    <p className="text-xs text-muted-foreground">
                      {config.serverHelper}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={nextStep}>Lanjut</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pilih nominal</CardTitle>
                <CardDescription>
                  Tap nominal untuk lanjut ke konfirmasi pembayaran.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={prevStep}>
                Kembali
              </Button>
            </CardHeader>
            <CardContent>
              {(() => {
                const scale = iconSize / 56;
                const cardPad = Math.round(16 * scale);
                const namePx = Math.round(13 * Math.max(0.95, Math.min(scale, 1.2)));
                const pricePx = Math.round(14 * Math.max(0.95, Math.min(scale, 1.2)));
                // Grid columns adaptif terhadap iconSize (selaras dengan TopupSearch).
                const gridCls =
                  iconSize <= 32
                    ? "grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
                    : iconSize <= 48
                      ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                      : iconSize >= 72
                        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                        : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
                return (
                  <div className={`grid gap-3 ${gridCls}`}>
                    {products.map((p) => {
                      const active = p.sku === selectedSku;
                      return (
                        <button
                          key={p.sku}
                          type="button"
                          onClick={() => handleSelectProduct(p.sku)}
                          style={{ padding: cardPad }}
                          className={cn(
                            "relative w-full min-w-0 overflow-hidden rounded-xl border text-left transition-all hover:-translate-y-0.5",
                            active
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border hover:border-primary/40 hover:bg-muted/50",
                          )}
                        >
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {p.type}
                          </div>
                          <div
                            className="mt-1 line-clamp-2 font-semibold leading-tight"
                            style={{ fontSize: `${namePx}px` }}
                          >
                            {p.name}
                          </div>
                          <div
                            className="mt-3 truncate font-semibold tabular-nums text-primary"
                            style={{ fontSize: `${pricePx}px` }}
                            title={formatIDR(p.sellPrice)}
                          >
                            {formatIDR(p.sellPrice)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal konfirmasi pembayaran */}
      {confirmOpen && selectedProduct && (
        <ConfirmDialog
          brand={brand}
          customerLabel={config.label}
          customerNo={customerNo}
          showServerId={config.showServerId}
          serverId={serverId}
          product={selectedProduct}
          submitting={submitting}
          onClose={() => !submitting && setConfirmOpen(false)}
          onConfirm={handleCheckout}
        />
      )}
    </div>
  );
}

interface ConfirmDialogProps {
  brand: string;
  customerLabel: string;
  customerNo: string;
  showServerId: boolean;
  serverId: string;
  product: ProductDTO;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  brand,
  customerLabel,
  customerNo,
  showServerId,
  serverId,
  product,
  submitting,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  // Lock body scroll + render via Portal supaya backdrop selalu di atas navbar.
  useEffect(() => {
    setMounted(true);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // ESC untuk tutup
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      {/* Backdrop full-viewport, di atas navbar */}
      <button
        type="button"
        aria-label="Tutup"
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
        onClick={onClose}
        disabled={submitting}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md animate-fade-in rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold tracking-tight">Konfirmasi Pesanan</h3>
              <p className="text-xs text-muted-foreground">
                Periksa detail sebelum melanjutkan.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5 text-sm">
          <dl className="divide-y divide-border/60">
            <Row label="Brand" value={brand} />
            <Row label={customerLabel} value={customerNo} />
            {showServerId && <Row label="Server / Zone ID" value={serverId} />}
            <Row label="Produk" value={product.name} />
            <div className="flex items-center justify-between gap-4 pt-3">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="text-lg font-semibold tabular-nums text-primary">
                {formatIDR(product.sellPrice)}
              </dd>
            </div>
          </dl>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Wallet className="h-4 w-4 text-primary" />
            Pembayaran via Saldo PTopup
          </div>
        </div>

        <div className="flex gap-2 border-t border-border/60 px-6 py-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            className="flex-1"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Bayar {formatIDR(product.sellPrice)}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  const empty = !value || value.trim() === "";
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "max-w-[60%] truncate text-right font-medium",
          empty && "text-muted-foreground/60",
        )}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  );
}
