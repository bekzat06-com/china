import "server-only";
import { db } from "@/lib/db";
import { loadSales, getStockOverview } from "@/lib/queries/dashboard";
import { productPerformance, summarizeSales } from "@/lib/finance/sales-analytics";
import { monthlyPnl, turnoverDays, xyzAnalysis } from "@/lib/finance/reports";
import { toNum } from "@/lib/utils";

const DAY = 86400_000;

export async function getReportsData(days: number) {
  const now = new Date();
  const from = new Date(now.getTime() - days * DAY);
  const yearAgo = new Date(now.getTime() - 365 * DAY);
  const [rows, rowsYear, expensesYear, stock, firstSales, products] = await Promise.all([
    loadSales(from, now),
    loadSales(yearAgo, now),
    db.expense.findMany({ where: { date: { gte: yearAgo } }, select: { date: true, amountKzt: true } }),
    getStockOverview(),
    db.$queryRaw<{ productId: string; first: Date }[]>`
      SELECT oi."productId", MIN(o."orderedAt") AS first
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
      GROUP BY oi."productId"`,
    db.product.findMany({ select: { id: true, category: { select: { name: true } } } }),
  ]);

  const expensesPeriod = expensesYear.filter((e) => e.date >= from).reduce((s, e) => s + (toNum(e.amountKzt) ?? 0), 0);
  const summary = summarizeSales(rows, expensesPeriod);
  const perf = productPerformance(rows);
  const xyz = xyzAnalysis(rowsYear, now, 12, 8, new Map(firstSales.map((f) => [f.productId, new Date(f.first)])));
  const stockBy = new Map(stock.rows.map((r) => [r.id, r]));
  const categoryBy = new Map(products.map((p) => [p.id, p.category?.name ?? "Без категории"]));

  const productRows = perf.map((p) => ({
    ...p,
    category: categoryBy.get(p.productId) ?? "Без категории",
    xyz: xyz.get(p.productId) ?? null,
    stock: stockBy.get(p.productId)?.onHand ?? 0,
    turnoverDays: turnoverDays(stockBy.get(p.productId)?.stockValueKzt ?? 0, p.costKzt, days),
    returnRatePct: p.unitsSold + p.unitsReturned > 0 ? Math.round((p.unitsReturned / (p.unitsSold + p.unitsReturned)) * 1000) / 10 : null,
  }));

  const catMap = new Map<string, { revenue: number; profit: number; units: number }>();
  for (const p of productRows) {
    const c = catMap.get(p.category) ?? { revenue: 0, profit: 0, units: 0 };
    c.revenue += p.revenueKzt;
    c.profit += p.profitKzt;
    c.units += p.unitsSold;
    catMap.set(p.category, c);
  }
  const categories = [...catMap.entries()]
    .map(([name, v]) => ({ name, ...v, marginPct: v.revenue > 0 ? Math.round((v.profit / v.revenue) * 1000) / 10 : null }))
    .sort((a, b) => b.profit - a.profit);

  return {
    days,
    summary,
    monthly: monthlyPnl(rowsYear, expensesYear.map((e) => ({ date: e.date, amountKzt: toNum(e.amountKzt) ?? 0 }))),
    productRows,
    categories,
    turnover: turnoverDays(stock.frozenKzt, summary.cogsKzt, days),
  };
}
