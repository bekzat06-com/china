import Link from "next/link";
import { Boxes, Download, PackageMinus, PackagePlus, ShoppingBasket, Timer, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getStockOverview, loadSales } from "@/lib/queries/dashboard";
import { getBusinessSettings } from "@/lib/settings";
import { productPerformance, summarizeSales } from "@/lib/finance/sales-analytics";
import { purchasePlan, turnoverDays } from "@/lib/finance/reports";
import { PageHeader } from "@/components/layout/page-header";
import { SubNav, INVENTORY_TABS } from "@/components/layout/sub-nav";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatKzt } from "@/lib/utils";

export const metadata = { title: "Склад и закупки" };
export const dynamic = "force-dynamic";

const FILTERS = { all: "Все", low: "Заканчиваются", out: "Нет в наличии", stale: "Залежались" } as const;
const STATUS_BADGE = {
  OUT: { label: "Нет", variant: "danger" },
  LOW: { label: "Мало", variant: "warning" },
  OK: { label: "Норма", variant: "success" },
  NO_SALES: { label: "Нет продаж", variant: "muted" },
} as const;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireUser();
  const { filter = "all" } = await searchParams;
  const now = new Date();
  const [stock, settings, rows30] = await Promise.all([
    getStockOverview(),
    getBusinessSettings(),
    loadSales(new Date(now.getTime() - 30 * 86400_000), now),
  ]);
  const perf = new Map(productPerformance(rows30).map((p) => [p.productId, p]));
  const cogs30 = summarizeSales(rows30).cogsKzt;
  const turnover = turnoverDays(stock.frozenKzt, cogs30, 30);
  const staleRows = stock.rows.filter((r) => r.sold30 === 0 && r.onHand > 0);
  const staleValue = staleRows.reduce((s, r) => s + (r.stockValueKzt ?? 0), 0);

  const plan = purchasePlan(
    stock.rows.map((r) => {
      const p = perf.get(r.id);
      return {
        productId: r.id,
        name: r.name,
        suggestedQty: r.advice.suggestedQty,
        unitCostKzt: r.unitCostKzt,
        profitPerUnitKzt: p && p.unitsSold > 0 ? p.profitKzt / p.unitsSold : null,
        status: r.advice.status,
      };
    }),
    settings.budgetKzt,
  );

  const list = stock.rows
    .filter((r) =>
      filter === "low" ? r.advice.status === "LOW" : filter === "out" ? r.advice.status === "OUT" : filter === "stale" ? r.sold30 === 0 && r.onHand > 0 : true,
    )
    .sort((a, b) => (a.advice.daysOfCover ?? 9999) - (b.advice.daysOfCover ?? 9999));
  const canEdit = user.role !== "VIEWER";

  return (
    <>
      <PageHeader title="Склад и закупки" description="Остатки считаются только по журналу движений: приход, продажи, возвраты, инвентаризация">
        <a href={`/api/export/stock`} download className={buttonVariants({ variant: "outline" })}><Download /> CSV</a>
        {canEdit && (
          <>
            <Link href="/inventory/receive" className={buttonVariants()}><PackagePlus /> Приход товара</Link>
            <Link href="/inventory/adjust" className={buttonVariants({ variant: "outline" })}><PackageMinus /> Инвентаризация</Link>
          </>
        )}
      </PageHeader>
      <SubNav items={INVENTORY_TABS} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Деньги в остатках" value={formatKzt(stock.frozenKzt)} icon={Wallet} hint="по себестоимости партий" />
        <KpiCard label="Единиц на складе" value={stock.rows.reduce((s, r) => s + Math.max(0, r.onHand), 0).toLocaleString("ru-RU")} icon={Boxes} hint={`в резерве: ${stock.rows.reduce((s, r) => s + r.reserved, 0)}`} />
        <KpiCard label="Оборачиваемость" value={turnover !== null ? `${Math.round(turnover)} дн.` : "—"} icon={Timer} hint="за сколько дней продастся запас" />
        <KpiCard label="Залежалось" value={formatKzt(staleValue)} icon={ShoppingBasket} hint={`${staleRows.length} поз. без продаж 30 дн.`} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>План закупок под бюджет {formatKzt(settings.budgetKzt)}</CardTitle>
          <CardDescription>
            Сначала то, чего нет в наличии, затем то, что заканчивается; внутри — по прибыли с единицы за 30 дней.
            Срок поставки {settings.leadTimeDays} дн. + страховой запас {settings.safetyStockDays} дн. (меняется в настройках). Это рекомендация — закупку оформляете вы.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-5">
          {plan.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Сейчас докупать ничего не нужно.</p>
          ) : (
            <>
              <Table>
                <THead><TR><TH>Товар</TH><TH className="text-right">Купить</TH><TH className="text-right">Себест./шт</TH><TH className="text-right">Сумма</TH><TH className="text-right">Прибыль/шт</TH><TH>Решение</TH></TR></THead>
                <TBody className="tabular">
                  {plan.lines.map((l) => (
                    <TR key={l.productId} className={cn(!l.fitsBudget && "opacity-70")}>
                      <TD className="max-w-60"><Link href={`/products/${l.productId}`} className="line-clamp-1 hover:underline">{l.name}</Link></TD>
                      <TD className="text-right">{l.suggestedQty} шт</TD>
                      <TD className="text-right">{formatKzt(l.unitCostKzt)}</TD>
                      <TD className="text-right">{formatKzt(l.costKzt)}</TD>
                      <TD className="text-right">{formatKzt(l.profitPerUnitKzt)}</TD>
                      <TD>
                        <Badge variant={l.fitsBudget ? "success" : "muted"}>{l.fitsBudget ? "В бюджете" : "Не сейчас"}</Badge>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{l.reason}</p>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <p className="tabular mt-2 px-3 text-sm">
                Итого в бюджете: <b>{formatKzt(plan.totalKzt)}</b> · останется {formatKzt(plan.leftKzt)}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Остатки</CardTitle>
          <div className="flex flex-wrap gap-1">
            {Object.entries(FILTERS).map(([k, l]) => (
              <Link key={k} href={`/inventory?filter=${k}`} className={cn("rounded-md px-2.5 py-1 text-xs", filter === k ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
                {l}
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:px-5">
          <Table>
            <THead>
              <TR>
                <TH>Товар</TH><TH className="text-right">На складе</TH><TH className="text-right">Резерв</TH><TH className="text-right">Доступно</TH>
                <TH className="text-right">Продано 30 дн.</TH><TH className="text-right">Хватит на</TH><TH className="text-right">Стоимость</TH><TH>Статус</TH>
              </TR>
            </THead>
            <TBody className="tabular">
              {list.map((r) => {
                const b = STATUS_BADGE[r.advice.status];
                return (
                  <TR key={r.id}>
                    <TD className="max-w-64">
                      <Link href={`/products/${r.id}`} className="line-clamp-1 hover:underline">{r.name}</Link>
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">{r.sku} {r.isDemo && <DemoBadge />}</p>
                    </TD>
                    <TD className="text-right">{r.onHand}</TD>
                    <TD className="text-right">{r.reserved || "—"}</TD>
                    <TD className={cn("text-right font-medium", r.available <= 0 && "text-danger")}>{r.available}</TD>
                    <TD className="text-right">{r.sold30}</TD>
                    <TD className="text-right">{r.advice.daysOfCover !== null ? `${Math.round(r.advice.daysOfCover)} дн.` : "—"}</TD>
                    <TD className="text-right">{formatKzt(r.stockValueKzt)}</TD>
                    <TD><Badge variant={b.variant}>{b.label}</Badge></TD>
                  </TR>
                );
              })}
              {list.length === 0 && <TR><TD colSpan={8} className="text-center text-muted-foreground">Нет товаров по этому фильтру</TD></TR>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
