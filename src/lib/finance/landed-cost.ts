/**
 * Калькулятор полной себестоимости (Landed Cost) товара Китай → Казахстан → покупатель Kaspi.
 *
 * Важно: здесь НЕТ «зашитых» ставок налогов, пошлин и комиссий.
 * Все ставки передаются во входных данных — пользователь задаёт их под свой
 * налоговый режим, категорию товара и условия доставки.
 *
 * Модель расчёта:
 * 1. Затраты на партию (до склада): товар + доставка по Китаю + международная доставка
 *    + таможня (пошлина, импортный НДС, сборы) + сертификация + посредник + упаковка
 *    + доставка до склада + прочее.
 * 2. Потери (брак/утеря) уменьшают количество единиц, пригодных к продаже.
 *    Себестоимость до склада = затраты на партию / пригодные единицы.
 * 3. Переменные расходы на продажу одной единицы: комиссия Kaspi, доставка покупателю,
 *    налог продавца, реклама, ожидаемая стоимость возвратов.
 * 4. Полная себестоимость единицы = себестоимость до склада + расходы на продажу.
 */

export type InternationalPricingMode =
  | "PER_KG" // тариф за кг
  | "PER_M3" // тариф за кубометр
  | "MAX_KG_M3" // берётся большее из двух (типично для карго)
  | "FIXED"; // фиксированная сумма за партию

export type CustomsBase =
  | "GOODS" // таможенная стоимость = стоимость товара
  | "GOODS_PLUS_SHIPPING"; // товар + доставка по Китаю + международная доставка

export interface LandedCostInput {
  // Закупка
  quantity: number; // штук в партии
  unitPriceCny: number; // цена за единицу у поставщика, CNY
  cnyToKzt: number; // курс 1 CNY в KZT
  usdToKzt: number; // курс 1 USD в KZT

  // Габариты единицы (с упаковкой)
  unitWeightKg: number;
  unitVolumeM3: number;

  // Логистика
  chinaDomesticShippingCny: number; // доставка по Китаю до склада карго, за партию
  intlPricingMode: InternationalPricingMode;
  intlRateUsdPerKg: number;
  intlRateUsdPerM3: number;
  intlFixedKzt: number; // для режима FIXED
  insurancePct: number; // страховка груза, % от стоимости товара
  deliveryToWarehouseKzt: number; // доставка от карго до вашего склада, за партию

  // Таможня (0, если карго работает «под ключ» и всё включено в тариф)
  customsBase: CustomsBase;
  customsDutyPct: number; // ставка пошлины для вашей категории (ТН ВЭД)
  importVatPct: number; // импортный НДС, если применим
  customsFeesKzt: number; // сборы, брокер, за партию

  // Прочие затраты на партию
  certificationKzt: number; // сертификация / декларация соответствия
  intermediaryPct: number; // комиссия посредника/байера, % от стоимости товара
  intermediaryFixedKzt: number;
  packagingKztPerUnit: number;
  otherBatchCostsKzt: number;
  lossRatePct: number; // % брака/утери — эти единицы не будут проданы

  // Продажа
  salePriceKzt: number; // цена продажи на Kaspi
  kaspiCommissionPct: number; // комиссия Kaspi для вашей категории
  customerDeliveryKztPerUnit: number; // доставка покупателю за счёт продавца
  sellerTaxPct: number; // налог продавца, % от выручки (зависит от режима)
  adsKztPerUnit: number; // реклама на единицу
  returnRatePct: number; // доля возвратов, %
  returnCostKztPerReturn: number; // затраты на один возврат (логистика, уценка)
}

export interface CostLine {
  key: string;
  label: string;
  perUnitKzt: number; // на одну проданную (пригодную) единицу
  batchKzt: number; // на всю партию
}

export interface LandedCostResult {
  sellableUnits: number;
  totalWeightKg: number;
  totalVolumeM3: number;

  // Затраты партии до склада
  batchLines: CostLine[];
  batchCostKzt: number; // = потребность в оборотном капитале на закупку
  landedCostPerUnitKzt: number;

  // Переменные расходы на продажу единицы
  sellingLines: CostLine[];
  sellingCostPerUnitKzt: number;

  fullCostPerUnitKzt: number;
  profitPerUnitKzt: number;
  marginPct: number | null; // прибыль / цена продажи
  markupPct: number | null; // (цена − полная себестоимость) / полная себестоимость
  roiPct: number | null; // прибыль с единицы / вложения в единицу (себестоимость до склада)
  batchRevenueKzt: number;
  batchProfitKzt: number;
  breakEvenUnits: number | null; // сколько единиц продать, чтобы вернуть вложения в партию
  breakEvenPriceKzt: number | null; // цена, при которой прибыль = 0
  workingCapitalKzt: number;
  warnings: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function assertNonNegative(input: LandedCostInput) {
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "number") {
      if (!Number.isFinite(v)) throw new Error(`Поле ${k}: значение должно быть числом`);
      if (v < 0) throw new Error(`Поле ${k}: значение не может быть отрицательным`);
    }
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new Error("Количество должно быть целым числом не меньше 1");
  }
  if (input.lossRatePct >= 100) throw new Error("Процент потерь должен быть меньше 100");
  if (input.returnRatePct > 100) throw new Error("Процент возвратов не может быть больше 100");
}

export function calculateLandedCost(input: LandedCostInput): LandedCostResult {
  assertNonNegative(input);
  const warnings: string[] = [];
  const q = input.quantity;

  const sellableUnits = Math.floor(q * (1 - input.lossRatePct / 100));
  if (sellableUnits < 1) throw new Error("После учёта потерь не остаётся единиц для продажи");

  const totalWeightKg = input.unitWeightKg * q;
  const totalVolumeM3 = input.unitVolumeM3 * q;

  // 1. Товар
  const goodsKzt = input.unitPriceCny * q * input.cnyToKzt;
  // 2. Доставка по Китаю
  const chinaShippingKzt = input.chinaDomesticShippingCny * input.cnyToKzt;
  // 3. Международная доставка
  const byKg = totalWeightKg * input.intlRateUsdPerKg * input.usdToKzt;
  const byM3 = totalVolumeM3 * input.intlRateUsdPerM3 * input.usdToKzt;
  let intlKzt: number;
  switch (input.intlPricingMode) {
    case "PER_KG":
      intlKzt = byKg;
      break;
    case "PER_M3":
      intlKzt = byM3;
      break;
    case "MAX_KG_M3":
      intlKzt = Math.max(byKg, byM3);
      break;
    case "FIXED":
      intlKzt = input.intlFixedKzt;
      break;
  }
  const insuranceKzt = (goodsKzt * input.insurancePct) / 100;

  // 4. Таможня
  const customsValue =
    input.customsBase === "GOODS" ? goodsKzt : goodsKzt + chinaShippingKzt + intlKzt + insuranceKzt;
  const dutyKzt = (customsValue * input.customsDutyPct) / 100;
  // Импортный НДС начисляется на таможенную стоимость + пошлину
  const importVatKzt = ((customsValue + dutyKzt) * input.importVatPct) / 100;

  // 5. Прочее
  const intermediaryKzt = (goodsKzt * input.intermediaryPct) / 100 + input.intermediaryFixedKzt;
  const packagingKzt = input.packagingKztPerUnit * q;

  const batchRaw: Array<[string, string, number]> = [
    ["goods", "Товар (закупка)", goodsKzt],
    ["chinaShipping", "Доставка по Китаю", chinaShippingKzt],
    ["international", "Международная доставка", intlKzt],
    ["insurance", "Страховка груза", insuranceKzt],
    ["duty", "Таможенная пошлина", dutyKzt],
    ["importVat", "Импортный НДС", importVatKzt],
    ["customsFees", "Таможенные сборы / брокер", input.customsFeesKzt],
    ["certification", "Сертификация", input.certificationKzt],
    ["intermediary", "Услуги посредника", intermediaryKzt],
    ["packaging", "Упаковка", packagingKzt],
    ["toWarehouse", "Доставка до склада", input.deliveryToWarehouseKzt],
    ["other", "Прочие расходы", input.otherBatchCostsKzt],
  ];

  const batchLines: CostLine[] = batchRaw.map(([key, label, batch]) => ({
    key,
    label,
    batchKzt: round2(batch),
    perUnitKzt: round2(batch / sellableUnits),
  }));
  const batchCostKzt = batchRaw.reduce((s, [, , v]) => s + v, 0);
  const landedCostPerUnitKzt = batchCostKzt / sellableUnits;

  // Расходы на продажу одной единицы
  const price = input.salePriceKzt;
  const commission = (price * input.kaspiCommissionPct) / 100;
  const tax = (price * input.sellerTaxPct) / 100;
  const returnsCost = (input.returnRatePct / 100) * input.returnCostKztPerReturn;
  const sellingRaw: Array<[string, string, number]> = [
    ["kaspiCommission", "Комиссия Kaspi", commission],
    ["customerDelivery", "Доставка покупателю", input.customerDeliveryKztPerUnit],
    ["sellerTax", "Налог продавца", tax],
    ["ads", "Реклама", input.adsKztPerUnit],
    ["returns", "Возвраты (ожидаемые)", returnsCost],
  ];
  const sellingLines: CostLine[] = sellingRaw.map(([key, label, unit]) => ({
    key,
    label,
    perUnitKzt: round2(unit),
    batchKzt: round2(unit * sellableUnits),
  }));
  const sellingCostPerUnitKzt = sellingRaw.reduce((s, [, , v]) => s + v, 0);

  const fullCostPerUnitKzt = landedCostPerUnitKzt + sellingCostPerUnitKzt;
  const profitPerUnitKzt = price - fullCostPerUnitKzt;

  const marginPct = price > 0 ? (profitPerUnitKzt / price) * 100 : null;
  const markupPct = fullCostPerUnitKzt > 0 ? (profitPerUnitKzt / fullCostPerUnitKzt) * 100 : null;
  const roiPct = landedCostPerUnitKzt > 0 ? (profitPerUnitKzt / landedCostPerUnitKzt) * 100 : null;

  // Точка безубыточности: сколько штук нужно продать, чтобы вернуть все вложения в партию.
  // Каждая проданная единица приносит «вклад» = цена − расходы на продажу.
  const contribution = price - sellingCostPerUnitKzt;
  let breakEvenUnits: number | null = null;
  if (contribution > 0) {
    const units = Math.ceil(batchCostKzt / contribution - 1e-9);
    breakEvenUnits = units;
    if (units > sellableUnits) warnings.push("Партия не окупается: точка безубыточности больше количества товара");
  } else {
    warnings.push("Цена не покрывает даже расходы на продажу (комиссия, доставка, налог, реклама)");
  }

  // Цена безубыточности: P = (себестоимость до склада + фикс. расходы на продажу) / (1 − %комиссии − %налога)
  const pctShare = (input.kaspiCommissionPct + input.sellerTaxPct) / 100;
  const fixedSelling = input.customerDeliveryKztPerUnit + input.adsKztPerUnit + returnsCost;
  const breakEvenPriceKzt = pctShare < 1 ? (landedCostPerUnitKzt + fixedSelling) / (1 - pctShare) : null;

  if (profitPerUnitKzt < 0) warnings.push("Товар убыточен при текущей цене продажи");
  else if (marginPct !== null && marginPct < 15)
    warnings.push("Маржинальность ниже 15% — высокий риск при снижении цен конкурентами");
  if (input.cnyToKzt === 0) warnings.push("Не указан курс CNY/KZT");
  if (input.intlPricingMode !== "FIXED" && input.usdToKzt === 0) warnings.push("Не указан курс USD/KZT");
  if (input.salePriceKzt === 0) warnings.push("Не указана цена продажи");

  return {
    sellableUnits,
    totalWeightKg: round2(totalWeightKg),
    totalVolumeM3: Math.round(totalVolumeM3 * 10000) / 10000,
    batchLines,
    batchCostKzt: round2(batchCostKzt),
    landedCostPerUnitKzt: round2(landedCostPerUnitKzt),
    sellingLines,
    sellingCostPerUnitKzt: round2(sellingCostPerUnitKzt),
    fullCostPerUnitKzt: round2(fullCostPerUnitKzt),
    profitPerUnitKzt: round2(profitPerUnitKzt),
    marginPct: marginPct === null ? null : round2(marginPct),
    markupPct: markupPct === null ? null : round2(markupPct),
    roiPct: roiPct === null ? null : round2(roiPct),
    batchRevenueKzt: round2(price * sellableUnits),
    batchProfitKzt: round2(profitPerUnitKzt * sellableUnits),
    breakEvenUnits,
    breakEvenPriceKzt: breakEvenPriceKzt === null ? null : round2(breakEvenPriceKzt),
    workingCapitalKzt: round2(batchCostKzt),
    warnings,
  };
}

/** Объём единицы в м³ из габаритов в сантиметрах */
export function volumeM3FromCm(l: number, w: number, h: number): number {
  return (l * w * h) / 1_000_000;
}
