/**
 * Money helper — gunakan Prisma.Decimal agar tidak ada floating point error.
 * Jangan pernah pakai number untuk perhitungan saldo / harga.
 */
import { Prisma } from "@prisma/client";

export type Money = Prisma.Decimal;
export const Money = Prisma.Decimal;

export function toMoney(value: number | string | Prisma.Decimal): Money {
  return new Prisma.Decimal(value);
}

export function add(a: Money, b: Money | number | string): Money {
  return a.add(b);
}
export function sub(a: Money, b: Money | number | string): Money {
  return a.sub(b);
}
export function gte(a: Money, b: Money | number | string): boolean {
  return a.gte(b);
}
export function lt(a: Money, b: Money | number | string): boolean {
  return a.lt(b);
}

/** Convert ke integer rupiah untuk dikirim ke Duitku/Digiflazz (mereka pakai integer). */
export function toIntRupiah(m: Money | number | string): number {
  return new Prisma.Decimal(m).toNumber();
}

/** Format display IDR. */
export function formatIDR(value: Money | number | string): string {
  const num =
    value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
  if (!Number.isFinite(num)) return "Rp0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}
