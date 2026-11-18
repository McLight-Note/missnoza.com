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
    .map((p) => {
      const compareAtPrice = displayCompareAt(p);
      const discountPercent =
        compareAtPrice && compareAtPrice > p.fromPrice && !p.hasPriceRange
          ? Math.round((1 - p.fromPrice / compareAtPrice) * 100)
          : null;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        categoryName: p.categoryName,
        description: p.description.trim().slice(0, 200),
        imageUrl: p.images[0]?.url ?? null,
        imageAlt: p.images[0]?.alt || p.name,
        price: p.fromPrice,
        compareAtPrice,
        hasPriceRange: p.hasPriceRange,
        onSale: p.onSale,
        discountPercent: discountPercent && discountPercent > 0 ? discountPercent : null,
        optionLabel: p.optionLabel,
        options: p.variants.slice(0, 6).map((v) => ({ name: v.name, swatch: v.swatch })),
        moreOptions: Math.max(0, p.variants.length - 6),
      };
    });
}
