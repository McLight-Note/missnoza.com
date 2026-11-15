import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { ProductGrid } from "@/components/store/product-card";
import { ProductGallery, ProductPurchase } from "@/components/store/product-purchase";
import { siteConfig } from "@/config/site";
import { getCatalog } from "@/server/catalog";

type Props = PageProps<"/products/[slug]">;
const PLACEHOLDER = "__placeholder__";

/** Prerender every visible product; new ones are generated on first visit. */
export async function generateStaticParams() {
  const { products } = await getCatalog();
  return products.length > 0 ? products.map((p) => ({ slug: p.slug })) : [{ slug: PLACEHOLDER }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { products } = await getCatalog();
  const product = products.find((p) => p.slug === slug);
  if (!product) return { title: "Mahsulot topilmadi", robots: { index: false } };
  const description = product.description.replace(/\s+/g, " ").slice(0, 155) || siteConfig.description;
  const image = product.images[0]?.url;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title: product.name, description, type: "website", images: image ? [{ url: image }] : undefined },
  };
}

export default function ProductPage({ params }: Props) {
  return (
    <div className="container-page py-6 sm:py-10">
      <Suspense fallback={<ProductSkeleton />}>
        <ProductDetails params={params} />
      </Suspense>
    </div>
  );
}

async function ProductDetails({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const product = catalog.products.find((p) => p.slug === slug);
  if (!product) notFound();

  const category = catalog.categories.find((c) => c.id === product.categoryId);
  const related = catalog.products
    .filter((p) => p.id !== product.id && p.categoryId === product.categoryId && p.inStock)
    .slice(0, 4);

  // Structured data for search engines: factual fields only, no claims.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image: product.images.map((i) => (i.url.startsWith("/") ? `${siteConfig.url}${i.url}` : i.url)),
    category: product.categoryName || undefined,
    offers: {
      "@type": "Offer",
      url: `${siteConfig.url}/products/${product.slug}`,
      priceCurrency: siteConfig.currency.code,
      price: (product.fromPrice / 10 ** siteConfig.currency.fractionDigits).toFixed(siteConfig.currency.fractionDigits),
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <nav aria-label="Yoʻl" className="mb-5 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/products" className="hover:text-ink hover:underline">
              Katalog
            </Link>
          </li>
          {category && (
            <li className="flex items-center gap-1">
              <ChevronRight className="size-3.5" aria-hidden="true" />
              <Link href={`/products?category=${category.slug}`} className="hover:text-ink hover:underline">
                {category.name}
              </Link>
            </li>
          )}
          <li className="flex items-center gap-1" aria-current="page">
            <ChevronRight className="size-3.5" aria-hidden="true" />
            <span className="text-ink">{product.name}</span>
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <ProductGallery product={product} />
        <div className="md:py-2">
          {product.categoryName && <p className="text-xs tracking-wide text-muted uppercase">{product.categoryName}</p>}
          <h1 className="mt-1 text-3xl leading-tight font-semibold sm:text-4xl">{product.name}</h1>
          <div className="mt-5">
            {/* The key resets the chosen option if the product data changes. */}
            <ProductPurchase key={product.id} product={product} />
          </div>
          {product.description && (
            <section aria-labelledby="description-heading" className="mt-8 border-t border-line pt-6">
              <h2 id="description-heading" className="font-sans text-sm font-semibold tracking-wide uppercase">
                Tavsif
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed whitespace-pre-line text-ink/90">{product.description}</div>
            </section>
          )}
          <p className="mt-6 rounded-xl bg-sand px-4 py-3 text-sm leading-relaxed text-muted">
            Toʻlov yetkazib berilganda. Har bir buyurtmani joʻnatishdan oldin telefon orqali tasdiqlaymiz.{" "}
            <Link href="/contact" className="font-medium text-brand-700 underline-offset-4 hover:underline">
              Yetkazib berish haqida
            </Link>
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-16">
          <h2 id="related-heading" className="text-2xl font-semibold sm:text-3xl">
            Sizga yoqishi mumkin
          </h2>
          <div className="mt-6">
            <ProductGrid products={related} />
          </div>
        </section>
      )}
    </>
  );
}

function ProductSkeleton() {
  return (
    <div role="status" className="grid gap-8 md:grid-cols-2 md:gap-12">
      <span className="sr-only">Mahsulot yuklanmoqda…</span>
      <div className="skeleton aspect-[4/5]" />
      <div className="space-y-4 md:py-2">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-10 w-3/4" />
        <div className="skeleton h-8 w-32" />
        <div className="skeleton h-12 w-full" />
        <div className="skeleton h-32 w-full" />
      </div>
    </div>
  );
}
