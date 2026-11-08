import Link from "next/link";
import { Package, Plus, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getStockOverview } from "@/lib/queries/dashboard";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { formatKzt, formatNumber, toNum } from "@/lib/utils";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/labels";

export const metadata = { title: "Товары" };
export const dynamic = "force-dynamic";


export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const where: Prisma.ProductWhereInput = {};
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { nameZh: { contains: q } }];
  if (sp.status && sp.status in STATUS_LABEL) where.status = sp.status as keyof typeof STATUS_LABEL;
  else where.status = { not: "ARCHIVED" };
  if (sp.category) where.categoryId = sp.category;

  const [products, categories, stock, lastCalcs] = await Promise.all([
    db.product.findMany({ where, include: { category: true }, orderBy: [{ status: "asc" }, { name: "asc" }], take: 500 }),
    db.category.findMany({ orderBy: { name: "asc" } }),
    getStockOverview(),
    db.costCalculation.findMany({ where: { productId: { not: null } }, orderBy: { createdAt: "desc" }, select: { productId: true, results: true } }),
  ]);
  const stockBy = new Map(stock.rows.map((r) => [r.id, r]));
  const calcBy = new Map<string, { marginPct: number | null; fullCostPerUnitKzt: number }>();
  for (const c of lastCalcs) if (c.productId && !calcBy.has(c.productId)) calcBy.set(c.productId, c.results as never);
  const canEdit = user.role !== "VIEWER";

  return (
    <>
      <PageHeader title="Товары" description={`${products.length} позиций`}>
        {canEdit && (
          <Link href="/products/new" className={buttonVariants()}>
            <Plus /> Добавить товар
          </Link>
        )}
      </PageHeader>

      <Card className="mb-4 p-3">
        <form className="grid gap-2 sm:grid-cols-[1fr_180px_200px_auto]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Поиск по названию, SKU, 中文…" className="pl-8" />
          </div>
          <Select name="status" defaultValue={sp.status ?? ""}>
            <option value="">Все, кроме архива</option>
            {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <Select name="category" defaultValue={sp.category ?? ""}>
            <option value="">Все категории</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Button type="submit" variant="outline">Найти</Button>
        </form>
      </Card>

      {products.length === 0 ? (
        <EmptyState icon={Package} title="Товары не найдены" text={q ? "Измените условия поиска." : "Добавьте первый товар."} />
      ) : (
        <Card className="px-2 py-1">
          <Table>
            <THead>
              <TR>
                <TH>Товар</TH>
                <TH>Категория</TH>
                <TH className="text-right">Закупка</TH>
                <TH className="text-right">Цена</TH>
                <TH className="text-right">Маржа*</TH>
                <TH className="text-right">Остаток</TH>
                <TH>Статус</TH>
              </TR>
            </THead>
            <TBody className="tabular">
              {products.map((p) => {
                const st = stockBy.get(p.id);
                const calc = calcBy.get(p.id);
                return (
                  <TR key={p.id}>
                    <TD className="max-w-72">
                      <Link href={`/products/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {p.sku} {p.isDemo && <DemoBadge />}
                      </div>
                    </TD>
                    <TD className="text-muted-foreground">{p.category?.name ?? "—"}</TD>
                    <TD className="text-right">{p.purchasePriceCny ? `¥${formatNumber(toNum(p.purchasePriceCny))}` : "—"}</TD>
                    <TD className="text-right">{formatKzt(toNum(p.salePriceKzt))}</TD>
                    <TD className="text-right">{calc?.marginPct != null ? `${calc.marginPct.toFixed(1)}%` : <span className="text-muted-foreground">нет расчёта</span>}</TD>
                    <TD className="text-right">
                      {st ? (
                        <span className={st.advice.status === "OUT" ? "text-danger" : st.advice.status === "LOW" ? "text-warning" : ""}>
                          {st.available}
                        </span>
                      ) : "—"}
                    </TD>
                    <TD>
                      <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <p className="px-3 py-2 text-[11px] text-muted-foreground">* Маржа — из последнего сохранённого расчёта себестоимости по товару.</p>
        </Card>
      )}
    </>
  );
}
