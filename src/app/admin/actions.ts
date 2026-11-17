"use server";

import { updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import {
  categoryInputSchema,
  fieldErrorsOf,
  orderIdSchema,
  orderNoteSchema,
  orderStatusSchema,
  productInputSchema,
  settingsInputSchema,
} from "@/lib/validation";
import { AuthError } from "@/server/auth";
import { getOrder } from "@/server/admin/data";
import {
  AdminError,
  addOrderNote,
  deleteCategory,
  deleteProduct,
  recordEmailRetry,
  recordTelegramRetry,
  saveCategory,
  saveProduct,
  saveSettings,
  updateOrderStatus,
  uploadProductImage,
} from "@/server/admin/mutations";
import { CATALOG_TAG, SETTINGS_TAG } from "@/server/catalog";
import { sendOrderEmails } from "@/server/email";
import { refreshOrderMessages, sendOrderTelegram } from "@/server/telegram";
import type { ActionResult } from "@/lib/types";

/**
 * Admin server actions. Each one is a public HTTP endpoint, so each one:
 *  1. validates its input with zod, and
 *  2. calls a mutation that verifies the admin session before touching data.
 */

const docId = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        code: error.code,
        error:
          error.code === "UNAUTHENTICATED"
            ? "Sessiya muddati tugadi. Qaytadan kiring."
            : "Bu amalni bajarishga ruxsatingiz yoʻq.",
      };
    }
    if (error instanceof AdminError) return { ok: false, code: error.code, error: error.message };
    if (error instanceof z.ZodError) {
      return { ok: false, code: "VALIDATION", error: "Belgilangan maydonlarni tekshiring.", fieldErrors: fieldErrorsOf(error) };
    }
    console.error("[admin] action failed", error);
    return { ok: false, error: "Xatolik yuz berdi. Hech narsa oʻzgarmadi — qayta urinib koʻring." };
  }
}

export async function saveProductAction(id: string | null, input: unknown, expectedUpdatedAt: number | null) {
  return run(async () => {
    const productId = id === null ? null : docId.parse(id);
    const version = z.number().int().nullable().parse(expectedUpdatedAt);
    const saved = await saveProduct(productId, productInputSchema.parse(input), version);
    updateTag(CATALOG_TAG);
    return saved;
  });
}

export async function deleteProductAction(id: string) {
  return run(async () => {
    await deleteProduct(docId.parse(id));
    updateTag(CATALOG_TAG);
    return null;
  });
}

export async function uploadProductImageAction(formData: FormData) {
  return run(async () => {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new AdminError("Yuklash uchun rasm tanlang.");
    return uploadProductImage(file);
  });
}

export async function saveCategoryAction(id: string | null, input: unknown) {
  return run(async () => {
    await saveCategory(id === null ? null : docId.parse(id), categoryInputSchema.parse(input));
    updateTag(CATALOG_TAG);
    return null;
  });
}

export async function deleteCategoryAction(id: string) {
  return run(async () => {
    await deleteCategory(docId.parse(id));
    updateTag(CATALOG_TAG);
    return null;
  });
}

export async function saveSettingsAction(input: unknown) {
  return run(async () => {
    await saveSettings(settingsInputSchema.parse(input));
    updateTag(SETTINGS_TAG);
    return null;
  });
}

export async function updateOrderStatusAction(orderId: string, status: string) {
  return run(async () => {
    const id = orderIdSchema.parse(orderId);
    const result = await updateOrderStatus(id, orderStatusSchema.parse(status));
    if (result.stockChanged) updateTag(CATALOG_TAG);
    // Update the order's Telegram messages (status line and buttons) too.
    if (result.changed) after(() => refreshOrderMessages(id));
    return null;
  });
}

export async function addOrderNoteAction(orderId: string, text: string) {
  return run(async () => {
    await addOrderNote(orderIdSchema.parse(orderId), orderNoteSchema.parse(text));
    return null;
  });
}

/** Re-send the notification emails for an order and report what happened. */
export async function resendOrderEmailsAction(orderId: string) {
  return run(async () => {
    const id = orderIdSchema.parse(orderId);
    const order = await getOrder(id); // verifies the admin session
    if (!order) throw new AdminError("Bu buyurtma endi mavjud emas.", "NOT_FOUND");
    await recordEmailRetry(id, order.reference);
    // Only re-send what has not already been delivered (owner at minimum).
    const customerPending = order.customer.email !== null && order.emails.customer.status !== "sent";
    await sendOrderEmails(id, customerPending ? ["owner", "customer"] : ["owner"]);
    const after = await getOrder(id);
    if (after && after.emails.owner.status !== "sent") {
      throw new AdminError(`Xat baribir yuborilmadi: ${after.emails.owner.error ?? "nomaʼlum xato"}`);
    }
    return null;
  });
}

/**
 * Re-send the Telegram notification for an order to the admin chats that
 * have not received it yet, and report what happened.
 */
export async function resendTelegramAction(orderId: string) {
  return run(async () => {
    const id = orderIdSchema.parse(orderId);
    const order = await getOrder(id); // verifies the admin session
    if (!order) throw new AdminError("Bu buyurtma endi mavjud emas.", "NOT_FOUND");
    if (order.telegramAlert.status === "sent") throw new AdminError("Bu buyurtma Telegramga allaqachon yuborilgan.");
    await recordTelegramRetry(id, order.reference);
    const result = await sendOrderTelegram(id, { manual: true });
    if (result.outcome === "busy") throw new AdminError("Xabar hozir yuborilmoqda. Birozdan keyin sahifani yangilang.");
    if (result.outcome !== "sent") {
      throw new AdminError(`Telegramga yuborilmadi: ${result.error ?? "nomaʼlum xato"}`);
    }
    return null;
  });
}
