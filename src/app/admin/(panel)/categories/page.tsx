import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { CategoriesManager } from "@/components/admin/categories-manager";
import { PageLoading } from "@/components/ui/misc";
import { listCategories } from "@/server/admin/data";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = { title: "Kategoriyalar" };

export default function CategoriesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Categories />
    </Suspense>
  );
}

async function Categories() {
  await requireAdminPage("/admin/categories");
  const categories = await listCategories();
  return (
    <>
      <AdminPageHeader title="Kategoriyalar" description="Xaridorlar oson topishi uchun mahsulotlarni guruhlang." />
      <CategoriesManager categories={categories} />
    </>
  );
}
