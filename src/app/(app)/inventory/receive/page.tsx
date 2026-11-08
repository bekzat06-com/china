import { requireUser } from "@/lib/auth/session";
import { getProductOptions } from "@/lib/queries/product-options";
import { PageHeader } from "@/components/layout/page-header";
import { SubNav, INVENTORY_TABS } from "@/components/layout/sub-nav";
import { ReceiveForm } from "@/components/inventory/stock-forms";

export const metadata = { title: "Приход товара" };
export const dynamic = "force-dynamic";

export default async function ReceivePage({ searchParams }: { searchParams: Promise<{ productId?: string }> }) {
  await requireUser("MANAGER");
  const { productId } = await searchParams;
  const products = await getProductOptions();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Приход товара" description="Каждый приход — отдельная партия со своей себестоимостью. Продажи списывают партии по FIFO (сначала старые)." />
      <SubNav items={INVENTORY_TABS} />
      <ReceiveForm products={products} initialProductId={productId} />
    </div>
  );
}
