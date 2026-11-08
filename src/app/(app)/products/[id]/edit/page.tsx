import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toNum } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/components/products/product-form";

export const metadata = { title: "Редактирование товара" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("MANAGER");
  const { id } = await params;
  const [p, categories] = await Promise.all([db.product.findUnique({ where: { id } }), db.category.findMany({ orderBy: { name: "asc" } })]);
  if (!p) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Редактирование" description={p.name} />
      <ProductForm
        categories={categories}
        values={{
          ...p,
          purchasePriceCny: toNum(p.purchasePriceCny),
          salePriceKzt: toNum(p.salePriceKzt),
          kaspiCommissionPct: toNum(p.kaspiCommissionPct),
          weightKg: toNum(p.weightKg),
          lengthCm: toNum(p.lengthCm),
          widthCm: toNum(p.widthCm),
          heightCm: toNum(p.heightCm),
        }}
      />
    </div>
  );
}
