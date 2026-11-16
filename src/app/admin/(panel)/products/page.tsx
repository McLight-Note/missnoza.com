import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ProductsTable } from "@/components/admin/products-table";
import { ButtonLink } from "@/components/ui/button";
import { PageLoading } from "@/components/ui/misc";
import { getSettings, listCategories, listProducts } from "@/server/admin/data";
import { requireAdminPage } from "@/server/auth";
import { adminHref } from "@/lib/admin-path";

export const metadata: Metadata = { title: "Mahsulotlar" };

export default function ProductsPage() {
  return (
    <Suspense fallback={<PageLoading label="Mahsulotlar yuklanmoqda…" />}>
      <Products />
    </Suspense>
  );
}

async function Products() {
  await requireAdminPage();
  const [products, categories, settings] = await Promise.all([listProducts(), listCategories(), getSettings()]);
  return (
    <>
      <AdminPageHeader
        title="Mahsulotlar"
        description={`${products.length} ta mahsulot`}
        actions={
          <ButtonLink href={adminHref("/products/new")}>
            <Plus className="size-4" aria-hidden="true" /> Mahsulot qoʻshish
          </ButtonLink>
        }
      />
      <ProductsTable products={products} categories={categories} lowStockThreshold={settings.lowStockThreshold} />
    </>
  );
}
