import { siteConfig } from "@/config/site";
import type { DeliveryArea, Product, PublicProduct, PublicVariant, Variant } from "@/lib/types";

/** A sale price only counts when it is a real discount. */
function resolve(price: number, salePrice: number | null) {
  if (salePrice !== null && salePrice >= 0 && salePrice < price) {
    return { price: salePrice, compareAtPrice: price };
  }
  return { price, compareAtPrice: null as number | null };
}

/** Price for a product without choosing a variant. */
export function productPrice(product: Pick<Product, "price" | "salePrice">) {
  return resolve(product.price, product.salePrice);
}

/** Price for one variant. A variant without its own price inherits the product's. */
export function variantPrice(product: Pick<Product, "price" | "salePrice">, variant: Variant) {
  if (variant.price !== null) return resolve(variant.price, variant.salePrice);
  return resolve(product.price, product.salePrice);
}

export function totalStockOf(product: Pick<Product, "variants" | "stock">) {
  if (product.variants.length > 0) {
    return product.variants.reduce((sum, v) => sum + Math.max(0, v.stock), 0);
  }
  return Math.max(0, product.stock);
}

const cap = (stock: number) => Math.max(0, Math.min(stock, siteConfig.order.maxQuantityPerItem));

/** Strip a product down to what the storefront is allowed to see. */
export function toPublicProduct(product: Product, categoryName: string | null): PublicProduct {
  const base = productPrice(product);
  const variants: PublicVariant[] = product.variants.map((v) => {
    const p = variantPrice(product, v);
    return {
      id: v.id,
      name: v.name,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      swatch: v.swatch,
      available: cap(v.stock),
    };
  });
  const prices = variants.length > 0 ? variants.map((v) => v.price) : [base.price];
  const fromPrice = Math.min(...prices);
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    categoryId: product.categoryId,
    categoryName,
    images: product.images,
    price: base.price,
    compareAtPrice: base.compareAtPrice,
    fromPrice,
    hasPriceRange: Math.max(...prices) !== fromPrice,
    onSale:
      variants.length > 0 ? variants.some((v) => v.compareAtPrice !== null) : base.compareAtPrice !== null,
    optionLabel: product.optionLabel,
    variants,
    available: variants.length > 0 ? 0 : cap(product.stock),
    inStock: totalStockOf(product) > 0,
    featured: product.featured,
    createdAt: product.createdAt,
  };
}

export function deliveryFeeFor(
  subtotal: number,
  area: DeliveryArea | undefined,
  freeDeliveryThreshold: number | null,
) {
  if (!area) return 0;
  if (freeDeliveryThreshold !== null && subtotal >= freeDeliveryThreshold) return 0;
  return area.fee;
}
