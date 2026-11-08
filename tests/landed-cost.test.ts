import { describe, it, expect } from "vitest";
import { calculateLandedCost, volumeM3FromCm, type LandedCostInput } from "@/lib/finance/landed-cost";

// Базовый пример с «круглыми» числами, чтобы результат легко проверить вручную
const base: LandedCostInput = {
  quantity: 100,
  unitPriceCny: 10,
  cnyToKzt: 70,
  usdToKzt: 500,
  unitWeightKg: 0.5,
  unitVolumeM3: 0.001,
  chinaDomesticShippingCny: 100,
  intlPricingMode: "PER_KG",
  intlRateUsdPerKg: 2,
  intlRateUsdPerM3: 300,
  intlFixedKzt: 0,
  insurancePct: 0,
  deliveryToWarehouseKzt: 3000,
  customsBase: "GOODS",
  customsDutyPct: 0,
  importVatPct: 0,
  customsFeesKzt: 0,
  certificationKzt: 0,
  intermediaryPct: 0,
  intermediaryFixedKzt: 0,
  packagingKztPerUnit: 50,
  otherBatchCostsKzt: 0,
  lossRatePct: 0,
  salePriceKzt: 3000,
  kaspiCommissionPct: 10,
  customerDeliveryKztPerUnit: 200,
  sellerTaxPct: 4,
  adsKztPerUnit: 100,
  returnRatePct: 0,
  returnCostKztPerReturn: 0,
};

describe("calculateLandedCost", () => {
  it("считает затраты на партию и себестоимость единицы", () => {
    const r = calculateLandedCost(base);
    // товар 100*10*70 = 70 000; Китай 100*70 = 7 000; межд. 50 кг*2$*500 = 50 000;
    // упаковка 5 000; до склада 3 000 → итого 135 000
    expect(r.batchCostKzt).toBe(135_000);
    expect(r.landedCostPerUnitKzt).toBe(1350);
    expect(r.totalWeightKg).toBe(50);
  });

  it("считает расходы на продажу, прибыль, маржу, наценку и ROI", () => {
    const r = calculateLandedCost(base);
    // комиссия 300 + доставка 200 + налог 120 + реклама 100 = 720
    expect(r.sellingCostPerUnitKzt).toBe(720);
    expect(r.fullCostPerUnitKzt).toBe(2070);
    expect(r.profitPerUnitKzt).toBe(930);
    expect(r.marginPct).toBe(31); // 930/3000
    expect(r.markupPct).toBeCloseTo(44.93, 2); // 930/2070
    expect(r.roiPct).toBeCloseTo(68.89, 2); // 930/1350
    expect(r.batchProfitKzt).toBe(93_000);
    expect(r.batchRevenueKzt).toBe(300_000);
    expect(r.workingCapitalKzt).toBe(135_000);
  });

  it("точка безубыточности в штуках и цена безубыточности", () => {
    const r = calculateLandedCost(base);
    // вклад единицы = 3000 − 720 = 2280; 135000/2280 = 59.2 → 60 шт
    expect(r.breakEvenUnits).toBe(60);
    // (1350 + 200 + 100) / (1 − 0.14) = 1918.60
    expect(r.breakEvenPriceKzt).toBeCloseTo(1918.6, 1);
    // проверка: при цене безубыточности прибыль ≈ 0
    const z = calculateLandedCost({ ...base, salePriceKzt: r.breakEvenPriceKzt! });
    expect(Math.abs(z.profitPerUnitKzt)).toBeLessThan(0.02);
  });

  it("режим MAX_KG_M3 берёт большее из веса и объёма", () => {
    const r = calculateLandedCost({ ...base, intlPricingMode: "MAX_KG_M3", unitVolumeM3: 0.01 });
    // по весу 50 000; по объёму 1 м3*300$*500 = 150 000 → берём 150 000
    expect(r.batchLines.find((l) => l.key === "international")!.batchKzt).toBe(150_000);
  });

  it("таможня: пошлина и импортный НДС на базу «товар + доставка»", () => {
    const r = calculateLandedCost({
      ...base,
      customsBase: "GOODS_PLUS_SHIPPING",
      customsDutyPct: 10,
      importVatPct: 12,
    });
    // база = 70 000 + 7 000 + 50 000 = 127 000; пошлина 12 700; НДС (127 000+12 700)*12% = 16 764
    expect(r.batchLines.find((l) => l.key === "duty")!.batchKzt).toBe(12_700);
    expect(r.batchLines.find((l) => l.key === "importVat")!.batchKzt).toBe(16_764);
  });

  it("потери уменьшают количество единиц для продажи", () => {
    const r = calculateLandedCost({ ...base, lossRatePct: 10 });
    expect(r.sellableUnits).toBe(90);
    expect(r.landedCostPerUnitKzt).toBe(1500); // 135000/90
  });

  it("возвраты добавляют ожидаемые затраты на единицу", () => {
    const r = calculateLandedCost({ ...base, returnRatePct: 5, returnCostKztPerReturn: 1000 });
    expect(r.sellingLines.find((l) => l.key === "returns")!.perUnitKzt).toBe(50);
  });

  it("предупреждает об убыточном товаре", () => {
    const r = calculateLandedCost({ ...base, salePriceKzt: 1500 });
    expect(r.profitPerUnitKzt).toBeLessThan(0);
    expect(r.warnings.join(" ")).toMatch(/убыточен/);
  });

  it("отклоняет некорректные данные", () => {
    expect(() => calculateLandedCost({ ...base, quantity: 0 })).toThrow();
    expect(() => calculateLandedCost({ ...base, quantity: 1.5 })).toThrow();
    expect(() => calculateLandedCost({ ...base, unitPriceCny: -1 })).toThrow();
    expect(() => calculateLandedCost({ ...base, lossRatePct: 100 })).toThrow();
    expect(() => calculateLandedCost({ ...base, cnyToKzt: Number.NaN })).toThrow();
  });

  it("переводит габариты в кубометры", () => {
    expect(volumeM3FromCm(50, 40, 30)).toBeCloseTo(0.06, 6);
  });
});
