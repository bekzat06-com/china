import { z } from "zod";
import { NegativeStockError } from "@/lib/inventory/stock";

export type ActionState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> };

export function zodFieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

/** Понятное сообщение об ошибке для пользователя (без технических подробностей) */
export function friendlyError(e: unknown): string {
  if (e instanceof NegativeStockError) return e.message;
  if (e instanceof Error && /не найден|нельзя|уже|можно только|не может|Недостаточно/i.test(e.message)) return e.message;
  console.error(e);
  return "Не удалось выполнить операцию. Подробности — в журнале сервера.";
}

/** Пустая строка → undefined (для необязательных полей форм) */
export const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** Дата из <input type="date"> трактуется как полдень по Алматы, чтобы не «уехать» на соседний день */
export function dateInputToAlmaty(v: string): Date {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12 - 5, 0, 0));
}
