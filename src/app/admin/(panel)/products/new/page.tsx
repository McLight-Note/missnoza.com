import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ProductForm } from "@/components/admin/product-form";
import { FreshOnNavigate } from "@/components/ui/fresh-on-navigate";
import { PageLoading } from "@/components/ui/misc";
import { listCategories } from "@/server/admin/data";
import { requireAdminPage } from "@/server/auth";
import { adminHref } from "@/lib/admin-path";

export const metadata: Metadata = { title: "Mahsulot qoʻshish" };

export default function NewProductPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewProduct />
    </Suspense>
  );
}

async function NewProduct() {
  await requireAdminPage();
  const categories = await listCategories();
  return (
    <>
      <Link href={adminHref("/products")} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" /> Barcha mahsulotlar
      </Link>
      <AdminPageHeader title="Mahsulot qoʻshish" />
      {/* Start with an empty form each time, not the previous product's draft. */}
      <FreshOnNavigate>
        <ProductForm product={null} categories={categories} />
      </FreshOnNavigate>
    </>
  );
}
