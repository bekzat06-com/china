import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/components/products/product-form";

export const metadata = { title: "Новый товар" };

export default async function NewProductPage() {
  await requireUser("MANAGER");
  const categories = await db.category.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Новый товар" description="После создания рассчитайте полную себестоимость в калькуляторе." />
      <ProductForm categories={categories} />
    </div>
  );
}
