import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchX } from "lucide-react";
import { CatalogFilters } from "@/components/store/catalog-filters";
import { ProductGrid, ProductGridSkeleton } from "@/components/store/product-card";
import { SideRails } from "@/components/store/side-rails";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { SORT_OPTIONS, filterProducts, getCatalog } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Barcha mahsulotlar",
  description: "Kosmetika va teri parvarishi vositalarining toʻliq katalogi. Qidiring, kategoriya boʻyicha saralang va narx boʻyicha tartiblang.",
  alternates: { canonical: "/products" },
};

const PAGE_SIZE = 24;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <div className="relative">
      <SideRails />
      <div className="container-page py-8 sm:py-10">
        <Suspense
          fallback={
            <>
              <h1 className="text-3xl font-semibold sm:text-4xl">Barcha mahsulotlar</h1>
              <div className="skeleton mt-6 h-[4.25rem] w-full" />
              <div className="mt-8">
                <ProductGridSkeleton />
              </div>
            </>
          }
        >
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/products">, "searchParams">) {
  const params = await searchParams;
  const values = {
    q: first(params.q).trim().slice(0, 80),
    category: first(params.category).slice(0, 80),
    sort: SORT_OPTIONS.some((o) => o.value === first(params.sort)) ? first(params.sort) : "featured",
    inStock: first(params.stock) === "1",
    onSale: first(params.sale) === "1",
  };
  const page = Math.max(1, Math.min(Number.parseInt(first(params.page), 10) || 1, 500));

  const catalog = await getCatalog();
  const matches = filterProducts(catalog, values);
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = matches.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const activeCategory = catalog.categories.find((c) => c.slug === values.category);
  const filtered = Boolean(values.q || values.category || values.inStock || values.onSale);

  const pageHref = (n: number) => {
    const query = new URLSearchParams();
    if (values.q) query.set("q", values.q);
    if (values.category) query.set("category", values.category);
    if (values.sort !== "featured") query.set("sort", values.sort);
    if (values.inStock) query.set("stock", "1");
    if (values.onSale) query.set("sale", "1");
    if (n > 1) query.set("page", String(n));
    const qs = query.toString();
    return qs ? `/products?${qs}` : "/products";
  };

  return (
    <>
      <h1 className="text-3xl font-semibold sm:text-4xl">
        {values.q ? `“${values.q}” boʻyicha natijalar` : (activeCategory?.name ?? "Barcha mahsulotlar")}
      </h1>

      <div className="mt-6">
        {/* The key resets the form's fields when the URL changes (e.g. browser Back). */}
        <CatalogFilters key={JSON.stringify(values)} categories={catalog.categories} sortOptions={SORT_OPTIONS} values={values} />
      </div>

      <p className="mt-5 text-sm text-muted" role="status">
        {matches.length} ta mahsulot
        {filtered && (
          <>
            {" · "}
            <Link href="/products" className="font-medium text-brand-700 underline-offset-4 hover:underline">
              Filtrlarni tozalash
            </Link>
          </>
        )}
      </p>

      <div className="mt-5">
        {visible.length > 0 ? (
          <ProductGrid products={visible} priorityCount={4} />
        ) : (
          <EmptyState
            icon={<SearchX className="size-6" aria-hidden="true" />}
            title={filtered ? "Mos mahsulot topilmadi" : "Hozircha mahsulot yoʻq"}
            action={filtered ? <ButtonLink href="/products">Barcha mahsulotlarni koʻrish</ButtonLink> : undefined}
          >
            {filtered
              ? "Boshqa soʻz bilan qidirib koʻring yoki filtrni olib tashlang."
              : "Katalog tayyorlanmoqda. Keyinroq qayta kiring."}
          </EmptyState>
        )}
      </div>

      {pageCount > 1 && (
        <nav aria-label="Sahifalar" className="mt-10 flex items-center justify-center gap-3">
          {current > 1 ? (
            <Link href={pageHref(current - 1)} className={buttonClass({ variant: "secondary" })}>
              Oldingi
            </Link>
          ) : (
            <span className={buttonClass({ variant: "secondary" }, "opacity-50")} aria-disabled="true">
              Oldingi
            </span>
          )}
          <span className="text-sm text-muted">
            {current} / {pageCount}-sahifa
          </span>
          {current < pageCount ? (
            <Link href={pageHref(current + 1)} className={buttonClass({ variant: "secondary" })}>
              Keyingi
            </Link>
          ) : (
            <span className={buttonClass({ variant: "secondary" }, "opacity-50")} aria-disabled="true">
              Keyingi
            </span>
          )}
        </nav>
      )}
    </>
  );
}
