import { displayCompareAt } from "@/components/store/product-card";
import type { ProductSlide } from "@/components/store/product-slider";
import type { PublicProduct } from "@/lib/types";

/**
 * Featured, in-stock products reduced to what the sliding banner and the side
 * rails need. Pass products already sorted with featured ones first.
 */
export function featuredSlides(products: PublicProduct[], limit = 6): ProductSlide[] {
  return products
    .filter((p) => p.featured && p.inStock)
    .slice(0, limit)
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
}
