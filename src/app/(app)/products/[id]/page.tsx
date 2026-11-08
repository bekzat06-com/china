import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator, Pencil, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getStockOverview } from "@/lib/queries/dashboard";
import { summarizeSales, type SaleRow } from "@/lib/finance/sales-analytics";
import type { LandedCostResult } from "@/lib/finance/landed-cost";
import { deleteProductAction } from "@/app/actions/products";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatDateTime, formatKzt, formatNumber, formatPct, toNum } from "@/lib/utils";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const p = await db.product.findUnique({
    where: { id },
    include: {
      category: true,
      calculations: { orderBy: { createdAt: "desc" }, take: 5 },
      stockBatches: { orderBy: { receivedAt: "desc" }, take: 5 },
    },
  });
  if (!p) notFound();

  const since = new Date(Date.now() - 30 * 86400_000);
  const [items, stock, salesCount] = await Promise.all([
    db.orderItem.findMany({ where: { productId: id, order: { orderedAt: { gte: since } } }, include: { order: true } }),
    getStockOverview(),
    db.orderItem.count({ where: { productId: id } }),
  ]);
  const rows: SaleRow[] = items.map((i) => ({
    orderId: i.orderId, orderedAt: i.order.orderedAt, status: i.order.status, productId: id, productName: p.name, sku: p.sku,
    quantity: i.quantity, returnedQty: i.returnedQty, unitPriceKzt: toNum(i.unitPriceKzt) ?? 0, commissionKzt: toNum(i.commissionKzt) ?? 0,
    deliveryKzt: toNum(i.deliveryKzt) ?? 0, unitCostKzt: toNum(i.unitCostKzt) ?? 0,
  }));
  const s = summarizeSales(rows);
  const st = stock.rows.find((r) => r.id === id);
  const canEdit = user.role !== "VIEWER";

  return (
    <>
      <PageHeader title={p.name} description={`${p.sku}${p.nameZh ? ` · ${p.nameZh}` : ""}${p.category ? ` · ${p.category.name}` : ""}`}>
        <Link href={`/calculator?productId=${p.id}`} className={buttonVariants({ variant: "outline" })}>
          <Calculator /> Рассчитать себестоимость
        </Link>
        {canEdit && (
          <>
            <Link href={`/products/${p.id}/edit`} className={buttonVariants({ variant: "outline" })}><Pencil /> Изменить</Link>
            <form action={deleteProductAction}>
              <input type="hidden" name="id" value={p.id} />
              <Button variant="ghost" className="text-danger" title="Удалить (или архивировать, если были продажи)">
                <Trash2 /> {salesCount > 0 ? "В архив" : "Удалить"}
              </Button>
            </form>
          </>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
        {p.isDemo && <DemoBadge />}
        {p.needsCertification && <Badge variant="warning">Нужна сертификация</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Выручка, 30 дн.", formatKzt(s.revenueKzt)],
          ["Прибыль по заказам, 30 дн.", formatKzt(s.grossProfitKzt)],
          ["Продано, 30 дн.", `${s.unitsSold} шт`],
          ["Доступно на складе", st ? `${st.available} шт` : "—"],
        ].map(([l, v]) => (
          <Card key={l} className="p-4">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="tabular mt-1 text-lg font-semibold">{v}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Параметры</CardTitle></CardHeader>
          <CardContent>
            <dl className="tabular grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Закупка</dt><dd>{p.purchasePriceCny ? `¥${formatNumber(toNum(p.purchasePriceCny))}` : "—"}</dd>
              <dt className="text-muted-foreground">Цена продажи</dt><dd>{formatKzt(toNum(p.salePriceKzt))}</dd>
              <dt className="text-muted-foreground">Комиссия Kaspi</dt><dd>{p.kaspiCommissionPct ? `${toNum(p.kaspiCommissionPct)}%` : "из настроек"}</dd>
              <dt className="text-muted-foreground">Вес</dt><dd>{p.weightKg ? `${toNum(p.weightKg)} кг` : "—"}</dd>
              <dt className="text-muted-foreground">Габариты</dt>
              <dd>{p.lengthCm && p.widthCm && p.heightCm ? `${toNum(p.lengthCm)}×${toNum(p.widthCm)}×${toNum(p.heightCm)} см` : "—"}</dd>
              <dt className="text-muted-foreground">Мин. остаток</dt><dd>{p.minStock} шт</dd>
              <dt className="text-muted-foreground">Возвраты, 30 дн.</dt><dd>{s.unitsReturned} шт ({formatPct(s.returnRatePct)})</dd>
              {st && (<><dt className="text-muted-foreground">Хватит запаса</dt><dd>{st.advice.daysOfCover !== null ? `~${st.advice.daysOfCover} дн.` : "нет продаж"}</dd></>)}
              {st && st.advice.suggestedQty > 0 && (<><dt className="text-muted-foreground">Рекомендуемая закупка</dt><dd className="font-medium">{st.advice.suggestedQty} шт</dd></>)}
            </dl>
            {p.kaspiProductUrl && (
              <a href={p.kaspiProductUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-primary hover:underline">Открыть в Kaspi ↗</a>
            )}
            {p.description && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{p.description}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Расчёты себестоимости</CardTitle>
            <CardDescription>Последние 5 сохранённых расчётов</CardDescription>
          </CardHeader>
          <CardContent>
            {p.calculations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Расчётов пока нет. <Link href={`/calculator?productId=${p.id}`} className="text-primary hover:underline">Рассчитать →</Link></p>
            ) : (
              <Table>
                <THead><TR><TH>Дата</TH><TH className="text-right">Себест.</TH><TH className="text-right">Прибыль/шт</TH><TH className="text-right">Маржа</TH></TR></THead>
                <TBody className="tabular">
                  {p.calculations.map((c) => {
                    const r = c.results as unknown as LandedCostResult;
                    return (
                      <TR key={c.id}>
                        <TD>
                          <p>{c.name}</p>
                          <p className="text-[11px] text-muted-foreground">{formatDateTime(c.createdAt)}</p>
                        </TD>
                        <TD className="text-right">{formatKzt(r.fullCostPerUnitKzt)}</TD>
                        <TD className="text-right">{formatKzt(r.profitPerUnitKzt)}</TD>
                        <TD className="text-right">{formatPct(r.marginPct)}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Партии на складе</CardTitle><CardDescription>Приход товара и учёт партий — этап 2</CardDescription></CardHeader>
          <CardContent>
            {p.stockBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Партий нет.</p>
            ) : (
              <Table>
                <THead><TR><TH>Дата прихода</TH><TH className="text-right">Количество</TH><TH className="text-right">Остаток партии</TH><TH className="text-right">Себестоимость ед.</TH><TH>Примечание</TH></TR></THead>
                <TBody className="tabular">
                  {p.stockBatches.map((b) => (
                    <TR key={b.id}>
                      <TD>{formatDate(b.receivedAt)}</TD>
                      <TD className="text-right">{b.quantity}</TD>
                      <TD className="text-right">{b.remaining}</TD>
                      <TD className="text-right">{formatKzt(toNum(b.unitCostKzt))}</TD>
                      <TD className="text-muted-foreground">{b.note ?? ""} {b.isDemo && <DemoBadge />}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
