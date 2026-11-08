import Link from "next/link";
import { Download, Plus, Upload } from "lucide-react";
import type { OrderSource, OrderStatus, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { SubNav, SALES_TABS } from "@/components/layout/sub-nav";
import { Card } from "@/components/ui/card";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { OrderActions } from "@/components/sales/order-actions";
import { ORDER_SOURCE_LABEL, ORDER_STATUS_LABEL, ORDER_STATUS_VARIANT } from "@/lib/labels";
import { rowFinancials } from "@/lib/finance/sales-analytics";
import { cn, formatDateTime, formatKzt, toNum } from "@/lib/utils";

export const metadata = { title: "Заказы" };
export const dynamic = "force-dynamic";

const PAGE = 50;
const PERIODS = { "7": "7 дней", "30": "30 дней", "90": "90 дней", all: "Всё время" } as const;

export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = (sp.period && sp.period in PERIODS ? sp.period : "30") as keyof typeof PERIODS;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const where: Prisma.OrderWhereInput = {};
  if (period !== "all") where.orderedAt = { gte: new Date(Date.now() - Number(period) * 86400_000) };
  if (sp.status && sp.status in ORDER_STATUS_LABEL) where.status = sp.status as OrderStatus;
  if (sp.source && sp.source in ORDER_SOURCE_LABEL) where.source = sp.source as OrderSource;
  if (q) where.OR = [{ externalId: { contains: q, mode: "insensitive" } }, { items: { some: { product: { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } } } }];

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { orderedAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { items: { include: { product: { select: { id: true, name: true } } } } },
    }),
    db.order.count({ where }),
  ]);
  const params = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]);
  const pageUrl = (p: number) => `/sales?${new URLSearchParams({ ...Object.fromEntries(params), page: String(p) })}`;
  const canEdit = user.role !== "VIEWER";

  return (
    <>
      <PageHeader title="Продажи" description={`${total.toLocaleString("ru-RU")} заказов за выбранный период`}>
        <a href={`/api/export/orders?${params}`} className={buttonVariants({ variant: "outline" })}><Download /> Выгрузить CSV</a>
        {canEdit && (
          <>
            <Link href="/sales/import" className={buttonVariants({ variant: "outline" })}><Upload /> Импорт</Link>
            <Link href="/sales/new" className={buttonVariants()}><Plus /> Заказ</Link>
          </>
        )}
      </PageHeader>
      <SubNav items={SALES_TABS} />

      <Card className="mb-4 p-3">
        <form className="grid gap-2 sm:grid-cols-[1fr_140px_150px_140px_auto]">
          <Input name="q" defaultValue={q} placeholder="Номер заказа, товар или SKU" />
          <Select name="period" defaultValue={period}>{Object.entries(PERIODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          <Select name="status" defaultValue={sp.status ?? ""}>
            <option value="">Все статусы</option>
            {Object.entries(ORDER_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <Select name="source" defaultValue={sp.source ?? ""}>
            <option value="">Все источники</option>
            {Object.entries(ORDER_SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <Button variant="outline">Найти</Button>
        </form>
      </Card>

      <Card className="px-2 py-1">
        <Table>
          <THead>
            <TR><TH>Дата</TH><TH>Заказ</TH><TH>Товары</TH><TH className="text-right">Сумма</TH><TH className="text-right">Прибыль</TH><TH>Статус</TH>{canEdit && <TH />}</TR>
          </THead>
          <TBody className="tabular">
            {orders.map((o) => {
              let revenue = 0, profit = 0;
              for (const i of o.items) {
                const f = rowFinancials({
                  orderId: o.id, orderedAt: o.orderedAt, status: o.status, productId: i.productId, productName: "", sku: "",
                  quantity: i.quantity, returnedQty: i.returnedQty, unitPriceKzt: toNum(i.unitPriceKzt) ?? 0,
                  commissionKzt: toNum(i.commissionKzt) ?? 0, deliveryKzt: toNum(i.deliveryKzt) ?? 0, unitCostKzt: toNum(i.unitCostKzt) ?? 0,
                });
                if (o.status !== "CANCELLED") { revenue += f.revenue; profit += f.profit; }
              }
              return (
                <TR key={o.id}>
                  <TD className="whitespace-nowrap text-xs">{formatDateTime(o.orderedAt)}</TD>
                  <TD>
                    <p className="text-xs font-medium">{o.externalId ?? "без номера"}</p>
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">{ORDER_SOURCE_LABEL[o.source]}{o.customerCity ? ` · ${o.customerCity}` : ""} {o.isDemo && <DemoBadge />}</p>
                  </TD>
                  <TD className="max-w-64">
                    {o.items.map((i) => (
                      <p key={i.id} className="line-clamp-1 text-xs">
                        <Link href={`/products/${i.product.id}`} className="hover:underline">{i.product.name}</Link> × {i.quantity}
                      </p>
                    ))}
                  </TD>
                  <TD className="text-right">{formatKzt(revenue)}</TD>
                  <TD className={cn("text-right", profit < 0 && "text-danger")}>{o.status === "CANCELLED" ? "—" : formatKzt(profit)}</TD>
                  <TD><Badge variant={ORDER_STATUS_VARIANT[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></TD>
                  {canEdit && <TD><OrderActions orderId={o.id} status={o.status} label={o.externalId ?? ""} /></TD>}
                </TR>
              );
            })}
            {orders.length === 0 && <TR><TD colSpan={7} className="text-center text-muted-foreground">Заказов нет</TD></TR>}
          </TBody>
        </Table>
      </Card>
      {total > PAGE && (
        <div className="mt-3 flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={pageUrl(page - 1)} className="text-primary hover:underline">← Назад</Link>}
          <span className="text-muted-foreground">стр. {page} из {Math.ceil(total / PAGE)}</span>
          {page * PAGE < total && <Link href={pageUrl(page + 1)} className="text-primary hover:underline">Далее →</Link>}
        </div>
      )}
    </>
  );
}
