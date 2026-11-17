// Telegram setup helpers. Reads TELEGRAM_BOT_TOKEN from .env.local, so the
// token never has to be pasted into a browser or a chat.
//
//   npm run telegram:chat-ids   list chats that recently messaged the bot
//   npm run telegram:test       send a test message to TELEGRAM_ADMIN_CHAT_IDS
//
// Before chat-ids: every admin opens the bot in Telegram and presses Start
// (for a group: add the bot, then send /start@your_bot in the group).
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
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // The error object can mention the request URL, which contains the token.
    return { ok: false, description: "network error: could not reach api.telegram.org" };
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
    if (updates.error_code === 409) console.error("A webhook is set for this bot. This feature does not need one; remove it with deleteWebhook.");
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
} else {
  console.error("Usage: npm run telegram:chat-ids | npm run telegram:test");
  process.exit(1);
}
