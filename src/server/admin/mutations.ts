import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue, type Transaction, type WriteBatch } from "firebase-admin/firestore";
import type { z } from "zod";
import { totalStockOf } from "@/lib/pricing";
import { formatMoney, slugify } from "@/lib/utils";
import type { ProductInput, SettingsInput, categoryInputSchema } from "@/lib/validation";
import { assertAdmin, type SessionUser } from "@/server/auth";
import { adminDb } from "@/server/firebase-admin";
import { mapOrder, mapProduct } from "@/server/mappers";
import { ORDER_STATUS_LABELS, type OrderStatus, type ProductImage } from "@/lib/types";

/**
 * Admin write access. Every exported function verifies the admin session
 * itself and records an audit entry in the same write as the change.
 */

/** An error whose message is safe and useful to show to the admin. */
export class AdminError extends Error {
  constructor(
    message: string,
    public code = "INVALID",
  ) {
    super(message);
  }
}

type Audit = { action: string; targetType: string; targetId: string; summary: string };

function audit(writer: Transaction | WriteBatch, session: SessionUser, entry: Audit) {
  const ref = adminDb().collection("auditLogs").doc();
  const data = {
    ...entry,
    summary: entry.summary.slice(0, 500),
    actorUid: session.uid,
    actorEmail: session.email ?? "",
    createdAt: FieldValue.serverTimestamp(),
  };
  // Transaction and WriteBatch share the same `set` signature.
  (writer as WriteBatch).set(ref, data);
}

// ───────── Images ─────────
//
// Product photos are stored in Firestore itself (collection `productImages`)
// and served by /img/<id>. This keeps the shop on Firebase's free plan:
// Cloud Storage would need the paid Blaze plan. A Firestore document holds
// up to 1 MB, so photos are shrunk in the browser before upload.

export const MAX_IMAGE_BYTES = 900 * 1024;
const IMAGE_PATH = /^productImages\/[A-Za-z0-9-]{1,64}$/;

function sniffImage(bytes: Buffer): { contentType: string } | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg" };
  }
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { contentType: "image/png" };
  }
  if (bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return { contentType: "image/webp" };
  }
  return null;
}

export async function uploadProductImage(file: File): Promise<{ url: string; path: string }> {
  const session = await assertAdmin();
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    throw new AdminError("Bu rasm juda katta. Kichikroq rasm tanlang (900 KB dan kam).");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  // Decide the type from the file's actual bytes, not its name or claimed type.
  const kind = sniffImage(bytes);
  if (!kind) throw new AdminError("JPG, PNG yoki WebP formatidagi rasm yuklang.");

  const id = randomUUID();
  await adminDb().collection("productImages").doc(id).create({
    data: bytes,
    contentType: kind.contentType,
    size: bytes.length,
    uploadedBy: session.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { url: `/img/${id}`, path: `productImages/${id}` };
}

async function deleteStoredImages(paths: (string | null)[]) {
  const safe = paths.filter((p): p is string => typeof p === "string" && IMAGE_PATH.test(p));
  await Promise.allSettled(safe.map((p) => adminDb().doc(p).delete()));
}

function checkImages(images: ProductImage[]) {
  for (const image of images) {
    const local = image.url.startsWith("/") && !image.url.startsWith("//");
    const remote = image.url.startsWith("https://");
    if (!local && !remote) throw new AdminError("Rasmlardan birining manzili ruxsat etilmagan.");
    if (image.path !== null && (!IMAGE_PATH.test(image.path) || image.url !== `/img/${image.path.split("/")[1]}`)) {
      throw new AdminError("Rasmlardan birining saqlash manzili notoʻgʻri.");
    }
  }
}

// ───────── Products ─────────

/**
 * Create or update a product.
 *
 * `expectedUpdatedAt` is the version the admin's form was loaded with. If an
 * order (or another admin) changed the product since, the save is refused
 * rather than silently overwriting newer stock numbers.
 */
export async function saveProduct(
  id: string | null,
  input: ProductInput,
  expectedUpdatedAt: number | null,
): Promise<{ id: string; slug: string }> {
  const session = await assertAdmin();
  checkImages(input.images);
  const db = adminDb();
  const ref = id ? db.collection("products").doc(id) : db.collection("products").doc();
  const variantIds = new Set(input.variants.map((v) => v.id));
  if (variantIds.size !== input.variants.length) throw new AdminError("Ikki variantning ID raqami bir xil. Birini oʻchirib, qaytadan qoʻshing.");

  let removedImages: (string | null)[] = [];

  const result = await db.runTransaction(async (tx) => {
    const current = id ? await tx.get(ref) : null;
    if (id && !current?.exists) throw new AdminError("Bu mahsulot endi mavjud emas.", "NOT_FOUND");
    const before = current?.exists ? mapProduct(current) : null;
    if (before && expectedUpdatedAt !== before.updatedAt) {
      throw new AdminError(
        "Siz sahifani ochganingizdan keyin bu mahsulot oʻzgardi (masalan, yangi buyurtma qoldiqni kamaytirdi). Sahifani yangilab, oʻzgarishlarni qaytadan kiriting.",
        "CONFLICT",
      );
    }
    if (input.categoryId) {
      const category = await tx.get(db.collection("categories").doc(input.categoryId));
      if (!category.exists) throw new AdminError("Tanlangan kategoriya endi mavjud emas.");
    }

    let slug = slugify(input.slug || input.name) || ref.id.toLowerCase();
    const clash = await tx.get(db.collection("products").where("slug", "==", slug).limit(2));
    if (clash.docs.some((d) => d.id !== ref.id)) slug = `${slug.slice(0, 70)}-${randomUUID().slice(0, 5)}`;

    const stock = input.variants.length > 0 ? 0 : input.stock;
    const data = {
      name: input.name,
      slug,
      description: input.description,
      categoryId: input.categoryId,
      images: input.images,
      price: input.price,
      salePrice: input.salePrice,
      optionLabel: input.variants.length > 0 ? input.optionLabel : "",
      variants: input.variants,
      stock,
      totalStock: totalStockOf({ variants: input.variants, stock }),
      active: input.active,
      featured: input.featured,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (before) {
      tx.update(ref, data);
      const changes: string[] = [];
      if (before.name !== input.name) changes.push(`avvalgi nomi: “${before.name}”`);
      if (before.price !== input.price) changes.push(`narx ${formatMoney(before.price)} → ${formatMoney(input.price)}`);
      if (before.salePrice !== input.salePrice) {
        changes.push(
          `chegirma narxi ${before.salePrice === null ? "yoʻq" : formatMoney(before.salePrice)} → ${
            input.salePrice === null ? "yoʻq" : formatMoney(input.salePrice)
          }`,
        );
      }
      if (before.totalStock !== data.totalStock) changes.push(`qoldiq ${before.totalStock} → ${data.totalStock}`);
      if (before.active !== input.active) changes.push(input.active ? "doʻkonda koʻrsatildi" : "doʻkondan yashirildi");
      audit(tx, session, {
        action: "product.update",
        targetType: "product",
        targetId: ref.id,
        summary: `“${input.name}” tahrirlandi${changes.length ? `: ${changes.join("; ")}` : ""}`,
      });
      const kept = new Set(input.images.map((i) => i.path));
      removedImages = before.images.map((i) => i.path).filter((p) => p && !kept.has(p));
    } else {
      tx.create(ref, { ...data, createdAt: FieldValue.serverTimestamp() });
      audit(tx, session, {
        action: "product.create",
        targetType: "product",
        targetId: ref.id,
        summary: `“${input.name}” yaratildi: narxi ${formatMoney(input.price)}, qoldiq ${data.totalStock}`,
      });
    }
    return { id: ref.id, slug };
  });

  await deleteStoredImages(removedImages);
  return result;
}

export async function deleteProduct(id: string) {
  const session = await assertAdmin();
  const db = adminDb();
  const ref = db.collection("products").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  const product = mapProduct(snap);
  const batch = db.batch();
  batch.delete(ref);
  audit(batch, session, {
    action: "product.delete",
    targetType: "product",
    targetId: id,
    summary: `“${product.name}” oʻchirildi (eski buyurtmalarda uning nusxasi saqlanadi)`,
  });
  await batch.commit();
  await deleteStoredImages(product.images.map((i) => i.path));
}

// ───────── Categories ─────────

type CategoryInput = z.infer<typeof categoryInputSchema>;

export async function saveCategory(id: string | null, input: CategoryInput) {
  const session = await assertAdmin();
  const db = adminDb();
  const ref = id ? db.collection("categories").doc(id) : db.collection("categories").doc();
  const all = await db.collection("categories").get();
  let slug = slugify(input.name) || ref.id.toLowerCase();
  if (all.docs.some((d) => d.id !== ref.id && d.get("slug") === slug)) {
    throw new AdminError("Bunday nomli kategoriya allaqachon bor.");
  }
  if (id && !all.docs.some((d) => d.id === id)) throw new AdminError("Bu kategoriya endi mavjud emas.");
  slug = slug.slice(0, 80);
  const batch = db.batch();
  batch.set(ref, { name: input.name, slug, order: input.order }, { merge: true });
  audit(batch, session, {
    action: id ? "category.update" : "category.create",
    targetType: "category",
    targetId: ref.id,
    summary: `“${input.name}” kategoriyasi ${id ? "tahrirlandi" : "yaratildi"}`,
  });
  await batch.commit();
}

export async function deleteCategory(id: string) {
  const session = await assertAdmin();
  const db = adminDb();
  const used = await db.collection("products").where("categoryId", "==", id).limit(1).get();
  if (!used.empty) {
    throw new AdminError("Bu kategoriyada hali mahsulotlar bor. Avval ularni boshqa kategoriyaga oʻtkazing.");
  }
  const ref = db.collection("categories").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  const batch = db.batch();
  batch.delete(ref);
  audit(batch, session, {
    action: "category.delete",
    targetType: "category",
    targetId: id,
    summary: `“${String(snap.get("name") ?? "")}” kategoriyasi oʻchirildi`,
  });
  await batch.commit();
}

// ───────── Settings ─────────

export async function saveSettings(input: SettingsInput) {
  const session = await assertAdmin();
  const ids = new Set(input.deliveryAreas.map((a) => a.id));
  if (ids.size !== input.deliveryAreas.length) throw new AdminError("Ikki yetkazib berish hududining ID raqami bir xil.");
  const db = adminDb();
  const batch = db.batch();
  batch.set(db.collection("settings").doc("store"), { ...input, updatedAt: FieldValue.serverTimestamp() });
  audit(batch, session, {
    action: "settings.update",
    targetType: "settings",
    targetId: "store",
    summary: `Doʻkon sozlamalari yangilandi (${input.deliveryAreas.length} ta yetkazib berish hududi, buyurtmalar ${
      input.ordersEnabled ? "ochiq" : "toʻxtatilgan"
    })`,
  });
  await batch.commit();
}

// ───────── Orders ─────────

/**
 * Change an order's status. Cancelling returns its items to stock exactly
 * once; re-opening a cancelled order takes them out again (and is refused if
 * the stock is no longer there). All of it happens in one transaction.
 */
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<{ stockChanged: boolean }> {
  const session = await assertAdmin();
  const db = adminDb();
  const ref = db.collection("orders").doc(orderId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AdminError("Bu buyurtma endi mavjud emas.", "NOT_FOUND");
    const order = mapOrder(snap);
    if (order.status === status) return { stockChanged: false };

    const release = status === "cancelled" && !order.stockReleased;
    const reserve = status !== "cancelled" && order.stockReleased;
    const update: Record<string, unknown> = {
      status,
      history: FieldValue.arrayUnion({ status, at: Date.now(), byEmail: session.email }),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (release || reserve) {
      const refs = [...new Set(order.items.map((i) => i.productId))].map((id) => db.collection("products").doc(id));
      const snaps = await tx.getAll(...refs);
      const products = new Map(snaps.filter((s) => s.exists).map((s) => [s.id, mapProduct(s)]));
      const sign = release ? 1 : -1;

      for (const item of order.items) {
        const product = products.get(item.productId);
        const variant = item.variantId ? product?.variants.find((v) => v.id === item.variantId) : undefined;
        const target = item.variantId ? variant : product;
        if (!product || !target) {
          // The product or option was deleted since the order was placed.
          if (reserve) throw new AdminError(`“${item.name}” endi mavjud emas, shuning uchun bu buyurtmani qayta ochib boʻlmaydi.`);
          continue;
        }
        if (reserve && target.stock < item.quantity) {
          throw new AdminError(`Buyurtmani qayta ochish uchun “${item.name}” yetarli emas (${target.stock} ta qolgan).`);
        }
        target.stock += sign * item.quantity;
      }
      for (const product of products.values()) {
        tx.update(db.collection("products").doc(product.id), {
          variants: product.variants,
          stock: product.stock,
          totalStock: totalStockOf(product),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      update.stockReleased = release;
    }

    tx.update(ref, update);
    audit(tx, session, {
      action: "order.status",
      targetType: "order",
      targetId: orderId,
      summary: `Buyurtma ${order.reference}: ${ORDER_STATUS_LABELS[order.status]} → ${ORDER_STATUS_LABELS[status]}${
        release ? " (mahsulotlar omborga qaytarildi)" : reserve ? " (mahsulotlar ombordan qayta olindi)" : ""
      }`,
    });
    return { stockChanged: release || reserve };
  });
}

export async function addOrderNote(orderId: string, text: string) {
  const session = await assertAdmin();
  const db = adminDb();
  const ref = db.collection("orders").doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AdminError("Bu buyurtma endi mavjud emas.", "NOT_FOUND");
    tx.update(ref, {
      internalNotes: FieldValue.arrayUnion({
        id: randomUUID(),
        text,
        authorEmail: session.email ?? "",
        createdAt: Date.now(),
      }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    audit(tx, session, {
      action: "order.note",
      targetType: "order",
      targetId: orderId,
      summary: `${String(snap.get("reference") ?? orderId)} buyurtmasiga ichki izoh qoʻshildi`,
    });
  });
}

export async function recordEmailRetry(orderId: string, reference: string) {
  const session = await assertAdmin();
  const batch = adminDb().batch();
  audit(batch, session, {
    action: "order.email_retry",
    targetType: "order",
    targetId: orderId,
    summary: `${reference} buyurtmasi boʻyicha xabarnoma xatlari qayta yuborildi`,
  });
  await batch.commit();
}
