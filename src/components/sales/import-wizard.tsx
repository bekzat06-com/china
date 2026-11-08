"use client";
import { useState, useTransition } from "react";
import { CheckCircle2, FileSpreadsheet, TriangleAlert } from "lucide-react";
import { parseImportFileAction, runImportAction, type ImportSummary, type ParseFileResult } from "@/app/actions/import";
import { IMPORT_FIELDS, type ColumnMapping } from "@/lib/import/parse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatKzt } from "@/lib/utils";

type Parsed = Extract<ParseFileResult, { ok: true }>;

export function ImportWizard() {
  const [file, setFile] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [deductStock, setDeductStock] = useState(true);
  const [check, setCheck] = useState<ImportSummary | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setFile(null); setCheck(null); setResult(null); setError(null); setMapping({});
  }

  function onUpload(formData: FormData) {
    reset();
    start(async () => {
      const res = await parseImportFileAction(formData);
      if (!res.ok) return setError(res.error);
      setFile(res);
      setMapping(res.mapping);
    });
  }

  function run(dryRun: boolean) {
    if (!file) return;
    if (!dryRun && !window.confirm(`Загрузить ${check?.ordersToCreate ?? 0} заказов${deductStock ? " и списать товар со склада" : ""}? Отменить загрузку целиком нельзя — только по одному заказу.`)) return;
    setError(null);
    start(async () => {
      const res = await runImportAction({ fileName: file.fileName, rows: file.rows, mapping, deductStock, dryRun });
      if (!res.ok) return setError(res.error ?? "Ошибка импорта");
      if (dryRun) setCheck(res);
      else setResult(res);
    });
  }

  if (result) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 pt-5">
          <p className="flex items-center gap-2 text-lg font-semibold"><CheckCircle2 className="size-5 text-success" /> Загружено заказов: {result.created}</p>
          {result.skippedDuplicates > 0 && <p className="text-sm text-muted-foreground">Пропущено уже загруженных ранее: {result.skippedDuplicates}</p>}
          <Problems summary={result} />
          <div><Button variant="outline" onClick={reset}>Загрузить ещё файл</Button></div>
        </CardContent>
      </Card>
    );
  }

  const preview = file?.rows.slice(0, 5) ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>1. Файл</CardTitle>
          <CardDescription>
            Excel (.xlsx) или CSV, до 5 МБ и 5 000 строк. Первая строка — заголовки. Одна строка = один товар в заказе;
            строки с одинаковым номером заказа объединяются. <a href={`/api/export/import-template`} download className="text-primary hover:underline">Скачать шаблон</a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={onUpload} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Файл с заказами" className="flex-1">
              <Input name="file" type="file" accept=".xlsx,.csv,.txt" required />
            </Field>
            <Button disabled={pending}><FileSpreadsheet /> {pending && !file ? "Чтение…" : "Прочитать файл"}</Button>
          </form>
        </CardContent>
      </Card>

      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {file && (
        <Card>
          <CardHeader>
            <CardTitle>2. Сопоставьте колонки</CardTitle>
            <CardDescription>
              Файл «{file.fileName}»: {file.rows.length} строк{file.truncated ? " (показаны первые 5 000 — остальное загрузите отдельным файлом)" : ""}.
              Колонки подобраны автоматически по названиям — проверьте их.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {IMPORT_FIELDS.map((f) => (
                <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`}>
                  <Select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => { setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined })); setCheck(null); }}
                  >
                    <option value="">— не загружать —</option>
                    {file.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-4" checked={deductStock} onChange={(e) => { setDeductStock(e.target.checked); setCheck(null); }} />
              <span>
                Списывать товар со склада.
                <span className="block text-xs text-muted-foreground">Снимите галочку, если загружаете старые продажи, которых не было в складском учёте (тогда себестоимость возьмётся из последней партии или расчёта).</span>
              </span>
            </label>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Предпросмотр (первые 5 строк)</p>
              <Table>
                <THead><TR>{IMPORT_FIELDS.filter((f) => mapping[f.key]).map((f) => <TH key={f.key}>{f.label}</TH>)}</TR></THead>
                <TBody>
                  {preview.map((r, i) => (
                    <TR key={i}>{IMPORT_FIELDS.filter((f) => mapping[f.key]).map((f) => <TD key={f.key} className="text-xs">{String(r[mapping[f.key]!] ?? "")}</TD>)}</TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <div><Button onClick={() => run(true)} disabled={pending}>{pending && !check ? "Проверка…" : "3. Проверить без загрузки"}</Button></div>
          </CardContent>
        </Card>
      )}

      {check && (
        <Card>
          <CardHeader>
            <CardTitle>4. Результат проверки</CardTitle>
            <CardDescription>В базу пока ничего не записано.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <dl className="tabular grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">Новых заказов</dt><dd className="text-lg font-semibold">{check.ordersToCreate}</dd></div>
              <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">Строк товаров</dt><dd className="text-lg font-semibold">{check.itemsToCreate}</dd></div>
              <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">Уже загружены ранее</dt><dd className="text-lg font-semibold">{check.skippedDuplicates}</dd></div>
              <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">Выручка</dt><dd className="text-lg font-semibold">{formatKzt(check.revenueKzt)}</dd></div>
            </dl>
            <Problems summary={check} />
            <div>
              <Button onClick={() => run(false)} disabled={pending || check.ordersToCreate === 0}>
                {pending ? "Загрузка…" : `Загрузить ${check.ordersToCreate} заказов`}
              </Button>
              {check.errors.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Строки с ошибками будут пропущены.</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Problems({ summary }: { summary: ImportSummary }) {
  return (
    <>
      {summary.warnings.map((w) => (
        <p key={w} className="flex gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs"><TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />{w}</p>
      ))}
      {summary.errors.length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded-lg border">
          <Table>
            <THead><TR><TH>Строка</TH><TH>Ошибка</TH></TR></THead>
            <TBody>
              {summary.errors.map((e, i) => <TR key={i}><TD className="text-xs">{e.rowNumber || "—"}</TD><TD className="text-xs text-danger">{e.message}</TD></TR>)}
            </TBody>
          </Table>
        </div>
      )}
    </>
  );
}
