import Link from "next/link";
import { Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getBusinessSettings } from "@/lib/settings";
import { volumeM3FromCm, type LandedCostInput, type LandedCostResult } from "@/lib/finance/landed-cost";
import { deleteCalculationAction } from "@/app/actions/calculations";
import { PageHeader } from "@/components/layout/page-header";
import { LandedCostCalculator, type CalculatorProduct } from "@/components/calculator/landed-cost-calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatKzt, formatPct, toNum } from "@/lib/utils";

export const metadata = { title: "Калькулятор себестоимости" };
export const dynamic = "force-dynamic";

export default async function CalculatorPage({ searchParams }: { searchParams: Promise<{ productId?: string }> }) {
  const user = await requireUser();
  const { productId } = await searchParams;
  const [settings, products, saved] = await Promise.all([
    getBusinessSettings(),
    db.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } }),
    db.costCalculation.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { product: { select: { name: true, id: true } } } }),
  ]);

  // Значения по умолчанию берутся из «Настроек» — не зашиты в код
  const defaults: LandedCostInput = {
    quantity: 100,
    unitPriceCny: 10,
    cnyToKzt: settings.cnyToKzt,
    usdToKzt: settings.usdToKzt,
    unitWeightKg: 0.5,
    unitVolumeM3: 0.002,
    chinaDomesticShippingCny: 0,
    intlPricingMode: "PER_KG",
    intlRateUsdPerKg: settings.intlRateUsdPerKg,
    intlRateUsdPerM3: settings.intlRateUsdPerM3,
    intlFixedKzt: 0,
    insurancePct: 0,
    deliveryToWarehouseKzt: 0,
    customsBase: "GOODS",
    customsDutyPct: 0,
    importVatPct: 0,
    customsFeesKzt: 0,
    certificationKzt: 0,
    intermediaryPct: 0,
    intermediaryFixedKzt: 0,
    packagingKztPerUnit: 0,
    otherBatchCostsKzt: 0,
    lossRatePct: 0,
    salePriceKzt: 5000,
    kaspiCommissionPct: settings.kaspiCommissionPct,
    customerDeliveryKztPerUnit: settings.customerDeliveryKzt,
    sellerTaxPct: settings.sellerTaxPct,
    adsKztPerUnit: 0,
    returnRatePct: settings.returnRatePct,
    returnCostKztPerReturn: 0,
  };

  const calcProducts: CalculatorProduct[] = products.map((p) => {
    const l = toNum(p.lengthCm), w = toNum(p.widthCm), h = toNum(p.heightCm);
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      purchasePriceCny: toNum(p.purchasePriceCny),
      salePriceKzt: toNum(p.salePriceKzt),
      kaspiCommissionPct: toNum(p.kaspiCommissionPct),
      weightKg: toNum(p.weightKg),
      volumeM3: l && w && h ? volumeM3FromCm(l, w, h) : null,
    };
  });
  const canSave = user.role !== "VIEWER";

  return (
    <>
      <PageHeader
        title="Калькулятор полной себестоимости"
        description="Китай → Казахстан → покупатель Kaspi. Все ставки настраиваются — универсальных ставок нет."
      >
        {!settings.verifiedByOwner && (
          <Link href="/settings" className="text-xs text-warning hover:underline">
            ⚠ Курсы и ставки по умолчанию — примерные. Проверить →
          </Link>
        )}
      </PageHeader>
      <LandedCostCalculator defaults={defaults} products={calcProducts} initialProductId={productId} canSave={canSave} key={productId ?? "none"} />

      <Card className="mt-6">
        <CardHeader><CardTitle>Сохранённые расчёты</CardTitle></CardHeader>
        <CardContent className="px-2 sm:px-5">
          {saved.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет сохранённых расчётов.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Расчёт</TH>
                  <TH>Товар</TH>
                  <TH className="text-right">Партия</TH>
                  <TH className="text-right">Себест./шт</TH>
                  <TH className="text-right">Прибыль/шт</TH>
                  <TH className="text-right">Маржа</TH>
                  <TH className="text-right">Нужно денег</TH>
                  <TH />
                </TR>
              </THead>
              <TBody className="tabular">
                {saved.map((c) => {
                  const r = c.results as unknown as LandedCostResult;
                  const i = c.inputs as unknown as LandedCostInput;
                  return (
                    <TR key={c.id}>
                      <TD>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(c.createdAt)}</p>
                      </TD>
                      <TD>{c.product ? <Link href={`/products/${c.product.id}`} className="hover:underline">{c.product.name}</Link> : "—"}</TD>
                      <TD className="text-right">{i.quantity} шт</TD>
                      <TD className="text-right">{formatKzt(r.fullCostPerUnitKzt)}</TD>
                      <TD className={r.profitPerUnitKzt < 0 ? "text-right text-danger" : "text-right"}>{formatKzt(r.profitPerUnitKzt)}</TD>
                      <TD className="text-right">{formatPct(r.marginPct)}</TD>
                      <TD className="text-right">{formatKzt(r.workingCapitalKzt)}</TD>
                      <TD className="text-right">
                        {canSave && (
                          <form action={deleteCalculationAction}>
                            <input type="hidden" name="id" value={c.id} />
                            <Button variant="ghost" size="icon" aria-label="Удалить расчёт"><Trash2 /></Button>
                          </form>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
