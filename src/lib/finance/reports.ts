/**
 * Отчёты: прибыль по месяцам, XYZ-анализ, оборачиваемость, план закупок под бюджет.
 * Чистые функции — данные передаются из базы, ничего не выдумывается.
 */
import { rowFinancials, type SaleRow } from "./sales-analytics";

const r2 = (n: number) => Math.round(n * 100) / 100;
const ALMATY_MS = 5 * 3600_000;
const DAY = 86400_000;

export interface MonthlyPnl {
  month: string; // YYYY-MM (по времени Алматы)
  revenueKzt: number;
  cogsKzt: number;
  commissionKzt: number;
  deliveryKzt: number;
  expensesKzt: number;
  netProfitKzt: number;
  orders: number;
  marginPct: number | null;
}

export function monthlyPnl(rows: SaleRow[], expenses: { date: Date; amountKzt: number }[]): MonthlyPnl[] {
  const key = (d: Date) => new Date(d.getTime() + ALMATY_MS).toISOString().slice(0, 7);
  const map = new Map<string, { rev: number; cogs: number; com: number; del: number; exp: number; orders: Set<string> }>();
  const get = (k: string) => {
    let v = map.get(k);
    if (!v) map.set(k, (v = { rev: 0, cogs: 0, com: 0, del: 0, exp: 0, orders: new Set() }));
    return v;
  };
  for (const row of rows) {
    if (row.status === "CANCELLED") continue;
    const f = rowFinancials(row);
    const m = get(key(row.orderedAt));
    m.rev += f.revenue;
    m.cogs += f.cost;
    m.com += f.commission;
    m.del += f.delivery;
    if (f.units > 0) m.orders.add(row.orderId);
  }
  for (const e of expenses) get(key(e.date)).exp += e.amountKzt;
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => {
      const net = v.rev - v.cogs - v.com - v.del - v.exp;
      return {
        month,
        revenueKzt: r2(v.rev),
        cogsKzt: r2(v.cogs),
        commissionKzt: r2(v.com),
        deliveryKzt: r2(v.del),
        expensesKzt: r2(v.exp),
        netProfitKzt: r2(net),
        orders: v.orders.size,
        marginPct: v.rev > 0 ? r2((net / v.rev) * 100) : null,
      };
    });
}

export type XyzClass = "X" | "Y" | "Z";

export interface XyzResult {
  productId: string;
  weeks: number;
  meanWeekly: number;
  cvPct: number | null; // коэффициент вариации спроса
  xyzClass: XyzClass | null; // null — недостаточно данных
}

/**
 * XYZ-анализ по недельным продажам.
 * X — стабильный спрос (вариация ≤ 25%), Y — колеблющийся (25–50%), Z — нерегулярный (> 50%).
 * Требуется минимум `minWeeks` полных недель истории — иначе «Недостаточно данных».
 */
export function xyzAnalysis(
  rows: SaleRow[],
  periodEnd: Date,
  weeks = 12,
  minWeeks = 8,
  firstSaleByProduct?: Map<string, Date>,
): Map<string, XyzResult> {
  const start = periodEnd.getTime() - weeks * 7 * DAY;
  const byProduct = new Map<string, number[]>();
  for (const row of rows) {
    if (row.status === "CANCELLED") continue;
    const t = row.orderedAt.getTime();
    if (t < start || t > periodEnd.getTime()) continue;
    const w = Math.min(weeks - 1, Math.floor((t - start) / (7 * DAY)));
    const arr = byProduct.get(row.productId) ?? Array(weeks).fill(0);
    arr[w] += rowFinancials(row).units;
    byProduct.set(row.productId, arr);
  }
  const out = new Map<string, XyzResult>();
  for (const [productId, series] of byProduct) {
    // учитываем только недели после первой продажи товара (иначе новые товары выглядят «нерегулярными»)
    const first = firstSaleByProduct?.get(productId);
    const firstWeek = first ? Math.max(0, Math.floor((first.getTime() - start) / (7 * DAY))) : 0;
    const active = series.slice(firstWeek);
    const n = active.length;
    const mean = n ? active.reduce((s, v) => s + v, 0) / n : 0;
    if (n < minWeeks || mean === 0) {
      out.set(productId, { productId, weeks: n, meanWeekly: r2(mean), cvPct: null, xyzClass: null });
      continue;
    }
    const sd = Math.sqrt(active.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
    const cv = (sd / mean) * 100;
    out.set(productId, {
      productId,
      weeks: n,
      meanWeekly: r2(mean),
      cvPct: r2(cv),
      xyzClass: cv <= 25 ? "X" : cv <= 50 ? "Y" : "Z",
    });
  }
  return out;
}

/** Оборачиваемость в днях: за сколько дней продаётся текущий запас при нынешнем темпе продаж */
export function turnoverDays(stockValueKzt: number, cogsKzt: number, periodDays: number): number | null {
  if (cogsKzt <= 0 || periodDays <= 0) return null;
  return r2(stockValueKzt / (cogsKzt / periodDays));
}

export interface PurchaseCandidate {
  productId: string;
  name: string;
  suggestedQty: number;
  unitCostKzt: number | null;
  profitPerUnitKzt: number | null; // фактическая прибыль на единицу за период
  status: "OUT" | "LOW" | "OK" | "NO_SALES";
}

export interface PurchasePlanLine extends PurchaseCandidate {
  costKzt: number | null;
  fitsBudget: boolean;
  reason: string;
}

/**
 * План закупок под бюджет: сначала то, чего нет в наличии, затем то, что заканчивается;
 * внутри группы — по прибыли на единицу. Убыточные позиции не рекомендуются.
 */
export function purchasePlan(candidates: PurchaseCandidate[], budgetKzt: number): { lines: PurchasePlanLine[]; totalKzt: number; leftKzt: number } {
  const rank = { OUT: 0, LOW: 1, OK: 2, NO_SALES: 3 } as const;
  const sorted = candidates
    .filter((c) => c.suggestedQty > 0)
    .sort((a, b) => rank[a.status] - rank[b.status] || (b.profitPerUnitKzt ?? -Infinity) - (a.profitPerUnitKzt ?? -Infinity));
  let left = budgetKzt;
  let total = 0;
  const lines = sorted.map((c): PurchasePlanLine => {
    const cost = c.unitCostKzt !== null ? r2(c.unitCostKzt * c.suggestedQty) : null;
    if (c.profitPerUnitKzt !== null && c.profitPerUnitKzt <= 0) {
      return { ...c, costKzt: cost, fitsBudget: false, reason: "Убыточен — сначала пересмотрите цену или себестоимость" };
    }
    if (cost === null) return { ...c, costKzt: null, fitsBudget: false, reason: "Неизвестна себестоимость единицы" };
    if (cost <= left) {
      left -= cost;
      total += cost;
      const reason =
        c.profitPerUnitKzt === null
          ? "Продаж за период не было — закупка только до минимального остатка"
          : c.status === "OUT"
            ? "Нет в наличии, товар продаётся"
            : "Запас заканчивается";
      return { ...c, costKzt: cost, fitsBudget: true, reason };
    }
    return { ...c, costKzt: cost, fitsBudget: false, reason: "Не помещается в оставшийся бюджет" };
  });
  return { lines, totalKzt: r2(total), leftKzt: r2(left) };
}
