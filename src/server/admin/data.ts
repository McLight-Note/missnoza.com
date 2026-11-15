import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { siteConfig } from "@/config/site";
import { assertAdmin } from "@/server/auth";
import { adminDb, toMillis } from "@/server/firebase-admin";
import { mapCategory, mapOrder, mapProduct, mapSettings } from "@/server/mappers";
import type { AuditEntry, Category, Order, OrderStatus, Product, StoreSettings } from "@/lib/types";

/**
 * Admin read access. EVERY exported function starts with `assertAdmin()`,
 * so data can only leave this module for a verified admin session — no
 * matter which page, action or URL asked for it.
 */

export async function listProducts(): Promise<Product[]> {
  await assertAdmin();
  const snap = await adminDb().collection("products").get();
  return snap.docs.map(mapProduct).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getProduct(id: string): Promise<Product | null> {
  await assertAdmin();
  const snap = await adminDb().collection("products").doc(id).get();
  return snap.exists ? mapProduct(snap) : null;
}

export async function listCategories(): Promise<Category[]> {
  await assertAdmin();
  const snap = await adminDb().collection("categories").get();
  return snap.docs.map(mapCategory).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export async function getSettings(): Promise<StoreSettings> {
  await assertAdmin();
  return mapSettings((await adminDb().collection("settings").doc("store").get()).data());
}

export type OrderFilters = { start: number; end: number; status?: OrderStatus; q?: string };
const ORDER_LIST_LIMIT = 300;

export async function listOrders(filters: OrderFilters): Promise<{ orders: Order[]; truncated: boolean }> {
  await assertAdmin();
  const db = adminDb();
  const q = (filters.q || "").trim();

  // An exact order reference finds the order whatever the date filter says.
  if (q && q.toUpperCase().startsWith(`${siteConfig.order.referencePrefix}-`)) {
    const exact = await db.collection("orders").where("reference", "==", q.toUpperCase()).limit(5).get();
    if (!exact.empty) return { orders: exact.docs.map(mapOrder), truncated: false };
  }

  let query = db
    .collection("orders")
    .where("createdAt", ">=", Timestamp.fromMillis(filters.start))
    .where("createdAt", "<", Timestamp.fromMillis(filters.end));
  if (filters.status) query = query.where("status", "==", filters.status);
  const snap = await query.orderBy("createdAt", "desc").limit(ORDER_LIST_LIMIT).get();
  let orders = snap.docs.map(mapOrder);

  if (q) {
    const needle = q.toLowerCase();
    const digits = q.replace(/\D/g, "");
    orders = orders.filter(
      (o) =>
        o.reference.toLowerCase().includes(needle) ||
        o.customer.name.toLowerCase().includes(needle) ||
        (o.customer.email ?? "").toLowerCase().includes(needle) ||
        (digits.length >= 3 && o.customer.phone.replace(/\D/g, "").includes(digits)),
    );
  }
  return { orders, truncated: snap.size >= ORDER_LIST_LIMIT };
}

export async function getOrder(id: string): Promise<Order | null> {
  await assertAdmin();
  const snap = await adminDb().collection("orders").doc(id).get();
  return snap.exists ? mapOrder(snap) : null;
}

export type ProductSales = {
  productId: string;
  name: string;
  units: number;
  revenue: number;
  variants: { name: string; units: number }[];
};

export type Dashboard = {
  orderCount: number;
  cancelledCount: number;
  revenue: number;
  unitsSold: number;
  averageOrder: number;
  byStatus: Record<OrderStatus, number>;
  sales: ProductSales[];
  lowStock: { id: string; name: string; label: string; stock: number; active: boolean }[];
  lowStockThreshold: number;
  emailIssues: { id: string; reference: string; createdAt: number; error: string | null; status: string }[];
  truncated: boolean;
};

const DASHBOARD_LIMIT = 5000;

/** Sales figures for a period. Cancelled orders are excluded from revenue and units. */
export async function getDashboard(start: number, end: number): Promise<Dashboard> {
  await assertAdmin();
  const db = adminDb();
  const [orderSnap, productSnap, settingsSnap, failedSnap, pendingSnap] = await Promise.all([
    db
      .collection("orders")
      .where("createdAt", ">=", Timestamp.fromMillis(start))
      .where("createdAt", "<", Timestamp.fromMillis(end))
      .orderBy("createdAt", "desc")
      .limit(DASHBOARD_LIMIT)
      .get(),
    db.collection("products").get(),
    db.collection("settings").doc("store").get(),
    db.collection("orders").where("emails.owner.status", "==", "failed").limit(20).get(),
    db.collection("orders").where("emails.owner.status", "==", "pending").limit(20).get(),
  ]);

  const settings = mapSettings(settingsSnap.data());
  const orders = orderSnap.docs.map(mapOrder);
  const byStatus = { new: 0, confirmed: 0, preparing: 0, shipped: 0, delivered: 0, cancelled: 0 } as Record<
    OrderStatus,
    number
  >;
  const sales = new Map<string, ProductSales & { variantUnits: Map<string, number> }>();
  let revenue = 0;
  let unitsSold = 0;

  for (const order of orders) {
    byStatus[order.status] += 1;
    if (order.status === "cancelled") continue;
    revenue += order.total;
    for (const item of order.items) {
      unitsSold += item.quantity;
      let entry = sales.get(item.productId);
      if (!entry) {
        entry = { productId: item.productId, name: item.name, units: 0, revenue: 0, variants: [], variantUnits: new Map() };
        sales.set(item.productId, entry);
      }
      entry.units += item.quantity;
      entry.revenue += item.lineTotal;
      if (item.variantName) {
        entry.variantUnits.set(item.variantName, (entry.variantUnits.get(item.variantName) ?? 0) + item.quantity);
      }
    }
  }

  const counted = orders.length - byStatus.cancelled;
  const lowStock: Dashboard["lowStock"] = [];
  for (const product of productSnap.docs.map(mapProduct)) {
    if (product.variants.length > 0) {
      for (const variant of product.variants) {
        if (variant.stock <= settings.lowStockThreshold) {
          lowStock.push({
            id: product.id,
            name: product.name,
            label: variant.name,
            stock: variant.stock,
            active: product.active,
          });
        }
      }
    } else if (product.stock <= settings.lowStockThreshold) {
      lowStock.push({ id: product.id, name: product.name, label: "", stock: product.stock, active: product.active });
    }
  }

  // "pending" for more than a few minutes means the send never finished.
  const stalePendingBefore = Date.now() - 5 * 60 * 1000;
  const emailIssues = [...failedSnap.docs, ...pendingSnap.docs]
    .map(mapOrder)
    .filter((o) => o.emails.owner.status === "failed" || o.createdAt < stalePendingBefore)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((o) => ({
      id: o.id,
      reference: o.reference,
      createdAt: o.createdAt,
      error: o.emails.owner.error,
      status: o.emails.owner.status,
    }));

  return {
    orderCount: orders.length,
    cancelledCount: byStatus.cancelled,
    revenue,
    unitsSold,
    averageOrder: counted > 0 ? Math.round(revenue / counted) : 0,
    byStatus,
    sales: [...sales.values()]
      .map(({ variantUnits, ...rest }) => ({
        ...rest,
        variants: [...variantUnits.entries()].map(([name, units]) => ({ name, units })).sort((a, b) => b.units - a.units),
      }))
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue),
    lowStock: lowStock.sort((a, b) => a.stock - b.stock),
    lowStockThreshold: settings.lowStockThreshold,
    emailIssues,
    truncated: orderSnap.size >= DASHBOARD_LIMIT,
  };
}

export async function listAudit(limit = 150): Promise<AuditEntry[]> {
  await assertAdmin();
  const snap = await adminDb().collection("auditLogs").orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      action: String(d.action ?? ""),
      targetType: String(d.targetType ?? ""),
      targetId: String(d.targetId ?? ""),
      summary: String(d.summary ?? ""),
      actorEmail: String(d.actorEmail ?? ""),
      actorUid: String(d.actorUid ?? ""),
      createdAt: toMillis(d.createdAt),
    };
  });
}
