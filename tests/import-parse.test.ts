import { describe, it, expect } from "vitest";
import { guessMapping, parseDate, parseNumber, parseStatus, validateRows } from "@/lib/import/parse";

describe("parseNumber", () => {
  it("понимает русский и английский формат", () => {
    expect(parseNumber("1 234,56")).toBe(1234.56);
    expect(parseNumber("1 234 ₸")).toBe(1234);
    expect(parseNumber("1.234,5")).toBe(1234.5);
    expect(parseNumber("1,234.5")).toBe(1234.5);
    expect(parseNumber("12,5")).toBe(12.5);
    expect(parseNumber(42)).toBe(42);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNaN();
  });
});

describe("parseDate", () => {
  it("dd.mm.yyyy и время Алматы", () => {
    expect(parseDate("08.11.2026 14:30")!.toISOString()).toBe("2026-11-08T09:30:00.000Z");
    expect(parseDate("2026-11-08")!.toISOString()).toBe("2026-11-07T19:00:00.000Z");
  });
  it("число Excel", () => {
    // 46334 = 08.11.2026
    expect(parseDate(46334)!.toISOString()).toBe("2026-11-07T19:00:00.000Z");
  });
  it("отклоняет несуществующие даты", () => {
    expect(parseDate("31.02.2026")).toBeNull();
    expect(parseDate("вчера")).toBeNull();
  });
});

describe("parseStatus", () => {
  it("распознаёт статусы", () => {
    expect(parseStatus("Отменён")).toBe("CANCELLED");
    expect(parseStatus("Возврат")).toBe("RETURNED");
    expect(parseStatus("Выдан")).toBe("COMPLETED");
    expect(parseStatus("")).toBe("COMPLETED");
    expect(parseStatus("Новый")).toBe("NEW");
  });
});

describe("guessMapping", () => {
  it("подбирает колонки по заголовкам", () => {
    const m = guessMapping(["Номер заказа", "Дата заказа", "Артикул", "Кол-во", "Цена, тг", "Статус", "Город доставки"]);
    expect(m).toMatchObject({ externalId: "Номер заказа", date: "Дата заказа", sku: "Артикул", quantity: "Кол-во", price: "Цена, тг", status: "Статус", city: "Город доставки" });
  });
});

describe("validateRows", () => {
  const mapping = { externalId: "N", date: "D", sku: "S", quantity: "Q", price: "P" };
  it("отделяет корректные строки от ошибочных", () => {
    const { valid, errors } = validateRows(
      [
        { N: "100", D: "01.11.2026", S: "A-1", Q: "2", P: "4 990" },
        { N: "101", D: "31.02.2026", S: "A-1", Q: "1", P: "100" },
        { N: "102", D: "01.11.2026", S: "", Q: "1,5", P: "-1" },
        { N: "", D: "", S: "", Q: "", P: "" },
        { N: "100", D: "01.11.2026", S: "A-1", Q: "1", P: "1" },
      ],
      mapping,
    );
    expect(valid).toHaveLength(1);
    expect(valid[0]).toMatchObject({ externalId: "100", quantity: 2, unitPriceKzt: 4990, rowNumber: 2 });
    expect(errors.map((e) => e.rowNumber)).toEqual([3, 4, 6]);
    expect(errors[1].message).toMatch(/артикул/);
    expect(errors[2].message).toMatch(/повтор/);
  });
  it("требует обязательные колонки", () => {
    const { errors } = validateRows([{}], { externalId: "N" });
    expect(errors[0].message).toMatch(/Не выбраны колонки/);
  });
});
