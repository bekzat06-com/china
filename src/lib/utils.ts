import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const kztFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

/** 125000 → «125 000 ₸» */
export function formatKzt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${kztFmt.format(Math.round(value))} ₸`;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return digits === 2 ? numFmt.format(value) : value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${numFmt.format(Math.round(value * 10) / 10)}%`;
}

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("ru-RU", { timeZone: "Asia/Almaty" });
}

export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" });
}

/** Prisma Decimal / null → number | null */
export function toNum(v: { toString(): string } | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}
