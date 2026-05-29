import type { TransactionStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const MAP: Record<
  TransactionStatus,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" }
> = {
  PENDING: { label: "Menunggu Bayar", variant: "warning" },
  PAID: { label: "Dibayar", variant: "secondary" },
  PROCESSING: { label: "Diproses", variant: "secondary" },
  SUCCESS: { label: "Sukses", variant: "success" },
  FAILED: { label: "Gagal", variant: "destructive" },
  REFUNDED: { label: "Direfund", variant: "outline" },
  EXPIRED: { label: "Kadaluarsa", variant: "outline" },
  CANCELLED: { label: "Dibatalkan", variant: "outline" },
};

export function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  const m = MAP[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
