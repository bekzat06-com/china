"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";

const optNum = (max = 1e10) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number().min(0).max(max).optional());
const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

const productSchema = z.object({
  sku: z.string().trim().min(1, "Укажите артикул (SKU)").max(64).regex(/^[\w\-.]+$/, "Только латиница, цифры, - _ ."),
  name: z.string().trim().min(2, "Название слишком короткое").max(200),
  nameZh: optStr(200),
  description: optStr(2000),
  categoryId: optStr(64),
  status: z.enum(["IDEA", "ACTIVE", "PAUSED", "ARCHIVED"]),
  purchasePriceCny: optNum(),
  salePriceKzt: optNum(),
  kaspiCommissionPct: optNum(100),
  weightKg: optNum(10000),
  lengthCm: optNum(10000),
  widthCm: optNum(10000),
  heightCm: optNum(10000),
  minStock: z.coerce.number().int().min(0).max(1_000_000).default(0),
  needsCertification: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  kaspiProductUrl: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().url("Некорректная ссылка").max(500).optional(),
  ),
});

export type ProductFormState = { error?: string; fieldErrors?: Record<string, string> };

function toData(d: z.infer<typeof productSchema>) {
  return {
    ...d,
    categoryId: d.categoryId ?? null,
    nameZh: d.nameZh ?? null,
    description: d.description ?? null,
    kaspiProductUrl: d.kaspiProductUrl ?? null,
    purchasePriceCny: d.purchasePriceCny ?? null,
    salePriceKzt: d.salePriceKzt ?? null,
    kaspiCommissionPct: d.kaspiCommissionPct ?? null,
    weightKg: d.weightKg ?? null,
    lengthCm: d.lengthCm ?? null,
    widthCm: d.widthCm ?? null,
    heightCm: d.heightCm ?? null,
  };
}

function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

export async function saveProductAction(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const user = await requireUser("MANAGER");
  const id = formData.get("id")?.toString() || null;
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Проверьте поля формы", fieldErrors: fieldErrors(parsed.error) };

  let productId: string;
  try {
    if (id) {
      const p = await db.product.update({ where: { id }, data: toData(parsed.data) });
      productId = p.id;
      await audit("product.update", { userId: user.id, entity: "product", entityId: id, details: { sku: p.sku } });
    } else {
      const p = await db.product.create({ data: toData(parsed.data) });
      productId = p.id;
      await audit("product.create", { userId: user.id, entity: "product", entityId: p.id, details: { sku: p.sku } });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Товар с таким артикулом уже существует", fieldErrors: { sku: "Артикул занят" } };
    }
    throw e;
  }
  revalidatePath("/products");
  redirect(`/products/${productId}`);
}

/** Удаление: если по товару были продажи — только архивирование (история продаж сохраняется) */
export async function deleteProductAction(formData: FormData) {
  const user = await requireUser("MANAGER");
  const id = z.string().min(1).parse(formData.get("id"));
  const sales = await db.orderItem.count({ where: { productId: id } });
  if (sales > 0) {
    await db.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    await audit("product.archive", { userId: user.id, entity: "product", entityId: id, details: { reason: "есть продажи" } });
  } else {
    const p = await db.product.delete({ where: { id } });
    await audit("product.delete", { userId: user.id, entity: "product", entityId: id, details: { sku: p.sku } });
  }
  revalidatePath("/products");
  redirect("/products");
}
