import { Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deleteExpenseAction } from "@/app/actions/sales";
import { PageHeader } from "@/components/layout/page-header";
import { SubNav, SALES_TABS } from "@/components/layout/sub-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ExpenseForm } from "@/components/sales/expense-form";
import { EXPENSE_LABEL } from "@/lib/labels";
import { formatDate, formatKzt, toNum } from "@/lib/utils";

export const metadata = { title: "Расходы" };
export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const user = await requireUser();
  const since = new Date(Date.now() - 90 * 86400_000);
  const [expenses, byCat] = await Promise.all([
    db.expense.findMany({ where: { date: { gte: since } }, orderBy: { date: "desc" }, take: 300 }),
    db.expense.groupBy({ by: ["category"], where: { date: { gte: since } }, _sum: { amountKzt: true } }),
  ]);
  const total = byCat.reduce((s, c) => s + (toNum(c._sum.amountKzt) ?? 0), 0);
  const canEdit = user.role !== "VIEWER";
  return (
    <>
      <PageHeader title="Общие расходы" description="Реклама, аренда, зарплата, сервисы — всё, что не привязано к конкретному заказу. Учитывается в чистой прибыли." />
      <SubNav items={SALES_TABS} />
      {canEdit && <Card className="mb-4"><CardContent className="pt-5"><ExpenseForm /></CardContent></Card>}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="px-2 py-1">
          <Table>
            <THead><TR><TH>Дата</TH><TH>Категория</TH><TH>Комментарий</TH><TH className="text-right">Сумма</TH>{canEdit && <TH />}</TR></THead>
            <TBody className="tabular">
              {expenses.map((e) => (
                <TR key={e.id}>
                  <TD className="text-xs">{formatDate(e.date)}</TD>
                  <TD>{EXPENSE_LABEL[e.category]}</TD>
                  <TD className="text-xs text-muted-foreground">{e.note ?? ""} {e.isDemo && <DemoBadge />}</TD>
                  <TD className="text-right">{formatKzt(toNum(e.amountKzt))}</TD>
                  {canEdit && (
                    <TD className="text-right">
                      <form action={deleteExpenseAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <Button size="icon" variant="ghost" aria-label="Удалить расход"><Trash2 /></Button>
                      </form>
                    </TD>
                  )}
                </TR>
              ))}
              {expenses.length === 0 && <TR><TD colSpan={5} className="text-center text-muted-foreground">Расходов нет</TD></TR>}
            </TBody>
          </Table>
        </Card>
        <Card>
          <CardHeader><CardTitle>За 90 дней</CardTitle><CardDescription>По категориям</CardDescription></CardHeader>
          <CardContent>
            <dl className="tabular flex flex-col gap-2 text-sm">
              {byCat.sort((a, b) => (toNum(b._sum.amountKzt) ?? 0) - (toNum(a._sum.amountKzt) ?? 0)).map((c) => (
                <div key={c.category} className="flex justify-between"><dt className="text-muted-foreground">{EXPENSE_LABEL[c.category]}</dt><dd>{formatKzt(toNum(c._sum.amountKzt))}</dd></div>
              ))}
              <div className="flex justify-between border-t pt-2 font-semibold"><dt>Итого</dt><dd>{formatKzt(total)}</dd></div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
