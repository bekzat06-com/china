/**
 * Расчёт остатков по движениям склада.
 * Остаток никогда не считается «на глаз» — только из журнала движений.
 */

export type MovementKind = "IN" | "OUT" | "RESERVE" | "UNRESERVE" | "RETURN" | "ADJUST";

export interface MovementLike {
  type: MovementKind;
  quantity: number; // для ADJUST может быть отрицательным (списание при инвентаризации)
}

export interface StockLevel {
  onHand: number; // физически на складе
  reserved: number; // в резерве под заказы
  available: number; // можно продать
}

export function computeStock(movements: MovementLike[]): StockLevel {
  let onHand = 0;
  let reserved = 0;
  for (const m of movements) {
    switch (m.type) {
      case "IN":
      case "RETURN":
        onHand += m.quantity;
        break;
      case "OUT":
        onHand -= m.quantity;
        break;
      case "ADJUST":
        onHand += m.quantity;
        break;
      case "RESERVE":
        reserved += m.quantity;
        break;
      case "UNRESERVE":
        reserved -= m.quantity;
        break;
    }
  }
  reserved = Math.max(0, reserved);
  return { onHand, reserved, available: onHand - reserved };
}

export class NegativeStockError extends Error {
  constructor(public available: number, public requested: number) {
    super(`Недостаточно товара: доступно ${available}, требуется ${requested}`);
  }
}

/** Проверка перед списанием: отрицательный остаток запрещён, если явно не разрешён */
export function assertCanRemove(level: StockLevel, qty: number, allowNegative = false) {
  if (!allowNegative && qty > level.available) throw new NegativeStockError(level.available, qty);
}

export interface ReorderAdvice {
  daysOfCover: number | null; // на сколько дней хватит остатка
  status: "OUT" | "LOW" | "OK" | "NO_SALES";
  suggestedQty: number;
}

/**
 * Рекомендация по дозакупке.
 * @param avgDailySales средние продажи в день за период анализа
 * @param leadTimeDays срок поставки из Китая (производство + доставка)
 * @param safetyDays страховой запас в днях
 */
export function reorderAdvice(
  available: number,
  minStock: number,
  avgDailySales: number,
  leadTimeDays = 30,
  safetyDays = 14,
): ReorderAdvice {
  if (available <= 0) {
    const need = Math.ceil(avgDailySales * (leadTimeDays + safetyDays));
    return { daysOfCover: 0, status: "OUT", suggestedQty: Math.max(need, minStock) };
  }
  if (avgDailySales <= 0) {
    return { daysOfCover: null, status: available <= minStock ? "LOW" : "NO_SALES", suggestedQty: 0 };
  }
  const daysOfCover = available / avgDailySales;
  const target = Math.ceil(avgDailySales * (leadTimeDays + safetyDays));
  const low = daysOfCover < leadTimeDays + safetyDays || available <= minStock;
  return {
    daysOfCover: Math.round(daysOfCover * 10) / 10,
    status: low ? "LOW" : "OK",
    suggestedQty: low ? Math.max(0, target - available) : 0,
  };
}
