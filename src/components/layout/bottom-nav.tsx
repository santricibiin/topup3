"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, Shield, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  isAdmin: boolean;
}

/**
 * Bottom navigation untuk mobile (< md).
 * Style: floating tab bar ala app PPOB modern (DANA / Flip / OVO).
 *
 * Catatan: tombol Keluar dipindah ke navbar (ProfileDropdown) supaya
 * mobile bottom-nav cuma berisi navigasi, bukan action.
 */
export function BottomNav({ isAdmin }: Props) {
  const pathname = usePathname();

  // Hide di halaman auth.
  if (pathname?.startsWith("/login") || pathname?.startsWith("/register")) {
    return null;
  }

  const items = [
    { href: "/topup", label: "Topup", icon: Home, match: (p: string) => p === "/topup" || p.startsWith("/topup/") },
    { href: "/deposit", label: "Deposit", icon: Wallet, match: (p: string) => p.startsWith("/deposit") },
    { href: "/transactions", label: "Riwayat", icon: History, match: (p: string) => p.startsWith("/transactions") || p.startsWith("/transaction/") },
    ...(isAdmin
      ? [{ href: "/admin", label: "Admin", icon: Shield, match: (p: string) => p.startsWith("/admin") }]
      : []),
  ];

  const cols =
    items.length === 4 ? "grid-cols-4" : "grid-cols-3";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className={cn("grid h-16", cols)}>
        {items.map((item) => {
          const active = pathname ? item.match(pathname) : false;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
