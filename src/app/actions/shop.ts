"use server";

import { updateTag } from "next/cache";
import { after } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { cartLinesSchema, checkoutSchema, fieldErrorsOf, profileSchema, type CheckoutInput } from "@/lib/validation";
import { getSession } from "@/server/auth";
import { CATALOG_TAG, SETTINGS_TAG, getCatalog, getPublicSettings } from "@/server/catalog";
import { sendOrderEmails } from "@/server/email";
import { adminDb, isAdminConfigured } from "@/server/firebase-admin";
import { createOrder, type CartIssue } from "@/server/orders";
import { clientIp, rateLimit, retryMessage, sweepExpired } from "@/server/rate-limit";
import type { ActionResult, DeliveryArea } from "@/lib/types";

export type QuoteLine = {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  slug: string;
  image: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  /** How many the customer may order right now (0 = unavailable). */
  available: number;
  status: "ok" | "insufficient" | "unavailable";
};

export type CartQuote = {
  lines: QuoteLine[];
  subtotal: number;
  deliveryAreas: DeliveryArea[];
  freeDeliveryThreshold: number | null;
  ordersEnabled: boolean;
  hasIssues: boolean;
};

/**
 * Current names, prices and availability for the items in a cart. The cart
 * in the browser only stores IDs and quantities; everything shown to the
 * customer about money comes from here.
 */
export async function quoteCart(linesInput: unknown): Promise<ActionResult<CartQuote>> {
  const parsed = cartLinesSchema.safeParse(linesInput);
  if (!parsed.success) return { ok: false, error: "Savatni oʻqib boʻlmadi. Sahifani yangilang." };

  const [catalog, settings] = await Promise.all([getCatalog(), getPublicSettings()]);
  const byId = new Map(catalog.products.map((p) => [p.id, p]));

  const lines: QuoteLine[] = parsed.data.map((line) => {
    const key = `${line.productId}::${line.variantId ?? ""}`;
    const product = byId.get(line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    const valid = product && (product.variants.length > 0 ? Boolean(variant) : line.variantId === null);
    if (!product || !valid) {
      return {
        key,
        productId: line.productId,
        variantId: line.variantId,
        name: product?.name ?? "Bu mahsulot endi mavjud emas",
        variantName: null,
        slug: product?.slug ?? "",
        image: product?.images[0]?.url ?? null,
        unitPrice: 0,
        compareAtPrice: null,
        quantity: line.quantity,
        available: 0,
        status: "unavailable",
      };
    }
    const available = variant ? variant.available : product.available;
    return {
      key,
      productId: product.id,
      variantId: variant?.id ?? null,
      name: product.name,
      variantName: variant?.name ?? null,
      slug: product.slug,
      image: product.images[0]?.url ?? null,
      unitPrice: variant ? variant.price : product.price,
      compareAtPrice: variant ? variant.compareAtPrice : product.compareAtPrice,
      quantity: line.quantity,
      available,
      status: available === 0 ? "unavailable" : line.quantity > available ? "insufficient" : "ok",
    };
  });

  return {
    ok: true,
    data: {
      lines,
      subtotal: lines.reduce((sum, l) => (l.status === "ok" ? sum + l.unitPrice * l.quantity : sum), 0),
      deliveryAreas: settings.deliveryAreas,
      freeDeliveryThreshold: settings.freeDeliveryThreshold,
      ordersEnabled: settings.ordersEnabled,
      hasIssues: lines.some((l) => l.status !== "ok"),
    },
  };
}

export type PlaceOrderResult =
  | { ok: true; orderId: string; reference: string }
  | {
      ok: false;
      error: string;
      code?: "VALIDATION" | "CART_INVALID" | "TOTAL_CHANGED" | "RATE_LIMITED" | "UNAVAILABLE";
      fieldErrors?: Record<string, string>;
      issues?: CartIssue[];
    };

/** Submit an order request. See `createOrder` for the guarantees. */
export async function placeOrder(input: CheckoutInput): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Belgilangan maydonlarni tekshiring.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }
  // Honeypot: a hidden field only bots fill in.
  if (parsed.data.company) return { ok: false, error: "Buyurtmani qabul qilib boʻlmadi. Qayta urinib koʻring." };
  if (!isAdminConfigured()) {
    return { ok: false, code: "UNAVAILABLE", error: "Onlayn buyurtma hozircha ishlamaydi. Doʻkon bilan bevosita bogʻlaning." };
  }

  try {
    const ip = await clientIp();
    const limits = [await rateLimit("order-ip", ip, 5, 10 * 60), await rateLimit("order-ip-day", ip, 25, 24 * 60 * 60)];
    const blocked = limits.find((l) => !l.ok);
    if (blocked && !blocked.ok) {
      return { ok: false, code: "RATE_LIMITED", error: retryMessage(blocked.retryAfterSeconds) };
    }

    const session = await getSession();
    const result = await createOrder(parsed.data, session?.uid ?? null);

    if (!result.ok) {
      // What the customer saw was out of date: refresh it for everyone.
      updateTag(CATALOG_TAG);
      updateTag(SETTINGS_TAG);
      switch (result.code) {
        case "CART_INVALID":
          return {
            ok: false,
            code: "CART_INVALID",
            error: "Savatdagi ayrim mahsulotlar bu miqdorda qolmagan. Savatingizni tekshiring.",
            issues: result.issues,
          };
        case "TOTAL_CHANGED":
          return {
            ok: false,
            code: "TOTAL_CHANGED",
            error: "Buyurtma berayotganingizda narx yoki yetkazib berish haqi oʻzgardi. Yangilangan summani koʻrib, qayta yuboring.",
          };
        case "AREA_INVALID":
          return {
            ok: false,
            code: "VALIDATION",
            error: "Yetkazib berish hududini qaytadan tanlang.",
            fieldErrors: { areaId: "Bu hududga endi yetkazib berilmaydi." },
          };
        case "ORDERS_PAUSED":
          return { ok: false, code: "UNAVAILABLE", error: "Doʻkon hozircha onlayn buyurtma qabul qilmayapti. Keyinroq qayta kiring." };
      }
    }

    if (!result.duplicate) {
      if (result.stockRunningLow) updateTag(CATALOG_TAG);
      const { orderId } = result;
      const data = parsed.data;
      // Runs after the response is sent, so slow email never delays the customer.
      after(async () => {
        await sendOrderEmails(orderId).catch((error) => console.error("[order] email step failed", error));
        await sweepExpired();
        if (session) {
          await adminDb()
            .collection("users")
            .doc(session.uid)
            .set(
              { name: data.name, phone: data.phone, address: data.address, areaId: data.areaId, updatedAt: FieldValue.serverTimestamp() },
              { merge: true },
            )
            .catch((error) => console.error("[order] profile save failed", error));
        }
      });
    }
    return { ok: true, orderId: result.orderId, reference: result.reference };
  } catch (error) {
    console.error("[order] placeOrder failed", error);
    return {
      ok: false,
      error: "Xatolik yuz berdi, buyurtma qabul qilinmadi. Qayta urinib koʻring — buyurtma ikki marta yozilmaydi.",
    };
  }
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, code: "UNAUTHENTICATED", error: "Iltimos, qaytadan kiring." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Belgilangan maydonlarni tekshiring.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  try {
    // The document ID comes from the verified session, never from the form.
    await adminDb()
      .collection("users")
      .doc(session.uid)
      .set({ ...parsed.data, email: session.email, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, data: null };
  } catch (error) {
    console.error("[account] updateProfile failed", error);
    return { ok: false, error: "Maʼlumotlarni saqlab boʻlmadi. Qayta urinib koʻring." };
  }
}
