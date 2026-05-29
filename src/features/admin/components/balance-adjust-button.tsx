"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { BalanceAdjustModal } from "./balance-adjust-modal";

interface Props {
  user: {
    id: string;
    username: string;
    email: string;
    balance: string;
  };
  variant?: "icon" | "text";
}

/**
 * Tombol untuk buka modal Kelola Saldo. Reusable di mobile card & desktop row.
 */
export function BalanceAdjustButton({ user, variant = "icon" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
          aria-label={`Kelola saldo ${user.username}`}
        >
          <Wallet className="h-3 w-3" />
          Saldo
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <Wallet className="h-3.5 w-3.5" />
          Kelola Saldo
        </button>
      )}

      {open && <BalanceAdjustModal user={user} onClose={() => setOpen(false)} />}
    </>
  );
}
