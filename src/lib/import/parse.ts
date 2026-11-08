/**
 * Разбор и проверка строк импорта заказов (Excel/CSV).
 * Формат выгрузки Kaspi здесь НЕ «зашит»: пользователь сам сопоставляет колонки,
 * система лишь предлагает вариант по похожим названиям заголовков.
 */

export const IMPORT_FIELDS = [
  { key: "externalId", label: "Номер заказа", required: true },
  { key: "date", label: "Дата заказа", required: true },
  { key: "sku", label: "Артикул (SKU)", required: true },
  { key: "quantity", label: "Количество", required: true },
  { key: "price", label: "Цена за единицу, ₸", required: true },
  { key: "commission", label: "Комиссия, ₸ (за строку)", required: false },
  { key: "delivery", label: "Доставка, ₸ (за строку)", required: false },
  { key: "status", label: "Статус", required: false },
  { key: "city", label: "Город", required: false },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type ColumnMapping = Partial<Record<ImportFieldKey, string>>; // поле → название колонки в файле

// Похожие названия колонок — только подсказка, пользователь проверяет сопоставление
const HINTS: Record<ImportFieldKey, string[]> = {
  externalId: ["номер заказа", "№ заказа", "заказ", "order", "order id", "номер"],
  date: ["дата заказа", "дата", "date", "создан"],
  sku: ["артикул", "sku", "код товара", "код"],
  quantity: ["количество", "кол-во", "кол", "qty", "quantity", "шт"],
  price: ["цена за единицу", "цена", "price", "стоимость"],
  commission: ["комиссия", "commission"],
  delivery: ["доставка", "delivery"],
  status: ["статус", "status", "состояние"],
  city: ["город", "city"],
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  for (const field of IMPORT_FIELDS) {
    for (const hint of HINTS[field.key]) {
      const exact = headers.find((h) => !used.has(h) && norm(h) === hint);
      const partial = exact ?? headers.find((h) => !used.has(h) && norm(h).includes(hint));
      if (partial) {
        mapping[field.key] = partial;
        used.add(partial);
        break;
      }
    }
  }
  return mapping;
}

/** «1 234,56 ₸» → 1234.56; пусто → null; мусор → NaN */
export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const s = String(value)
    .replace(/[\s  ]/g, "")
    .replace(/[₸$¥]|тг|kzt/gi, "");
  if (s === "") return null;
  // «1.234,56» → «1234.56»; «1,234.56» → «1234.56»; «12,5» → «12.5»
  let cleaned = s;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else {
    cleaned = cleaned.replace(",", ".");
  }
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

/**
 * Даты: «08.11.2026», «08.11.2026 14:30», «2026-11-08», «2026-11-08T14:30», объект Date или
 * число Excel (дни с 1899-12-30). Время без пояса считается временем Алматы (UTC+5).
 */
export function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    if (value < 20000 || value > 80000) return null;
    return new Date(Math.round((value - 25569) * 86400_000) - 5 * 3600_000);
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, d, mo, y, h = "0", mi = "0", sec = "0"] = m;
    return almaty(+y, +mo, +d, +h, +mi, +sec);
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, y, mo, d, h = "0", mi = "0", sec = "0"] = m;
    return almaty(+y, +mo, +d, +h, +mi, +sec);
  }
  return null;
}

function almaty(y: number, mo: number, d: number, h: number, mi: number, s: number): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const date = new Date(Date.UTC(y, mo - 1, d, h - 5, mi, s));
  // защита от «31.02» → 3 марта
  const check = new Date(date.getTime() + 5 * 3600_000);
  if (check.getUTCDate() !== d || check.getUTCMonth() !== mo - 1) return null;
  return date;
}

export type OrderStatusValue = "COMPLETED" | "CANCELLED" | "RETURNED" | "NEW";

export function parseStatus(value: unknown): OrderStatusValue {
  const s = norm(String(value ?? ""));
  if (!s) return "COMPLETED";
  if (/отмен|cancel/.test(s)) return "CANCELLED";
  if (/возврат|return/.test(s)) return "RETURNED";
  if (/нов|ожида|обработ|new|pending/.test(s)) return "NEW";
  return "COMPLETED";
}

export interface ParsedOrderRow {
  rowNumber: number; // номер строки в файле (с учётом заголовка)
  externalId: string;
  orderedAt: Date;
  sku: string;
  quantity: number;
  unitPriceKzt: number;
  commissionKzt: number | null;
  deliveryKzt: number | null;
  status: OrderStatusValue;
  city: string | null;
}

export interface RowError {
  rowNumber: number;
  message: string;
}

export function validateRows(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping,
): { valid: ParsedOrderRow[]; errors: RowError[] } {
  const valid: ParsedOrderRow[] = [];
  const errors: RowError[] = [];
  const missing = IMPORT_FIELDS.filter((f) => f.required && !mapping[f.key]);
  if (missing.length) {
    return { valid, errors: [{ rowNumber: 0, message: `Не выбраны колонки: ${missing.map((f) => f.label).join(", ")}` }] };
  }
  const get = (row: Record<string, unknown>, key: ImportFieldKey) => (mapping[key] ? row[mapping[key]!] : undefined);
  const seen = new Set<string>();

  rows.forEach((row, i) => {
    const rowNumber = i + 2; // строка 1 — заголовок
    const problems: string[] = [];
    const externalId = String(get(row, "externalId") ?? "").trim();
    const sku = String(get(row, "sku") ?? "").trim();
    const orderedAt = parseDate(get(row, "date"));
    const quantity = parseNumber(get(row, "quantity"));
    const price = parseNumber(get(row, "price"));
    const commission = parseNumber(get(row, "commission"));
    const delivery = parseNumber(get(row, "delivery"));

    // полностью пустые строки пропускаем молча
    if (!externalId && !sku && quantity === null && price === null) return;

    if (!externalId) problems.push("нет номера заказа");
    if (externalId.length > 100) problems.push("слишком длинный номер заказа");
    if (!sku) problems.push("нет артикула");
    if (!orderedAt) problems.push("неверная дата");
    else if (orderedAt.getTime() > Date.now() + 86400_000) problems.push("дата в будущем");
    if (quantity === null || Number.isNaN(quantity) || !Number.isInteger(quantity) || quantity <= 0)
      problems.push("количество должно быть целым числом > 0");
    if (price === null || Number.isNaN(price) || price < 0) problems.push("неверная цена");
    if (commission !== null && (Number.isNaN(commission) || commission < 0)) problems.push("неверная комиссия");
    if (delivery !== null && (Number.isNaN(delivery) || delivery < 0)) problems.push("неверная доставка");
    const key = `${externalId}::${sku}`;
    if (externalId && sku && seen.has(key)) problems.push("повтор строки в файле");
    seen.add(key);

    if (problems.length) {
      errors.push({ rowNumber, message: problems.join("; ") });
      return;
    }
    valid.push({
      rowNumber,
      externalId,
      orderedAt: orderedAt!,
      sku,
      quantity: quantity!,
      unitPriceKzt: price!,
      commissionKzt: commission,
      deliveryKzt: delivery,
      status: parseStatus(get(row, "status")),
      city: String(get(row, "city") ?? "").trim().slice(0, 100) || null,
    });
  });
  return { valid, errors };
}
