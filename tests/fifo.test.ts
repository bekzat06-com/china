import { describe, it, expect } from "vitest";
import { allocateFifo } from "@/lib/inventory/fifo";

const b = (id: string, remaining: number, cost: number, day: number) => ({ id, remaining, unitCostKzt: cost, receivedAt: new Date(2026, 0, day) });

describe("allocateFifo", () => {
  it("списывает сначала из самой старой партии", () => {
    const r = allocateFifo([b("new", 10, 2000, 20), b("old", 5, 1000, 1)], 8);
    expect(r.allocations).toEqual([
      { batchId: "old", quantity: 5, unitCostKzt: 1000 },
      { batchId: "new", quantity: 3, unitCostKzt: 2000 },
    ]);
    expect(r.unitCostKzt).toBe(1375); // (5*1000 + 3*2000) / 8
    expect(r.shortage).toBe(0);
  });
  it("пропускает пустые партии и сообщает о нехватке", () => {
    const r = allocateFifo([b("a", 0, 500, 1), b("b", 2, 800, 2)], 5);
    expect(r.allocatedQty).toBe(2);
    expect(r.shortage).toBe(3);
    expect(r.unitCostKzt).toBe(800);
  });
  it("нет партий — себестоимость неизвестна", () => {
    expect(allocateFifo([], 1).unitCostKzt).toBeNull();
  });
  it("отклоняет неверное количество", () => {
    expect(() => allocateFifo([], 0)).toThrow();
    expect(() => allocateFifo([], 1.5)).toThrow();
  });
});
