"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  User as UserIcon,
  LogOut,
  Loader2,
  Wallet,
  History,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  user: {
    username: string;
    email: string;
    avatarUrl: string | null;
    fullName: string | null;
    role: string;
  };
  isAdmin: boolean;
}

/**
 * Dropdown profile di navbar — avatar bulat sebagai trigger.
 * Klik → muncul menu: Profile, Riwayat, Keluar.
 *
 * Pakai click-outside + ESC untuk tutup. Tidak pakai Radix supaya bundle kecil.
 */
export function ProfileDropdown({ user, isAdmin }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Logout gagal");
      toast.success("Berhasil keluar");
      setOpen(false);
      router.push("/login");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoggingOut(false);
    }
  }

  const initials = (user.fullName || user.username || "??")
    .split(/\s+/)
    .map((s) => s[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu profil"
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-violet-600 text-xs font-semibold text-white shadow-sm ring-1 ring-black/5 transition-transform hover:scale-105"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="h-9 w-9 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right animate-fade-in rounded-xl border border-border bg-card p-1.5 shadow-xl ring-1 ring-black/5"
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-violet-600 text-sm font-semibold text-white shadow-sm">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="h-10 w-10 object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {user.fullName || user.username}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {user.email}
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <MenuLink
              href="/profile"
              icon={UserIcon}
              label="Profile"
              onClick={() => setOpen(false)}
            />
            <MenuLink
              href="/deposit"
              icon={Wallet}
              label="Deposit Saldo"
              onClick={() => setOpen(false)}
            />
            <MenuLink
              href="/transactions"
              icon={History}
              label="Riwayat Transaksi"
              onClick={() => setOpen(false)}
            />
            {isAdmin && (
              <MenuLink
                href="/admin"
                icon={ShieldCheck}
                label="Admin Panel"
                tone="primary"
                onClick={() => setOpen(false)}
              />
            )}
          </div>

          <div className="my-1 border-t border-border/60" />

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
          >
            {loggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Keluar
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  href: string;
  icon: typeof UserIcon;
  label: string;
  onClick?: () => void;
  tone?: "primary";
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        tone === "primary"
          ? "text-primary hover:bg-primary/10"
          : "text-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
