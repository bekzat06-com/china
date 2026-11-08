import Link from "next/link";
import type { MovementType, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { SubNav, INVENTORY_TABS } from "@/components/layout/sub-nav";
import { Card } from "@/components/ui/card";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { MOVEMENT_LABEL } from "@/lib/labels";
import { cn, formatDateTime, formatKzt, toNum } from "@/lib/utils";

export const metadata = { title: "Движения склада" };
export const dynamic = "force-dynamic";

const PAGE = 100;

export default async function MovementsPage({ searchParams }: { searchParams: Promise<{ type?: string; productId?: string; page?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.StockMovementWhereInput = {};
  if (sp.type && sp.type in MOVEMENT_LABEL) where.type = sp.type as MovementType;
  if (sp.productId) where.productId = sp.productId;
  const [moves, total, products] = await Promise.all([
    db.stockMovement.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { product: { select: { name: true, sku: true } } } }),
    db.stockMovement.count({ where }),
    db.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const qs = (p: number) => `/inventory/movements?${new URLSearchParams({ ...(sp.type ? { type: sp.type } : {}), ...(sp.productId ? { productId: sp.productId } : {}), page: String(p) })}`;
  return (
    <>
      <PageHeader title="Движения склада" description={`Журнал всех операций с товаром · ${total.toLocaleString("ru-RU")} записей`} />
      <SubNav items={INVENTORY_TABS} />
      <Card className="mb-4 p-3">
        <form className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
          <Select name="productId" defaultValue={sp.productId ?? ""}>
            <option value="">Все товары</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select name="type" defaultValue={sp.type ?? ""}>
            <option value="">Все операции</option>
            {Object.entries(MOVEMENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <Button variant="outline">Показать</Button>
        </form>
      </Card>
      <Card className="px-2 py-1">
        <Table>
          <THead><TR><TH>Дата</TH><TH>Товар</TH><TH>Операция</TH><TH className="text-right">Кол-во</TH><TH className="text-right">Себест./шт</TH><TH>Примечание</TH></TR></THead>
          <TBody className="tabular">
            {moves.map((m) => {
              const sign = m.type === "OUT" || m.type === "RESERVE" ? -1 : m.type === "ADJUST" ? Math.sign(m.quantity) : 1;
              const qty = Math.abs(m.quantity) * sign;
              return (
                <TR key={m.id}>
                  <TD className="whitespace-nowrap text-xs">{formatDateTime(m.createdAt)}</TD>
                  <TD className="max-w-56"><Link href={`/products/${m.productId}`} className="line-clamp-1 hover:underline">{m.product.name}</Link></TD>
                  <TD><Badge variant={m.type === "IN" ? "success" : m.type === "OUT" ? "default" : m.type === "RETURN" ? "warning" : "muted"}>{MOVEMENT_LABEL[m.type]}</Badge></TD>
                  <TD className={cn("text-right font-medium", qty < 0 ? "text-danger" : "text-success")}>{qty > 0 ? `+${qty}` : qty}</TD>
                  <TD className="text-right">{formatKzt(toNum(m.unitCostKzt))}</TD>
                  <TD className="text-xs text-muted-foreground">{m.note ?? ""} {m.isDemo && <DemoBadge />}</TD>
                </TR>
              );
            })}
            {moves.length === 0 && <TR><TD colSpan={6} className="text-center text-muted-foreground">Записей нет</TD></TR>}
          </TBody>
        </Table>
      </Card>
      {total > PAGE && (
        <div className="mt-3 flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={qs(page - 1)} className="text-primary hover:underline">← Назад</Link>}
          <span className="text-muted-foreground">стр. {page} из {Math.ceil(total / PAGE)}</span>
          {page * PAGE < total && <Link href={qs(page + 1)} className="text-primary hover:underline">Далее →</Link>}
        </div>
      )}
    </>
  );
}
