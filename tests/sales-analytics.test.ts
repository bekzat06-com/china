import { describe, it, expect } from "vitest";
import { summarizeSales, productPerformance, dailySeries, type SaleRow } from "@/lib/finance/sales-analytics";

const row = (o: Partial<SaleRow>): SaleRow => ({
  orderId: "o1",
  orderedAt: new Date("2026-11-01T06:00:00Z"),
  status: "COMPLETED",
  productId: "p1",
  productName: "Товар 1",
  sku: "SKU1",
  quantity: 1,
  returnedQty: 0,
  unitPriceKzt: 1000,
  commissionKzt: 100,
  deliveryKzt: 50,
  unitCostKzt: 500,
  ...o,
});

describe("summarizeSales", () => {
  it("считает выручку, прибыль, средний чек и ROI", () => {
    const rows = [
      row({ orderId: "o1", quantity: 2, commissionKzt: 200 }),
      row({ orderId: "o2", productId: "p2", unitPriceKzt: 3000, unitCostKzt: 1000, commissionKzt: 300 }),
    ];
    const s = summarizeSales(rows, 500);
    expect(s.revenueKzt).toBe(5000);
    expect(s.cogsKzt).toBe(2000);
    expect(s.commissionKzt).toBe(500);
    expect(s.deliveryKzt).toBe(100);
    expect(s.grossProfitKzt).toBe(2400);
    expect(s.netProfitKzt).toBe(1900);
    expect(s.ordersCount).toBe(2);
    expect(s.averageCheckKzt).toBe(2500);
    expect(s.roiPct).toBe(95);
  });

  it("игнорирует отменённые заказы и учитывает возвраты", () => {
    const rows = [
      row({ orderId: "o1", status: "CANCELLED" }),
      row({ orderId: "o2", status: "RETURNED" }),
      row({ orderId: "o3", quantity: 2, returnedQty: 1, commissionKzt: 200 }),
    ];
    const s = summarizeSales(rows);
    expect(s.revenueKzt).toBe(1000);
    expect(s.unitsReturned).toBe(2);
    expect(s.ordersCount).toBe(1);
    // o2: выручки нет, но доставка 50 — расход; o3: 1000 − 500 − 100 − 50 = 350
    expect(s.netProfitKzt).toBe(300);
    expect(s.returnRatePct).toBeCloseTo(66.67, 2);
  });

  it("пустые данные — без деления на ноль", () => {
    const s = summarizeSales([]);
    expect(s.averageCheckKzt).toBeNull();
    expect(s.roiPct).toBeNull();
  });
});

describe("productPerformance + ABC", () => {
  it("находит убыточные и делит на классы A/B/C", () => {
    const rows = [
      row({ productId: "a", unitPriceKzt: 10000, unitCostKzt: 1000, commissionKzt: 0, deliveryKzt: 0 }),
      row({ productId: "b", unitPriceKzt: 1500, unitCostKzt: 1000, commissionKzt: 0, deliveryKzt: 0 }),
      row({ productId: "c", unitPriceKzt: 500, unitCostKzt: 1000, commissionKzt: 0, deliveryKzt: 0 }),
    ];
    const list = productPerformance(rows);
    expect(list.map((p) => p.productId)).toEqual(["a", "b", "c"]);
    expect(list[0].abcClass).toBe("A");
    expect(list[1].abcClass).toBe("B"); // 9000 из 9500 = 94.7% до него
    expect(list[2].abcClass).toBe("C");
    expect(list[2].profitKzt).toBe(-500);
  });
});

describe("dailySeries", () => {
  it("заполняет дни без продаж нулями и группирует по времени Алматы", () => {
    const from = new Date("2026-11-01T00:00:00Z");
    const to = new Date("2026-11-03T00:00:00Z");
    const s = dailySeries([row({ orderedAt: new Date("2026-11-01T20:00:00Z") })], from, to);
    // 20:00 UTC = 01:00 следующего дня в Алматы
    expect(s.find((d) => d.date === "2026-11-02")!.revenueKzt).toBe(1000);
    expect(s.find((d) => d.date === "2026-11-01")!.revenueKzt).toBe(0);
  });
});
