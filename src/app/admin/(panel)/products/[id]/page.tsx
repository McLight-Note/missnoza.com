import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ProductForm } from "@/components/admin/product-form";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { PageLoading } from "@/components/ui/misc";
import { getProduct, listCategories } from "@/server/admin/data";
import { requireAdminPage } from "@/server/auth";
import { adminHref } from "@/lib/admin-path";

export const metadata: Metadata = { title: "Mahsulotni tahrirlash" };

export default function EditProductPage(props: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense fallback={<PageLoading label="Mahsulot yuklanmoqda…" />}>
      <EditProduct {...props} />
    </Suspense>
  );
}

async function EditProduct({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  await requireAdminPage();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  const [product, categories] = await Promise.all([getProduct(id), listCategories()]);
  if (!product) notFound();

  return (
    <>
      <Link href={adminHref("/products")} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" /> Barcha mahsulotlar
      </Link>
      <AdminPageHeader
        title={product.name}
        description={product.active ? "Doʻkonda koʻrinadi" : "Doʻkondan yashirilgan"}
        actions={
          product.active ? (
            <ButtonLink href={`/products/${product.slug}`} variant="secondary" size="sm" target="_blank">
              <ExternalLink className="size-4" aria-hidden="true" /> Doʻkonda koʻrish
            </ButtonLink>
          ) : undefined
        }
      />
      {query.saved && (
        <Notice tone="success" className="mb-4">
          Saqlandi. Oʻzgarishlar doʻkonda darhol koʻrinadi.
        </Notice>
      )}
      {/* The key reloads the form with fresh data (and a fresh version) after every save. */}
      <ProductForm key={product.updatedAt} product={product} categories={categories} />
    </>
  );
}
