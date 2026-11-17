import "server-only";
import { randomUUID } from "node:crypto";
import { FieldPath, FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { siteConfig } from "@/config/site";
import { adminHref } from "@/lib/admin-path";
import { formatPhone } from "@/lib/phone";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { adminDb } from "@/server/firebase-admin";
import { mapOrder } from "@/server/mappers";
import { ORDER_STATUS_LABELS, type Order, type OrderStatus, type TelegramAlertStatus } from "@/lib/types";

/**
 * "New order" notifications to the shop admins' Telegram chats.
 *
 * Each order carries an outbox record, `telegramAlert`, written in the same
 * transaction that creates the order (src/server/orders.ts). It is sent:
 *   1. right after checkout, in `after()` (src/app/actions/shop.ts);
 *   2. by the daily cron sweep (src/app/api/cron/telegram/route.ts);
 *   3. by the "Telegramga qayta yuborish" button in the admin panel.
 *
 * Whoever sends first "claims" the record in a transaction (status
 * "sending" + a lease), so concurrent attempts never send in parallel. Each
 * chat that Telegram confirms is added to `deliveredTo` straight away, so a
 * retry only goes to chats that have not received the message. The order
 * is marked "sent" only after Telegram confirmed every chat.
 *
 * Delivery is at-least-once, not exactly-once: if the process dies after
 * Telegram accepted a message but before `deliveredTo` was saved, the next
 * attempt sends that message again. Nothing here is triggered by database
 * writes, so state updates can never cause another notification.
 *
 * The message carries status buttons (✅ / 🚚 / 📦 / ❌). Pressing one reaches
 * the bot's webhook (src/app/api/telegram/webhook/route.ts →
 * src/server/telegram-bot.ts), which changes the order's status and calls
 * `refreshOrderMessages` to update every admin's copy of the message.
 *
 * The bot token is read on the server only and never logged or stored.
 */

// ───────── Configuration ─────────

const OPTIONAL_FIELDS = ["name", "phone", "telegram", "address", "notes"] as const;
export type OptionalField = (typeof OPTIONAL_FIELDS)[number];

export type TelegramConfig =
  | { ok: true; token: string; chatIds: string[]; omit: ReadonlySet<OptionalField> }
  | { ok: false; error: string };

const TOKEN_PATTERN = /^\d{5,20}:[A-Za-z0-9_-]{30,64}$/;
const CHAT_ID_PATTERN = /^-?\d{1,20}$/;
const MAX_CHATS = 10;

/**
 * Reads and validates TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_IDS and
 * TELEGRAM_OMIT_FIELDS. Error messages name the variable, never its value.
 */
export function telegramConfig(): TelegramConfig {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const rawIds = (process.env.TELEGRAM_ADMIN_CHAT_IDS ?? "").trim();
  if (!token && !rawIds) {
    return { ok: false, error: "Telegram sozlanmagan: TELEGRAM_BOT_TOKEN va TELEGRAM_ADMIN_CHAT_IDS koʻrsatilmagan." };
  }
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN koʻrsatilmagan." };
  if (!TOKEN_PATTERN.test(token)) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN notoʻgʻri koʻrinishda (BotFather bergan 123456789:AA… shaklidagi qiymat kerak)." };
  }
  const ids = rawIds.split(/[\s,;]+/).filter(Boolean);
  if (ids.length === 0) return { ok: false, error: "TELEGRAM_ADMIN_CHAT_IDS koʻrsatilmagan." };
  const invalid = ids.filter((id) => !CHAT_ID_PATTERN.test(id)).length;
  if (invalid > 0) {
    return {
      ok: false,
      error: `TELEGRAM_ADMIN_CHAT_IDS faqat raqamli chat ID'lardan iborat boʻlishi kerak (${invalid} ta notoʻgʻri qiymat).`,
    };
  }
  const chatIds = [...new Set(ids)];
  if (chatIds.length > MAX_CHATS) {
    return { ok: false, error: `TELEGRAM_ADMIN_CHAT_IDS da ${MAX_CHATS} tadan koʻp chat koʻrsatilgan.` };
  }
  const omit = new Set<OptionalField>();
  for (const raw of (process.env.TELEGRAM_OMIT_FIELDS ?? "").split(/[\s,;]+/).filter(Boolean)) {
    const field = raw.toLowerCase();
    if ((OPTIONAL_FIELDS as readonly string[]).includes(field)) omit.add(field as OptionalField);
    else console.warn(`[telegram] TELEGRAM_OMIT_FIELDS: unknown field "${field.slice(0, 20)}" ignored`);
  }
  return { ok: true, token, chatIds, omit };
}

export function isTelegramConfigured() {
  return telegramConfig().ok;
}

/** Telegram allows 1-256 of these characters; we require at least 16. */
const WEBHOOK_SECRET_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;

/**
 * TELEGRAM_WEBHOOK_SECRET: Telegram sends it back in the
 * X-Telegram-Bot-Api-Secret-Token header of every webhook request, which is
 * how the webhook knows a request really comes from Telegram. Only the bot's
 * buttons and commands need it; notifications work without it.
 */
export function telegramWebhookSecret(): { ok: true; secret: string } | { ok: false; error: string } {
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim();
  if (!secret) return { ok: false, error: "TELEGRAM_WEBHOOK_SECRET koʻrsatilmagan." };
  if (!WEBHOOK_SECRET_PATTERN.test(secret)) {
    return {
      ok: false,
      error: "TELEGRAM_WEBHOOK_SECRET 16-256 belgidan iborat boʻlishi kerak (faqat A-Z, a-z, 0-9, _ va -).",
    };
  }
  return { ok: true, secret };
}

// ───────── Message ─────────

/** Telegram's limit for one message (characters after HTML is parsed). */
export const TELEGRAM_TEXT_LIMIT = 4096;
/** Our own ceiling, comfortably below the limit. */
const MESSAGE_BUDGET = 3900;

/** Escaping for Telegram's HTML parse mode (it understands &lt; &gt; &amp; &quot;). */
const esc = (value: string) =>
  value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Escape a customer-supplied value, shortening it first so the escaped text
 * is at most `max` characters. Cutting happens before escaping (and on whole
 * characters, never inside an emoji), so no entity or tag is ever cut in half.
 */
function clip(value: string, max: number) {
  const chars = Array.from(value.trim());
  let out = esc(chars.join(""));
  let keep = chars.length;
  while (out.length > max && keep > 0) {
    keep = Math.min(keep - 1, Math.floor(keep * 0.9));
    out = `${esc(chars.slice(0, keep).join("").trimEnd())}…`;
  }
  return out;
}

export const STATUS_EMOJI: Record<OrderStatus, string> = {
  new: "🆕",
  confirmed: "✅",
  preparing: "🧴",
  shipped: "🚚",
  delivered: "📦",
  cancelled: "❌",
};

/** "✅ Holat: Tasdiqlangan · Telegram: @ali, 17-noy, 2026, 14:05" */
export function statusLine(order: Order) {
  let line = `${STATUS_EMOJI[order.status]} Holat: <b>${esc(ORDER_STATUS_LABELS[order.status])}</b>`;
  const last = order.history.at(-1);
  if (order.status !== "new" && last && last.status === order.status) {
    const details = [last.byEmail ? clip(last.byEmail, 80) : "", last.at ? esc(formatDateTime(last.at)) : ""];
    const text = details.filter(Boolean).join(", ");
    if (text) line += ` · ${text}`;
  }
  return line;
}

/** Customers pay on delivery; there is no online payment (see README). */
const PAYMENT_LINE = "💵 Toʻlov: yetkazib berilganda";

/** Link to the order in the admin panel. */
export function orderAdminUrl(order: Pick<Order, "id">) {
  return `${siteConfig.url}${adminHref(`/orders/${order.id}`)}`;
}

/** Build the order message (HTML) sent to the admins and kept up to date. */
export function buildOrderMessage(order: Order, omit: ReadonlySet<OptionalField> = new Set()): string {
  const head = [
    `🛒 <b>${order.status === "new" ? "Yangi buyurtma" : "Buyurtma"} ${esc(order.reference)}</b>`,
    esc(formatDateTime(order.createdAt || Date.now())),
    statusLine(order),
  ].join("\n");

  const totals = [
    `Mahsulotlar: ${esc(formatMoney(order.subtotal))}`,
    `Yetkazib berish: ${order.deliveryFee === 0 ? "Bepul" : esc(formatMoney(order.deliveryFee))}`,
    `<b>Jami: ${esc(formatMoney(order.total))}</b>`,
    PAYMENT_LINE,
  ].join("\n");

  const contact: string[] = [];
  if (!omit.has("name") && order.customer.name) contact.push(`👤 ${clip(order.customer.name, 200)}`);
  if (!omit.has("phone") && order.customer.phone) contact.push(`📞 ${esc(formatPhone(order.customer.phone))}`);
  if (!omit.has("telegram") && order.customer.telegram) contact.push(`✈️ @${clip(order.customer.telegram, 40)}`);
  const area = clip(order.delivery.areaName, 150);
  const address = !omit.has("address") && order.delivery.address ? `, ${clip(order.delivery.address, 600)}` : "";
  contact.push(`📍 ${area}${address}`);
  if (!omit.has("notes") && order.notes.trim()) contact.push(`💬 ${clip(order.notes, 1200)}`);

  // Telegram only accepts public https links: those become the
  // "Admin panelda ochish" button (orderKeyboard). Anything else (e.g.
  // localhost while developing) is shown as plain text instead.
  const adminUrl = orderAdminUrl(order);
  const link = adminUrl.startsWith("https://") ? "" : `Admin panel: ${esc(adminUrl)}`;

  const fixed = [head, totals, contact.join("\n"), link];
  // Room for the items block, minus a line that says how many were left out.
  const itemBudget = MESSAGE_BUDGET - fixed.join("\n\n").length - 2 - 40;
  const items: string[] = [];
  let used = 0;
  for (const [index, item] of order.items.entries()) {
    const label = item.variantName ? `${item.name} (${item.variantName})` : item.name;
    const line = `• ${clip(label, 250)} × ${item.quantity} — ${esc(formatMoney(item.lineTotal))}`;
    if (used + line.length + 1 > itemBudget) {
      items.push(`… va yana ${order.items.length - index} ta mahsulot (admin panelda)`);
      break;
    }
    items.push(line);
    used += line.length + 1;
  }

  return [head, items.join("\n"), totals, contact.join("\n"), link].filter(Boolean).join("\n\n");
}

// ───────── Status buttons ─────────

type InlineButton = { text: string; callback_data: string } | { text: string; url: string };
export type InlineKeyboard = { inline_keyboard: InlineButton[][] };

/**
 * The statuses the message's buttons can set, and which current statuses
 * each button is offered for. The webhook enforces the same `from` list, so
 * pressing an old button (e.g. "Joʻnatildi" on an order cancelled meanwhile)
 * is refused instead of silently re-opening the order.
 */
export const BUTTON_TRANSITIONS = {
  confirmed: { label: "✅ Tasdiqlash", from: ["new"] },
  shipped: { label: "🚚 Joʻnatildi", from: ["new", "confirmed", "preparing"] },
  delivered: { label: "📦 Yetkazildi", from: ["shipped"] },
  cancelled: { label: "❌ Bekor qilish", from: ["new", "confirmed", "preparing"] },
} as const satisfies Partial<Record<OrderStatus, { label: string; from: readonly OrderStatus[] }>>;
export type ButtonStatus = keyof typeof BUTTON_TRANSITIONS;

/**
 * Callback data (Telegram allows 64 bytes; order IDs are 36-character UUIDs):
 *   s:<status>:<orderId>  set the status
 *   x:<orderId>           ask "really cancel?"
 *   k:<orderId>           keep the order (put the normal buttons back)
 */
export const callbackData = {
  set: (status: ButtonStatus, orderId: string) => `s:${status}:${orderId}`,
  askCancel: (orderId: string) => `x:${orderId}`,
  keep: (orderId: string) => `k:${orderId}`,
};

const offered = (status: ButtonStatus, order: Order) =>
  (BUTTON_TRANSITIONS[status].from as readonly OrderStatus[]).includes(order.status);

function adminLinkRow(order: Order): InlineButton[][] {
  // Telegram only accepts public https links in buttons.
  const url = orderAdminUrl(order);
  return url.startsWith("https://") ? [[{ text: "🔗 Admin panelda ochish", url }]] : [];
}

/** Buttons under an order message, depending on its current status. */
export function orderKeyboard(order: Order): InlineKeyboard {
  const rows: InlineButton[][] = [];
  const main = (["confirmed", "shipped", "delivered"] as const)
    .filter((status) => offered(status, order))
    .map((status) => ({ text: BUTTON_TRANSITIONS[status].label, callback_data: callbackData.set(status, order.id) }));
  if (main.length > 0) rows.push(main);
  if (offered("cancelled", order)) {
    rows.push([{ text: BUTTON_TRANSITIONS.cancelled.label, callback_data: callbackData.askCancel(order.id) }]);
  }
  return { inline_keyboard: [...rows, ...adminLinkRow(order)] };
}

/** Cancelling returns the items to stock, so it is confirmed first. */
export function cancelConfirmKeyboard(order: Order): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "Ha, bekor qilinsin", callback_data: callbackData.set("cancelled", order.id) },
        { text: "Yoʻq, qoldirish", callback_data: callbackData.keep(order.id) },
      ],
    ],
  };
}

// ───────── Telegram Bot API ─────────

/**
 * TELEGRAM_API_URL exists so automated tests can point at a local mock
 * (like RESEND_API_URL). It is ignored on Vercel production deployments.
 */
function apiBase() {
  const override = process.env.TELEGRAM_API_URL;
  if (override && process.env.VERCEL_ENV !== "production") return override.replace(/\/$/, "");
  return "https://api.telegram.org";
}
const REQUEST_TIMEOUT_MS = 10_000;
/** Wait in place for a 429 only if Telegram asks for at most this long. */
const MAX_INLINE_WAIT_SECONDS = 15;
const MAX_REQUESTS_PER_CALL = 3;

type TelegramResponse = {
  ok?: boolean;
  result?: unknown;
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number; migrate_to_chat_id?: number };
};

export type ApiResult<T> =
  | { ok: true; result: T }
  | { ok: false; error: string; code: number; retryAfterSeconds?: number };
export type SendResult = { ok: true; messageId: number } | { ok: false; error: string; retryAfterSeconds?: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Never let the token reach logs, the database or the admin UI. */
const redact = (text: string, token: string) => (token ? text.split(token).join("***") : text);

/** "…1234": enough to tell chats apart in errors and logs. */
export const maskChatId = (chatId: string) => `…${chatId.slice(-4)}`;

/**
 * Call one Bot API method. Retries with growing delays (1 s, 2 s) on network
 * errors and 5xx (up to 3 requests), and once on 429 when `retry_after` is
 * short. A timeout is ambiguous: Telegram may have acted on the request, so
 * a retried sendMessage may produce a duplicate (preferred over a missed
 * order). Errors never contain the token.
 */
export async function callTelegram<T = unknown>(
  token: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<ApiResult<T>> {
  let waitedForRateLimit = false;
  for (let request = 1; ; request++) {
    let response: Response;
    try {
      response = await fetch(`${apiBase()}/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      if (request < MAX_REQUESTS_PER_CALL) {
        await sleep(request * 1000);
        continue;
      }
      return {
        ok: false,
        code: 0,
        error: timedOut
          ? "Telegram javob bermadi (timeout); xabar yetib borgan boʻlishi ham mumkin."
          : "Telegram serveriga ulanib boʻlmadi.",
      };
    }

    const body = (await response.json().catch(() => null)) as TelegramResponse | null;
    if (response.ok && body?.ok) return { ok: true, result: body.result as T };

    const code = body?.error_code ?? response.status;
    const description = redact(String(body?.description ?? `HTTP ${response.status}`), token).slice(0, 200);

    if (code === 429) {
      const retryAfter = Math.max(1, Math.ceil(Number(body?.parameters?.retry_after) || 5));
      if (!waitedForRateLimit && retryAfter <= MAX_INLINE_WAIT_SECONDS) {
        waitedForRateLimit = true;
        await sleep(retryAfter * 1000);
        continue;
      }
      return {
        ok: false,
        code,
        error: `Telegram cheklovi (429): ${retryAfter} soniyadan keyin qayta urinish kerak.`,
        retryAfterSeconds: retryAfter,
      };
    }
    if (code >= 500 && request < MAX_REQUESTS_PER_CALL) {
      await sleep(request * 1000);
      continue;
    }
    const migrated = body?.parameters?.migrate_to_chat_id;
    const hint = migrated ? ` Guruh yangi ID oldi (${migrated}): TELEGRAM_ADMIN_CHAT_IDS ni yangilang.` : "";
    return { ok: false, code, error: `Telegram ${code}: ${description}.${hint}` };
  }
}

/** Send one HTML message, optionally with buttons. */
export async function sendTelegramMessage(
  token: string,
  chatId: string,
  html: string,
  replyMarkup?: InlineKeyboard,
): Promise<SendResult> {
  const result = await callTelegram<{ message_id?: number }>(token, "sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(replyMarkup && replyMarkup.inline_keyboard.length > 0 ? { reply_markup: replyMarkup } : {}),
  });
  if (!result.ok) return { ok: false, error: result.error, retryAfterSeconds: result.retryAfterSeconds };
  const messageId = result.result?.message_id;
  if (typeof messageId !== "number") return { ok: false, error: "Telegram javobida message_id yoʻq." };
  return { ok: true, messageId };
}

/** Telegram answers 400 "message is not modified" when nothing changed: that is fine. */
const notModified = (result: ApiResult<unknown>) => !result.ok && /message is not modified/i.test(result.error);

/** Replace a message's text and buttons (an empty keyboard removes the buttons). */
export async function editTelegramMessage(
  token: string,
  chatId: string,
  messageId: number,
  html: string,
  replyMarkup: InlineKeyboard,
): Promise<ApiResult<unknown>> {
  const result = await callTelegram(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: replyMarkup,
  });
  return notModified(result) ? { ok: true, result: null } : result;
}

/** Replace only a message's buttons. */
export async function editTelegramKeyboard(
  token: string,
  chatId: string,
  messageId: number,
  replyMarkup: InlineKeyboard,
): Promise<ApiResult<unknown>> {
  const result = await callTelegram(token, "editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  });
  return notModified(result) ? { ok: true, result: null } : result;
}

// ───────── Outbox: claim → send → finish ─────────

/** Automatic (after() + cron) attempts per order; the admin button is not limited. */
const MAX_AUTO_ATTEMPTS = 5;
/** Wait before automatic attempt 2, 3, 4, 5. */
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
/** How long a claim is honoured before another attempt may take over. */
const LEASE_BASE_MS = 30_000;
const LEASE_PER_CHAT_MS = 60_000;

const field = (name: string) => `telegramAlert.${name}`;

export type TelegramOutcome = TelegramAlertStatus | "busy" | "not-due" | "missing";
export type TelegramResult = { outcome: TelegramOutcome; error?: string };

type Claim = { claimId: string; order: Order; attempt: number };

async function claim(ref: DocumentReference, manual: boolean, chatCount: number): Promise<Claim | TelegramResult> {
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { outcome: "missing" };
    const order = mapOrder(snap);
    const state = order.telegramAlert;
    const now = Date.now();

    if (state.status === "sent") return { outcome: "sent" };
    if (state.status === "sending" && (state.leaseUntil ?? 0) > now) return { outcome: "busy" };
    if (!manual) {
      if (!state.queued) return { outcome: state.status };
      if (state.attempts >= MAX_AUTO_ATTEMPTS) {
        // Earlier attempts never finished (e.g. the process was killed).
        tx.update(ref, {
          [field("status")]: "failed",
          [field("queued")]: false,
          [field("claimId")]: null,
          [field("leaseUntil")]: null,
          [field("error")]: state.error ?? "Yuborish yakunlanmadi. Admin paneldan qayta yuboring.",
        });
        return { outcome: "failed", error: state.error ?? undefined };
      }
      if ((state.nextAttemptAt ?? 0) > now) return { outcome: "not-due" };
    }

    const claimId = randomUUID();
    const attempt = state.attempts + 1;
    tx.update(ref, {
      [field("status")]: "sending",
      [field("claimId")]: claimId,
      [field("leaseUntil")]: now + LEASE_BASE_MS + chatCount * LEASE_PER_CHAT_MS,
      [field("attempts")]: attempt,
      [field("lastAttemptAt")]: now,
    });
    return { claimId, order, attempt };
  });
}

async function finish(
  ref: DocumentReference,
  current: Claim,
  chatIds: string[],
  failures: Map<string, string>,
  retryAfterSeconds: number,
): Promise<TelegramResult> {
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { outcome: "missing" };
    const state = mapOrder(snap).telegramAlert;
    // Our lease expired and another attempt took over: its result wins.
    if (state.claimId !== current.claimId) return { outcome: state.status, error: state.error ?? undefined };

    const delivered = new Set(state.deliveredTo);
    const missing = chatIds.filter((id) => !delivered.has(id));
    if (missing.length === 0) {
      tx.update(ref, {
        [field("status")]: "sent",
        [field("error")]: null,
        [field("queued")]: false,
        [field("nextAttemptAt")]: null,
        [field("claimId")]: null,
        [field("leaseUntil")]: null,
      });
      return { outcome: "sent" };
    }

    const error = missing
      .map((id) => `${maskChatId(id)}: ${failures.get(id) ?? "yuborilmadi"}`)
      .join("; ")
      .slice(0, 600);
    const queued = current.attempt < MAX_AUTO_ATTEMPTS;
    const delay = Math.max(
      retryAfterSeconds * 1000,
      RETRY_DELAYS_MS[Math.min(current.attempt - 1, RETRY_DELAYS_MS.length - 1)],
    );
    tx.update(ref, {
      [field("status")]: "failed",
      [field("error")]: error,
      [field("queued")]: queued,
      [field("nextAttemptAt")]: queued ? Date.now() + delay : null,
      [field("claimId")]: null,
      [field("leaseUntil")]: null,
    });
    return { outcome: "failed", error };
  });
}

/** Telegram is not set up: park the record so it stops being retried. */
async function markNotConfigured(ref: DocumentReference, error: string) {
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const state = mapOrder(snap).telegramAlert;
    const active = state.status === "sending" && (state.leaseUntil ?? 0) > Date.now();
    if (state.status === "sent" || state.status === "skipped" || active) return;
    tx.update(ref, {
      [field("status")]: "skipped",
      [field("error")]: error,
      [field("queued")]: false,
      [field("claimId")]: null,
      [field("leaseUntil")]: null,
    });
  });
}

/**
 * Send (or re-send) the Telegram notification for an order and record the
 * result on the order. Never throws for Telegram problems; Firestore errors
 * propagate to the caller. `manual` is the admin's retry button: it ignores
 * the automatic attempt limit and schedule, and also works for orders whose
 * notification was skipped (e.g. placed before Telegram was configured).
 */
export async function sendOrderTelegram(orderId: string, { manual = false } = {}): Promise<TelegramResult> {
  const ref = adminDb().collection("orders").doc(orderId);
  const config = telegramConfig();
  if (!config.ok) {
    if (!manual) await markNotConfigured(ref, config.error);
    return { outcome: "skipped", error: config.error };
  }

  const claimed = await claim(ref, manual, config.chatIds.length);
  if (!("claimId" in claimed)) return claimed;

  const { order } = claimed;
  const text = buildOrderMessage(order, config.omit);
  const keyboard = orderKeyboard(order);
  const alreadyDelivered = new Set(order.telegramAlert.deliveredTo);
  const failures = new Map<string, string>();
  let retryAfterSeconds = 0;

  for (const chatId of config.chatIds) {
    if (alreadyDelivered.has(chatId)) continue;
    const result = await sendTelegramMessage(config.token, chatId, text, keyboard);
    if (result.ok) {
      try {
        // Saved per chat, so a later retry skips the chats that already have it.
        await ref.update(
          new FieldPath("telegramAlert", "deliveredTo"),
          FieldValue.arrayUnion(chatId),
          new FieldPath("telegramAlert", "messageIds", chatId),
          result.messageId,
        );
      } catch (error) {
        // Telegram has the message but we could not record it: a retry will
        // send it to this chat again (a duplicate, not a loss).
        console.error("[telegram] could not record delivery", { order: order.reference, chat: maskChatId(chatId), error });
        failures.set(chatId, "Yuborildi, lekin bazaga yozib boʻlmadi; qayta urinishda takrorlanishi mumkin.");
        continue;
      }
      console.info("[telegram] order notification sent", { order: order.reference, chat: maskChatId(chatId), attempt: claimed.attempt });
    } else {
      failures.set(chatId, result.error);
      retryAfterSeconds = Math.max(retryAfterSeconds, result.retryAfterSeconds ?? 0);
      console.error("[telegram] order notification failed", {
        order: order.reference,
        chat: maskChatId(chatId),
        attempt: claimed.attempt,
        error: result.error,
      });
    }
  }

  return finish(ref, claimed, config.chatIds, failures, retryAfterSeconds);
}

export type SweepResult = {
  configured: boolean;
  checked: number;
  sent: number;
  failed: number;
  other: number;
  timedOut: boolean;
};

/**
 * Retry notifications that are still queued: never sent (the after() step
 * was cut off), failed and due again, or stuck in "sending" past their lease.
 * Stops starting new orders after `budgetMs` so it ends within the function's
 * time limit; anything left over is picked up by the next run.
 */
export async function sweepTelegramAlerts({ limit = 25, budgetMs = 40_000 } = {}): Promise<SweepResult> {
  const result: SweepResult = { configured: false, checked: 0, sent: 0, failed: 0, other: 0, timedOut: false };
  if (!isTelegramConfigured()) return result;
  result.configured = true;

  const deadline = Date.now() + budgetMs;
  const snap = await adminDb().collection("orders").where("telegramAlert.queued", "==", true).limit(limit).get();
  for (const doc of snap.docs) {
    if (Date.now() > deadline) {
      result.timedOut = true;
      break;
    }
    result.checked++;
    try {
      const { outcome } = await sendOrderTelegram(doc.id);
      if (outcome === "sent") result.sent++;
      else if (outcome === "failed") result.failed++;
      else result.other++;
    } catch (error) {
      result.failed++;
      console.error("[telegram] sweep step failed", { orderId: doc.id, error });
    }
  }
  return result;
}

// ───────── Keeping sent messages up to date ─────────

/**
 * Re-render every admin's copy of an order's message (text and buttons)
 * after its status changed, from the bot or from the admin panel. Only chats
 * still listed in TELEGRAM_ADMIN_CHAT_IDS are edited. `skip` is a message
 * the caller has already edited. Best effort: failures are logged, never
 * thrown, and never change the order.
 */
export async function refreshOrderMessages(
  orderId: string,
  { skip }: { skip?: { chatId: string; messageId: number } } = {},
): Promise<void> {
  const config = telegramConfig();
  if (!config.ok) return;
  try {
    const snap = await adminDb().collection("orders").doc(orderId).get();
    if (!snap.exists) return;
    const order = mapOrder(snap);
    const targets = Object.entries(order.telegramAlert.messageIds).filter(
      ([chatId, messageId]) =>
        config.chatIds.includes(chatId) && !(skip && skip.chatId === chatId && skip.messageId === messageId),
    );
    if (targets.length === 0) return;
    const text = buildOrderMessage(order, config.omit);
    const keyboard = orderKeyboard(order);
    const results = await Promise.all(
      targets.map(([chatId, messageId]) => editTelegramMessage(config.token, chatId, messageId, text, keyboard)),
    );
    results.forEach((result, index) => {
      if (!result.ok) {
        console.error("[telegram] could not update order message", {
          order: order.reference,
          chat: maskChatId(targets[index][0]),
          error: result.error,
        });
      }
    });
  } catch (error) {
    console.error("[telegram] refreshing order messages failed", { orderId, error });
  }
}
