import "server-only";
import { siteConfig } from "@/config/site";
import { formatPhone } from "@/lib/phone";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { adminDb } from "@/server/firebase-admin";
import { mapOrder, mapSettings } from "@/server/mappers";
import type { EmailState, Order } from "@/lib/types";
import { adminHref } from "@/lib/admin-path";

/**
 * Transactional email through Resend's HTTP API (https://resend.com).
 * The API key is read on the server only. To use another provider, replace
 * the body of `sendEmail` — nothing else in the app talks to the provider.
 */

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

type Email = { to: string; subject: string; html: string; text: string; replyTo?: string; idempotencyKey?: string };

export async function sendEmail(email: Email): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "Email sozlanmagan (RESEND_API_KEY / EMAIL_FROM yoʻq)." };
  }
  try {
    // RESEND_API_URL exists so automated tests can point at a local mock.
    const response = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(email.idempotencyKey ? { "Idempotency-Key": email.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return { ok: true };
    const body = await response.text().catch(() => "");
    return { ok: false, error: `Email xizmati ${response.status} xato qaytardi: ${body.slice(0, 300)}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Nomaʼlum email xatosi" };
  }
}

const esc = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string) {
  return `<!doctype html><html lang="uz"><body style="margin:0;background:#fbf6f1;font-family:Arial,Helvetica,sans-serif;color:#2b1d22">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<p style="font-size:20px;font-weight:bold;margin:0 0 16px;color:#8a2749">${esc(siteConfig.name)}</p>
<div style="background:#ffffff;border:1px solid #eadfd6;border-radius:12px;padding:24px">
<h1 style="font-size:18px;margin:0 0 16px">${esc(title)}</h1>
${body}
</div></div></body></html>`;
}

function itemRows(order: Order) {
  return order.items
    .map(
      (item) => `<tr>
<td style="padding:6px 0;border-bottom:1px solid #f1e8e1">${esc(item.name)}${
        item.variantName ? ` <span style="color:#6f5d63">(${esc(item.variantName)})</span>` : ""
      }</td>
<td style="padding:6px 8px;border-bottom:1px solid #f1e8e1;text-align:center">× ${item.quantity}</td>
<td style="padding:6px 0;border-bottom:1px solid #f1e8e1;text-align:right;white-space:nowrap">${esc(
        formatMoney(item.lineTotal),
      )}</td></tr>`,
    )
    .join("");
}

function totalsBlock(order: Order) {
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0 0">
${itemRows(order)}
<tr><td colspan="2" style="padding:8px 0 2px;color:#6f5d63">Mahsulotlar</td><td style="padding:8px 0 2px;text-align:right">${esc(
    formatMoney(order.subtotal),
  )}</td></tr>
<tr><td colspan="2" style="padding:2px 0;color:#6f5d63">Yetkazib berish</td><td style="padding:2px 0;text-align:right">${
    order.deliveryFee === 0 ? "Bepul" : esc(formatMoney(order.deliveryFee))
  }</td></tr>
<tr><td colspan="2" style="padding:6px 0;font-weight:bold">Jami</td><td style="padding:6px 0;text-align:right;font-weight:bold">${esc(
    formatMoney(order.total),
  )}</td></tr></table>`;
}

function itemsText(order: Order) {
  return order.items
    .map(
      (i) => `- ${i.name}${i.variantName ? ` (${i.variantName})` : ""} x ${i.quantity} = ${formatMoney(i.lineTotal)}`,
    )
    .join("\n");
}

function ownerEmail(order: Order, to: string): Email {
  const adminUrl = `${siteConfig.url}${adminHref(`/orders/${order.id}`)}`;
  const phone = formatPhone(order.customer.phone);
  const html = layout(
    `Yangi buyurtma ${order.reference}`,
    `<p style="margin:0 0 12px;font-size:14px;color:#6f5d63">${esc(formatDateTime(order.createdAt))}</p>
${totalsBlock(order)}
<h2 style="font-size:15px;margin:20px 0 6px">Mijoz</h2>
<p style="margin:0;font-size:14px;line-height:1.6">${esc(order.customer.name)}<br>
<a href="tel:${esc(order.customer.phone)}" style="color:#8a2749">${esc(phone)}</a>${
      order.customer.email ? `<br>${esc(order.customer.email)}` : ""
    }</p>
<h2 style="font-size:15px;margin:20px 0 6px">Yetkazib berish</h2>
<p style="margin:0;font-size:14px;line-height:1.6">${esc(order.delivery.areaName)}<br>${esc(order.delivery.address)}</p>
${
  order.notes
    ? `<h2 style="font-size:15px;margin:20px 0 6px">Mijoz izohi</h2><p style="margin:0;font-size:14px;line-height:1.6">${esc(
        order.notes,
      )}</p>`
    : ""
}
<p style="margin:24px 0 0"><a href="${esc(adminUrl)}" style="display:inline-block;background:#8a2749;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:14px">Buyurtmani admin panelda ochish</a></p>`,
  );
  const text = `Yangi buyurtma ${order.reference} (${formatDateTime(order.createdAt)})

${itemsText(order)}

Mahsulotlar: ${formatMoney(order.subtotal)}
Yetkazib berish: ${order.deliveryFee === 0 ? "Bepul" : formatMoney(order.deliveryFee)}
Jami: ${formatMoney(order.total)}

Mijoz: ${order.customer.name}
Telefon: ${phone}${order.customer.email ? `\nEmail: ${order.customer.email}` : ""}
Manzil: ${order.delivery.areaName}, ${order.delivery.address}${order.notes ? `\nIzoh: ${order.notes}` : ""}

${adminUrl}`;
  return {
    to,
    subject: `Yangi buyurtma ${order.reference} · ${formatMoney(order.total)}`,
    html,
    text,
    replyTo: order.customer.email ?? undefined,
  };
}

function customerEmail(order: Order, to: string): Email {
  const html = layout(
    "Rahmat — buyurtmangiz qabul qilindi",
    `<p style="margin:0 0 12px;font-size:14px;line-height:1.6">Assalomu alaykum, ${esc(
      order.customer.name.split(/\s+/)[0] ?? "",
    )}! <strong>${esc(order.reference)}</strong> raqamli buyurtmangiz bizga yetib keldi. Yetkazib berishni tasdiqlash uchun ${esc(
      formatPhone(order.customer.phone),
    )} raqamiga bogʻlanamiz. Toʻlov yetkazib berilganda yoki doʻkon bilan kelishilgan tartibda amalga oshiriladi.</p>
${totalsBlock(order)}
<h2 style="font-size:15px;margin:20px 0 6px">Yetkazib berish</h2>
<p style="margin:0;font-size:14px;line-height:1.6">${esc(order.delivery.areaName)}<br>${esc(order.delivery.address)}</p>
<p style="margin:20px 0 0;font-size:13px;color:#6f5d63">Savolingiz bormi? Shu xatga javob yozing va buyurtma raqamini koʻrsating.</p>`,
  );
  const text = `Rahmat — ${order.reference} raqamli buyurtmangiz qabul qilindi.

${itemsText(order)}

Mahsulotlar: ${formatMoney(order.subtotal)}
Yetkazib berish: ${order.deliveryFee === 0 ? "Bepul" : formatMoney(order.deliveryFee)}
Jami: ${formatMoney(order.total)}

Manzil: ${order.delivery.areaName}, ${order.delivery.address}

Yetkazib berishni tasdiqlash uchun ${formatPhone(order.customer.phone)} raqamiga bogʻlanamiz. Toʻlov yetkazib berilganda yoki doʻkon bilan kelishilgan tartibda amalga oshiriladi.`;
  return { to, subject: `${siteConfig.name}: ${order.reference} raqamli buyurtmangiz`, html, text };
}

export function signInEmail(to: string, link: string): Email {
  const html = layout(
    `${siteConfig.name} saytiga kirish`,
    `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">Kirishni yakunlash uchun quyidagi tugmani bosing. Havola faqat bir marta ishlaydi va tez orada muddati tugaydi.</p>
<p style="margin:0 0 16px"><a href="${esc(link)}" style="display:inline-block;background:#8a2749;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:15px">Kirish</a></p>
<p style="margin:0;font-size:13px;color:#6f5d63;line-height:1.6">Agar bu xatni siz soʻramagan boʻlsangiz, eʼtibor bermang — bu havolasiz hech kim kira olmaydi.</p>`,
  );
  return {
    to,
    subject: `${siteConfig.name}: kirish havolasi`,
    html,
    text: `${siteConfig.name} saytiga kirish uchun ushbu havolani oching (u faqat bir marta ishlaydi va tez orada muddati tugaydi):\n\n${link}\n\nAgar bu xatni siz soʻramagan boʻlsangiz, eʼtibor bermang.`,
  };
}

export type OrderEmailKind = "owner" | "customer";

/**
 * Send (or re-send) the emails for an order and record the outcome on the
 * order itself. A failure here never affects the order: the result is stored
 * in `emails.<kind>` so the admin can see it and retry.
 */
export async function sendOrderEmails(orderId: string, kinds: OrderEmailKind[] = ["owner", "customer"]) {
  const db = adminDb();
  const orderRef = db.collection("orders").doc(orderId);
  const [orderSnap, settingsSnap] = await Promise.all([orderRef.get(), db.collection("settings").doc("store").get()]);
  if (!orderSnap.exists) return;
  const order = mapOrder(orderSnap);
  const settings = mapSettings(settingsSnap.data());

  const update: Record<string, EmailState> = {};
  for (const kind of kinds) {
    const previous = order.emails[kind];
    const to = kind === "owner" ? settings.ownerEmail || process.env.ORDER_NOTIFICATION_EMAIL || "" : order.customer.email;
    if (kind === "customer" && !to) {
      update[`emails.customer`] = { ...previous, status: "skipped" };
      continue;
    }
    const attempt = previous.attempts + 1;
    const result = to
      ? await sendEmail({
          ...(kind === "owner" ? ownerEmail(order, to) : customerEmail(order, to)),
          idempotencyKey: `order-${order.id}-${kind}-${attempt}`,
        })
      : ({ ok: false, error: "Xabarnoma manzili koʻrsatilmagan (Admin → Sozlamalar yoki ORDER_NOTIFICATION_EMAIL)." } as const);
    update[`emails.${kind}`] = {
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error,
      attempts: attempt,
      lastAttemptAt: Date.now(),
    };
    if (!result.ok) console.error(`[email] ${kind} email for order ${order.reference} failed: ${result.error}`);
  }
  if (Object.keys(update).length > 0) await orderRef.update(update);
}
