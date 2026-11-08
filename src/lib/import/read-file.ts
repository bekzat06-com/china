import "server-only";
import Papa from "papaparse";
import ExcelJS from "exceljs";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

export interface TableData {
  headers: string[];
  rows: Record<string, string | number | null>[];
  truncated: boolean;
}

/** Текст CSV: UTF-8, а если в нём «битые» символы — пробуем Windows-1251 (частая кодировка русского Excel) */
function decodeText(buf: Buffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (!utf8.includes("�")) return utf8.replace(/^﻿/, "");
  return new TextDecoder("windows-1251").decode(buf);
}

function uniqueHeaders(raw: unknown[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    let name = String(h ?? "").trim() || `Колонка ${i + 1}`;
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    if (n > 0) name = `${name} (${n + 1})`;
    return name.slice(0, 120);
  });
}

function parseCsv(buf: Buffer): TableData {
  const text = decodeText(buf);
  const res = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  const [head = [], ...body] = res.data;
  const headers = uniqueHeaders(head);
  const rows = body.slice(0, MAX_IMPORT_ROWS).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null])));
  return { headers, rows, truncated: body.length > MAX_IMPORT_ROWS };
}

function cellValue(v: ExcelJS.CellValue): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "да" : "нет";
  if (v instanceof Date) {
    // Excel хранит «настенное» время без пояса; exceljs отдаёт его как UTC — переводим в строку Алматы
    const iso = v.toISOString();
    return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)} ${iso.slice(11, 16)}`;
  }
  if (typeof v === "object") {
    if ("result" in v) return cellValue(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    if ("error" in v) return null;
  }
  return String(v);
}

async function parseXlsx(buf: Buffer): Promise<TableData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("В файле нет листов");
  const all: (string | number | null)[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = (row.values as ExcelJS.CellValue[]).slice(1); // exceljs нумерует с 1
    all.push(values.map(cellValue));
  });
  const [head = [], ...body] = all;
  const headers = uniqueHeaders(head);
  const rows = body.slice(0, MAX_IMPORT_ROWS).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null])));
  return { headers, rows, truncated: body.length > MAX_IMPORT_ROWS };
}

export async function readTableFile(file: File): Promise<TableData> {
  if (file.size === 0) throw new Error("Файл пустой");
  if (file.size > MAX_IMPORT_BYTES) throw new Error("Файл больше 5 МБ — разделите его на части");
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseCsv(buf);
  if (name.endsWith(".xlsx")) {
    // проверка «подписи» ZIP — xlsx это zip-архив
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error("Файл не похож на Excel (.xlsx)");
    return parseXlsx(buf);
  }
  if (name.endsWith(".xls")) throw new Error("Старый формат .xls не поддерживается — сохраните файл как .xlsx или .csv");
  throw new Error("Поддерживаются файлы .xlsx и .csv");
}
