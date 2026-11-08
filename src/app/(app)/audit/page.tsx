import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Журнал операций" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireUser("OWNER");
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { name: true } } } });
  return (
    <>
      <PageHeader title="Журнал операций" description="Последние 200 действий: входы, изменения товаров, настроек, расчётов" />
      <Card className="px-2 py-1">
        <Table>
          <THead><TR><TH>Время</TH><TH>Пользователь</TH><TH>Действие</TH><TH>Объект</TH><TH>IP</TH></TR></THead>
          <TBody>
            {logs.map((l) => (
              <TR key={l.id}>
                <TD className="whitespace-nowrap text-xs">{formatDateTime(l.createdAt)}</TD>
                <TD>{l.user?.name ?? "—"}</TD>
                <TD><code className="text-xs">{l.action}</code></TD>
                <TD className="text-xs text-muted-foreground">{l.entity ? `${l.entity}:${l.entityId ?? ""}` : ""}</TD>
                <TD className="text-xs text-muted-foreground">{l.ip ?? ""}</TD>
              </TR>
            ))}
            {logs.length === 0 && <TR><TD colSpan={5} className="text-center text-muted-foreground">Записей нет</TD></TR>}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
