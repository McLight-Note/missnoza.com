import Link from "next/link";
import { Send } from "lucide-react";
import { featuredSlides } from "@/components/store/featured";
import { Price, ProductImage } from "@/components/store/product-card";
import { promises } from "@/components/store/promises";
import { buttonClass } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { filterProducts, getCatalog } from "@/server/catalog";

/*
 * Content for the empty space beside the page on wide screens.
 *
 * The page content is 76rem wide and centred, so on a wide monitor there is a
 * margin on each side. Each rail sits in that margin, hugging the content, and
 * its width grows with the screen. Below 1700px wide there is no room, so the
 * rails are hidden and nothing changes. Put <SideRails /> inside a `relative`
 * wrapper: the rails stretch to its height and their cards stay in view
 * (sticky) while the visitor scrolls.
 */
const rail = "absolute inset-y-0 hidden w-[clamp(11rem,calc(50vw_-_41rem),16rem)] min-[1700px]:block";

export async function SideRails() {
  const catalog = await getCatalog();
  const picks = featuredSlides(filterProducts(catalog, { sort: "featured" }), 2);

  return (
    <>
      <aside aria-label="Doʻkon haqida" className={cn(rail, "right-[calc(50%_+_39.5rem)]")}>
        <div className="sticky top-24 space-y-4 py-12">
          <div className="rounded-2xl border border-line bg-brand-50 p-4">
            <span className="grid size-10 place-items-center rounded-full bg-brand-600 text-white">
              <Send className="size-4" aria-hidden="true" />
            </span>
            <p className="mt-3 font-display text-xl leading-tight font-semibold">Telegram kanalimiz</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">Yangiliklar va aksiyalardan birinchi boʻlib xabardor boʻling.</p>
            <a
              href={siteConfig.telegramChannel}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass({ size: "sm" }, "mt-3 w-full")}
            >
              Qoʻshilish
            </a>
          </div>
          <ul className="space-y-3">
            {promises.map(({ icon: Icon, title }) => (
              <li key={title} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
                <Icon className="size-5 shrink-0 text-brand-600" aria-hidden="true" />
                <span className="text-sm leading-snug font-medium">{title}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {picks.length > 0 && (
        <aside aria-label="Tavsiya etilgan mahsulotlar" className={cn(rail, "left-[calc(50%_+_39.5rem)]")}>
          <div className="sticky top-24 space-y-4 py-12">
            <p className="font-display text-xl font-semibold">Tavsiya etamiz</p>
            {picks.map((pick) => (
              <Link
                key={pick.id}
                href={`/products/${pick.slug}`}
                className="group block rounded-2xl border border-line bg-surface p-2 shadow-card transition-colors hover:border-brand-300"
              >
                <div className="aspect-[4/5] overflow-hidden rounded-xl bg-sand">
                  <ProductImage
                    src={pick.imageUrl}
                    alt={pick.imageAlt}
                    className="transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </div>
                <p className="mt-2 line-clamp-2 px-1 text-sm leading-snug font-medium">{pick.name}</p>
                <div className="px-1 pt-0.5 pb-1">
                  <Price price={pick.price} compareAtPrice={pick.compareAtPrice} from={pick.hasPriceRange} />
                </div>
              </Link>
            ))}
          </div>
        </aside>
      )}
    </>
  );
}
