"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  KeyRound,
  Loader2,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { LoginSchema, type LoginInput } from "@/schemas/auth.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RESEND_COOLDOWN_S = 60;

export function LoginForm({
  showForgotLink = false,
}: {
  showForgotLink?: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // 2FA state
  const [step, setStep] = useState<1 | 2>(1);
  const [requestId, setRequestId] = useState<string>("");
  const [phoneMasked, setPhoneMasked] = useState<string>("");
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Simpan credentials supaya resend bisa re-trigger step 1 tanpa user
  // input ulang. Cleared saat step 2 selesai / user kembali ke step 1.
  const credsRef = useRef<LoginInput | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });

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

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal masuk");

      // Branching: kalau 2FA diperlukan, server tidak set cookie.
      if (json.data?.requireOtp) {
        credsRef.current = values;
        setRequestId(json.data.requestId);
        setPhoneMasked(json.data.phoneMasked);
        setStep(2);
        startResendCooldown();
        toast.success("Kode OTP telah dikirim ke WhatsApp.");
        return;
      }

      toast.success("Berhasil masuk");
      router.push("/topup");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 4) {
      toast.error("Masukkan kode OTP.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, code }),
      });
      const json = await res.json();
      if (!json.success)
        throw new Error(json.error?.message ?? "Verifikasi gagal");
      toast.success("Berhasil masuk");
      credsRef.current = null;
      router.push("/topup");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (resendIn > 0 || submitting) return;
    const creds = credsRef.current;
    if (!creds) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });
      const json = await res.json();
      if (!json.success)
        throw new Error(json.error?.message ?? "Gagal kirim ulang");
      // Idealnya server return requireOtp:true lagi.
      if (json.data?.requireOtp) {
        setRequestId(json.data.requestId);
        setCode("");
        startResendCooldown();
        toast.success("Kode baru telah dikirim.");
      } else {
        // Edge case: admin baru saja matikan loginRequired antara step 1 & 2.
        toast.success("Berhasil masuk");
        router.push("/topup");
        router.refresh();
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleBackToStep1() {
    setStep(1);
    setCode("");
    setRequestId("");
    setPhoneMasked("");
    credsRef.current = null;
  }

  // ===== Step 2: OTP =====
  if (step === 2) {
    return (
      <form onSubmit={handleVerifyOtp} className="space-y-5">
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Verifikasi 2 langkah</div>
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
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
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
            onClick={handleBackToStep1}
            disabled={submitting}
          >
            Kembali
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={submitting || code.length < 4}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Masuk
          </Button>
        </div>
      </form>
    );
  }

  // ===== Step 1: identifier + password =====
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="identifier">Email atau Username</Label>
        <Input id="identifier" autoComplete="username" {...register("identifier")} />
        {errors.identifier && (
          <p className="text-xs text-destructive">{errors.identifier.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          {showForgotLink && (
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              Lupa password?
            </Link>
          )}
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Masuk
      </Button>
    </form>
  );
}
