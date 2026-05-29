"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SyncProductsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products/sync", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Sync gagal");
      const { total, created, updated, failed } = json.data;
      toast.success(`Sync selesai: ${total} produk (baru ${created}, update ${updated}, gagal ${failed})`);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || isPending;

  return (
    <Button onClick={handleSync} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Sync dari Digiflazz
    </Button>
  );
}
