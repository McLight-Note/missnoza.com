import Link from "next/link";
import { Badge } from "@/components/ui/misc";
import { cn, formatMoney } from "@/lib/utils";
import type { PublicProduct } from "@/lib/types";

/**
 * Product photo. Uploaded images are already resized by the admin uploader,
 * so a plain <img> with lazy loading keeps pages fast with no extra service.
 * To swap in next/image later, this is the only place to change.
 */
export function ProductImage({
  src,
  alt,
  priority,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src || "/placeholders/product.svg"}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={cn("size-full object-cover", className)}
    />
  );
}

export function Price({
  price,
  compareAtPrice,
  from,
  size = "md",
}: {
  price: number;
  compareAtPrice?: number | null;
  from?: boolean;
  size?: "md" | "lg";
}) {
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2", size === "lg" ? "text-2xl" : "text-base")}>
      <span className={cn("font-semibold", compareAtPrice ? "text-brand-700" : "text-ink")}>
        
        {compareAtPrice ? <span className="sr-only">Chegirma narxi: </span> : null}
        {formatMoney(price)}
        {/* Uzbek puts "from" after the amount: "159 000 soʻm dan". */}
        {from && <span className="ml-1 text-sm font-normal text-muted">dan</span>}
      </span>
      {compareAtPrice ? (
        <span className={cn("text-muted line-through", size === "lg" ? "text-base" : "text-sm")}>
          <span className="sr-only">Avvalgi narxi: </span>
          {formatMoney(compareAtPrice)}
        </span>
      ) : null}
    </p>
  );
}

export function ProductCard({ product, priority }: { product: PublicProduct; priority?: boolean }) {
  const image = product.images[0];
  // With several options, show the lowest price as "from"; otherwise the price.
  const single = product.variants.length === 1 ? product.variants[0] : null;
  const compareAt = product.variants.length === 0 ? product.compareAtPrice : (single?.compareAtPrice ?? null);
  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
        <ProductImage
          src={image?.url}
          alt={image?.alt || product.name}
          priority={priority}
          className={cn("transition-transform duration-500 group-hover:scale-[1.03]", !product.inStock && "opacity-60")}
        />
        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
          {!product.inStock ? <Badge tone="dark">Tugagan</Badge> : product.onSale ? <Badge tone="brand">Chegirma</Badge> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-1 px-0.5">
        {product.categoryName && <p className="text-xs tracking-wide text-muted uppercase">{product.categoryName}</p>}
        <h3 className="font-sans text-[15px] leading-snug font-medium text-ink">
          <Link href={`/products/${product.slug}`} className="after:absolute after:inset-0 after:rounded-2xl">
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto pt-1">
          <Price price={product.fromPrice} compareAtPrice={compareAt} from={product.hasPriceRange} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: PublicProduct[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      <span className="sr-only">Mahsulotlar yuklanmoqda…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden="true">
          <div className="skeleton aspect-[4/5]" />
          <div className="skeleton mt-3 h-4 w-3/4" />
          <div className="skeleton mt-2 h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}
