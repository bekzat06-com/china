import Link from "next/link";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getReportsData } from "@/lib/queries/reports";
import { PageHeader } from "@/components/layout/page-header";
import { SubNav, SALES_TABS } from "@/components/layout/sub-nav";
import { MonthlyChart } from "@/components/sales/monthly-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatKzt, formatPct } from "@/lib/utils";

export const metadata = { title: "Отчёты" };
export const dynamic = "force-dynamic";

const PERIODS = [30, 90, 180, 365];
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.days)) ? Number(sp.days) : 90;
  const d = await getReportsData(days);
  const s = d.summary;

  return (
    <>
      <PageHeader title="Отчёты" description="Все цифры считаются из заказов, расходов и партий в базе">
        <div className="flex rounded-lg border bg-card p-0.5">
          {PERIODS.map((x) => (
            <Link key={x} href={`/sales/reports?days=${x}`} className={cn("rounded-md px-3 py-1 text-sm", x === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {x} дн.
            </Link>
          ))}
        </div>
      </PageHeader>
      <SubNav items={SALES_TABS} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Выручка", formatKzt(s.revenueKzt)],
          ["Чистая прибыль", formatKzt(s.netProfitKzt)],
          ["Маржа", formatPct(s.revenueKzt > 0 ? (s.netProfitKzt / s.revenueKzt) * 100 : null)],
          ["ROI", formatPct(s.roiPct)],
          ["Оборачиваемость", d.turnover !== null ? `${Math.round(d.turnover)} дн.` : "—"],
        ].map(([l, v]) => (
          <Card key={l} className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="tabular mt-1 text-lg font-semibold">{v}</p></Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Прибыль по месяцам</CardTitle><CardDescription>Последние 12 месяцев · чистая прибыль = выручка − себестоимость − комиссия − доставка − общие расходы</CardDescription></CardHeader>
        <CardContent>
          {d.monthly.length === 0 ? <p className="text-sm text-muted-foreground">Нет данных</p> : (
            <>
              <MonthlyChart data={d.monthly} />
              <Table className="mt-4">
                <THead><TR><TH>Месяц</TH><TH className="text-right">Заказы</TH><TH className="text-right">Выручка</TH><TH className="text-right">Себестоимость</TH><TH className="text-right">Комиссия</TH><TH className="text-right">Доставка</TH><TH className="text-right">Расходы</TH><TH className="text-right">Чистая прибыль</TH><TH className="text-right">Маржа</TH></TR></THead>
                <TBody className="tabular">
                  {[...d.monthly].reverse().map((m) => (
                    <TR key={m.month}>
                      <TD>{MONTHS[Number(m.month.slice(5)) - 1]} {m.month.slice(0, 4)}</TD>
                      <TD className="text-right">{m.orders}</TD>
                      <TD className="text-right">{formatKzt(m.revenueKzt)}</TD>
                      <TD className="text-right">{formatKzt(m.cogsKzt)}</TD>
                      <TD className="text-right">{formatKzt(m.commissionKzt)}</TD>
                      <TD className="text-right">{formatKzt(m.deliveryKzt)}</TD>
                      <TD className="text-right">{formatKzt(m.expensesKzt)}</TD>
                      <TD className={cn("text-right font-medium", m.netProfitKzt < 0 && "text-danger")}>{formatKzt(m.netProfitKzt)}</TD>
                      <TD className="text-right">{formatPct(m.marginPct)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <CardTitle>Товары: ABC и XYZ</CardTitle>
            <CardDescription>
              ABC — вклад в прибыль (A — первые 80%). XYZ — стабильность недельного спроса за 12 недель (X — стабильный, Z — нерегулярный);
              нужно минимум 8 недель продаж, иначе «нет данных».
            </CardDescription>
          </div>
          <a href={`/api/export/products?days=${days}`} className={buttonVariants({ variant: "outline", size: "sm" })}><Download /> CSV</a>
        </CardHeader>
        <CardContent className="px-2 sm:px-5">
          <Table>
            <THead><TR><TH>Товар</TH><TH className="text-center">ABC</TH><TH className="text-center">XYZ</TH><TH className="text-right">Продано</TH><TH className="text-right">Выручка</TH><TH className="text-right">Прибыль</TH><TH className="text-right">Маржа</TH><TH className="text-right">Возвраты</TH><TH className="text-right">Оборач.</TH></TR></THead>
            <TBody className="tabular">
              {d.productRows.map((p) => (
                <TR key={p.productId}>
                  <TD className="max-w-60"><Link href={`/products/${p.productId}`} className="line-clamp-1 hover:underline">{p.productName}</Link><p className="text-[11px] text-muted-foreground">{p.category}</p></TD>
                  <TD className="text-center"><Badge variant={p.abcClass === "A" ? "success" : p.abcClass === "B" ? "default" : "muted"}>{p.abcClass}</Badge></TD>
                  <TD className="text-center">
                    {p.xyz?.xyzClass ? <Badge variant={p.xyz.xyzClass === "X" ? "success" : p.xyz.xyzClass === "Y" ? "default" : "warning"} title={`Вариация ${p.xyz.cvPct}%`}>{p.xyz.xyzClass}</Badge> : <span className="text-[11px] text-muted-foreground">нет данных</span>}
                  </TD>
                  <TD className="text-right">{p.unitsSold}</TD>
                  <TD className="text-right">{formatKzt(p.revenueKzt)}</TD>
                  <TD className={cn("text-right font-medium", p.profitKzt < 0 && "text-danger")}>{formatKzt(p.profitKzt)}</TD>
                  <TD className="text-right">{formatPct(p.marginPct)}</TD>
                  <TD className="text-right">{formatPct(p.returnRatePct)}</TD>
                  <TD className="text-right">{p.turnoverDays !== null ? `${Math.round(p.turnoverDays)} дн.` : "—"}</TD>
                </TR>
              ))}
              {d.productRows.length === 0 && <TR><TD colSpan={9} className="text-center text-muted-foreground">Нет продаж за период</TD></TR>}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle>По категориям</CardTitle></CardHeader>
        <CardContent className="px-2 sm:px-5">
          <Table>
            <THead><TR><TH>Категория</TH><TH className="text-right">Продано</TH><TH className="text-right">Выручка</TH><TH className="text-right">Прибыль</TH><TH className="text-right">Маржа</TH></TR></THead>
            <TBody className="tabular">
              {d.categories.map((c) => (
                <TR key={c.name}>
                  <TD>{c.name}</TD>
                  <TD className="text-right">{c.units}</TD>
                  <TD className="text-right">{formatKzt(c.revenue)}</TD>
                  <TD className={cn("text-right", c.profit < 0 && "text-danger")}>{formatKzt(c.profit)}</TD>
                  <TD className="text-right">{formatPct(c.marginPct)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
