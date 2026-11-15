import Link from "next/link";
import { Banknote, PackageCheck, PhoneCall, Sparkles } from "lucide-react";
import { ProductGrid } from "@/components/store/product-card";
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
  const ranked = filterProducts(catalog, { sort: "featured" });
  // Featured products if any are marked, otherwise the first few in the default order.
  const picked = ranked.filter((p) => p.featured).slice(0, 8);
  const featured = picked.length > 0 ? picked : ranked.slice(0, 4);
  const newest = filterProducts(catalog, { sort: "newest" })
    .filter((p) => !featured.some((f) => f.id === p.id))
    .slice(0, 4);

  return (
    <>
      <section className="border-b border-line bg-gradient-to-b from-brand-50 to-cream">
        <div className="container-page grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-semibold tracking-wide text-brand-700 uppercase shadow-card">
              <Sparkles className="size-3.5" aria-hidden="true" /> Yangi mavsum tanlovi
            </p>
            <h1 className="mt-4 text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl lg:text-6xl">
              Goʻzallik uchun sara mahsulotlar
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted sm:text-lg">
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
          <div className="relative mx-auto aspect-[5/4] w-full max-w-lg overflow-hidden rounded-3xl bg-brand-100 shadow-card lg:max-w-none">
            {/* Replace /public/brand/hero.svg with your own photo (any image format works). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={siteConfig.heroImage} alt="" fetchPriority="high" className="size-full object-cover" />
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

      <section aria-labelledby="featured-heading" className="container-page pt-12">
        <div className="flex items-end justify-between gap-4">
          <h2 id="featured-heading" className="text-2xl font-semibold sm:text-3xl">
            Xaridorlar tanlovi
          </h2>
          {featured.length > 0 && (
            <Link href="/products" className="text-sm font-semibold text-brand-700 underline-offset-4 hover:underline">
              Hammasini koʻrish
            </Link>
          )}
        </div>
        <div className="mt-6">
          {featured.length > 0 ? (
            <ProductGrid products={featured} priorityCount={2} />
          ) : (
            <EmptyState title={catalog.configured ? "Mahsulotlar tez orada qoʻshiladi" : "Doʻkon sozlanmoqda"}>
              {catalog.configured
                ? "Katalog tayyorlanmoqda. Keyinroq qayta kiring."
                : "Doʻkon hali maʼlumotlar bazasiga ulanmagan. README boʻyicha Firebase sozlamalarini kiriting, soʻng admin panelda mahsulot qoʻshing."}
            </EmptyState>
          )}
        </div>
      </section>

      {newest.length > 0 && (
        <section aria-labelledby="new-heading" className="container-page pt-14">
          <h2 id="new-heading" className="text-2xl font-semibold sm:text-3xl">
            Yangi kelganlar
          </h2>
          <div className="mt-6">
            <ProductGrid products={newest} />
          </div>
        </section>
      )}

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
