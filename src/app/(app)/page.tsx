import Link from "next/link";
import {
  AlertTriangle, Banknote, Boxes, Info, Percent, Receipt, ShoppingCart, Swords, TrendingUp, Wallet, CircleAlert, Package,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/queries/dashboard";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatKzt, formatPct } from "@/lib/utils";

export const metadata = { title: "Главная" };
export const dynamic = "force-dynamic";

const PERIODS = [7, 30, 90];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const d = await getDashboardData(days);
  const s = d.summary;
  const p = d.prevSummary;

  const lowStock = d.stock.rows
    .filter((r) => r.advice.status === "LOW" || r.advice.status === "OUT")
    .sort((a, b) => (a.advice.daysOfCover ?? 0) - (b.advice.daysOfCover ?? 0));

  return (
    <>
      <PageHeader title="Главная" description={`Показатели за последние ${days} дней · время Алматы`}>
        <div className="flex rounded-lg border bg-card p-0.5">
          {PERIODS.map((x) => (
            <Link
              key={x}
              href={`/?days=${x}`}
              className={cn(
                "rounded-md px-3 py-1 text-sm",
                x === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {x} дн.
            </Link>
          ))}
        </div>
      </PageHeader>

      {d.hasDemo && (
        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-dashed border-warning bg-warning/10 px-4 py-3 text-sm sm:flex-row sm:items-center">
          <DemoBadge />
          <p className="flex-1">
            В базе есть <b>демонстрационные данные</b> (товары и заказы вымышлены). Они нужны, чтобы увидеть работу аналитики.
          </p>
          <Link href="/settings#demo" className="text-sm font-medium text-primary hover:underline">
            Удалить демо-данные →
          </Link>
        </div>
      )}

      {d.productsCount === 0 ? (
        <EmptyState icon={Package} title="Пока нет товаров" text="Добавьте первый товар и рассчитайте его себестоимость.">
          <Link href="/products/new" className={buttonVariants({ size: "sm" })}>Добавить товар</Link>
        </EmptyState>
      ) : null}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Выручка" value={formatKzt(s.revenueKzt)} icon={Banknote} current={s.revenueKzt} previous={p.revenueKzt} />
        <KpiCard label="Чистая прибыль" value={formatKzt(s.netProfitKzt)} icon={Wallet} current={s.netProfitKzt} previous={p.netProfitKzt} />
        <KpiCard label="Заказы" value={s.ordersCount.toLocaleString("ru-RU")} icon={ShoppingCart} current={s.ordersCount} previous={p.ordersCount} />
        <KpiCard label="Средний чек" value={formatKzt(s.averageCheckKzt)} icon={Receipt} current={s.averageCheckKzt} previous={p.averageCheckKzt} />
        <KpiCard label="ROI" value={formatPct(s.roiPct)} icon={Percent} hint="чистая прибыль / себестоимость" />
        <KpiCard label="Деньги в остатках" value={formatKzt(d.stock.frozenKzt)} icon={Boxes} hint="по себестоимости партий" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Выручка и прибыль по дням</CardTitle>
            <CardDescription>Прибыль по заказам — до общих расходов (реклама, сервисы)</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={d.series} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Структура результата</CardTitle>
            <CardDescription>Как выручка превращается в чистую прибыль</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="tabular flex flex-col gap-2 text-sm">
              {[
                ["Выручка", s.revenueKzt, false],
                ["Себестоимость товара", -s.cogsKzt, false],
                ["Комиссия Kaspi", -s.commissionKzt, false],
                ["Доставка покупателю", -s.deliveryKzt, false],
                ["Валовая прибыль", s.grossProfitKzt, true],
                ["Общие расходы", -s.expensesKzt, false],
                ["Чистая прибыль", s.netProfitKzt, true],
              ].map(([label, v, strong]) => (
                <div key={String(label)} className={cn("flex justify-between", strong && "border-t pt-2 font-semibold")}>
                  <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
                  <dd className={cn(Number(v) < 0 && !strong && "text-muted-foreground")}>{formatKzt(Number(v))}</dd>
                </div>
              ))}
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Возвраты</span>
                <span>
                  {s.unitsReturned} шт · {formatPct(s.returnRatePct)}
                </span>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4" /> Топ-10 товаров по прибыли
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-5">
            {d.top10.length === 0 ? (
              <EmptyState icon={TrendingUp} title="Нет продаж за период" text="Как только появятся заказы, здесь будет рейтинг товаров." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Товар</TH>
                    <TH className="text-right">Продано</TH>
                    <TH className="text-right">Выручка</TH>
                    <TH className="text-right">Прибыль</TH>
                    <TH className="text-right">Маржа</TH>
                    <TH className="text-center">ABC</TH>
                  </TR>
                </THead>
                <TBody className="tabular">
                  {d.top10.map((x) => (
                    <TR key={x.productId}>
                      <TD className="max-w-56">
                        <Link href={`/products/${x.productId}`} className="line-clamp-1 hover:underline">{x.productName}</Link>
                        <p className="text-[11px] text-muted-foreground">{x.sku}</p>
                      </TD>
                      <TD className="text-right">{x.unitsSold}</TD>
                      <TD className="text-right">{formatKzt(x.revenueKzt)}</TD>
                      <TD className="text-right font-medium">{formatKzt(x.profitKzt)}</TD>
                      <TD className="text-right">{formatPct(x.marginPct)}</TD>
                      <TD className="text-center">
                        <Badge variant={x.abcClass === "A" ? "success" : x.abcClass === "B" ? "default" : "muted"}>{x.abcClass}</Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleAlert className="size-4" /> Рекомендации
            </CardTitle>
            <CardDescription>Правила на основе ваших данных. ИИ-рекомендации — этап 6.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {d.recommendations.length === 0 && <p className="text-sm text-muted-foreground">Замечаний нет.</p>}
            {d.recommendations.map((r, i) => {
              const Icon = r.level === "info" ? Info : AlertTriangle;
              const body = (
                <div className="flex gap-2.5 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                  <Icon className={cn("mt-0.5 size-4 shrink-0", r.level === "critical" ? "text-danger" : r.level === "warning" ? "text-warning" : "text-primary")} />
                  <div>
                    <p className="text-sm font-medium leading-snug">{r.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.text}</p>
                  </div>
                </div>
              );
              return r.href ? <Link key={i} href={r.href}>{body}</Link> : <div key={i}>{body}</div>;
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4" /> Убыточные и низкомаржинальные
            </CardTitle>
            <CardDescription>Прибыль ≤ 0 или маржа ниже 10%</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {d.losing.length === 0 && <p className="text-sm text-muted-foreground">Таких товаров нет 👍</p>}
            {d.losing.map((x) => (
              <Link key={x.productId} href={`/products/${x.productId}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="truncate text-sm">{x.productName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    продано {x.unitsSold} · возвратов {x.unitsReturned}
                  </p>
                </div>
                <div className="tabular text-right">
                  <p className={cn("text-sm font-medium", x.profitKzt < 0 && "text-danger")}>{formatKzt(x.profitKzt)}</p>
                  <p className="text-[11px] text-muted-foreground">маржа {formatPct(x.marginPct)}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="size-4" /> Остатки
            </CardTitle>
            <CardDescription>Требуют внимания: заканчиваются или закончились</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {lowStock.length === 0 && <p className="text-sm text-muted-foreground">Запасов достаточно.</p>}
            {lowStock.slice(0, 6).map((r) => (
              <Link key={r.id} href={`/products/${r.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="truncate text-sm">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.advice.daysOfCover !== null ? `хватит на ~${r.advice.daysOfCover} дн.` : "нет продаж"} · заказать {r.advice.suggestedQty} шт
                  </p>
                </div>
                <Badge variant={r.advice.status === "OUT" ? "danger" : "warning"}>
                  {r.advice.status === "OUT" ? "нет" : `${r.available} шт`}
                </Badge>
              </Link>
            ))}
            <p className="pt-1 text-[11px] text-muted-foreground">
              Всего на складе: {d.stock.rows.reduce((a, r) => a + Math.max(0, r.onHand), 0).toLocaleString("ru-RU")} шт
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="size-4" /> Мониторинг конкурентов
            </CardTitle>
            <CardDescription>Этап 4</CardDescription>
          </CardHeader>
          <CardContent>
            {d.competitorsCount === 0 ? (
              <EmptyState
                icon={Swords}
                title="Конкуренты не подключены"
                text="Модуль появится на этапе 4: добавление ссылок на товары конкурентов, история цен и уведомления. Данные — только из разрешённых источников."
              />
            ) : (
              <p className="text-sm">Отслеживается товаров: {d.competitorsCount}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
