"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft, KeyRound, Send, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RESEND_COOLDOWN_S = 60;

/**
 * Forgot Password — 2 step flow.
 * 1) Input email/username → kirim OTP ke nomor WA terdaftar
 * 2) Input kode OTP + password baru → submit reset
 *
 * SECURITY: server tidak leak existence akun. Step 1 selalu balas success.
 * Kalau requestId null, kita lanjut ke step 2 dengan UX informatif tapi
 * tetap tidak konfirmasi keberadaan akun.
 */
export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Countdown untuk tombol "Kirim ulang" (sesuai throttle service 60 detik).
  const [resendIn, setResendIn] = useState(0);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error("Masukkan email atau username.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal kirim OTP");
      setRequestId(json.data.requestId ?? null);
      setPhoneMasked(json.data.phoneMasked ?? null);
      setStep(2);
      startResendCooldown();
      toast.success(json.data.message ?? "Kode OTP telah dikirim.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Kirim ulang kode tanpa kembali ke step 1 — pakai identifier yang sama.
   * Throttle 60 detik di server akan reject kalau kecepetan, tapi kita juga
   * disable tombol di client supaya UX jelas.
   */
  async function handleResend() {
    if (resendIn > 0 || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Gagal kirim ulang");
      // Update requestId baru (kode lama otomatis invalid setelah ini).
      setRequestId(json.data.requestId ?? null);
      setPhoneMasked(json.data.phoneMasked ?? null);
      setCode("");
      startResendCooldown();
      toast.success(json.data.message ?? "Kode baru telah dikirim.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!requestId) {
      toast.error("Akun tidak ditemukan. Cek email/username dan coba lagi.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password tidak cocok.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          code,
          newPassword,
          confirmPassword,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Reset gagal");
      toast.success(json.data.message ?? "Password berhasil diubah.");
      router.push("/login");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (step === 1) {
    return (
      <form onSubmit={handleRequestOtp} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="identifier">Email atau Username</Label>
          <Input
            id="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="email@anda.com atau username"
            autoComplete="username"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Kode reset akan dikirim ke nomor WhatsApp yang terdaftar pada akun.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Kirim Kode OTP
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke login
          </Link>
        </p>
      </form>
    );
  }

  // Step 2
  return (
    <form onSubmit={handleResetPassword} className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
        {requestId && phoneMasked ? (
          <>
            Kode OTP telah dikirim ke{" "}
            <span className="font-semibold">{phoneMasked}</span>. Cek WhatsApp
            kamu sekarang.
          </>
        ) : (
          <>
            Jika akun ditemukan, kode reset password sudah dikirim ke WhatsApp
            terdaftar.
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="code" className="flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
          Kode OTP
        </Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className="tabular-nums tracking-widest text-center text-lg"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Tidak dapat kode?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={loading || resendIn > 0 || !identifier.trim()}
            className="inline-flex items-center gap-1 text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
          >
            <RefreshCw className="h-3 w-3" />
            {resendIn > 0
              ? `Kirim ulang (${resendIn}s)`
              : "Kirim ulang"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">Password Baru</Label>
        <Input
          id="new-password"
          type={showPassword ? "text" : "password"}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          placeholder="Minimal 8 karakter"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Konfirmasi Password</Label>
        <Input
          id="confirm-password"
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={showPassword}
          onChange={(e) => setShowPassword(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        Tampilkan password
      </label>

      <Button
        type="submit"
        className="w-full"
        disabled={
          loading ||
          !requestId ||
          code.length < 4 ||
          newPassword.length < 8 ||
          confirmPassword.length < 8
        }
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Reset Password
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => {
            setStep(1);
            setCode("");
            setRequestId(null);
            setPhoneMasked(null);
          }}
          className="text-primary hover:underline"
        >
          Coba email/username lain
        </button>
        <Link href="/login" className="text-muted-foreground hover:underline">
          Kembali ke login
        </Link>
      </div>
    </form>
  );
}
