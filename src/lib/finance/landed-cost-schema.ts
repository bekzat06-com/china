import { z } from "zod";

const n = (max = 1e12) => z.coerce.number().min(0, "Не может быть отрицательным").max(max).finite();
const pct = () => z.coerce.number().min(0).max(100);

/** Проверка входных данных калькулятора (используется и в браузере, и на сервере) */
export const landedCostInputSchema = z.object({
  quantity: z.coerce.number().int("Целое число").min(1, "Минимум 1").max(10_000_000),
  unitPriceCny: n(),
  cnyToKzt: z.coerce.number().positive("Укажите курс CNY/KZT"),
  usdToKzt: z.coerce.number().positive("Укажите курс USD/KZT"),
  unitWeightKg: n(10000),
  unitVolumeM3: n(1000),
  chinaDomesticShippingCny: n(),
  intlPricingMode: z.enum(["PER_KG", "PER_M3", "MAX_KG_M3", "FIXED"]),
  intlRateUsdPerKg: n(),
  intlRateUsdPerM3: n(),
  intlFixedKzt: n(),
  insurancePct: pct(),
  deliveryToWarehouseKzt: n(),
  customsBase: z.enum(["GOODS", "GOODS_PLUS_SHIPPING"]),
  customsDutyPct: pct(),
  importVatPct: pct(),
  customsFeesKzt: n(),
  certificationKzt: n(),
  intermediaryPct: pct(),
  intermediaryFixedKzt: n(),
  packagingKztPerUnit: n(),
  otherBatchCostsKzt: n(),
  lossRatePct: z.coerce.number().min(0).max(99.99),
  salePriceKzt: n(),
  kaspiCommissionPct: pct(),
  customerDeliveryKztPerUnit: n(),
  sellerTaxPct: pct(),
  adsKztPerUnit: n(),
  returnRatePct: pct(),
  returnCostKztPerReturn: n(),
});
