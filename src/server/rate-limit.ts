import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/server/firebase-admin";

/**
 * Fixed-window rate limiter backed by Firestore, so limits hold across
 * serverless instances. Keys are hashed: raw IPs and emails are not stored.
 * Expired records are swept out now and then by `sweepExpired` below, so no
 * paid Firestore feature (TTL policy) is needed.
 */

function hash(value: string) {
  const salt = process.env.RATE_LIMIT_SALT || process.env.FIREBASE_PROJECT_ID || "missnoza";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 40);
}

export async function clientIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export async function rateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const db = adminDb();
  const ref = db.collection("rateLimits").doc(`${scope}_${hash(`${scope}:${identifier}`)}`);
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as { count: number; windowStart: number } | undefined;
    if (!data || now - data.windowStart >= windowMs) {
      tx.set(ref, {
        count: 1,
        windowStart: now,
        expiresAt: Timestamp.fromMillis(now + windowMs + 60_000),
      });
      return { ok: true } as const;
    }
    if (data.count >= limit) {
      return { ok: false, retryAfterSeconds: Math.ceil((data.windowStart + windowMs - now) / 1000) } as const;
    }
    tx.update(ref, { count: data.count + 1 });
    return { ok: true } as const;
  });
}

/** Delete a batch of expired rate-limit records. Cheap, and safe to fail. */
export async function sweepExpired() {
  try {
    const db = adminDb();
    const snap = await db.collection("rateLimits").where("expiresAt", "<", Timestamp.now()).limit(100).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } catch (error) {
    console.error("[rate-limit] sweep failed", error);
  }
}

export function retryMessage(seconds: number) {
  if (seconds < 90) return `Urinishlar juda koʻp. ${seconds} soniyadan keyin qayta urinib koʻring.`;
  return `Urinishlar juda koʻp. Taxminan ${Math.ceil(seconds / 60)} daqiqadan keyin qayta urinib koʻring.`;
}
