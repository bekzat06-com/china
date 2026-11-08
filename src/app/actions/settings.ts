"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { businessSettingsSchema, getBusinessSettings, saveBusinessSettings } from "@/lib/settings";

export type SettingsState = { ok?: boolean; error?: string };

export async function saveSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser("OWNER");
  const raw = Object.fromEntries(formData);
  const parsed = businessSettingsSchema.safeParse({ ...raw, verifiedByOwner: raw.verifiedByOwner === "on" });
  if (!parsed.success) return { error: `${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}` };
  const before = await getBusinessSettings();
  const value = { ...parsed.data, ratesUpdatedAt: new Date().toISOString() };
  await saveBusinessSettings(value);
  await audit("settings.update", { userId: user.id, entity: "settings", entityId: "business", details: { before, after: value } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export type DemoState = { ok?: boolean; error?: string; message?: string };

/**
 * Удаление всех демо-данных. Необратимая операция → требуется повторный ввод пароля владельца.
 */
export async function deleteDemoDataAction(_prev: DemoState, formData: FormData): Promise<DemoState> {
  const user = await requireUser("OWNER");
  const password = String(formData.get("password") ?? "");
  const full = await db.user.findUnique({ where: { id: user.id } });
  if (!full || !(await bcrypt.compare(password, full.passwordHash))) {
    await audit("demo.delete_denied", { userId: user.id });
    return { error: "Неверный пароль — демо-данные не удалены" };
  }
  const result = await db.$transaction(async (tx) => {
    const demoProducts = await tx.product.findMany({ where: { isDemo: true }, select: { id: true } });
    const ids = demoProducts.map((p) => p.id);
    const orders = await tx.order.deleteMany({ where: { isDemo: true } });
    // реальные заказы с демо-товарами не трогаем: такие товары не удаляем, а только архивируем
    const stillUsed = await tx.orderItem.findMany({ where: { productId: { in: ids } }, select: { productId: true }, distinct: ["productId"] });
    const usedIds = new Set(stillUsed.map((x) => x.productId));
    await tx.stockMovement.deleteMany({ where: { isDemo: true } });
    await tx.stockBatch.deleteMany({ where: { isDemo: true } });
    await tx.expense.deleteMany({ where: { isDemo: true } });
    const deletable = ids.filter((id) => !usedIds.has(id));
    const products = await tx.product.deleteMany({ where: { id: { in: deletable } } });
    if (usedIds.size) await tx.product.updateMany({ where: { id: { in: [...usedIds] } }, data: { status: "ARCHIVED" } });
    return { orders: orders.count, products: products.count };
  });
  await audit("demo.delete", { userId: user.id, details: result });
  revalidatePath("/", "layout");
  return { ok: true, message: `Удалено: ${result.products} товаров, ${result.orders} заказов` };
}
