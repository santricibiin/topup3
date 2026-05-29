"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search, Layers, Crown, Users, Ban, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleOption {
  value: string;
  label: string;
  icon: typeof Layers;
  tone?: string;
}

const ROLE_OPTS: readonly RoleOption[] = [
  { value: "ALL", label: "Semua", icon: Layers },
  { value: "USER", label: "User", icon: Users },
  { value: "RESELLER", label: "Reseller", icon: Crown, tone: "text-emerald-500" },
  { value: "ADMIN", label: "Admin", icon: Crown, tone: "text-amber-500" },
  { value: "SUSPENDED", label: "Suspended", icon: ShieldOff, tone: "text-amber-500" },
  { value: "BANNED", label: "Banned", icon: Ban, tone: "text-destructive" },
];

interface Props {
  initialQ?: string;
  initialRole?: string;
}

/**
 * Filter user dengan auto-submit + pill chips utk role.
 * Value "INACTIVE" dipakai sebagai status filter (bukan role) agar bisa
 * filter user yg di-suspend langsung dari sini.
 */
export function UsersFilter({ initialQ = "", initialRole = "ALL" }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(initialQ);
  const [role, setRole] = useState(initialRole);

  useEffect(() => {
    const handle = setTimeout(() => apply(q, role), 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function apply(nextQ: string, nextRole: string) {
    const sp = new URLSearchParams(params?.toString() ?? "");
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    else sp.delete("q");
    if (nextRole && nextRole !== "ALL") sp.set("role", nextRole);
    else sp.delete("role");
    sp.delete("page");
    const qs = sp.toString();
    start(() => {
      router.replace(qs ? `/admin/users?${qs}` : "/admin/users");
    });
  }

  function onRole(value: string) {
    setRole(value);
    apply(q, value);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari username, email, atau nomor HP..."
          className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-10 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {pending && (
          <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="-mx-1 flex flex-wrap gap-1.5 overflow-x-auto pb-1">
        {ROLE_OPTS.map(({ value, label, icon: Icon, tone }) => {
          const active = role === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onRole(value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", !active && tone)} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
