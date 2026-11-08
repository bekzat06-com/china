import "server-only";
import { db } from "@/lib/db";
import { toNum } from "@/lib/utils";
import { dailySeries, productPerformance, summarizeSales, type SaleRow } from "@/lib/finance/sales-analytics";
import { computeStock, reorderAdvice, type MovementKind } from "@/lib/inventory/stock";
import { getBusinessSettings } from "@/lib/settings";

const DAY = 86400_000;

export async function loadSales(from: Date, to: Date): Promise<SaleRow[]> {
  const items = await db.orderItem.findMany({
    where: { order: { orderedAt: { gte: from, lte: to } } },
    select: {
      quantity: true,
      returnedQty: true,
      unitPriceKzt: true,
      commissionKzt: true,
      deliveryKzt: true,
      unitCostKzt: true,
      productId: true,
      product: { select: { name: true, sku: true } },
      order: { select: { id: true, orderedAt: true, status: true } },
    },
  });
  return items.map((i) => ({
    orderId: i.order.id,
    orderedAt: i.order.orderedAt,
    status: i.order.status,
    productId: i.productId,
    productName: i.product.name,
    sku: i.product.sku,
    quantity: i.quantity,
    returnedQty: i.returnedQty,
    unitPriceKzt: toNum(i.unitPriceKzt) ?? 0,
    commissionKzt: toNum(i.commissionKzt) ?? 0,
    deliveryKzt: toNum(i.deliveryKzt) ?? 0,
    unitCostKzt: toNum(i.unitCostKzt) ?? 0,
  }));
}

export async function sumExpenses(from: Date, to: Date) {
  const agg = await db.expense.aggregate({ where: { date: { gte: from, lte: to } }, _sum: { amountKzt: true } });
  return toNum(agg._sum.amountKzt) ?? 0;
}

/** Остатки по всем товарам + оценка «замороженных» денег и рекомендации по закупке */
export async function getStockOverview() {
  const settings = await getBusinessSettings();
  const [products, grouped, batches, recentSales] = await Promise.all([
    db.product.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, name: true, sku: true, minStock: true, isDemo: true, status: true },
    }),
    db.stockMovement.groupBy({ by: ["productId", "type"], _sum: { quantity: true } }),
    db.stockBatch.findMany({ select: { productId: true, unitCostKzt: true, receivedAt: true }, orderBy: { receivedAt: "desc" } }),
    db.orderItem.groupBy({
      by: ["productId"],
      where: { order: { orderedAt: { gte: new Date(Date.now() - 30 * DAY) }, status: { in: ["COMPLETED", "NEW"] } } },
      _sum: { quantity: true },
    }),
  ]);

  const movementsBy = new Map<string, { type: MovementKind; quantity: number }[]>();
  for (const g of grouped) {
    const list = movementsBy.get(g.productId) ?? [];
    list.push({ type: g.type, quantity: g._sum.quantity ?? 0 });
    movementsBy.set(g.productId, list);
  }
  const lastCost = new Map<string, number>();
  for (const b of batches) if (!lastCost.has(b.productId)) lastCost.set(b.productId, toNum(b.unitCostKzt) ?? 0);
  const sold30 = new Map(recentSales.map((s) => [s.productId, s._sum.quantity ?? 0]));

  const rows = products.map((p) => {
    const level = computeStock(movementsBy.get(p.id) ?? []);
    const avgDaily = (sold30.get(p.id) ?? 0) / 30;
    const advice = reorderAdvice(level.available, p.minStock, avgDaily, settings.leadTimeDays, settings.safetyStockDays);
    const unitCost = lastCost.get(p.id) ?? null;
    return {
      ...p,
      ...level,
      avgDailySales: Math.round(avgDaily * 100) / 100,
      sold30: sold30.get(p.id) ?? 0,
      unitCostKzt: unitCost,
      stockValueKzt: unitCost !== null ? Math.max(0, level.onHand) * unitCost : null,
      advice,
    };
  });
  const frozenKzt = rows.reduce((s, r) => s + (r.stockValueKzt ?? 0), 0);
  return { rows, frozenKzt };
}

export interface Recommendation {
  level: "critical" | "warning" | "info";
  title: string;
  text: string;
  href?: string;
}

export async function getDashboardData(days: number) {
  // Период — полные календарные дни по времени Алматы (UTC+5), включая сегодня
  const to = new Date();
  const ALMATY_OFFSET = 5 * 3600_000;
  const startOfToday = Math.floor((to.getTime() + ALMATY_OFFSET) / DAY) * DAY - ALMATY_OFFSET;
  const from = new Date(startOfToday - (days - 1) * DAY);
  const prevFrom = new Date(from.getTime() - days * DAY);

  const [rows, prevRows, expenses, prevExpenses, stock, competitorsCount, demoCount, settings, productsCount] =
    await Promise.all([
      loadSales(from, to),
      loadSales(prevFrom, from),
      sumExpenses(from, to),
      sumExpenses(prevFrom, from),
      getStockOverview(),
      db.competitorProduct.count(),
      db.order.count({ where: { isDemo: true } }),
      getBusinessSettings(),
      db.product.count(),
    ]);

  const summary = summarizeSales(rows, expenses);
  const prevSummary = summarizeSales(prevRows, prevExpenses);
  const performance = productPerformance(rows);
  const series = dailySeries(rows, from, to);

  const top10 = performance.filter((p) => p.profitKzt > 0).slice(0, 10);
  const losing = performance.filter((p) => p.profitKzt <= 0 || (p.marginPct !== null && p.marginPct < 10));

  // Рекомендации на основе правил (без ИИ). ИИ-рекомендации подключаются на этапе 6.
  const recs: Recommendation[] = [];
  for (const p of performance.filter((x) => x.profitKzt < 0)) {
    recs.push({
      level: "critical",
      title: `Убыток: ${p.productName}`,
      text: `За период товар принёс ${Math.round(p.profitKzt).toLocaleString("ru-RU")} ₸. Проверьте цену, себестоимость и возвраты (${p.unitsReturned} шт).`,
      href: `/products/${p.productId}`,
    });
  }
  for (const p of performance.filter((x) => x.profitKzt > 0 && x.marginPct !== null && x.marginPct < 10)) {
    recs.push({
      level: "warning",
      title: `Низкая маржа: ${p.productName}`,
      text: `Маржинальность ${p.marginPct}% — при снижении цен конкурентами товар станет убыточным.`,
      href: `/products/${p.productId}`,
    });
  }
  for (const s of stock.rows.filter((r) => r.advice.status === "OUT" && r.sold30 > 0)) {
    recs.push({ level: "critical", title: `Нет в наличии: ${s.name}`, text: `Товар продавался (${s.sold30} шт за 30 дней), но закончился.`, href: `/products/${s.id}` });
  }
  for (const s of stock.rows.filter((r) => r.advice.status === "LOW")) {
    recs.push({
      level: "warning",
      title: `Пора дозаказать: ${s.name}`,
      text: `Остатка хватит примерно на ${s.advice.daysOfCover ?? "?"} дн., а поставка из Китая занимает ~${settings.leadTimeDays} дн. Рекомендуемая закупка: ${s.advice.suggestedQty} шт.`,
      href: `/products/${s.id}`,
    });
  }
  for (const s of stock.rows.filter((r) => r.sold30 === 0 && r.onHand > 0)) {
    recs.push({
      level: "info",
      title: `Залежавшийся товар: ${s.name}`,
      text: `0 продаж за 30 дней, на складе ${s.onHand} шт${s.stockValueKzt ? ` (≈ ${Math.round(s.stockValueKzt).toLocaleString("ru-RU")} ₸ заморожено)` : ""}. Рассмотрите акцию или снижение цены.`,
      href: `/products/${s.id}`,
    });
  }
  if (!settings.verifiedByOwner) {
    recs.push({
      level: "info",
      title: "Проверьте ставки в настройках",
      text: "Курсы валют, комиссия Kaspi и налог сейчас заданы примерными значениями. Укажите свои — от них зависят все расчёты.",
      href: "/settings",
    });
  }

  return {
    days,
    from,
    to,
    summary,
    prevSummary,
    series,
    top10,
    losing,
    stock,
    competitorsCount,
    hasDemo: demoCount > 0,
    productsCount,
    recommendations: recs.slice(0, 8),
    budgetKzt: settings.budgetKzt,
  };
}
