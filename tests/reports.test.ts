import { describe, it, expect } from "vitest";
import { monthlyPnl, purchasePlan, turnoverDays, xyzAnalysis } from "@/lib/finance/reports";
import type { SaleRow } from "@/lib/finance/sales-analytics";

const row = (o: Partial<SaleRow>): SaleRow => ({
  orderId: "o", orderedAt: new Date("2026-10-15T06:00:00Z"), status: "COMPLETED", productId: "p", productName: "P", sku: "P",
  quantity: 1, returnedQty: 0, unitPriceKzt: 1000, commissionKzt: 100, deliveryKzt: 0, unitCostKzt: 500, ...o,
});

describe("monthlyPnl", () => {
  it("группирует по месяцам времени Алматы и вычитает расходы", () => {
    const res = monthlyPnl(
      [row({ orderId: "a" }), row({ orderId: "b", orderedAt: new Date("2026-10-31T20:00:00Z") })], // 01.11 по Алматы
      [{ date: new Date("2026-10-10T06:00:00Z"), amountKzt: 100 }],
    );
    expect(res.map((m) => m.month)).toEqual(["2026-10", "2026-11"]);
    expect(res[0].netProfitKzt).toBe(300); // 1000 − 500 − 100 − 100
    expect(res[1].orders).toBe(1);
  });
});

describe("xyzAnalysis", () => {
  const end = new Date("2026-11-08T00:00:00Z");
  const weekly = (pid: string, counts: number[]) =>
    counts.flatMap((c, w) => (c ? [row({ productId: pid, orderId: `${pid}${w}`, quantity: c, orderedAt: new Date(end.getTime() - (counts.length - w - 0.5) * 7 * 86400_000) })] : []));
  it("X — стабильный, Z — нерегулярный", () => {
    const rows = [...weekly("stable", Array(12).fill(5)), ...weekly("spiky", [0, 0, 20, 0, 0, 0, 15, 0, 0, 0, 0, 10])];
    const r = xyzAnalysis(rows, end);
    expect(r.get("stable")!.xyzClass).toBe("X");
    expect(r.get("spiky")!.xyzClass).toBe("Z");
  });
  it("мало истории — недостаточно данных", () => {
    const rows = weekly("new", [3, 3, 3]);
    const first = new Map([["new", rows[0].orderedAt]]);
    const r = xyzAnalysis(rows, end, 12, 8, new Map([["new", new Date(end.getTime() - 3 * 7 * 86400_000)]]));
    expect(first.size).toBe(1);
    expect(r.get("new")!.xyzClass).toBeNull();
  });
});

describe("turnoverDays", () => {
  it("остаток 30 000 при себестоимости продаж 1 000/день → 30 дней", () => {
    expect(turnoverDays(30000, 30000, 30)).toBe(30);
    expect(turnoverDays(100, 0, 30)).toBeNull();
  });
});

describe("purchasePlan", () => {
  it("приоритет: нет в наличии → заканчивается; убыточные и сверх бюджета не берёт", () => {
    const plan = purchasePlan(
      [
        { productId: "low", name: "Low", suggestedQty: 10, unitCostKzt: 1000, profitPerUnitKzt: 2000, status: "LOW" },
        { productId: "out", name: "Out", suggestedQty: 20, unitCostKzt: 1000, profitPerUnitKzt: 500, status: "OUT" },
        { productId: "loss", name: "Loss", suggestedQty: 5, unitCostKzt: 100, profitPerUnitKzt: -50, status: "OUT" },
        { productId: "big", name: "Big", suggestedQty: 100, unitCostKzt: 1000, profitPerUnitKzt: 100, status: "LOW" },
      ],
      35000,
    );
    expect(plan.lines.map((l) => [l.productId, l.fitsBudget])).toEqual([
      ["out", true], ["loss", false], ["low", true], ["big", false],
    ]);
    expect(plan.totalKzt).toBe(30000);
    expect(plan.leftKzt).toBe(5000);
  });
});
