import { describe, it, expect } from "vitest";
import { computeStock, assertCanRemove, reorderAdvice, NegativeStockError } from "@/lib/inventory/stock";

describe("computeStock", () => {
  it("считает остаток, резерв и доступно", () => {
    const s = computeStock([
      { type: "IN", quantity: 100 },
      { type: "OUT", quantity: 30 },
      { type: "RETURN", quantity: 2 },
      { type: "RESERVE", quantity: 5 },
      { type: "ADJUST", quantity: -1 },
    ]);
    expect(s).toEqual({ onHand: 71, reserved: 5, available: 66 });
  });

  it("запрещает отрицательный остаток без явного разрешения", () => {
    const level = { onHand: 3, reserved: 0, available: 3 };
    expect(() => assertCanRemove(level, 5)).toThrow(NegativeStockError);
    expect(() => assertCanRemove(level, 5, true)).not.toThrow();
  });
});

describe("reorderAdvice", () => {
  it("рекомендует дозакупку при низком запасе", () => {
    const a = reorderAdvice(20, 5, 2, 30, 14); // хватит на 10 дней, нужно 44
    expect(a.status).toBe("LOW");
    expect(a.daysOfCover).toBe(10);
    expect(a.suggestedQty).toBe(68); // 2*44 − 20
  });
  it("нет продаж — нет рекомендации закупать", () => {
    expect(reorderAdvice(50, 5, 0).status).toBe("NO_SALES");
  });
  it("нет товара", () => {
    expect(reorderAdvice(0, 10, 1).status).toBe("OUT");
  });
});
