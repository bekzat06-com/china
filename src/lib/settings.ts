import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Настройки бизнеса. Значения по умолчанию — ПРИМЕРЫ, а не официальные ставки.
 * Ставки налогов, пошлин и комиссий зависят от режима налогообложения, категории
 * товара (ТН ВЭД) и условий Kaspi — владелец обязан проверить и указать свои.
 */
export const businessSettingsSchema = z.object({
  cnyToKzt: z.coerce.number().positive("Курс должен быть больше 0"),
  usdToKzt: z.coerce.number().positive("Курс должен быть больше 0"),
  ratesUpdatedAt: z.string().optional(),
  ratesSource: z.string().max(200).default("введено вручную"),
  kaspiCommissionPct: z.coerce.number().min(0).max(100),
  sellerTaxPct: z.coerce.number().min(0).max(100),
  customerDeliveryKzt: z.coerce.number().min(0),
  intlRateUsdPerKg: z.coerce.number().min(0),
  intlRateUsdPerM3: z.coerce.number().min(0),
  returnRatePct: z.coerce.number().min(0).max(100),
  leadTimeDays: z.coerce.number().int().min(1).max(365),
  safetyStockDays: z.coerce.number().int().min(0).max(365),
  budgetKzt: z.coerce.number().min(0),
  verifiedByOwner: z.coerce.boolean().default(false), // владелец подтвердил, что ставки проверены
});

export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

export const DEFAULT_SETTINGS: BusinessSettings = {
  cnyToKzt: 70,
  usdToKzt: 500,
  ratesSource: "пример — обновите по курсу Нацбанка РК",
  kaspiCommissionPct: 12,
  sellerTaxPct: 4,
  customerDeliveryKzt: 0,
  intlRateUsdPerKg: 3,
  intlRateUsdPerM3: 250,
  returnRatePct: 2,
  leadTimeDays: 30,
  safetyStockDays: 14,
  budgetKzt: 500_000,
  verifiedByOwner: false,
};

const KEY = "business";

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_SETTINGS;
  const parsed = businessSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(row.value as object) });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveBusinessSettings(value: BusinessSettings) {
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}
