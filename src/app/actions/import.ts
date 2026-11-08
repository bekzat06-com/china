"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { getBusinessSettings } from "@/lib/settings";
import { createOrder } from "@/lib/inventory/service";
import { readTableFile, MAX_IMPORT_ROWS } from "@/lib/import/read-file";
import { guessMapping, validateRows, IMPORT_FIELDS, type ColumnMapping, type ParsedOrderRow, type RowError } from "@/lib/import/parse";
import { friendlyError } from "@/lib/action-utils";
import { computeStock, type MovementKind } from "@/lib/inventory/stock";
import { toNum } from "@/lib/utils";

export type ParseFileResult =
  | { ok: true; fileName: string; headers: string[]; rows: Record<string, string | number | null>[]; truncated: boolean; mapping: ColumnMapping }
  | { ok: false; error: string };

/** Шаг 1: прочитать файл и предложить сопоставление колонок */
export async function parseImportFileAction(formData: FormData): Promise<ParseFileResult> {
  await requireUser("MANAGER");
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Выберите файл" };
  try {
    const t = await readTableFile(file);
    if (t.rows.length === 0) return { ok: false, error: "В файле нет строк с данными" };
    return { ok: true, fileName: file.name, headers: t.headers, rows: t.rows, truncated: t.truncated, mapping: guessMapping(t.headers) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось прочитать файл" };
  }
}

const runSchema = z.object({
  fileName: z.string().max(255),
  rows: z.array(z.record(z.union([z.string().max(2000), z.number(), z.null()]))).max(MAX_IMPORT_ROWS),
  mapping: z.object(Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, z.string().max(120).optional()]))),
  deductStock: z.boolean(),
  dryRun: z.boolean(),
});

export interface ImportSummary {
  ok: boolean;
  error?: string;
  dryRun: boolean;
  ordersToCreate: number;
  itemsToCreate: number;
  created: number;
  skippedDuplicates: number;
  revenueKzt: number;
  errors: RowError[];
  warnings: string[];
}

/** Шаг 2: проверка (dryRun) или реальная загрузка. Данные из браузера заново проверяются на сервере. */
export async function runImportAction(payload: unknown): Promise<ImportSummary> {
  const user = await requireUser("MANAGER");
  const empty: ImportSummary = { ok: false, dryRun: true, ordersToCreate: 0, itemsToCreate: 0, created: 0, skippedDuplicates: 0, revenueKzt: 0, errors: [], warnings: [] };
  const parsed = runSchema.safeParse(payload);
  if (!parsed.success) return { ...empty, error: "Некорректные данные импорта" };
  const { rows, mapping, deductStock, dryRun, fileName } = parsed.data;

  const { valid, errors } = validateRows(rows, mapping as ColumnMapping);
  if (errors.length && errors[0].rowNumber === 0) return { ...empty, error: errors[0].message };

  // Сопоставляем артикулы с каталогом
  const skus = [...new Set(valid.map((r) => r.sku))];
  const products = await db.product.findMany({ where: { sku: { in: skus } }, select: { id: true, sku: true, kaspiCommissionPct: true } });
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const settings = await getBusinessSettings();
  const allErrors = [...errors];
  const known: ParsedOrderRow[] = [];
  for (const r of valid) {
    if (!bySku.has(r.sku)) allErrors.push({ rowNumber: r.rowNumber, message: `артикул «${r.sku}» не найден в каталоге товаров` });
    else known.push(r);
  }

  // Группируем строки в заказы по номеру
  const groups = new Map<string, ParsedOrderRow[]>();
  for (const r of known) groups.set(r.externalId, [...(groups.get(r.externalId) ?? []), r]);

  // Уже загруженные ранее заказы пропускаем (защита от двойного импорта)
  const existing = await db.order.findMany({ where: { source: "IMPORT", externalId: { in: [...groups.keys()] } }, select: { externalId: true } });
  const existingIds = new Set(existing.map((e) => e.externalId));
  let fresh = [...groups.entries()]
    .filter(([id]) => !existingIds.has(id))
    .sort((a, b) => a[1][0].orderedAt.getTime() - b[1][0].orderedAt.getTime());

  // Проверка остатков заранее: заказы «расходуют» склад по очереди (по дате)
  if (deductStock) {
    const productIds = [...new Set(known.map((r) => bySku.get(r.sku)!.id))];
    const moves = await db.stockMovement.groupBy({ by: ["productId", "type"], where: { productId: { in: productIds } }, _sum: { quantity: true } });
    const available = new Map<string, number>();
    for (const id of productIds) {
      available.set(id, computeStock(moves.filter((m) => m.productId === id).map((m) => ({ type: m.type as MovementKind, quantity: m._sum.quantity ?? 0 }))).available);
    }
    fresh = fresh.filter(([externalId, group]) => {
      if (group[0].status === "CANCELLED") return true;
      const need = new Map<string, number>();
      for (const r of group) need.set(bySku.get(r.sku)!.id, (need.get(bySku.get(r.sku)!.id) ?? 0) + r.quantity);
      for (const [pid, q] of need) {
        if ((available.get(pid) ?? 0) < q) {
          const sku = group.find((r) => bySku.get(r.sku)!.id === pid)!.sku;
          allErrors.push({ rowNumber: group[0].rowNumber, message: `заказ ${externalId}: недостаточно товара ${sku} на складе (доступно ${available.get(pid) ?? 0}, нужно ${q})` });
          return false;
        }
      }
      for (const [pid, q] of need) available.set(pid, (available.get(pid) ?? 0) - q);
      return true;
    });
  }

  const summary: ImportSummary = {
    ok: true,
    dryRun,
    ordersToCreate: fresh.length,
    itemsToCreate: fresh.reduce((s, [, g]) => s + g.length, 0),
    created: 0,
    skippedDuplicates: existingIds.size,
    revenueKzt: fresh.reduce((s, [, g]) => s + (g[0].status === "CANCELLED" ? 0 : g.reduce((a, r) => a + r.unitPriceKzt * r.quantity, 0)), 0),
    errors: allErrors.slice(0, 200),
    warnings: [],
  };
  if (allErrors.length > 200) summary.warnings.push(`Показаны первые 200 ошибок из ${allErrors.length}`);
  if (!deductStock) summary.warnings.push("Склад не изменится: заказы загрузятся только как история продаж");
  const commissionMissing = !mapping.commission;
  if (commissionMissing) summary.warnings.push(`Комиссия не выбрана — будет рассчитана по ставке товара или ${settings.kaspiCommissionPct}% из настроек`);
  if (dryRun) return summary;

  // Реальная загрузка: каждый заказ в своей транзакции; ошибка одного не ломает остальные
  const costWarnings = new Set<string>();
  for (const [externalId, group] of fresh) {
    const head = group[0];
    try {
      const { warnings } = await db.$transaction((tx) =>
        createOrder(tx, {
          externalId,
          source: "IMPORT",
          status: head.status,
          orderedAt: head.orderedAt,
          city: head.city,
          deductStock,
          items: group.map((r) => {
            const p = bySku.get(r.sku)!;
            const pct = toNum(p.kaspiCommissionPct) ?? settings.kaspiCommissionPct;
            return {
              productId: p.id,
              quantity: r.quantity,
              unitPriceKzt: r.unitPriceKzt,
              commissionKzt: r.commissionKzt ?? Math.round((r.unitPriceKzt * r.quantity * pct) / 100),
              deliveryKzt: r.deliveryKzt ?? 0,
            };
          }),
        }),
      );
      warnings.forEach((w) => costWarnings.add(w));
      summary.created++;
    } catch (e) {
      summary.errors.push({ rowNumber: head.rowNumber, message: `заказ ${externalId}: ${friendlyError(e)}` });
    }
  }
  summary.warnings.push(...costWarnings);
  await audit("orders.import", {
    userId: user.id,
    details: { fileName, created: summary.created, errors: summary.errors.length, skippedDuplicates: summary.skippedDuplicates, deductStock },
  });
  revalidatePath("/", "layout");
  return summary;
}
