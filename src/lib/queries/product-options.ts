import "server-only";
import { db } from "@/lib/db";
import { getStockOverview } from "@/lib/queries/dashboard";
import { toNum } from "@/lib/utils";
import type { ProductOption } from "@/components/inventory/stock-forms";

/** Список товаров для форм склада и заказов: остаток + подсказки себестоимости */
export async function getProductOptions(): Promise<(ProductOption & { salePriceKzt: number | null })[]> {
  const [products, stock, calcs] = await Promise.all([
    db.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, salePriceKzt: true } }),
    getStockOverview(),
    db.costCalculation.findMany({ where: { productId: { not: null } }, orderBy: { createdAt: "desc" }, select: { productId: true, results: true } }),
  ]);
  const stockBy = new Map(stock.rows.map((r) => [r.id, r]));
  const landed = new Map<string, number>();
  for (const c of calcs) {
    const v = (c.results as { landedCostPerUnitKzt?: number }).landedCostPerUnitKzt;
    if (c.productId && !landed.has(c.productId) && typeof v === "number") landed.set(c.productId, v);
  }
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    available: stockBy.get(p.id)?.available ?? 0,
    lastBatchCostKzt: stockBy.get(p.id)?.unitCostKzt ?? null,
    landedCostKzt: landed.get(p.id) ?? null,
    salePriceKzt: toNum(p.salePriceKzt),
  }));
}
