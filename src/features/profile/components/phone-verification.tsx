"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Phone as PhoneIcon,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  /** Nomor user saat ini (boleh kosong). */
  phone: string;
  /** Apakah nomor sudah terverifikasi WA OTP. */
  verified: boolean;
}

/**
 * Section verifikasi nomor WhatsApp via OTP.
 *
 * Flow:
 *  1) User klik "Kirim Kode" → POST /api/otp/verify-phone/send
 *  2) UI tampilkan input kode 6 digit + countdown
 *  3) User submit kode → POST /api/otp/verify-phone/confirm
 *  4) Sukses → User.phoneVerified terisi, refresh page
 */
export function PhoneVerification({ phone, verified }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "code">("idle");
  const [phoneInput, setPhoneInput] = useState(phone);
  const [requestId, setRequestId] = useState<string>("");
  const [code, setCode] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [expiresInSeconds, setExpiresInSeconds] = useState(0);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleSend() {
    if (!phoneInput.trim()) {
      toast.error("Masukkan nomor WhatsApp terlebih dahulu.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/otp/verify-phone/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal kirim OTP");
      setRequestId(json.data.requestId);
      const p = json.data.phone as string;
      setMaskedPhone(`+${p.slice(0, 5)}****${p.slice(-4)}`);
      setExpiresInSeconds(json.data.expiresInSeconds);
      setStage("code");
      toast.success("Kode OTP telah dikirim ke WhatsApp.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 4) {
      toast.error("Masukkan kode OTP yang lengkap.");
      return;
    }
    setConfirming(true);
    try {
      const res = await fetch("/api/otp/verify-phone/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, code }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Verifikasi gagal");
      toast.success("Nomor WhatsApp berhasil diverifikasi.");
      setStage("idle");
      setCode("");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  function handleResend() {
    setStage("idle");
    setCode("");
    setRequestId("");
  }

  if (verified) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-semibold">Nomor WhatsApp terverifikasi</div>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">
            {phone}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Kamu bisa pakai nomor ini untuk reset password kalau lupa.
          </p>
        </div>
      </div>
    );
  }

  if (stage === "code") {
    return (
      <form
        onSubmit={handleConfirm}
        className="space-y-4 rounded-lg border border-border bg-muted/30 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Masukkan Kode OTP</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cek pesan WhatsApp di {maskedPhone}. Kode berlaku{" "}
              {Math.round(expiresInSeconds / 60)} menit.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="otp-code">Kode 6 Digit</Label>
          <Input
            id="otp-code"
            inputMode="numeric"
            autoFocus
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="tabular-nums tracking-widest text-center text-lg"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={confirming || code.length < 4}>
            {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
            Verifikasi
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleResend}
            disabled={confirming}
          >
            Ganti nomor / kirim ulang
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-semibold">Nomor belum diverifikasi</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Verifikasi nomor agar bisa reset password lewat WhatsApp kalau lupa.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="verify-phone" className="flex items-center gap-1.5">
          <PhoneIcon className="h-3.5 w-3.5 text-muted-foreground" />
          Nomor WhatsApp
        </Label>
        <Input
          id="verify-phone"
          type="tel"
          inputMode="tel"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          placeholder="08xxxxxxxxxx"
        />
        <p className="text-xs text-muted-foreground">
          Format: 08xx atau +62xx (tanpa spasi).
        </p>
      </div>

      <Button onClick={handleSend} disabled={sending}>
        {sending && <Loader2 className="h-4 w-4 animate-spin" />}
        Kirim Kode OTP
      </Button>
    </div>
  );
}
