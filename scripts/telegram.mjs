// Telegram setup helpers. Reads TELEGRAM_BOT_TOKEN from .env.local, so the
// token never has to be pasted into a browser or a chat.
//
//   npm run telegram:chat-ids        list chats that recently messaged the bot
//   npm run telegram:test            send a test message to TELEGRAM_ADMIN_CHAT_IDS
//   npm run telegram:webhook:set     connect the bot's buttons/commands to the site
//                                    (optional: -- https://other-address.vercel.app)
//   npm run telegram:webhook:info    show whether Telegram can reach the webhook
//   npm run telegram:webhook:delete  disconnect the webhook
//
// Before chat-ids: every admin opens the bot in Telegram and presses Start
// (for a group: add the bot, then send /start@your_bot in the group).
// Once the webhook is set, chat-ids no longer works; send /start to the bot
// instead and it replies with the chat ID.
import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const command = process.argv[2];

if (!/^\d{5,20}:[A-Za-z0-9_-]{30,64}$/.test(token)) {
  console.error("TELEGRAM_BOT_TOKEN is missing or malformed in .env.local (get it from @BotFather).");
  process.exit(1);
}

async function call(method, body) {
  let response;
  for (let attempt = 1; ; attempt++) {
    try {
      response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(15_000),
      });
      break;
    } catch (error) {
      // Only the error code is shown: the full error can mention the request
      // URL, which contains the token.
      const reason = error?.name === "TimeoutError" ? "TIMEOUT" : (error?.cause?.code ?? error?.name ?? "unknown");
      if (attempt < 3) {
        console.error(`  (${method}: network problem ${reason}, retrying…)`);
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
        continue;
      }
      return {
        ok: false,
        description: `network error (${reason}): could not reach api.telegram.org. Check your internet / VPN and try again.`,
      };
    }
  }
  const data = await response.json().catch(() => ({ ok: false, description: `HTTP ${response.status}` }));
  if (typeof data.description === "string") data.description = data.description.split(token).join("***");
  return data;
}

if (command === "chat-ids") {
  const me = await call("getMe");
  if (!me.ok) {
    console.error(`Token rejected by Telegram: ${me.description}`);
    process.exit(1);
  }
  const updates = await call("getUpdates", { allowed_updates: ["message", "my_chat_member"] });
  if (!updates.ok) {
    console.error(`getUpdates failed: ${updates.description}`);
    if (updates.error_code === 409) {
      console.error("The webhook is set, so Telegram does not keep updates for this command.");
      console.error("Send /start to the bot instead: it replies with the chat ID.");
    }
    process.exit(1);
  }
  const chats = new Map();
  for (const update of updates.result) {
    const chat = update.message?.chat ?? update.my_chat_member?.chat;
    if (!chat) continue;
    const name = chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(" ");
    chats.set(String(chat.id), `${chat.type.padEnd(10)} ${name}${chat.username ? ` (@${chat.username})` : ""}`);
  }
  console.log(`Bot: @${me.result.username}`);
  if (chats.size === 0) {
    console.log("No chats yet. Open the bot in Telegram, press Start (or send any message), then run this again.");
    console.log("Telegram keeps these updates for about 24 hours.");
  } else {
    console.log("Chats that messaged the bot recently:\n");
    for (const [id, label] of chats) console.log(`  ${id.padEnd(16)} ${label}`);
    console.log("\nPut the admins' IDs, comma-separated, into TELEGRAM_ADMIN_CHAT_IDS.");
  }
} else if (command === "test") {
  const ids = (process.env.TELEGRAM_ADMIN_CHAT_IDS || "").split(/[\s,;]+/).filter(Boolean);
  if (ids.length === 0) {
    console.error("TELEGRAM_ADMIN_CHAT_IDS is empty in .env.local. Run: npm run telegram:chat-ids");
    process.exit(1);
  }
  let failed = 0;
  for (const id of ids) {
    const result = await call("sendMessage", {
      chat_id: id,
      text: "✅ Test: yangi buyurtma xabarnomalari shu chatga keladi.",
      link_preview_options: { is_disabled: true },
    });
    if (result.ok) console.log(`  ok      ${id}`);
    else {
      failed++;
      console.log(`  FAILED  ${id}: ${result.description}`);
    }
  }
  if (failed > 0) {
    console.error("\n\"chat not found\" or \"bot was blocked\" means that person has not pressed Start in the bot (or blocked it).");
    process.exit(1);
  }
} else if (command === "set-webhook") {
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret)) {
    console.error("TELEGRAM_WEBHOOK_SECRET is missing or invalid in .env.local.");
    console.error("Create one with: openssl rand -hex 32  (and set the SAME value on Vercel).");
    process.exit(1);
  }
  const base = (process.argv[3] || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  if (!base.startsWith("https://")) {
    console.error("The site address must start with https:// (Telegram only calls https webhooks).");
    console.error("Set NEXT_PUBLIC_SITE_URL in .env.local, or pass it: npm run telegram:webhook:set -- https://your-site.com");
    process.exit(1);
  }
  const url = `${base}/api/telegram/webhook`;
  const result = await call("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  if (!result.ok) {
    console.error(`setWebhook failed: ${result.description}`);
    process.exit(1);
  }
  console.log(`Webhook set: ${url}`);
  const commands = await call("setMyCommands", {
    commands: [
      { command: "orders", description: "Oxirgi 10 ta buyurtma" },
      { command: "today", description: "Bugungi buyurtmalar va tushum" },
      { command: "order", description: "Bitta buyurtma: /order MN-XXXX-XXXX" },
      { command: "stats", description: "7 kunlik va oylik hisobot" },
      { command: "start", description: "Salomlashish va chat ID" },
    ],
  });
  console.log(commands.ok ? "Command menu set." : `setMyCommands failed (not critical): ${commands.description}`);
  console.log("Now send /start to the bot in Telegram, then run: npm run telegram:webhook:info");
} else if (command === "webhook-info") {
  const info = await call("getWebhookInfo");
  if (!info.ok) {
    console.error(`getWebhookInfo failed: ${info.description}`);
    process.exit(1);
  }
  const w = info.result;
  console.log(`URL:              ${w.url || "(none: webhook not set)"}`);
  console.log(`Pending updates:  ${w.pending_update_count}`);
  if (w.last_error_date) {
    console.log(`Last error:       ${new Date(w.last_error_date * 1000).toISOString()}  ${w.last_error_message}`);
    console.log("  401 → TELEGRAM_WEBHOOK_SECRET on Vercel differs from the one used here (redeploy after changing it).");
    console.log("  503 → a TELEGRAM_* or FIREBASE_* variable is missing on Vercel; check the function logs.");
    console.log("  404 → the URL is wrong or the latest code is not deployed.");
  } else {
    console.log("Last error:       none");
  }
} else if (command === "delete-webhook") {
  const result = await call("deleteWebhook", { drop_pending_updates: false });
  console.log(result.ok ? "Webhook removed. Buttons and commands stop working until it is set again." : `Failed: ${result.description}`);
  if (!result.ok) process.exit(1);
} else {
  console.error("Usage: npm run telegram:chat-ids | telegram:test | telegram:webhook:set | telegram:webhook:info | telegram:webhook:delete");
  process.exit(1);
}
