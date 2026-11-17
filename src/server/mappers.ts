import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { siteConfig } from "@/config/site";
import { totalStockOf } from "@/lib/pricing";
import { toMillis } from "@/server/firebase-admin";
import type {
  Category,
  EmailState,
  Order,
  OrderStatus,
  Product,
  ProductImage,
  StoreSettings,
  TelegramAlertState,
  Variant,
} from "@/lib/types";
import { ORDER_STATUSES } from "@/lib/types";

/** Defensive readers: Firestore documents are untyped, so never trust shapes. */

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const int = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : fallback);
const intOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export function mapProduct(snap: DocumentSnapshot): Product {
  const d = obj(snap.data());
  const variants: Variant[] = arr(d.variants).map((raw) => {
    const v = obj(raw);
    return {
      id: str(v.id),
      name: str(v.name),
      stock: Math.max(0, int(v.stock)),
      price: intOrNull(v.price),
      salePrice: intOrNull(v.salePrice),
      swatch: typeof v.swatch === "string" ? v.swatch : null,
    };
  });
  const images: ProductImage[] = arr(d.images).map((raw) => {
    const i = obj(raw);
    return { url: str(i.url), path: typeof i.path === "string" ? i.path : null, alt: str(i.alt) };
  });
  const product: Product = {
    id: snap.id,
    name: str(d.name),
    slug: str(d.slug, snap.id),
    description: str(d.description),
    categoryId: typeof d.categoryId === "string" ? d.categoryId : null,
    images,
    price: Math.max(0, int(d.price)),
    salePrice: intOrNull(d.salePrice),
    optionLabel: str(d.optionLabel),
    variants,
    stock: Math.max(0, int(d.stock)),
    totalStock: 0,
    active: d.active === true,
    featured: d.featured === true,
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
  product.totalStock = totalStockOf(product);
  return product;
}

export function mapCategory(snap: DocumentSnapshot): Category {
  const d = obj(snap.data());
  return { id: snap.id, name: str(d.name), slug: str(d.slug, snap.id), order: int(d.order) };
}

export function mapSettings(data: unknown): StoreSettings {
  const d = obj(data);
  const defaults = siteConfig.defaults;
  const contact = obj(d.contact);
  const areas = arr(d.deliveryAreas)
    .map((raw) => {
      const a = obj(raw);
      return { id: str(a.id), name: str(a.name), fee: Math.max(0, int(a.fee)) };
    })
    .filter((a) => a.id && a.name);
  return {
    deliveryAreas: areas.length > 0 ? areas : defaults.deliveryAreas.map((a) => ({ ...a })),
    freeDeliveryThreshold:
      d.freeDeliveryThreshold === undefined ? defaults.freeDeliveryThreshold : intOrNull(d.freeDeliveryThreshold),
    lowStockThreshold: d.lowStockThreshold === undefined ? defaults.lowStockThreshold : int(d.lowStockThreshold),
    ownerEmail: str(d.ownerEmail),
    contact: {
      phone: str(contact.phone, defaults.contact.phone),
      email: str(contact.email, defaults.contact.email),
      address: str(contact.address, defaults.contact.address),
      hours: str(contact.hours, defaults.contact.hours),
      instagram: str(contact.instagram, defaults.contact.instagram),
      telegram: str(contact.telegram, defaults.contact.telegram),
    },
    announcement: d.announcement === undefined ? defaults.announcement : str(d.announcement),
    ordersEnabled: d.ordersEnabled !== false,
  };
}

function mapEmailState(raw: unknown): EmailState {
  const e = obj(raw);
  const status = str(e.status, "pending");
  return {
    status: (["pending", "sent", "failed", "skipped"] as const).includes(status as never)
      ? (status as EmailState["status"])
      : "pending",
    error: typeof e.error === "string" ? e.error : null,
    attempts: int(e.attempts),
    lastAttemptAt: typeof e.lastAttemptAt === "number" ? e.lastAttemptAt : null,
  };
}

/**
 * Orders placed before Telegram notifications existed have no `telegramAlert`
 * field. They read as "skipped" so nothing is ever sent for them automatically.
 */
export function mapTelegramAlert(raw: unknown): TelegramAlertState {
  const t = obj(raw);
  const missing = raw === undefined || raw === null;
  const status = missing ? "skipped" : str(t.status, "pending");
  return {
    status: (["pending", "sending", "sent", "failed", "skipped"] as const).includes(status as never)
      ? (status as TelegramAlertState["status"])
      : "pending",
    error: typeof t.error === "string" ? t.error : null,
    attempts: int(t.attempts),
    lastAttemptAt: intOrNull(t.lastAttemptAt),
    queued: t.queued === true,
    nextAttemptAt: intOrNull(t.nextAttemptAt),
    claimId: typeof t.claimId === "string" ? t.claimId : null,
    leaseUntil: intOrNull(t.leaseUntil),
    deliveredTo: arr(t.deliveredTo).filter((v): v is string => typeof v === "string"),
  };
}

const asStatus = (v: unknown): OrderStatus =>
  (ORDER_STATUSES as readonly string[]).includes(str(v)) ? (v as OrderStatus) : "new";

export function mapOrder(snap: DocumentSnapshot): Order {
  const d = obj(snap.data());
  const customer = obj(d.customer);
  const delivery = obj(d.delivery);
  const emails = obj(d.emails);
  return {
    id: snap.id,
    reference: str(d.reference),
    status: asStatus(d.status),
    items: arr(d.items).map((raw) => {
      const i = obj(raw);
      return {
        productId: str(i.productId),
        variantId: typeof i.variantId === "string" ? i.variantId : null,
        name: str(i.name),
        slug: str(i.slug),
        optionLabel: typeof i.optionLabel === "string" ? i.optionLabel : null,
        variantName: typeof i.variantName === "string" ? i.variantName : null,
        image: typeof i.image === "string" ? i.image : null,
        unitPrice: int(i.unitPrice),
        listPrice: int(i.listPrice, int(i.unitPrice)),
        quantity: int(i.quantity),
        lineTotal: int(i.lineTotal),
      };
    }),
    subtotal: int(d.subtotal),
    deliveryFee: int(d.deliveryFee),
    total: int(d.total),
    currency: str(d.currency, siteConfig.currency.code),
    customer: {
      name: str(customer.name),
      phone: str(customer.phone),
      telegram: typeof customer.telegram === "string" && customer.telegram ? customer.telegram : null,
      email: typeof customer.email === "string" && customer.email ? customer.email : null,
    },
    delivery: { areaId: str(delivery.areaId), areaName: str(delivery.areaName), address: str(delivery.address) },
    notes: str(d.notes),
    stockReleased: d.stockReleased === true,
    emails: { owner: mapEmailState(emails.owner), customer: mapEmailState(emails.customer) },
    telegramAlert: mapTelegramAlert(d.telegramAlert),
    internalNotes: arr(d.internalNotes).map((raw) => {
      const n = obj(raw);
      return { id: str(n.id), text: str(n.text), authorEmail: str(n.authorEmail), createdAt: int(n.createdAt) };
    }),
    history: arr(d.history).map((raw) => {
      const h = obj(raw);
      return { status: asStatus(h.status), at: int(h.at), byEmail: typeof h.byEmail === "string" ? h.byEmail : null };
    }),
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}
