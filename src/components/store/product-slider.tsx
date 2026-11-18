"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Blossom, Branch, Daisy, Droplet, Leaf, Sprig } from "@/components/store/background-decor";
import { Price, ProductImage } from "@/components/store/product-card";
import { promises } from "@/components/store/promises";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export type ProductSlide = {
  id: string;
  name: string;
  slug: string;
  categoryName: string | null;
  /** Short product description (already trimmed). */
  description: string;
  imageUrl: string | null;
  imageAlt: string;
  price: number;
  compareAtPrice: number | null;
  hasPriceRange: boolean;
  onSale: boolean;
  /** Whole-number percentage off, when the product has one clear discount. */
  discountPercent: number | null;
  /** Name of the choice, e.g. "Rang" or "Hajm", and the first few choices. */
  optionLabel: string;
  options: { name: string; swatch: string | null }[];
  moreOptions: number;
};

/** Time between automatic moves, and how long each slide transition takes. */
const INTERVAL_MS = 2000;
const SLIDE_MS = 1000;

const roundButton =
  "grid size-10 place-items-center rounded-full bg-surface/95 text-ink shadow-card transition-colors hover:bg-brand-50";

/** Plant drawings behind a slide's text, arranged differently for each of three variants. */
function SlideDecor({ variant }: { variant: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      {variant === 0 && (
        <>
          <Branch className="-bottom-12 -left-12 w-44 rotate-[12deg] text-sage opacity-50 sm:w-56" />
          <Blossom className="-top-8 -right-8 w-32 rotate-12 text-brand-300 opacity-70 sm:w-40" />
          <Droplet className="top-1/2 right-6 hidden w-10 text-brand-300 opacity-60 sm:block" />
        </>
      )}
      {variant === 1 && (
        <>
          <Leaf className="-top-6 -left-8 w-32 -rotate-[25deg] text-sage opacity-45 sm:w-40" />
          <Sprig className="-right-4 -bottom-6 w-28 rotate-[18deg] text-sage opacity-50 sm:w-36" />
          <Daisy className="top-6 right-10 hidden w-16 text-brand-300 opacity-70 sm:block" />
        </>
      )}
      {variant === 2 && (
        <>
          <Blossom className="-bottom-14 -left-12 w-36 -rotate-12 text-brand-300 opacity-70 sm:w-44" />
          <Branch className="-top-8 -right-10 w-44 -scale-x-100 rotate-[200deg] text-sage opacity-50 sm:w-56" />
          <Droplet className="bottom-8 left-1/2 hidden w-9 text-brand-300 opacity-60 sm:block" />
        </>
      )}
    </div>
  );
}

/**
 * Advertising-style banner that slides through a few products.
 *
 * Built on native scroll-snap, so swiping works on phones and it needs no
 * library. It advances by itself every 2 seconds and never pauses (it only
 * waits while the browser tab is hidden, and stays still for people who ask
 * their device to reduce motion).
 */
export function ProductSlider({ slides }: { slides: ProductSlide[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const count = slides.length;

  const frameRef = useRef<number | null>(null);

  /** Stop a running slide animation and give scroll-snap back to the browser. */
  const cancelAnimation = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (trackRef.current) trackRef.current.style.scrollSnapType = "";
  }, []);

  // The browser's own smooth scrolling is fast and cannot be slowed down, so
  // the slide is animated by hand. Scroll-snap is switched off while it runs.
  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track || count === 0) return;
      cancelAnimation();
      const left = (((index % count) + count) % count) * track.clientWidth;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const from = track.scrollLeft;
      if (reduce || left === from) {
        track.scrollTo({ left, behavior: "auto" });
        return;
      }
      track.style.scrollSnapType = "none";
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - start) / SLIDE_MS, 1);
        const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // ease in-out
        track.scrollLeft = from + (left - from) * eased;
        if (t < 1) {
          frameRef.current = requestAnimationFrame(step);
        } else {
          frameRef.current = null;
          track.style.scrollSnapType = "";
        }
      };
      frameRef.current = requestAnimationFrame(step);
    },
    [count, cancelAnimation],
  );

  useEffect(() => cancelAnimation, [cancelAnimation]);

  // Advance every 2 seconds. The timer restarts after any change of slide, so
  // a manual arrow, dot or swipe gets a full interval before the next move.
  useEffect(() => {
    if (count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) goTo(active + 1);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [count, active, goTo]);

  if (count === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-brand-50 to-brand-100 shadow-card">
      <ul
        ref={trackRef}
        aria-live="off"
        // A swipe or mouse-wheel scroll takes over from a running animation.
        onPointerDown={cancelAnimation}
        onWheel={cancelAnimation}
        onScroll={(e) => {
          const track = e.currentTarget;
          setActive(Math.round(track.scrollLeft / track.clientWidth));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, index) => (
          <li
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} / ${count}`}
            className="grid w-full flex-none snap-start sm:min-h-80 sm:grid-cols-2 lg:min-h-96"
          >
            <div className="relative isolate flex flex-col items-start justify-center gap-3 overflow-hidden p-6 pb-20 sm:order-1 sm:p-10 sm:pb-20 lg:p-14 lg:pb-20">
              <SlideDecor variant={index % 3} />
              <div className="flex flex-wrap items-center gap-2">
                {slide.onSale && (
                  <Badge tone="brand">{slide.discountPercent ? `Chegirma −${slide.discountPercent}%` : "Chegirma"}</Badge>
                )}
                {slide.categoryName && (
                  <span className="text-xs tracking-wide text-muted uppercase">{slide.categoryName}</span>
                )}
              </div>
              <h3 className="text-2xl leading-tight font-semibold text-balance sm:text-3xl lg:text-4xl">{slide.name}</h3>
              {slide.description && (
                <p className="line-clamp-2 max-w-md text-sm leading-relaxed text-muted sm:line-clamp-3 sm:text-base">
                  {slide.description}
                </p>
              )}
              {slide.options.length > 0 && (
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                    {slide.optionLabel || "Variantlar"}
                  </p>
                  <ul className="mt-1.5 flex max-w-md flex-wrap gap-1.5">
                    {slide.options.map((option) => (
                      <li
                        key={option.name}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium"
                      >
                        {option.swatch && (
                          <span
                            aria-hidden="true"
                            className="size-3 rounded-full border border-black/10"
                            style={{ backgroundColor: option.swatch }}
                          />
                        )}
                        {option.name}
                      </li>
                    ))}
                    {slide.moreOptions > 0 && (
                      <li className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-muted">
                        +{slide.moreOptions}
                      </li>
                    )}
                  </ul>
                </div>
              )}
              <Price price={slide.price} compareAtPrice={slide.compareAtPrice} from={slide.hasPriceRange} size="lg" />
              <ButtonLink href={`/products/${slide.slug}`} className="mt-1">
                Koʻrish
              </ButtonLink>
              <ul className="mt-2 hidden flex-col gap-1.5 text-sm text-muted sm:flex">
                {promises.slice(0, 2).map(({ icon: Icon, title }) => (
                  <li key={title} className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
                    {title}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative aspect-[4/3] bg-sand sm:order-2 sm:aspect-auto">
              <ProductImage
                src={slide.imageUrl}
                alt={slide.imageAlt}
                priority={index === 0}
                className="absolute inset-0"
              />
            </div>
          </li>
        ))}
      </ul>

      {count > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4 sm:px-6 lg:px-10">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-surface/90 px-2 py-1 shadow-card">
            <div className="flex items-center">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={`${index + 1}-slaydga oʻtish`}
                  aria-current={index === active ? "true" : undefined}
                  className="grid size-6 place-items-center"
                >
                  <span
                    className={cn(
                      "block h-2 rounded-full transition-all",
                      index === active ? "w-6 bg-brand-600" : "w-2 bg-brand-300",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="pointer-events-auto flex gap-2">
            <button type="button" onClick={() => goTo(active - 1)} aria-label="Oldingi slayd" className={roundButton}>
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => goTo(active + 1)} aria-label="Keyingi slayd" className={roundButton}>
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
