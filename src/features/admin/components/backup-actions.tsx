"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackupActions() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleRunNow() {
    if (running) return;
    setRunning(true);
    const tid = toast.loading("Menjalankan backup...");
    try {
      const res = await fetch("/api/admin/backup", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Backup gagal");
      }
      toast.success(
        `Backup tersimpan: ${json.data.filename} (${json.data.sizeText})`,
        { id: tid },
      );
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error((err as Error).message, { id: tid });
    } finally {
      setRunning(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    const tid = toast.loading(`Mengupload ${file.name}...`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/backup/upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Upload gagal");
      }
      toast.success(`Berhasil: ${json.data.filename}`, { id: tid });
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error((err as Error).message, { id: tid });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        onClick={handleRunNow}
        disabled={running || uploading}
        className="gap-2"
      >
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        Backup Sekarang
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={() => fileRef.current?.click()}
        disabled={running || uploading}
        className="gap-2"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        Upload Backup
      </Button>

      <input
        ref={fileRef}
        type="file"
        accept=".sql,.sql.gz,.gz,application/sql,application/gzip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
        }}
      />
    </div>
  );
}
