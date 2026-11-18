import Link from "next/link";
import { Banknote, PackageCheck, PhoneCall, Sparkles } from "lucide-react";
import { ProductGrid, displayCompareAt } from "@/components/store/product-card";
import { ProductSlider } from "@/components/store/product-slider";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { siteConfig } from "@/config/site";
import { filterProducts, getCatalog } from "@/server/catalog";

const promises = [
  {
    icon: Banknote,
    title: "Toʻlov yetkazib berilganda",
    text: "Onlayn toʻlov shart emas. Buyurtma yetib kelganda yoki biz bilan kelishilgan tartibda toʻlaysiz.",
  },
  {
    icon: PhoneCall,
    title: "Telefon orqali tasdiqlanadi",
    text: "Har bir buyurtmani joʻnatishdan oldin qoʻngʻiroq qilib yoki yozib tasdiqlaymiz.",
  },
  {
    icon: PackageCheck,
    title: "Ehtiyotkorlik bilan qadoqlanadi",
    text: "Har bir buyurtma joʻnatishdan oldin tekshiriladi va qoʻlda qadoqlanadi.",
  },
];

export default async function HomePage() {
  const catalog = await getCatalog();
  // Every product, with featured ones first (then in-stock, then newest).
  const products = filterProducts(catalog, { sort: "featured" });
  // The sliding banner advertises products marked "featured" that are in stock.
  const slides = products
    .filter((p) => p.featured && p.inStock)
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      categoryName: p.categoryName,
      imageUrl: p.images[0]?.url ?? null,
      imageAlt: p.images[0]?.alt || p.name,
      price: p.fromPrice,
      compareAtPrice: displayCompareAt(p),
      hasPriceRange: p.hasPriceRange,
      onSale: p.onSale,
    }));

  return (
    <>
      {/* Full-width hero: the photo spans the whole page width, with the text on top. */}
      <section className="relative isolate overflow-hidden border-b border-line bg-ink">
        {/* Replace /public/brand/image.png with your own photo (any image format works). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={siteConfig.heroImage}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 -z-20 size-full object-cover object-[50%_40%]"
        />
        {/* Darkens the photo so the white text stays readable, most on the text side. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-ink/60 sm:bg-transparent sm:bg-gradient-to-r sm:from-ink/80 sm:via-ink/50 sm:to-ink/5"
        />
        <div className="container-page flex min-h-[28rem] items-center py-14 sm:min-h-[32rem] lg:min-h-[38rem] lg:py-20">
          <div className="max-w-xl text-white">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-semibold tracking-wide text-brand-700 uppercase shadow-card">
              <Sparkles className="size-3.5" aria-hidden="true" /> Yangi mavsum tanlovi
            </p>
            <h1 className="mt-4 text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl lg:text-6xl">
              Goʻzallik uchun sara mahsulotlar
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/90 sm:text-lg">
              {siteConfig.name} doʻkonidan teri parvarishi vositalari va kosmetika. Bir necha bosishda onlayn buyurtma bering va yetkazib berilganda toʻlang.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/products" size="lg">
                Katalogni koʻrish
              </ButtonLink>
              <ButtonLink href="/contact" size="lg" variant="secondary">
                Yetkazib berish va aloqa
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {catalog.categories.length > 0 && (
        <section aria-labelledby="categories-heading" className="container-page pt-12">
          <h2 id="categories-heading" className="text-2xl font-semibold sm:text-3xl">
            Kategoriyalar
          </h2>
          <ul className="mt-5 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
            {catalog.categories.map((category) => (
              <li key={category.id} className="shrink-0">
                <Link
                  href={`/products?category=${category.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 text-sm font-medium hover:border-brand-300 hover:bg-brand-50"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {slides.length > 0 && (
        <section
          aria-roledescription="carousel"
          aria-label="Tavsiya etilgan mahsulotlar"
          className="container-page pt-12"
        >
          <ProductSlider slides={slides} />
        </section>
      )}

      <section aria-labelledby="products-heading" className="container-page pt-12">
        <h2 id="products-heading" className="text-2xl font-semibold sm:text-3xl">
          Barcha mahsulotlar
        </h2>
        <div className="mt-6">
          {products.length > 0 ? (
            <ProductGrid products={products} priorityCount={4} />
          ) : (
            <EmptyState title={catalog.configured ? "Mahsulotlar tez orada qoʻshiladi" : "Doʻkon sozlanmoqda"}>
              {catalog.configured
                ? "Katalog tayyorlanmoqda. Keyinroq qayta kiring."
                : "Doʻkon hali maʼlumotlar bazasiga ulanmagan. README boʻyicha Firebase sozlamalarini kiriting, soʻng admin panelda mahsulot qoʻshing."}
            </EmptyState>
          )}
        </div>
      </section>

      <section aria-label="Buyurtma qanday ishlaydi" className="container-page pt-14">
        <ul className="grid gap-4 sm:grid-cols-3">
          {promises.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-2xl border border-line bg-surface p-5">
              <Icon className="size-6 text-brand-600" aria-hidden="true" />
              <h3 className="mt-3 font-sans text-base font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
