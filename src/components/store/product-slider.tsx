"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Price, ProductImage } from "@/components/store/product-card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export type ProductSlide = {
  id: string;
  name: string;
  slug: string;
  categoryName: string | null;
  imageUrl: string | null;
  imageAlt: string;
  price: number;
  compareAtPrice: number | null;
  hasPriceRange: boolean;
  onSale: boolean;
};

const INTERVAL_MS = 5000;

const roundButton =
  "grid size-10 place-items-center rounded-full bg-surface/95 text-ink shadow-card transition-colors hover:bg-brand-50";

/**
 * Advertising-style banner that slides through a few products.
 *
 * Built on native scroll-snap, so swiping works on phones and it needs no
 * library. It advances by itself, pauses while the pointer, a finger or the
 * keyboard focus is on it (or when the visitor presses pause), and does not
 * auto-advance for people who ask their device to reduce motion.
 */
export function ProductSlider({ slides }: { slides: ProductSlide[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const count = slides.length;
  const playing = count > 1 && !userPaused && !hovering;

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track || count === 0) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const target = (index + count) % count;
      track.scrollTo({ left: target * track.clientWidth, behavior: reduce ? "auto" : "smooth" });
    },
    [count],
  );

  // Advance every few seconds. The timer restarts after any change of slide.
  useEffect(() => {
    if (!playing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) goTo(active + 1);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, active, goTo]);

  if (count === 0) return null;

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-brand-50 to-brand-100 shadow-card"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      onTouchStart={() => setHovering(true)}
      onTouchEnd={() => setHovering(false)}
    >
      <ul
        ref={trackRef}
        aria-live={playing ? "off" : "polite"}
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
            <div className="flex flex-col items-start justify-center gap-3 p-6 pb-20 sm:order-1 sm:p-10 sm:pb-20 lg:p-14 lg:pb-20">
              {slide.onSale && <Badge tone="brand">Chegirma</Badge>}
              {slide.categoryName && <p className="text-xs tracking-wide text-muted uppercase">{slide.categoryName}</p>}
              <h3 className="text-2xl leading-tight font-semibold text-balance sm:text-3xl lg:text-4xl">{slide.name}</h3>
              <Price price={slide.price} compareAtPrice={slide.compareAtPrice} from={slide.hasPriceRange} size="lg" />
              <ButtonLink href={`/products/${slide.slug}`} className="mt-1">
                Koʻrish
              </ButtonLink>
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
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-surface/90 py-1 pr-3 pl-1 shadow-card">
            <button
              type="button"
              onClick={() => setUserPaused((p) => !p)}
              aria-label={userPaused ? "Avto-almashtirishni yoqish" : "Avto-almashtirishni toʻxtatish"}
              className="grid size-8 place-items-center rounded-full text-ink hover:bg-brand-50"
            >
              {userPaused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
            </button>
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
