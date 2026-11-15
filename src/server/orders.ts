import "server-only";
import { randomInt } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { z } from "zod";
import { siteConfig } from "@/config/site";
import { deliveryFeeFor, productPrice, totalStockOf, variantPrice } from "@/lib/pricing";
import { maskPhone } from "@/lib/utils";
import type { checkoutSchema } from "@/lib/validation";
import { adminDb } from "@/server/firebase-admin";
import { mapOrder, mapProduct, mapSettings } from "@/server/mappers";
import type { Order, OrderConfirmation, OrderItem } from "@/lib/types";

type ValidCheckout = z.output<typeof checkoutSchema>;

export type CartIssue = {
  productId: string;
  variantId: string | null;
  name: string;
  reason: "unavailable" | "insufficient";
  available: number;
};

export type CreateOrderResult =
  | { ok: true; orderId: string; reference: string; duplicate: boolean; stockRunningLow: boolean }
  | { ok: false; code: "CART_INVALID"; issues: CartIssue[] }
  | { ok: false; code: "TOTAL_CHANGED"; total: number }
  | { ok: false; code: "AREA_INVALID" | "ORDERS_PAUSED" };

const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function newReference() {
  let out = "";
  for (let i = 0; i < 8; i++) out += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  return `${siteConfig.order.referencePrefix}-${out.slice(0, 4)}-${out.slice(4)}`;
}

/**
 * Create an order atomically.
 *
 * Everything that matters is decided here, inside one Firestore transaction:
 *  - prices, the delivery fee and the total are recomputed from the database
 *    (nothing the browser sends about money is trusted);
 *  - stock is checked and decremented together with writing the order, so two
 *    customers can never both buy the last item;
 *  - the order document ID is the checkout's idempotency key, so a double
 *    click or a network retry returns the original order instead of a copy;
 *  - each line stores the price charged, so later price edits never rewrite
 *    past orders.
 */
export async function createOrder(input: ValidCheckout, userId: string | null): Promise<CreateOrderResult> {
  const db = adminDb();
  const orderRef = db.collection("orders").doc(input.idempotencyKey);
  const settingsRef = db.collection("settings").doc("store");

  // Merge duplicate lines so stock is checked against the combined quantity.
  const merged = new Map<string, { productId: string; variantId: string | null; quantity: number }>();
  for (const line of input.lines) {
    const key = `${line.productId}::${line.variantId ?? ""}`;
    const existing = merged.get(key);
    if (existing) existing.quantity += line.quantity;
    else merged.set(key, { ...line });
  }
  const lines = [...merged.values()];
  const productRefs = [...new Set(lines.map((l) => l.productId))].map((id) => db.collection("products").doc(id));

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(orderRef);
    if (existing.exists) {
      return {
        ok: true,
        orderId: existing.id,
        reference: String(existing.get("reference")),
        duplicate: true,
        stockRunningLow: false,
      } as const;
    }

    const settings = mapSettings((await tx.get(settingsRef)).data());
    if (!settings.ordersEnabled) return { ok: false, code: "ORDERS_PAUSED" } as const;
    const area = settings.deliveryAreas.find((a) => a.id === input.areaId);
    if (!area) return { ok: false, code: "AREA_INVALID" } as const;

    const snaps = await tx.getAll(...productRefs);
    const products = new Map(snaps.filter((s) => s.exists).map((s) => [s.id, mapProduct(s)]));

    const issues: CartIssue[] = [];
    const items: OrderItem[] = [];
    let stockRunningLow = false;

    for (const line of lines) {
      const product = products.get(line.productId);
      const variant = product?.variants.find((v) => v.id === line.variantId);
      const variantMismatch = product
        ? product.variants.length > 0
          ? !variant
          : line.variantId !== null
        : true;
      if (!product || !product.active || variantMismatch) {
        issues.push({
          productId: line.productId,
          variantId: line.variantId,
          name: product?.name ?? "Bu mahsulot",
          reason: "unavailable",
          available: 0,
        });
        continue;
      }
      const stock = variant ? variant.stock : product.stock;
      const allowed = Math.min(stock, siteConfig.order.maxQuantityPerItem);
      if (line.quantity > allowed) {
        issues.push({
          productId: product.id,
          variantId: line.variantId,
          name: variant ? `${product.name} (${variant.name})` : product.name,
          reason: allowed > 0 ? "insufficient" : "unavailable",
          available: allowed,
        });
        continue;
      }
      const price = variant ? variantPrice(product, variant) : productPrice(product);
      items.push({
        productId: product.id,
        variantId: variant?.id ?? null,
        name: product.name,
        slug: product.slug,
        optionLabel: variant ? product.optionLabel || null : null,
        variantName: variant?.name ?? null,
        image: product.images[0]?.url ?? null,
        unitPrice: price.price,
        listPrice: price.compareAtPrice ?? price.price,
        quantity: line.quantity,
        lineTotal: price.price * line.quantity,
      });
      // Reserve the stock on our in-memory copy; written back below.
      if (variant) variant.stock -= line.quantity;
      else product.stock -= line.quantity;
      if (stock - line.quantity <= Math.max(settings.lowStockThreshold, siteConfig.order.maxQuantityPerItem)) {
        stockRunningLow = true;
      }
    }

    if (issues.length > 0) return { ok: false, code: "CART_INVALID", issues } as const;

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const deliveryFee = deliveryFeeFor(subtotal, area, settings.freeDeliveryThreshold);
    const total = subtotal + deliveryFee;
    if (total !== input.expectedTotal) return { ok: false, code: "TOTAL_CHANGED", total } as const;

    for (const product of products.values()) {
      tx.update(db.collection("products").doc(product.id), {
        variants: product.variants,
        stock: product.stock,
        totalStock: totalStockOf(product),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const now = Date.now();
    const reference = newReference();
    const pending = { status: "pending", error: null, attempts: 0, lastAttemptAt: null };
    tx.create(orderRef, {
      reference,
      status: "new",
      items,
      subtotal,
      deliveryFee,
      total,
      currency: siteConfig.currency.code,
      customer: { name: input.name, phone: input.phone, email: input.email || null },
      delivery: { areaId: area.id, areaName: area.name, address: input.address },
      notes: input.notes,
      userId,
      stockReleased: false,
      emails: {
        owner: pending,
        customer: input.email ? pending : { ...pending, status: "skipped" },
      },
      internalNotes: [],
      history: [{ status: "new", at: now, byEmail: null }],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, orderId: orderRef.id, reference, duplicate: false, stockRunningLow } as const;
  });
}

export async function getOrderById(id: string): Promise<Order | null> {
  const snap = await adminDb().collection("orders").doc(id).get();
  return snap.exists ? mapOrder(snap) : null;
}

/**
 * What the public confirmation page may show. The page is reachable by anyone
 * holding the (unguessable) order link, so it leaves out the address and
 * full contact details.
 */
export async function getOrderConfirmation(id: string): Promise<OrderConfirmation | null> {
  const order = await getOrderById(id);
  if (!order) return null;
  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    items: order.items,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    createdAt: order.createdAt,
    customerFirstName: order.customer.name.split(/\s+/)[0] ?? "",
    phoneMasked: maskPhone(order.customer.phone),
    areaName: order.delivery.areaName,
  };
}

/** Orders placed while signed in to this account (never anyone else's). */
export async function getOrdersForUser(uid: string): Promise<Order[]> {
  const snap = await adminDb()
    .collection("orders")
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map(mapOrder);
}
