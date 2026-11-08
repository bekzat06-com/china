"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { getBusinessSettings } from "@/lib/settings";
import { createOrder, reverseOrder } from "@/lib/inventory/service";
import { type ActionState, dateInputToAlmaty, emptyToUndef, friendlyError, zodFieldErrors } from "@/lib/action-utils";
import { toNum } from "@/lib/utils";

const optMoney = z.preprocess(emptyToUndef, z.coerce.number().min(0).max(1e9).optional());

const orderSchema = z.object({
  externalId: z.preprocess(emptyToUndef, z.string().trim().max(100).optional()),
  orderedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату"),
  productId: z.string().min(1, "Выберите товар"),
  quantity: z.coerce.number().int("Целое число").min(1, "Минимум 1").max(100_000),
  unitPriceKzt: z.coerce.number().min(0, "Не может быть отрицательной").max(1e9),
  commissionKzt: optMoney,
  deliveryKzt: optMoney,
  status: z.enum(["COMPLETED", "NEW"]),
  city: z.preprocess(emptyToUndef, z.string().trim().max(100).optional()),
});

export async function createOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("MANAGER");
  const parsed = orderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Проверьте поля формы", fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;
  const orderedAt = dateInputToAlmaty(d.orderedAt);
  if (orderedAt.getTime() > Date.now() + 86400_000) return { error: "Дата заказа не может быть в будущем" };

  const product = await db.product.findUnique({ where: { id: d.productId }, select: { kaspiCommissionPct: true } });
  if (!product) return { error: "Товар не найден" };
  const settings = await getBusinessSettings();
  // Комиссия не указана — считаем по ставке товара или ставке из настроек
  const pct = toNum(product.kaspiCommissionPct) ?? settings.kaspiCommissionPct;
  const commission = d.commissionKzt ?? Math.round((d.unitPriceKzt * d.quantity * pct) / 100);

  try {
    const { order } = await db.$transaction((tx) =>
      createOrder(tx, {
        externalId: d.externalId ?? null,
        source: "MANUAL",
        status: d.status,
        orderedAt,
        city: d.city ?? null,
        items: [{ productId: d.productId, quantity: d.quantity, unitPriceKzt: d.unitPriceKzt, commissionKzt: commission, deliveryKzt: d.deliveryKzt ?? 0 }],
        deductStock: true,
      }),
    );
    await audit("order.create", { userId: user.id, entity: "order", entityId: order.id, details: { productId: d.productId, quantity: d.quantity, price: d.unitPriceKzt } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "Заказ с таким номером уже есть" };
    return { error: friendlyError(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Заказ сохранён, товар списан со склада" };
}

const reverseSchema = z.object({ orderId: z.string().min(1), action: z.enum(["RETURNED", "CANCELLED"]) });

export async function reverseOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("MANAGER");
  const parsed = reverseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Некорректный запрос" };
  try {
    await db.$transaction((tx) => reverseOrder(tx, parsed.data.orderId, parsed.data.action));
    await audit(parsed.data.action === "RETURNED" ? "order.return" : "order.cancel", { userId: user.id, entity: "order", entityId: parsed.data.orderId });
  } catch (e) {
    return { error: friendlyError(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: parsed.data.action === "RETURNED" ? "Оформлен возврат, товар вернулся на склад" : "Заказ отменён" };
}

const expenseSchema = z.object({
  category: z.enum(["ADS", "SALARY", "RENT", "TAXES", "SERVICES", "OTHER"]),
  amountKzt: z.coerce.number().positive("Сумма должна быть больше 0").max(1e10),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату"),
  note: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
});

export async function addExpenseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("MANAGER");
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Проверьте поля формы", fieldErrors: zodFieldErrors(parsed.error) };
  const e = await db.expense.create({ data: { ...parsed.data, date: dateInputToAlmaty(parsed.data.date), note: parsed.data.note ?? null } });
  await audit("expense.create", { userId: user.id, entity: "expense", entityId: e.id, details: { amount: parsed.data.amountKzt, category: parsed.data.category } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Расход добавлен" };
}

export async function deleteExpenseAction(formData: FormData) {
  const user = await requireUser("MANAGER");
  const id = z.string().min(1).parse(formData.get("id"));
  const e = await db.expense.delete({ where: { id } });
  await audit("expense.delete", { userId: user.id, entity: "expense", entityId: id, details: { amount: toNum(e.amountKzt) } });
  revalidatePath("/", "layout");
}
