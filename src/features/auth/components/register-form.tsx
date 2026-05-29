"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { KeyRound, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { RegisterSchema, type RegisterInput } from "@/schemas/auth.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RESEND_COOLDOWN_S = 60;

interface Props {
  /** Kalau true (WA OTP enabled): 2 step — phone wajib + verifikasi OTP. */
  requireOtp?: boolean;
}

export function RegisterForm({ requireOtp = false }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  // OTP step state
  const [step, setStep] = useState<1 | 2>(1);
  const [otpRequestId, setOtpRequestId] = useState<string>("");
  const [otpCode, setOtpCode] = useState("");
  const [phoneMasked, setPhoneMasked] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(RegisterSchema) });

  function startResendCooldown() {
    setResendIn(RESEND_COOLDOWN_S);
    if (resendTimer.current) clearInterval(resendTimer.current);
    resendTimer.current = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) {
          if (resendTimer.current) clearInterval(resendTimer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    return () => {
      if (resendTimer.current) clearInterval(resendTimer.current);
    };
  }, []);

  async function requestOtp(phone: string) {
    const res = await fetch("/api/auth/register/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message ?? "Gagal kirim OTP");
    }
    return json.data as {
      requestId: string;
      phone: string;
      expiresInSeconds: number;
    };
  }

  /**
   * Submit final ke /api/auth/register.
   * - requireOtp=false: kirim langsung values.
   * - requireOtp=true:
   *   step 1 → kirim OTP, pindah ke step 2.
   *   step 2 → kirim values + otpRequestId/otpCode.
   */
  async function onSubmit(values: RegisterInput) {
    setSubmitting(true);
    try {
      if (requireOtp) {
        if (step === 1) {
          if (!values.phone) {
            toast.error("Nomor WhatsApp wajib diisi.");
            return;
          }
          const sent = await requestOtp(values.phone);
          setOtpRequestId(sent.requestId);
          setPhoneMasked(
            `+${sent.phone.slice(0, 5)}****${sent.phone.slice(-4)}`,
          );
          setStep(2);
          startResendCooldown();
          toast.success("Kode OTP telah dikirim ke WhatsApp.");
          return;
        }
        // step 2 — submit final
        if (otpCode.length < 4) {
          toast.error("Masukkan kode OTP.");
          return;
        }
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            otpRequestId,
            otpCode,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message ?? "Gagal daftar");
        toast.success("Akun berhasil dibuat. Selamat datang!");
        router.push("/topup");
        router.refresh();
        return;
      }

      // Mode tanpa OTP (legacy)
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal daftar");
      toast.success("Akun berhasil dibuat");
      router.push("/topup");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  /** Tombol kirim ulang OTP (step 2 saja). */
  async function handleResendOtp() {
    if (resendIn > 0 || submitting) return;
    const phone = getValues("phone");
    if (!phone) return;
    setSubmitting(true);
    try {
      const sent = await requestOtp(phone);
      setOtpRequestId(sent.requestId);
      setPhoneMasked(`+${sent.phone.slice(0, 5)}****${sent.phone.slice(-4)}`);
      setOtpCode("");
      startResendCooldown();
      toast.success("Kode baru telah dikirim.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // ===== Step 2 (OTP only) =====
  if (requireOtp && step === 2) {
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Verifikasi nomor WhatsApp</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Kode telah dikirim ke <strong>{phoneMasked}</strong>. Cek pesan
                WhatsApp kamu.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="otp" className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            Kode OTP
          </Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="tabular-nums tracking-widest text-center text-lg"
            autoFocus
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tidak dapat kode?</span>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={submitting || resendIn > 0}
              className="inline-flex items-center gap-1 text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
            >
              <RefreshCw className="h-3 w-3" />
              {resendIn > 0 ? `Kirim ulang (${resendIn}s)` : "Kirim ulang"}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => {
              setStep(1);
              setOtpCode("");
            }}
            disabled={submitting}
          >
            Kembali
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={submitting || otpCode.length < 4}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Daftar
          </Button>
        </div>
      </form>
    );
  }

  // ===== Step 1 / non-OTP =====
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" autoComplete="username" {...register("username")} />
          {errors.username && (
            <p className="text-xs text-destructive">{errors.username.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">
          Nomor WhatsApp{" "}
          {requireOtp ? (
            <span className="text-destructive">*</span>
          ) : (
            <span className="text-xs text-muted-foreground">(opsional)</span>
          )}
        </Label>
        <Input id="phone" type="tel" autoComplete="tel" {...register("phone")} />
        {errors.phone && (
          <p className="text-xs text-destructive">{errors.phone.message}</p>
        )}
        {requireOtp && (
          <p className="text-xs text-muted-foreground">
            Kode verifikasi akan dikirim ke nomor ini lewat WhatsApp.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {requireOtp ? "Lanjut — Kirim Kode OTP" : "Daftar"}
      </Button>
    </form>
  );
}
