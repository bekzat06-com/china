import { requireUser } from "@/lib/auth/session";
import { getProductOptions } from "@/lib/queries/product-options";
import { getBusinessSettings } from "@/lib/settings";
import { PageHeader } from "@/components/layout/page-header";
import { SubNav, SALES_TABS } from "@/components/layout/sub-nav";
import { OrderForm } from "@/components/sales/order-form";

export const metadata = { title: "Новый заказ" };
export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  await requireUser("MANAGER");
  const [products, settings] = await Promise.all([getProductOptions(), getBusinessSettings()]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Новый заказ" description="Товар списывается со склада по FIFO, себестоимость фиксируется на момент продажи. Продать больше остатка нельзя." />
      <SubNav items={SALES_TABS} />
      <OrderForm products={products} defaultCommissionPct={settings.kaspiCommissionPct} />
    </div>
  );
}
