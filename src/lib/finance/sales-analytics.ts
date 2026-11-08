/**
 * Аналитика продаж: чистые функции над строками заказов.
 * Ничего не выдумывает — считает только то, что передано из базы.
 */

export interface SaleRow {
  orderId: string;
  orderedAt: Date;
  status: "NEW" | "COMPLETED" | "CANCELLED" | "RETURNED";
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  returnedQty: number;
  unitPriceKzt: number;
  commissionKzt: number;
  deliveryKzt: number;
  unitCostKzt: number;
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  sku: string;
  unitsSold: number;
  unitsReturned: number;
  revenueKzt: number;
  costKzt: number; // себестоимость проданных единиц
  commissionKzt: number;
  deliveryKzt: number;
  profitKzt: number;
  marginPct: number | null;
  abcClass?: "A" | "B" | "C";
}

export interface SalesSummary {
  revenueKzt: number;
  ordersCount: number;
  unitsSold: number;
  unitsReturned: number;
  averageCheckKzt: number | null;
  cogsKzt: number;
  commissionKzt: number;
  deliveryKzt: number;
  grossProfitKzt: number; // до общих расходов
  expensesKzt: number;
  netProfitKzt: number; // после общих расходов (реклама, аренда и т.д.)
  roiPct: number | null; // чистая прибыль / себестоимость проданного
  returnRatePct: number | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Учитываются только заказы, которые не отменены. Возвращённые единицы вычитаются из выручки. */
function isCounted(row: SaleRow) {
  return row.status !== "CANCELLED";
}

function netUnits(row: SaleRow) {
  if (row.status === "RETURNED") return 0;
  return Math.max(0, row.quantity - row.returnedQty);
}

export function rowFinancials(row: SaleRow) {
  const units = netUnits(row);
  const returned = row.status === "RETURNED" ? row.quantity : row.returnedQty;
  const revenue = units * row.unitPriceKzt;
  const cost = units * row.unitCostKzt;
  // Комиссия и доставка за позицию: считаем пропорционально оставшимся единицам,
  // доставка при возврате остаётся расходом продавца.
  const commission = row.quantity > 0 ? (row.commissionKzt * units) / row.quantity : 0;
  const delivery = row.deliveryKzt;
  return { units, returned, revenue, cost, commission, delivery, profit: revenue - cost - commission - delivery };
}

export function summarizeSales(rows: SaleRow[], expensesKzt = 0): SalesSummary {
  const counted = rows.filter(isCounted);
  let revenue = 0,
    cogs = 0,
    commission = 0,
    delivery = 0,
    units = 0,
    returned = 0,
    ordered = 0;
  const revenueOrders = new Set<string>();
  for (const row of counted) {
    const f = rowFinancials(row);
    revenue += f.revenue;
    cogs += f.cost;
    commission += f.commission;
    delivery += f.delivery;
    units += f.units;
    returned += f.returned;
    ordered += row.quantity;
    if (f.units > 0) revenueOrders.add(row.orderId);
  }
  const gross = revenue - cogs - commission - delivery;
  const net = gross - expensesKzt;
  const ordersCount = revenueOrders.size;
  return {
    revenueKzt: r2(revenue),
    ordersCount,
    unitsSold: units,
    unitsReturned: returned,
    averageCheckKzt: ordersCount > 0 ? r2(revenue / ordersCount) : null,
    cogsKzt: r2(cogs),
    commissionKzt: r2(commission),
    deliveryKzt: r2(delivery),
    grossProfitKzt: r2(gross),
    expensesKzt: r2(expensesKzt),
    netProfitKzt: r2(net),
    roiPct: cogs > 0 ? r2((net / cogs) * 100) : null,
    returnRatePct: ordered > 0 ? r2((returned / ordered) * 100) : null,
  };
}

export function productPerformance(rows: SaleRow[]): ProductPerformance[] {
  const map = new Map<string, ProductPerformance>();
  for (const row of rows.filter(isCounted)) {
    const f = rowFinancials(row);
    const p =
      map.get(row.productId) ??
      ({
        productId: row.productId,
        productName: row.productName,
        sku: row.sku,
        unitsSold: 0,
        unitsReturned: 0,
        revenueKzt: 0,
        costKzt: 0,
        commissionKzt: 0,
        deliveryKzt: 0,
        profitKzt: 0,
        marginPct: null,
      } satisfies ProductPerformance);
    p.unitsSold += f.units;
    p.unitsReturned += f.returned;
    p.revenueKzt += f.revenue;
    p.costKzt += f.cost;
    p.commissionKzt += f.commission;
    p.deliveryKzt += f.delivery;
    p.profitKzt += f.profit;
    map.set(row.productId, p);
  }
  const list = [...map.values()].map((p) => ({
    ...p,
    revenueKzt: r2(p.revenueKzt),
    costKzt: r2(p.costKzt),
    commissionKzt: r2(p.commissionKzt),
    deliveryKzt: r2(p.deliveryKzt),
    profitKzt: r2(p.profitKzt),
    marginPct: p.revenueKzt > 0 ? r2((p.profitKzt / p.revenueKzt) * 100) : null,
  }));
  return applyAbc(list);
}

/**
 * ABC-анализ по прибыли: A — товары, дающие первые 80% прибыли, B — следующие 15%, C — остальные.
 * Убыточные товары всегда попадают в C.
 */
export function applyAbc(list: ProductPerformance[]): ProductPerformance[] {
  const sorted = [...list].sort((a, b) => b.profitKzt - a.profitKzt);
  const totalPositive = sorted.reduce((s, p) => s + Math.max(0, p.profitKzt), 0);
  let cumulative = 0;
  return sorted.map((p) => {
    if (p.profitKzt <= 0 || totalPositive === 0) return { ...p, abcClass: "C" as const };
    const before = cumulative / totalPositive;
    cumulative += p.profitKzt;
    const cls = before < 0.8 ? "A" : before < 0.95 ? "B" : "C";
    return { ...p, abcClass: cls as "A" | "B" | "C" };
  });
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  revenueKzt: number;
  profitKzt: number;
  orders: number;
}

/** Ряд по дням (по времени Алматы, UTC+5) для графиков. Дни без продаж заполняются нулями. */
export function dailySeries(rows: SaleRow[], from: Date, to: Date, tzOffsetHours = 5): DailyPoint[] {
  const key = (d: Date) => new Date(d.getTime() + tzOffsetHours * 3600_000).toISOString().slice(0, 10);
  const map = new Map<string, { revenue: number; profit: number; orders: Set<string> }>();
  for (let t = from.getTime(); t <= to.getTime(); t += 86400_000) {
    map.set(key(new Date(t)), { revenue: 0, profit: 0, orders: new Set() });
  }
  map.set(key(to), map.get(key(to)) ?? { revenue: 0, profit: 0, orders: new Set() });
  for (const row of rows.filter(isCounted)) {
    const k = key(row.orderedAt);
    const bucket = map.get(k);
    if (!bucket) continue;
    const f = rowFinancials(row);
    bucket.revenue += f.revenue;
    bucket.profit += f.profit;
    if (f.units > 0) bucket.orders.add(row.orderId);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, revenueKzt: r2(v.revenue), profitKzt: r2(v.profit), orders: v.orders.size }));
}
