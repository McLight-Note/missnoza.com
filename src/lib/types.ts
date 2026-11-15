/** Shared, serialisable data shapes used by both server and client code. */

export type Variant = {
  id: string;
  /** e.g. "30 ml" or "Rose Nude" */
  name: string;
  stock: number;
  /** Optional price override (minor units). null = use the product price. */
  price: number | null;
  /** Sale price for the override. Only used when `price` is set. */
  salePrice: number | null;
  /** Optional colour swatch for shades, e.g. "#c98a7d". */
  swatch: string | null;
};

export type ProductImage = {
  url: string;
  /** Where the uploaded photo is kept ("productImages/<id>"), or null for placeholder / external images. */
  path: string | null;
  alt: string;
};

/** Full product record (admin and server only). */
export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string | null;
  images: ProductImage[];
  price: number;
  salePrice: number | null;
  /** Label for the option, e.g. "Shade" or "Size". */
  optionLabel: string;
  variants: Variant[];
  /** Stock when the product has no variants. */
  stock: number;
  /** Sum of all sellable stock (kept in sync on every write). */
  totalStock: number;
  active: boolean;
  featured: boolean;
  createdAt: number;
  updatedAt: number;
};

export type PublicVariant = {
  id: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  swatch: string | null;
  /** Units a customer may add (capped; raw stock is never exposed). */
  available: number;
};

/** Product as sent to the storefront. */
export type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  images: ProductImage[];
  price: number;
  compareAtPrice: number | null;
  /** Lowest current price across variants (used for "from" and sorting). */
  fromPrice: number;
  hasPriceRange: boolean;
  onSale: boolean;
  optionLabel: string;
  variants: PublicVariant[];
  available: number;
  inStock: boolean;
  featured: boolean;
  createdAt: number;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  order: number;
};

export type DeliveryArea = { id: string; name: string; fee: number };

export type ContactDetails = {
  phone: string;
  email: string;
  address: string;
  hours: string;
  instagram: string;
  telegram: string;
};

export type PublicSettings = {
  deliveryAreas: DeliveryArea[];
  freeDeliveryThreshold: number | null;
  contact: ContactDetails;
  announcement: string;
  ordersEnabled: boolean;
};

export type StoreSettings = PublicSettings & {
  lowStockThreshold: number;
  /** Where new-order notifications are sent. Falls back to the env var. */
  ownerEmail: string;
};

export const ORDER_STATUSES = [
  "new",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Yangi",
  confirmed: "Tasdiqlangan",
  preparing: "Tayyorlanmoqda",
  shipped: "Joʻnatilgan",
  delivered: "Yetkazilgan",
  cancelled: "Bekor qilingan",
};

export type OrderItem = {
  productId: string;
  variantId: string | null;
  name: string;
  slug: string;
  optionLabel: string | null;
  variantName: string | null;
  image: string | null;
  /** Price actually charged per unit at the time of the order. */
  unitPrice: number;
  /** Regular price at the time of the order (equals unitPrice if no sale). */
  listPrice: number;
  quantity: number;
  lineTotal: number;
};

export type EmailStatus = "pending" | "sent" | "failed" | "skipped";
export type EmailState = {
  status: EmailStatus;
  error: string | null;
  attempts: number;
  lastAttemptAt: number | null;
};

export type OrderNote = { id: string; text: string; authorEmail: string; createdAt: number };
export type OrderHistoryEntry = { status: OrderStatus; at: number; byEmail: string | null };

export type Order = {
  id: string;
  reference: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  customer: { name: string; phone: string; email: string | null };
  delivery: { areaId: string; areaName: string; address: string };
  notes: string;
  userId: string | null;
  /** True once a cancelled order's stock has been returned to inventory. */
  stockReleased: boolean;
  emails: { owner: EmailState; customer: EmailState };
  internalNotes: OrderNote[];
  history: OrderHistoryEntry[];
  createdAt: number;
  updatedAt: number;
};

/** The limited view of an order shown on the public confirmation page. */
export type OrderConfirmation = Pick<
  Order,
  "id" | "reference" | "status" | "items" | "subtotal" | "deliveryFee" | "total" | "createdAt"
> & {
  customerFirstName: string;
  phoneMasked: string;
  areaName: string;
};

export type CustomerProfile = {
  uid: string;
  email: string | null;
  name: string;
  phone: string;
  address: string;
  areaId: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  actorEmail: string;
  actorUid: string;
  createdAt: number;
};

/** Standard result shape returned by server actions. */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };
