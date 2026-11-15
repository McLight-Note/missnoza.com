import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { toPublicProduct } from "@/lib/pricing";
import { adminDb, isAdminConfigured } from "@/server/firebase-admin";
import { mapCategory, mapProduct, mapSettings } from "@/server/mappers";
import type { Category, PublicProduct, PublicSettings } from "@/lib/types";

export const CATALOG_TAG = "catalog";
export const SETTINGS_TAG = "settings";

export type Catalog = {
  /** False until Firebase environment variables are set. */
  configured: boolean;
  products: PublicProduct[];
  categories: Category[];
};

/**
 * The public catalogue: visible products and categories.
 *
 * Cached so storefront pages are served instantly; admin changes expire the
 * `catalog` tag immediately, and it also refreshes on its own every few
 * minutes. Only public fields leave this function (raw stock stays private).
 */
export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife({ stale: 300, revalidate: 300, expire: 86400 });

  if (!isAdminConfigured()) return { configured: false, products: [], categories: [] };

  const db = adminDb();
  const [productSnap, categorySnap] = await Promise.all([
    db.collection("products").where("active", "==", true).get(),
    db.collection("categories").get(),
  ]);
  const categories = categorySnap.docs
    .map(mapCategory)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "uz"));
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const products = productSnap.docs
    .map(mapProduct)
    .map((p) => toPublicProduct(p, p.categoryId ? (categoryNames.get(p.categoryId) ?? null) : null));

  return { configured: true, products, categories };
}

/** Settings the storefront may show (never includes the owner's email). */
export async function getPublicSettings(): Promise<PublicSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife({ stale: 300, revalidate: 300, expire: 86400 });

  const full = isAdminConfigured()
    ? mapSettings((await adminDb().collection("settings").doc("store").get()).data())
    : mapSettings(undefined);
  return {
    deliveryAreas: full.deliveryAreas,
    freeDeliveryThreshold: full.freeDeliveryThreshold,
    contact: full.contact,
    announcement: full.announcement,
    ordersEnabled: full.ordersEnabled,
  };
}

export type CatalogQuery = {
  q?: string;
  category?: string;
  sort?: string;
  inStock?: boolean;
  onSale?: boolean;
};

export const SORT_OPTIONS = [
  { value: "featured", label: "Tavsiya etilgan" },
  { value: "newest", label: "Yangi kelganlar" },
  { value: "price-asc", label: "Narx: arzonidan" },
  { value: "price-desc", label: "Narx: qimmatidan" },
  { value: "name", label: "Nomi boʻyicha" },
] as const;

/** Search, filter and sort the cached catalogue in memory. */
export function filterProducts(catalog: Catalog, query: CatalogQuery): PublicProduct[] {
  // Customers type oʻ / gʻ in several ways (o', o`, oʻ): ignore the apostrophe.
  const plain = (text: string) => text.toLowerCase().replace(/[\u02bb\u02bc'\u2019\u2018`]/g, "");
  const terms = plain(query.q || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  const category = query.category ? catalog.categories.find((c) => c.slug === query.category) : undefined;

  const result = catalog.products.filter((p) => {
    if (query.category && (!category || p.categoryId !== category.id)) return false;
    if (query.inStock && !p.inStock) return false;
    if (query.onSale && !p.onSale) return false;
    if (terms.length > 0) {
      const haystack = plain(
        `${p.name} ${p.categoryName ?? ""} ${p.description} ${p.variants.map((v) => v.name).join(" ")}`,
      );
      if (!terms.every((t) => haystack.includes(t))) return false;
    }
    return true;
  });

  const byNewest = (a: PublicProduct, b: PublicProduct) => b.createdAt - a.createdAt;
  switch (query.sort) {
    case "newest":
      return result.sort(byNewest);
    case "price-asc":
      return result.sort((a, b) => a.fromPrice - b.fromPrice);
    case "price-desc":
      return result.sort((a, b) => b.fromPrice - a.fromPrice);
    case "name":
      return result.sort((a, b) => a.name.localeCompare(b.name, "uz"));
    default:
      // Featured first, then in-stock, then newest.
      return result.sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) || Number(b.inStock) - Number(a.inStock) || byNewest(a, b),
      );
  }
}
