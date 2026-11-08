"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { adjustStock, receiveStock } from "@/lib/inventory/service";
import { type ActionState, dateInputToAlmaty, emptyToUndef, friendlyError, zodFieldErrors } from "@/lib/action-utils";

const receiveSchema = z.object({
  productId: z.string().min(1, "Выберите товар"),
  quantity: z.coerce.number().int("Целое число").min(1, "Минимум 1").max(1_000_000),
  unitCostKzt: z.coerce.number().min(0, "Не может быть отрицательной").max(1e9),
  receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату"),
  note: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
});

export async function receiveStockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("MANAGER");
  const parsed = receiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Проверьте поля формы", fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;
  const receivedAt = dateInputToAlmaty(d.receivedAt);
  if (receivedAt.getTime() > Date.now() + 86400_000) return { error: "Дата прихода не может быть в будущем" };
  try {
    const batch = await db.$transaction((tx) =>
      receiveStock(tx, { productId: d.productId, quantity: d.quantity, unitCostKzt: d.unitCostKzt, receivedAt, note: d.note }),
    );
    await audit("stock.receive", { userId: user.id, entity: "product", entityId: d.productId, details: { batchId: batch.id, quantity: d.quantity, unitCostKzt: d.unitCostKzt } });
  } catch (e) {
    return { error: friendlyError(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: `Оприходовано ${d.quantity} шт` };
}

const adjustSchema = z.object({
  productId: z.string().min(1, "Выберите товар"),
  delta: z.coerce.number().int("Целое число").min(-1_000_000).max(1_000_000).refine((v) => v !== 0, "Не может быть 0"),
  note: z.string().trim().min(3, "Укажите причину (минимум 3 символа)").max(500),
  allowNegative: z.preprocess((v) => v === "on", z.boolean()),
});

export async function adjustStockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("MANAGER");
  const parsed = adjustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Проверьте поля формы", fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;
  // Отрицательный остаток — только с явного разрешения владельца
  if (d.allowNegative && user.role !== "OWNER") return { error: "Разрешить отрицательный остаток может только владелец" };
  try {
    await db.$transaction((tx) => adjustStock(tx, { productId: d.productId, delta: d.delta, note: d.note, allowNegative: d.allowNegative }));
    await audit("stock.adjust", { userId: user.id, entity: "product", entityId: d.productId, details: { delta: d.delta, note: d.note, allowNegative: d.allowNegative } });
  } catch (e) {
    return { error: friendlyError(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: d.delta > 0 ? `Добавлено ${d.delta} шт` : `Списано ${-d.delta} шт` };
}
