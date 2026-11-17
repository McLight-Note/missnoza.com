import { createHash, timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { isAdminConfigured } from "@/server/firebase-admin";
import { sweepTelegramAlerts } from "@/server/telegram";

/**
 * Recovery sweep for Telegram order notifications, called by Vercel Cron
 * (see vercel.json). Vercel sends `Authorization: Bearer <CRON_SECRET>`;
 * any other caller gets 401 and nothing is sent. The sweep only retries
 * notifications already queued on orders, so the request carries no input.
 */

export const maxDuration = 60;

function authorized(header: string | null, secret: string) {
  // Hash both sides so the comparison is constant-time whatever the length.
  const given = createHash("sha256").update(header ?? "").digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(given, expected);
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) {
    console.error("[telegram-cron] CRON_SECRET is missing or shorter than 16 characters; refusing to run.");
    return json({ ok: false, error: "Not configured" }, 500);
  }
  if (!authorized(request.headers.get("authorization"), secret)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }
  if (!isAdminConfigured()) {
    console.error("[telegram-cron] Firebase Admin is not configured.");
    return json({ ok: false, error: "Not configured" }, 503);
  }

  try {
    const result = await sweepTelegramAlerts();
    console.info("[telegram-cron] sweep finished", result);
    return json({ ok: true, ...result });
  } catch (error) {
    console.error("[telegram-cron] sweep failed", error);
    return json({ ok: false, error: "Sweep failed" }, 500);
  }
}
