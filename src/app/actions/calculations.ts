"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { calculateLandedCost } from "@/lib/finance/landed-cost";
import { landedCostInputSchema } from "@/lib/finance/landed-cost-schema";

const saveSchema = z.object({
  name: z.string().trim().min(1, "Введите название расчёта").max(200),
  productId: z.string().max(64).optional().nullable(),
  inputs: landedCostInputSchema,
});

export type SaveCalcResult = { ok: true; id: string } | { ok: false; error: string };

/** Сохраняет расчёт. Результат пересчитывается на сервере — данным из браузера не доверяем. */
export async function saveCalculationAction(payload: unknown): Promise<SaveCalcResult> {
  const user = await requireUser("MANAGER");
  const parsed = saveSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  const { name, productId, inputs } = parsed.data;
  let results;
  try {
    results = calculateLandedCost(inputs);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка расчёта" };
  }
  if (productId) {
    const exists = await db.product.count({ where: { id: productId } });
    if (!exists) return { ok: false, error: "Товар не найден" };
  }
  const calc = await db.costCalculation.create({
    data: {
      name,
      productId: productId || null,
      userId: user.id,
      inputs: inputs as unknown as Prisma.InputJsonValue,
      results: results as unknown as Prisma.InputJsonValue,
    },
  });
  await audit("calculation.create", { userId: user.id, entity: "calculation", entityId: calc.id, details: { name, productId } });
  revalidatePath("/calculator");
  if (productId) revalidatePath(`/products/${productId}`);
  return { ok: true, id: calc.id };
}

export async function deleteCalculationAction(formData: FormData) {
  const user = await requireUser("MANAGER");
  const id = z.string().min(1).parse(formData.get("id"));
  await db.costCalculation.delete({ where: { id } });
  await audit("calculation.delete", { userId: user.id, entity: "calculation", entityId: id });
  revalidatePath("/calculator");
}
