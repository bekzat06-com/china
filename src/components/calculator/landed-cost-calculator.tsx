"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save } from "lucide-react";
import { calculateLandedCost, type LandedCostInput, type LandedCostResult } from "@/lib/finance/landed-cost";
import { landedCostInputSchema } from "@/lib/finance/landed-cost-schema";
import { saveCalculationAction } from "@/app/actions/calculations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatKzt, formatPct } from "@/lib/utils";

type FormValues = Record<keyof LandedCostInput, string>;

export interface CalculatorProduct {
  id: string;
  name: string;
  sku: string;
  purchasePriceCny: number | null;
  salePriceKzt: number | null;
  kaspiCommissionPct: number | null;
  weightKg: number | null;
  volumeM3: number | null;
}

interface Props {
  defaults: LandedCostInput;
  products: CalculatorProduct[];
  initialProductId?: string;
  canSave: boolean;
}

const toForm = (i: LandedCostInput): FormValues =>
  Object.fromEntries(Object.entries(i).map(([k, v]) => [k, String(v)])) as FormValues;

function applyProduct(values: FormValues, p: CalculatorProduct | undefined): FormValues {
  if (!p) return values;
  const next = { ...values };
  if (p.purchasePriceCny != null) next.unitPriceCny = String(p.purchasePriceCny);
  if (p.salePriceKzt != null) next.salePriceKzt = String(p.salePriceKzt);
  if (p.kaspiCommissionPct != null) next.kaspiCommissionPct = String(p.kaspiCommissionPct);
  if (p.weightKg != null) next.unitWeightKg = String(p.weightKg);
  if (p.volumeM3 != null) next.unitVolumeM3 = String(Math.round(p.volumeM3 * 1e6) / 1e6);
  return next;
}

export function LandedCostCalculator({ defaults, products, initialProductId, canSave }: Props) {
  const router = useRouter();
  const [productId, setProductId] = useState(initialProductId ?? "");
  const [values, setValues] = useState<FormValues>(() =>
    applyProduct(toForm(defaults), products.find((p) => p.id === initialProductId)),
  );
  const [name, setName] = useState(() => products.find((p) => p.id === initialProductId)?.name ?? "");
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (k: keyof LandedCostInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  type Calc = { result: LandedCostResult | null; error: string | null; fieldErrors: Partial<Record<keyof LandedCostInput, string>> };
  const { result, error, fieldErrors } = useMemo<Calc>(() => {
    const parsed = landedCostInputSchema.safeParse(values);
    if (!parsed.success) {
      const fe: Partial<Record<keyof LandedCostInput, string>> = {};
      for (const i of parsed.error.issues) fe[i.path[0] as keyof LandedCostInput] ??= i.message;
      return { result: null, error: "Исправьте выделенные поля", fieldErrors: fe };
    }
    try {
      return { result: calculateLandedCost(parsed.data), error: null, fieldErrors: {} };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : "Ошибка расчёта", fieldErrors: {} };
    }
  }, [values]);

  const num = (k: keyof LandedCostInput, label: string, hint?: string, step = "any") => (
    <Field label={label} hint={hint} error={fieldErrors[k]}>
      <Input type="number" inputMode="decimal" min="0" step={step} value={values[k]} onChange={set(k)} className="tabular" />
    </Field>
  );

  function onProductChange(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    setValues((v) => applyProduct(v, p));
    if (p) setName(p.name);
  }

  function onSave() {
    setSaveMsg(null);
    startTransition(async () => {
      const res = await saveCalculationAction({
        name: name || "Расчёт без названия",
        productId: productId || null,
        inputs: landedCostInputSchema.parse(values),
      });
      setSaveMsg(res.ok ? { ok: true, text: "Расчёт сохранён" } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });
  }

  const mode = values.intlPricingMode;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Товар и закупка</CardTitle>
            <CardDescription>Выберите товар из каталога — его параметры подставятся автоматически</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Товар из каталога" className="sm:col-span-3">
              <Select value={productId} onChange={(e) => onProductChange(e.target.value)}>
                <option value="">— без привязки к товару —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </Select>
            </Field>
            {num("quantity", "Количество в партии, шт", undefined, "1")}
            {num("unitPriceCny", "Цена за единицу, ¥ CNY")}
            {num("lossRatePct", "Брак / потери, %", "Не будут проданы")}
            {num("cnyToKzt", "Курс CNY → KZT")}
            {num("usdToKzt", "Курс USD → KZT")}
            <div />
            {num("unitWeightKg", "Вес единицы, кг", "С упаковкой")}
            {num("unitVolumeM3", "Объём единицы, м³", "Д×Ш×В(см) / 1 000 000")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Логистика Китай → Казахстан</CardTitle>
            <CardDescription>Тарифы уточняйте у вашего карго — они меняются</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {num("chinaDomesticShippingCny", "Доставка по Китаю, ¥ за партию")}
            <Field label="Тариф международной доставки">
              <Select value={mode} onChange={set("intlPricingMode")}>
                <option value="PER_KG">За килограмм</option>
                <option value="PER_M3">За кубометр</option>
                <option value="MAX_KG_M3">Большее из кг и м³</option>
                <option value="FIXED">Фиксированная сумма</option>
              </Select>
            </Field>
            {(mode === "PER_KG" || mode === "MAX_KG_M3") && num("intlRateUsdPerKg", "Тариф, $ за кг")}
            {(mode === "PER_M3" || mode === "MAX_KG_M3") && num("intlRateUsdPerM3", "Тариф, $ за м³")}
            {mode === "FIXED" && num("intlFixedKzt", "Доставка, ₸ за партию")}
            {num("insurancePct", "Страховка, % от товара")}
            {num("deliveryToWarehouseKzt", "До вашего склада, ₸ за партию")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Таможня и сертификация</CardTitle>
            <CardDescription>
              Ставки зависят от кода ТН ВЭД, режима ввоза и условий карго. Если карго работает «под ключ» — оставьте 0.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="База для пошлины и НДС">
              <Select value={values.customsBase} onChange={set("customsBase")}>
                <option value="GOODS">Стоимость товара</option>
                <option value="GOODS_PLUS_SHIPPING">Товар + доставка + страховка</option>
              </Select>
            </Field>
            {num("customsDutyPct", "Таможенная пошлина, %")}
            {num("importVatPct", "Импортный НДС, %", "Если применим")}
            {num("customsFeesKzt", "Сборы / брокер, ₸ за партию")}
            {num("certificationKzt", "Сертификация, ₸ за партию")}
            <div />
            {num("intermediaryPct", "Посредник, % от товара")}
            {num("intermediaryFixedKzt", "Посредник, ₸ фикс.")}
            {num("packagingKztPerUnit", "Упаковка, ₸ за шт")}
            {num("otherBatchCostsKzt", "Прочее, ₸ за партию")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Продажа на Kaspi</CardTitle>
            <CardDescription>Комиссия Kaspi зависит от категории; налог — от вашего режима ИП</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {num("salePriceKzt", "Цена продажи, ₸")}
            {num("kaspiCommissionPct", "Комиссия Kaspi, %")}
            {num("sellerTaxPct", "Налог продавца, % от выручки")}
            {num("customerDeliveryKztPerUnit", "Доставка покупателю, ₸/шт", "Если платит продавец")}
            {num("adsKztPerUnit", "Реклама, ₸ на 1 продажу")}
            <div />
            {num("returnRatePct", "Доля возвратов, %")}
            {num("returnCostKztPerReturn", "Затраты на 1 возврат, ₸", "Логистика, уценка")}
          </CardContent>
        </Card>
      </div>

      {/* Результаты */}
      <div className="xl:sticky xl:top-20 xl:self-start">
        <Results result={result} error={error} />
        {result && canSave && (
          <Card className="mt-4">
            <CardContent className="flex flex-col gap-3 pt-5">
              <Field label="Название расчёта">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Органайзер, партия 200 шт" maxLength={200} />
              </Field>
              <Button onClick={onSave} disabled={pending}>
                <Save /> {pending ? "Сохранение…" : "Сохранить расчёт"}
              </Button>
              {saveMsg && <p className={cn("text-sm", saveMsg.ok ? "text-success" : "text-danger")}>{saveMsg.text}</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Results({ result: r, error }: { result: LandedCostResult | null; error: string | null }) {
  if (!r) {
    return (
      <Card className="p-5">
        <p className="text-sm text-danger">{error}</p>
      </Card>
    );
  }
  const profitable = r.profitPerUnitKzt >= 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Результат</CardTitle>
        <CardDescription>
          {r.sellableUnits} шт к продаже · {r.totalWeightKg} кг · {r.totalVolumeM3} м³
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Полная себестоимость / шт" value={formatKzt(r.fullCostPerUnitKzt)} />
          <Metric label="Прибыль / шт" value={formatKzt(r.profitPerUnitKzt)} tone={profitable ? "good" : "bad"} />
          <Metric label="Маржинальность" value={formatPct(r.marginPct)} tone={profitable ? undefined : "bad"} />
          <Metric label="Наценка" value={formatPct(r.markupPct)} />
          <Metric label="ROI" value={formatPct(r.roiPct)} />
          <Metric label="Прибыль с партии" value={formatKzt(r.batchProfitKzt)} tone={profitable ? "good" : "bad"} />
          <Metric label="Точка безубыточности" value={r.breakEvenUnits !== null ? `${r.breakEvenUnits} шт` : "—"} />
          <Metric label="Цена безубыточности" value={formatKzt(r.breakEvenPriceKzt)} />
        </div>
        <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Нужно денег на партию</span>
            <span className="tabular font-semibold">{formatKzt(r.workingCapitalKzt)}</span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>Себестоимость до склада / шт</span>
            <span className="tabular">{formatKzt(r.landedCostPerUnitKzt)}</span>
          </div>
        </div>

        {r.warnings.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {r.warnings.map((w) => (
              <p key={w} className="flex gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" /> {w}
              </p>
            ))}
          </div>
        )}

        <Breakdown title="Затраты до склада (на 1 шт)" lines={r.batchLines} total={r.landedCostPerUnitKzt} />
        <Breakdown title="Расходы на продажу (на 1 шт)" lines={r.sellingLines} total={r.sellingCostPerUnitKzt} />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Маржа = прибыль / цена. Наценка = прибыль / полная себестоимость. ROI = прибыль / вложения в единицу до склада.
          Расчёт не является налоговой консультацией — ставки проверьте у бухгалтера.
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("tabular mt-0.5 text-base font-semibold", tone === "good" && "text-success", tone === "bad" && "text-danger")}>{value}</p>
    </div>
  );
}

function Breakdown({ title, lines, total }: { title: string; lines: LandedCostResult["batchLines"]; total: number }) {
  const visible = lines.filter((l) => l.perUnitKzt !== 0);
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium">{title}</p>
      <div className="tabular flex flex-col gap-1 text-xs">
        {visible.map((l) => (
          <div key={l.key} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{l.label}</span>
            <span>{formatKzt(l.perUnitKzt)}</span>
          </div>
        ))}
        {visible.length === 0 && <span className="text-muted-foreground">—</span>}
        <div className="mt-0.5 flex justify-between border-t pt-1 font-medium">
          <span>Итого</span>
          <span>{formatKzt(total)}</span>
        </div>
      </div>
    </div>
  );
}
