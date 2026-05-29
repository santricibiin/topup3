"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  title: string;
  description: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Modal konfirmasi reusable. Ganti `window.confirm()` yg jelek.
 * - Render via Portal supaya backdrop selalu di atas semua elemen.
 * - ESC + click backdrop untuk tutup (kecuali sedang loading).
 * - `variant=destructive` → tombol confirm merah + ikon warning.
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  variant = "default",
  loading = false,
  onConfirm,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, loading, onClose]);

  if (!mounted || !open) return null;

  const isDestructive = variant === "destructive";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Tutup"
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
        onClick={onClose}
        disabled={loading}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md animate-fade-in rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={
                isDestructive
                  ? "grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive"
                  : "grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary"
              }
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 id="confirm-title" className="font-semibold tracking-tight">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 text-sm text-muted-foreground">
          {description}
        </div>

        <div className="flex gap-2 border-t border-border/60 px-6 py-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            className="flex-1"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
