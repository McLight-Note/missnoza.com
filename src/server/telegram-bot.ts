import "server-only";
import { revalidateTag } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { siteConfig } from "@/config/site";
import { addDays, shopDayStart, shopToday } from "@/lib/dates";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { orderIdSchema } from "@/lib/validation";
import { AdminError, changeOrderStatus } from "@/server/admin/mutations";
import { CATALOG_TAG } from "@/server/catalog";
import { adminDb } from "@/server/firebase-admin";
import { mapOrder } from "@/server/mappers";
import {
  BUTTON_TRANSITIONS,
  STATUS_EMOJI,
  buildOrderMessage,
  callTelegram,
  cancelConfirmKeyboard,
  editTelegramKeyboard,
  editTelegramMessage,
  maskChatId,
  orderKeyboard,
  refreshOrderMessages,
  sendTelegramMessage,
  type ButtonStatus,
  type TelegramConfig,
} from "@/server/telegram";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type Order, type OrderStatus } from "@/lib/types";

/**
 * The admin bot: commands and the status buttons under order messages.
 * Called by the webhook (src/app/api/telegram/webhook/route.ts) after it has
 * checked Telegram's secret header.
 *
 * Who may use it: only chats listed in TELEGRAM_ADMIN_CHAT_IDS. A private
 * chat's ID is the person's own ID; for a group, EVERY member of that group
 * may use the commands and press the buttons. Everyone else gets a polite
 * refusal (and /start shows them their chat ID, which is needed for setup).
 */

type Config = Extract<TelegramConfig, { ok: true }>;

// The parts of Telegram's Update object this bot reads.
type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string };
type TgChat = { id: number; type: string; title?: string };
type TgMessage = { message_id: number; chat: TgChat; from?: TgUser; text?: string };
type TgCallbackQuery = { id: string; from: TgUser; message?: TgMessage; data?: string };
export type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: TgCallbackQuery };

const esc = (value: string) =>
  value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Shorten (whole characters) and escape a customer-supplied value for a list line. */
const short = (value: string, max: number) => {
  const chars = Array.from(value.trim());
  return esc(chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : chars.join(""));
};

const isAuthorizedChat = (config: Config, chatId: number) => config.chatIds.includes(String(chatId));

async function reply(config: Config, chatId: number, html: string, keyboard?: ReturnType<typeof orderKeyboard>) {
  const result = await sendTelegramMessage(config.token, String(chatId), html, keyboard);
  if (!result.ok) console.error("[telegram-bot] reply failed", { chat: maskChatId(String(chatId)), error: result.error });
}

async function answerCallback(config: Config, id: string, text: string, alert = false) {
  const result = await callTelegram(config.token, "answerCallbackQuery", {
    callback_query_id: id,
    text: text.slice(0, 200),
    show_alert: alert,
  });
  if (!result.ok) console.error("[telegram-bot] answerCallbackQuery failed", { error: result.error });
}

/** Entry point for one webhook update. Never throws for Telegram problems. */
export async function handleUpdate(update: TgUpdate, config: Config): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query, config);
  const message = update.message;
  if (message?.text && message.from && !message.from.is_bot) return handleCommand(message, config);
}

// ───────── Commands ─────────

const HELP = [
  "/orders — oxirgi 10 ta buyurtma",
  "/today — bugungi buyurtmalar va tushum",
  "/order MN-XXXX-XXXX — bitta buyurtma",
  "/stats — 7 kunlik va oylik hisobot",
].join("\n");

/** "/order@my_bot MN-ABCD-EFGH" → { name: "order", arg: "MN-ABCD-EFGH" } */
function parseCommand(text: string) {
  const match = /^\/([A-Za-z0-9_]{1,64})(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!match) return null;
  return { name: match[1].toLowerCase(), arg: (match[2] ?? "").trim() };
}

async function handleCommand(message: TgMessage, config: Config) {
  const command = parseCommand(message.text ?? "");
  if (!command) return; // Ordinary text: ignored.
  const chatId = message.chat.id;

  if (!isAuthorizedChat(config, chatId)) {
    console.warn("[telegram-bot] command from an unauthorized chat", { chat: maskChatId(String(chatId)) });
    if (command.name === "start" || command.name === "help") {
      await reply(
        config,
        chatId,
        `Assalomu alaykum! Bu bot faqat ${esc(siteConfig.name)} administratorlari uchun.\n\n` +
          `Sizning chat ID: <code>${chatId}</code>\n` +
          "Agar siz administrator boʻlsangiz, shu raqamni sayt egasiga yuboring: u TELEGRAM_ADMIN_CHAT_IDS ga qoʻshadi.",
      );
    } else {
      await reply(config, chatId, "Kechirasiz, bu botdan foydalanishga ruxsatingiz yoʻq.");
    }
    return;
  }

  try {
    if (command.name === "start" || command.name === "help") {
      await reply(
        config,
        chatId,
        `Assalomu alaykum! Yangi buyurtmalar shu chatga keladi.\n\nChat ID: <code>${chatId}</code>\n\n${esc(HELP)}`,
      );
    } else if (command.name === "orders") {
      await reply(config, chatId, await latestOrdersText(config));
    } else if (command.name === "order" || command.name.startsWith("order_")) {
      const arg = command.name === "order" ? command.arg : command.name.slice("order_".length);
      await sendOrderDetails(config, chatId, arg);
    } else if (command.name === "today") {
      const today = shopToday(Date.now());
      const summary = await summarize(shopDayStart(today), shopDayStart(addDays(today, 1)));
      await reply(config, chatId, `📅 <b>Bugun</b> (${esc(today)})\n${summaryText(summary)}`);
    } else if (command.name === "stats") {
      const today = shopToday(Date.now());
      const end = shopDayStart(addDays(today, 1));
      const [week, month] = await Promise.all([
        summarize(shopDayStart(addDays(today, -6)), end),
        summarize(shopDayStart(`${today.slice(0, 8)}01`), end),
      ]);
      await reply(
        config,
        chatId,
        `📊 <b>Oxirgi 7 kun</b>\n${summaryText(week)}\n\n📊 <b>Shu oy</b> (${esc(today.slice(0, 7))})\n${summaryText(month)}`,
      );
    } else {
      await reply(config, chatId, `Bunday buyruq yoʻq.\n\n${esc(HELP)}`);
    }
  } catch (error) {
    console.error("[telegram-bot] command failed", { command: command.name, error });
    await reply(config, chatId, "Xatolik yuz berdi. Birozdan keyin qayta urinib koʻring yoki admin panelni oching.");
  }
}

/** "/order_MNABCDEFGH" works as a tappable shortcut in /orders (commands cannot contain "-"). */
const shortcut = (reference: string) => `/order_${reference.replace(/[^A-Za-z0-9]/g, "")}`;

async function latestOrdersText(config: Config) {
  const snap = await adminDb().collection("orders").orderBy("createdAt", "desc").limit(10).get();
  if (snap.empty) return "Hali buyurtmalar yoʻq.";
  const lines = snap.docs.map(mapOrder).map((order) => {
    const name = !config.omit.has("name") && order.customer.name ? ` · ${short(order.customer.name, 40)}` : "";
    return (
      `${STATUS_EMOJI[order.status]} <b>${esc(order.reference)}</b> · ${esc(formatMoney(order.total))}\n` +
      `${esc(ORDER_STATUS_LABELS[order.status])}${name} · ${esc(formatDateTime(order.createdAt))}\n` +
      shortcut(order.reference)
    );
  });
  return `🧾 <b>Oxirgi ${lines.length} ta buyurtma</b>\n\n${lines.join("\n\n")}`;
}

/** Accepts "MN-ABCD-EFGH", "mnabcdefgh" or the order's document ID. */
async function findOrder(input: string): Promise<Order | null> {
  const value = input.trim();
  if (!value) return null;
  const db = adminDb();
  if (orderIdSchema.safeParse(value).success) {
    const snap = await db.collection("orders").doc(value).get();
    return snap.exists ? mapOrder(snap) : null;
  }
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const prefix = siteConfig.order.referencePrefix.toUpperCase();
  if (!compact.startsWith(prefix) || compact.length !== prefix.length + 8) return null;
  const code = compact.slice(prefix.length);
  const reference = `${prefix}-${code.slice(0, 4)}-${code.slice(4)}`;
  const snap = await db.collection("orders").where("reference", "==", reference).limit(1).get();
  return snap.empty ? null : mapOrder(snap.docs[0]);
}

async function sendOrderDetails(config: Config, chatId: number, arg: string) {
  if (!arg) {
    await reply(config, chatId, "Buyurtma raqamini yozing, masalan: <code>/order MN-ABCD-EFGH</code>");
    return;
  }
  const order = await findOrder(arg);
  if (!order) {
    await reply(config, chatId, `“${short(arg, 40)}” raqamli buyurtma topilmadi.`);
    return;
  }
  await reply(config, chatId, buildOrderMessage(order, config.omit), orderKeyboard(order));
}

type Summary = { count: number; cancelled: number; revenue: number; byStatus: Record<OrderStatus, number>; truncated: boolean };

const SUMMARY_LIMIT = 5000;

/** Orders created in [start, end). Revenue leaves out cancelled orders, like the admin dashboard. */
async function summarize(start: number, end: number): Promise<Summary> {
  const snap = await adminDb()
    .collection("orders")
    .where("createdAt", ">=", Timestamp.fromMillis(start))
    .where("createdAt", "<", Timestamp.fromMillis(end))
    .orderBy("createdAt", "desc")
    .select("status", "total")
    .limit(SUMMARY_LIMIT)
    .get();
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  let revenue = 0;
  for (const doc of snap.docs) {
    const raw = doc.get("status");
    const status: OrderStatus = (ORDER_STATUSES as readonly string[]).includes(raw) ? raw : "new";
    byStatus[status] += 1;
    const total = Number(doc.get("total"));
    if (status !== "cancelled" && Number.isFinite(total)) revenue += total;
  }
  return { count: snap.size, cancelled: byStatus.cancelled, revenue, byStatus, truncated: snap.size >= SUMMARY_LIMIT };
}

function summaryText(summary: Summary) {
  if (summary.count === 0) return "Buyurtmalar yoʻq.";
  const breakdown = ORDER_STATUSES.filter((s) => summary.byStatus[s] > 0)
    .map((s) => `${STATUS_EMOJI[s]} ${esc(ORDER_STATUS_LABELS[s])}: ${summary.byStatus[s]}`)
    .join("\n");
  return [
    `Buyurtmalar: <b>${summary.count}</b>${summary.cancelled ? ` (${summary.cancelled} tasi bekor qilingan)` : ""}`,
    `Tushum: <b>${esc(formatMoney(summary.revenue))}</b>`,
    breakdown,
    summary.truncated ? `(Faqat oxirgi ${SUMMARY_LIMIT} ta buyurtma hisoblandi.)` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ───────── Buttons ─────────

type Parsed =
  | { kind: "set"; status: ButtonStatus; orderId: string }
  | { kind: "askCancel"; orderId: string }
  | { kind: "keep"; orderId: string };

function parseCallback(data: string): Parsed | null {
  const [kind, a, b] = data.split(":");
  if (kind === "s" && Object.hasOwn(BUTTON_TRANSITIONS, a) && orderIdSchema.safeParse(b).success) {
    return { kind: "set", status: a as ButtonStatus, orderId: b };
  }
  if ((kind === "x" || kind === "k") && orderIdSchema.safeParse(a).success && b === undefined) {
    return { kind: kind === "x" ? "askCancel" : "keep", orderId: a };
  }
  return null;
}

/** "Telegram: @ali" / "Telegram: Ali Valiyev": shown in the order history and activity log. */
function actorLabel(user: TgUser) {
  const name = user.username ? `@${user.username}` : [user.first_name, user.last_name].filter(Boolean).join(" ");
  return `Telegram: ${Array.from(name || String(user.id)).slice(0, 60).join("")}`;
}

async function loadOrder(orderId: string) {
  const snap = await adminDb().collection("orders").doc(orderId).get();
  return snap.exists ? mapOrder(snap) : null;
}

async function handleCallback(query: TgCallbackQuery, config: Config) {
  const message = query.message;
  if (!message) {
    await answerCallback(config, query.id, "Bu xabar endi mavjud emas.", true);
    return;
  }
  const chatId = message.chat.id;
  if (!isAuthorizedChat(config, chatId)) {
    console.warn("[telegram-bot] button pressed in an unauthorized chat", { chat: maskChatId(String(chatId)) });
    await answerCallback(config, query.id, "Ruxsat yoʻq.", true);
    return;
  }
  const parsed = parseCallback(query.data ?? "");
  if (!parsed) {
    await answerCallback(config, query.id, "Bu tugma eskirgan.", true);
    return;
  }

  const chat = String(chatId);
  const editPressed = (order: Order) =>
    editTelegramMessage(config.token, chat, message.message_id, buildOrderMessage(order, config.omit), orderKeyboard(order));

  try {
    if (parsed.kind !== "set") {
      const order = await loadOrder(parsed.orderId);
      if (!order) {
        await answerCallback(config, query.id, "Bu buyurtma endi mavjud emas.", true);
        return;
      }
      const askCancel =
        parsed.kind === "askCancel" &&
        (BUTTON_TRANSITIONS.cancelled.from as readonly OrderStatus[]).includes(order.status);
      await answerCallback(
        config,
        query.id,
        askCancel
          ? "Buyurtmani bekor qilasizmi?"
          : parsed.kind === "keep"
            ? "Bekor qilinmadi."
            : `Holat allaqachon: ${ORDER_STATUS_LABELS[order.status]}`,
      );
      const result = askCancel
        ? await editTelegramKeyboard(config.token, chat, message.message_id, cancelConfirmKeyboard(order))
        : await editPressed(order);
      if (!result.ok) console.error("[telegram-bot] could not update buttons", { error: result.error });
      return;
    }

    const { status, orderId } = parsed;
    const change = await changeOrderStatus(
      orderId,
      status,
      { uid: `telegram:${query.from.id}`, email: null, label: actorLabel(query.from) },
      { expectedFrom: BUTTON_TRANSITIONS[status].from },
    );
    if (change.stockChanged) revalidateTag(CATALOG_TAG, { expire: 0 });
    console.info("[telegram-bot] status changed", {
      order: change.reference,
      status,
      changed: change.changed,
      by: `telegram:${query.from.id}`,
    });
    await answerCallback(
      config,
      query.id,
      change.changed
        ? `${STATUS_EMOJI[status]} ${change.reference}: ${ORDER_STATUS_LABELS[status]}`
        : `Holat allaqachon: ${ORDER_STATUS_LABELS[status]}`,
    );
  } catch (error) {
    if (error instanceof AdminError) {
      await answerCallback(config, query.id, error.message, true);
    } else {
      console.error("[telegram-bot] button failed", { data: query.data, error });
      await answerCallback(config, query.id, "Xatolik yuz berdi. Admin paneldan urinib koʻring.", true);
      return;
    }
  }

  // Show the order's current state on the pressed message and on every
  // admin's copy (also after a refused, stale button).
  const order = await loadOrder(parsed.orderId);
  if (!order) return;
  const edited = await editPressed(order);
  if (!edited.ok) console.error("[telegram-bot] could not update the pressed message", { error: edited.error });
  await refreshOrderMessages(order.id, { skip: { chatId: chat, messageId: message.message_id } });
}
