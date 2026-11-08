import { requireUser } from "@/lib/auth/session";
import { getProductOptions } from "@/lib/queries/product-options";
import { PageHeader } from "@/components/layout/page-header";
import { SubNav, INVENTORY_TABS } from "@/components/layout/sub-nav";
import { AdjustForm } from "@/components/inventory/stock-forms";

export const metadata = { title: "Инвентаризация" };
export const dynamic = "force-dynamic";

export default async function AdjustPage() {
  const user = await requireUser("MANAGER");
  const products = await getProductOptions();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Инвентаризация и списание" description="Исправление остатка по факту пересчёта: брак, потеря, найденный излишек. Каждая операция попадает в журнал." />
      <SubNav items={INVENTORY_TABS} />
      <AdjustForm products={products} isOwner={user.role === "OWNER"} />
    </div>
  );
}
