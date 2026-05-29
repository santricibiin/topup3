"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Save, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Schema = z.object({
  enabled: z.boolean(),
  interval: z.enum(["minutes", "hours", "days"]),
  value: z.coerce.number().int().positive().max(10_000),
  keepDays: z.coerce.number().int().min(0).max(3650),
});
type FormValues = z.infer<typeof Schema>;

interface Props {
  initial: {
    enabled: boolean;
    interval: "minutes" | "hours" | "days";
    value: number;
    keepDays: number;
  };
}

export function BackupSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: initial,
  });

  const enabled = watch("enabled");
  const interval = watch("interval");
  const value = watch("value");

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/backup/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Gagal menyimpan");
      }
      toast.success("Pengaturan backup tersimpan");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const intervalLabels: Record<string, string> = {
    minutes: "Menit",
    hours: "Jam",
    days: "Hari",
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Toggle Auto-Backup */}
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-primary" />
            Auto-Backup
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Jalankan backup database otomatis sesuai interval yang diset.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() =>
            setValue("enabled", !enabled, { shouldDirty: true })
          }
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            enabled ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Interval & Value */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="value">Frekuensi</Label>
          <div className="flex gap-2">
            <Input
              id="value"
              type="number"
              min={1}
              max={10000}
              {...register("value", { valueAsNumber: true })}
              disabled={!enabled}
              className="flex-1"
            />
            <select
              {...register("interval")}
              disabled={!enabled}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="minutes">Menit</option>
              <option value="hours">Jam</option>
              <option value="days">Hari</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Backup setiap{" "}
            <span className="font-medium text-foreground">
              {value} {intervalLabels[interval] ?? interval}
            </span>
            .
          </p>
          {errors.value && (
            <p className="text-xs text-destructive">{errors.value.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="keepDays">Simpan (hari)</Label>
          <Input
            id="keepDays"
            type="number"
            min={0}
            max={3650}
            {...register("keepDays", { valueAsNumber: true })}
          />
          <p className="text-xs text-muted-foreground">
            File backup &gt; nilai ini hari akan dihapus otomatis. Set 0 untuk
            menonaktifkan auto-cleanup.
          </p>
          {errors.keepDays && (
            <p className="text-xs text-destructive">
              {errors.keepDays.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-4">
        <Button
          type="submit"
          disabled={saving || isPending || !isDirty}
          className="gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Simpan Pengaturan
        </Button>
      </div>
    </form>
  );
}
