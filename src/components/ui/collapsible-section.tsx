"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Optional badge/chip kecil di kanan title (mis. count). */
  badge?: ReactNode;
}

/**
 * Card-style collapsible section. Dipakai di admin pages untuk grup
 * konten yg banyak supaya tidak bertumpuk vertikal.
 */
export function CollapsibleSection({
  title,
  description,
  icon,
  children,
  defaultOpen = false,
  badge,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-border bg-card transition-shadow hover:shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left md:px-6"
      >
        {icon && (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-tight">{title}</span>
            {badge}
          </div>
          {description && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </div>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-border/60 px-5 py-5 md:px-6 md:py-6">
          {children}
        </div>
      )}
    </div>
  );
}
