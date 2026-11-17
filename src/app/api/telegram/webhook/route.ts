import { createHash, timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { isAdminConfigured } from "@/server/firebase-admin";
import { telegramConfig, telegramWebhookSecret } from "@/server/telegram";
import { handleUpdate, type TgUpdate } from "@/server/telegram-bot";

/**
 * Telegram webhook for the admin bot: commands (/orders, /today, …) and the
 * status buttons under order messages. Register it once with
 * `npm run telegram:webhook:set` (see README, section 5b).
 *
 * Telegram sends TELEGRAM_WEBHOOK_SECRET back in the
 * X-Telegram-Bot-Api-Secret-Token header; any request without it gets 401
 * and is not looked at. Valid updates are always answered 200 (even when
 * handling failed, which is logged), because Telegram would otherwise
 * re-send the same update again and again.
 */

export const maxDuration = 30;

/** Real updates are a few KB; anything far larger is not from Telegram. */
const MAX_BODY_BYTES = 64 * 1024;

function secretMatches(header: string | null, secret: string) {
  // Hash both sides so the comparison is constant-time whatever the length.
  const given = createHash("sha256").update(header ?? "").digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(given, expected);
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  await connection();

  const webhook = telegramWebhookSecret();
  if (!webhook.ok) {
    console.error(`[telegram-webhook] ${webhook.error} Refusing all requests.`);
    return json({ ok: false, error: "Not configured" }, 503);
  }
  if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), webhook.secret)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const config = telegramConfig();
  if (!config.ok || !isAdminConfigured()) {
    // 503 makes Telegram retry later, and shows up in getWebhookInfo.
    console.error("[telegram-webhook] not configured:", config.ok ? "Firebase Admin is not configured." : config.error);
    return json({ ok: false, error: "Not configured" }, 503);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ ok: true, ignored: "too large" });
  let update: TgUpdate;
  try {
    update = JSON.parse(raw) as TgUpdate;
  } catch {
    return json({ ok: true, ignored: "invalid JSON" });
  }
  if (!update || typeof update !== "object") return json({ ok: true, ignored: "not an update" });

  try {
    await handleUpdate(update, config);
  } catch (error) {
    console.error("[telegram-webhook] update failed", { updateId: update.update_id, error });
  }
  return json({ ok: true });
}
