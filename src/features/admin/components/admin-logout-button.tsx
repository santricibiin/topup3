"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  collapsed: boolean;
}

/**
 * Tombol logout admin sidebar.
 * Hit POST /api/auth/logout (JSON response) → redirect ke /login.
 */
export function AdminLogoutButton({ collapsed }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Logout gagal");
      toast.success("Berhasil keluar");
      router.push("/login");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      title={collapsed ? "Keluar" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60",
        collapsed && "lg:justify-center lg:px-2",
      )}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      <span className={cn(collapsed && "lg:hidden")}>
        {loading ? "Keluar..." : "Keluar"}
      </span>
    </button>
  );
}
