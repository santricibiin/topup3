"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Receipt,
  Search,
  Wallet,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatIDR } from "@/lib/utils";

interface ProductDTO {
  id: string;
  sku: string;
  name: string;
  type: string;
  description: string | null;
}

interface Props {
  brand: string;
  category: string;
  products: ProductDTO[];
}

interface InquiryResult {
  orderId: string;
  status: string;
  productName: string;
  customerNo: string;
  customerName: string | null;
  periode: string | null;
  basePrice: string;
  sellPrice: string;
  adminFee: string;
  totalAmount: string;
  inquiryDetail: Record<string, unknown> | null;
  providerMessage: string | null;
  providerStatus: "Sukses" | "Gagal" | "Pending";
}

const CATEGORY_FIELD: Record<
  string,
  { label: string; placeholder: string; helper?: string; minLength: number }
> = {
  PASCABAYAR: {
    label: "Nomor Pelanggan",
    placeholder: "Nomor pelanggan / tagihan",
    helper: "Sesuai nomor billing tagihan kamu.",
    minLength: 6,
  },
  TV_KABEL: {
    label: "Nomor Pelanggan TV",
    placeholder: "Nomor pelanggan TV kabel",
    minLength: 6,
  },
  GAS: {
    label: "Nomor Pelanggan Gas",
    placeholder: "Nomor pelanggan PGN",
    minLength: 6,
  },
  BPJS: {
    label: "Nomor BPJS",
    placeholder: "Nomor kartu BPJS (11 digit)",
    minLength: 11,
  },
  ASURANSI: {
    label: "Nomor Polis",
    placeholder: "Nomor polis asuransi",
    minLength: 5,
  },
  PDAM: {
    label: "Nomor Pelanggan PDAM",
    placeholder: "Nomor pelanggan air",
    minLength: 6,
  },
};

const DEFAULT_FIELD = {
  label: "Nomor Pelanggan",
  placeholder: "Nomor pelanggan / tagihan",
  helper: "Tertera di tagihan / kartu pelanggan.",
  minLength: 6,
};

export function PostpaidFlow({ brand, category, products }: Props) {
  const router = useRouter();
  const field = CATEGORY_FIELD[category] ?? DEFAULT_FIELD;

  // Pasca biasanya cuma 1 produk per brand (mis. PLN Pascabayar tunggal).
  // Tapi kita siapkan dropdown kalau ada >1 (mis. BPJS Kesehatan vs Ketenagakerjaan).
  const [selectedSku, setSelectedSku] = useState(products[0]?.sku ?? "");
  const [customerNo, setCustomerNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState<InquiryResult | null>(null);

  const selectedProduct = products.find((p) => p.sku === selectedSku);

  async function handleInquiry() {
    if (!selectedProduct) {
      toast.error("Produk tidak valid");
      return;
    }
    const cn = customerNo.trim();
    if (cn.length < field.minLength) {
      toast.error(`${field.label} minimal ${field.minLength} karakter`);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/transactions/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productSku: selectedProduct.sku,
          customerNo: cn,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        if (json.error?.code === "UNAUTHORIZED") {
          toast.error("Silakan masuk terlebih dahulu");
          router.push("/login");
          return;
        }
        throw new Error(json.error?.message ?? "Cek tagihan gagal");
      }
      setResult(json.data as InquiryResult);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePay() {
    if (!result) return;
    setPaying(true);
    try {
      const res = await fetch(
        `/api/transactions/${result.orderId}/confirm-pay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentMethod: "BALANCE" }),
        },
      );
      const json = await res.json();
      if (!json.success) {
        if (json.error?.code === "UNAUTHORIZED") {
          toast.error("Silakan masuk terlebih dahulu");
          router.push("/login");
          return;
        }
        throw new Error(json.error?.message ?? "Pembayaran gagal");
      }
      router.push(`/transaction/${result.orderId}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPaying(false);
    }
  }

  function reset() {
    setResult(null);
  }

  // Hasil inquiry sukses → tampilkan struk.
  if (result && result.providerStatus === "Sukses") {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="space-y-4 p-5 md:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Receipt className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  Tagihan ditemukan
                </h2>
                <p className="text-sm text-muted-foreground">
                  Periksa detail di bawah sebelum melanjutkan pembayaran.
                </p>
              </div>
            </div>

            <dl className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background/60 px-4">
              <BillRow label="Produk" value={result.productName} />
              <BillRow
                label={field.label}
                value={result.customerNo}
                mono
              />
              <BillRow label="Nama Pelanggan" value={result.customerName} />
              <BillRow label="Periode" value={result.periode} />
              {result.inquiryDetail &&
                Object.entries(result.inquiryDetail)
                  .filter(([k, v]) => k !== "detail" && typeof v !== "object")
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <BillRow
                      key={k}
                      label={prettyLabel(k)}
                      value={String(v)}
                    />
                  ))}
              <BillRow
                label="Tagihan"
                value={formatIDR(result.basePrice)}
                strong
              />
              <BillRow
                label="Biaya Admin"
                value={formatIDR(result.adminFee)}
              />
            </dl>

            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3">
              <span className="text-sm font-medium">Total bayar</span>
              <span className="font-display text-xl font-semibold tabular-nums text-primary">
                {formatIDR(result.totalAmount)}
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <Wallet className="h-4 w-4 text-primary" />
              Pembayaran via Saldo PTopup. Bayar harus di hari yang sama dengan
              cek tagihan.
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={reset}
                disabled={paying}
              >
                Cek tagihan lain
              </Button>
              <Button
                className="flex-1"
                onClick={handlePay}
                disabled={paying}
              >
                {paying && <Loader2 className="h-4 w-4 animate-spin" />}
                Bayar {formatIDR(result.totalAmount)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Hasil inquiry gagal — tampilkan pesan & balik ke form.
  if (result && result.providerStatus !== "Sukses") {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="space-y-4 p-5 md:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-destructive/15 text-destructive">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  Tagihan tidak ditemukan
                </h2>
                <p className="text-sm text-muted-foreground">
                  {result.providerMessage ??
                    "Provider menolak inquiry. Cek nomor pelanggan kamu."}
                </p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={reset}>
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Form awal: pilih produk + isi nomor.
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Cek tagihan {brand}</CardTitle>
          <CardDescription>
            Masukkan nomor pelanggan untuk melihat detail tagihan. Saldo baru
            dipotong setelah kamu konfirmasi pembayaran.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {products.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="product">Pilih Produk</Label>
              <select
                id="product"
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {products.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="customerNo">{field.label}</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="customerNo"
                inputMode="numeric"
                autoComplete="off"
                value={customerNo}
                onChange={(e) => setCustomerNo(e.target.value)}
                placeholder={field.placeholder}
                className="pl-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInquiry();
                }}
              />
            </div>
            {field.helper && (
              <p className="text-xs text-muted-foreground">{field.helper}</p>
            )}
          </div>

          <Button
            className="w-full"
            onClick={handleInquiry}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Mencari tagihan...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Cek tagihan
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Bayar tagihan harus di hari yang sama dengan cek tagihan.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function BillRow({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  strong?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`max-w-[60%] truncate text-right ${
          mono ? "font-mono text-xs tabular-nums" : ""
        } ${strong ? "font-semibold" : "font-medium"}`}
      >
        {value}
      </dd>
    </div>
  );
}

/** "tahun_pajak" → "Tahun Pajak". */
function prettyLabel(key: string): string {
  return key
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
