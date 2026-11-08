import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { SubNav, SALES_TABS } from "@/components/layout/sub-nav";
import { ImportWizard } from "@/components/sales/import-wizard";

export const metadata = { title: "Импорт заказов" };

export default async function ImportPage() {
  await requireUser("MANAGER");
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Импорт заказов из Excel/CSV"
        description="Например, выгрузка заказов из кабинета продавца Kaspi. Формат файла не «зашит»: вы сами указываете, какая колонка что означает. Повторная загрузка того же файла не создаст дублей."
      />
      <SubNav items={SALES_TABS} />
      <ImportWizard />
    </div>
  );
}
