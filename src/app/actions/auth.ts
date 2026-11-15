"use server";

import { FieldValue } from "firebase-admin/firestore";
import { siteConfig } from "@/config/site";
import { safeNextPath } from "@/lib/utils";
import { emailSchema } from "@/lib/validation";
import {
  SESSION_MAX_AGE_MS,
  bootstrapAdminEmails,
  clearSessionCookie,
  getSession,
  setSessionCookie,
} from "@/server/auth";
import { isEmailConfigured, sendEmail, signInEmail } from "@/server/email";
import { adminAuth, adminDb, isAdminConfigured } from "@/server/firebase-admin";
import { clientIp, rateLimit, retryMessage } from "@/server/rate-limit";
import type { ActionResult } from "@/lib/types";

const NOT_CONFIGURED = "Kirish hozircha ishlamaydi. Doʻkon egasi Firebase xizmatini ulashi kerak.";

/**
 * Step 1 of sign-in: email the customer a one-time sign-in link.
 *
 * Returns `delivery: "server"` when this server sent the email through the
 * configured provider, or `delivery: "client"` when no provider is set up
 * and the browser should ask Firebase to send its built-in email instead.
 * Either way the request passes the same rate limits first.
 */
export async function requestSignInLink(
  emailInput: string,
  nextInput: string,
): Promise<ActionResult<{ delivery: "server" | "client"; cooldownSeconds: number }>> {
  const parsed = emailSchema.safeParse(emailInput);
  if (!parsed.success) return { ok: false, error: "Toʻgʻri email manzil kiriting.", fieldErrors: { email: "Toʻgʻri email manzil kiriting." } };
  if (!isAdminConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const email = parsed.data;
  const cooldownSeconds = 60;

  try {
    const ip = await clientIp();
    const checks = [
      await rateLimit("signin-ip", ip, 8, 15 * 60),
      await rateLimit("signin-cooldown", email, 1, cooldownSeconds),
      await rateLimit("signin-email", email, 5, 60 * 60),
    ];
    const blocked = checks.find((c) => !c.ok);
    if (blocked && !blocked.ok) {
      return { ok: false, code: "RATE_LIMITED", error: retryMessage(blocked.retryAfterSeconds) };
    }

    if (!isEmailConfigured()) return { ok: true, data: { delivery: "client", cooldownSeconds } };

    const next = safeNextPath(nextInput);
    const link = await adminAuth().generateSignInWithEmailLink(email, {
      url: `${siteConfig.url}/auth/verify?next=${encodeURIComponent(next)}`,
      handleCodeInApp: true,
    });
    const sent = await sendEmail(signInEmail(email, link));
    if (!sent.ok) {
      console.error(`[auth] sign-in email failed: ${sent.error}`);
      return { ok: false, error: "Xatni hozir yuborib boʻlmadi. Bir daqiqadan keyin qayta urinib koʻring." };
    }
    return { ok: true, data: { delivery: "server", cooldownSeconds } };
  } catch (error) {
    console.error("[auth] requestSignInLink failed", error);
    const detail = error instanceof Error ? `${(error as { code?: string }).code ?? ""} ${error.message}` : "";
    if (/quota/i.test(detail)) {
      return {
        ok: false,
        code: "QUOTA",
        error: "Bugungi kirish xatlari limiti tugadi. Roʻyxatdan oʻtmasdan ham buyurtma berishingiz mumkin yoki ertaga qayta urinib koʻring.",
      };
    }
    return { ok: false, error: "Xatni hozir yuborib boʻlmadi. Bir daqiqadan keyin qayta urinib koʻring." };
  }
}

/**
 * Step 2 of sign-in: exchange a fresh Firebase ID token (obtained by opening
 * the emailed link) for an httpOnly session cookie.
 *
 * Admin rights come only from a Firebase custom claim. The claim is granted
 * here, on the server, when a *verified* email matches the ADMIN_EMAILS
 * environment variable — never from anything the browser claims about itself.
 */
export async function createSession(
  idToken: string,
): Promise<ActionResult<{ refreshToken: boolean; isAdmin: boolean }>> {
  if (typeof idToken !== "string" || idToken.length < 20 || idToken.length > 5000) {
    return { ok: false, error: "Kirish soʻrovi notoʻgʻri." };
  }
  if (!isAdminConfigured()) return { ok: false, error: NOT_CONFIGURED };

  try {
    const limited = await rateLimit("session-ip", await clientIp(), 20, 10 * 60);
    if (!limited.ok) return { ok: false, code: "RATE_LIMITED", error: retryMessage(limited.retryAfterSeconds) };

    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(idToken, true);
    // Only accept tokens from a sign-in that just happened.
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
      return { ok: false, error: "Bu kirish havolasining muddati tugagan. Yangisini soʻrang." };
    }

    const email = decoded.email?.toLowerCase() ?? null;
    const verified = decoded.email_verified === true;
    const shouldBeAdmin = verified && email !== null && bootstrapAdminEmails().includes(email);

    if (shouldBeAdmin && decoded.admin !== true) {
      const user = await auth.getUser(decoded.uid);
      await auth.setCustomUserClaims(decoded.uid, { ...(user.customClaims ?? {}), admin: true });
      await adminDb().collection("auditLogs").add({
        action: "admin.grant",
        targetType: "user",
        targetId: decoded.uid,
        summary: `${email} ga admin huquqi berildi (ADMIN_EMAILS roʻyxatida)`,
        actorUid: decoded.uid,
        actorEmail: email,
        createdAt: FieldValue.serverTimestamp(),
      });
      // The browser must fetch a new ID token that carries the claim.
      return { ok: true, data: { refreshToken: true, isAdmin: true } };
    }

    const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
    await setSessionCookie(cookie);
    await adminDb()
      .collection("users")
      .doc(decoded.uid)
      .set({ email, lastSignInAt: FieldValue.serverTimestamp() }, { merge: true });

    return { ok: true, data: { refreshToken: false, isAdmin: decoded.admin === true && verified } };
  } catch (error) {
    console.error("[auth] createSession failed", error);
    return { ok: false, error: "Tizimga kirib boʻlmadi. Yangi havola soʻrab, qayta urinib koʻring." };
  }
}

/** Sign out on every device: clears the cookie and revokes existing sessions. */
export async function signOutAction(): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (session) await adminAuth().revokeRefreshTokens(session.uid);
  } catch (error) {
    console.error("[auth] revoke on sign-out failed", error);
  }
  await clearSessionCookie();
  return { ok: true, data: null };
}
