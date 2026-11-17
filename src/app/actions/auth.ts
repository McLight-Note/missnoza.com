"use server";

import { FieldValue } from "firebase-admin/firestore";
import { siteConfig } from "@/config/site";
import { emailSchema } from "@/lib/validation";
import { SESSION_MAX_AGE_MS, clearSessionCookie, getSession, setSessionCookie } from "@/server/auth";
import { adminAuth, adminDb, isAdminConfigured } from "@/server/firebase-admin";
import { clientIp, rateLimit, retryMessage } from "@/server/rate-limit";
import type { ActionResult } from "@/lib/types";

const NOT_CONFIGURED = "Kirish hozircha ishlamaydi: Firebase sozlanmagan.";

const BAD_LOGIN = "Email yoki parol notoʻgʻri.";

/** Ask Firebase to check an email + password. Returns an ID token, or null. */
async function verifyPassword(email: string, password: string): Promise<string | null> {
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const origin = emulator ? `http://${emulator}/identitytoolkit.googleapis.com` : "https://identitytoolkit.googleapis.com";
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
  const response = await fetch(`${origin}/v1/accounts:signInWithPassword?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: siteConfig.url },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    const reason = body?.error?.message ?? `HTTP ${response.status}`;
    // Wrong email/password is normal; anything else points at configuration.
    if (!/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND|USER_DISABLED|TOO_MANY_ATTEMPTS/.test(reason)) {
      console.error(`[auth] password check failed: ${reason}`);
    }
    return null;
  }
  const data = (await response.json()) as { idToken?: string };
  return typeof data.idToken === "string" ? data.idToken : null;
}

/**
 * Admin sign-in with email and password (the admin login page).
 *
 * The password is checked by Firebase, on the server, behind rate limits.
 * A correct password is not enough: the account must also carry the admin
 * custom claim (set with `npm run admin:create`). Every failure returns the
 * same message, so the form does not reveal which accounts exist.
 */
export async function adminPasswordSignIn(emailInput: string, passwordInput: string): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(emailInput);
  if (!parsed.success || typeof passwordInput !== "string" || passwordInput.length < 1 || passwordInput.length > 200) {
    return { ok: false, error: BAD_LOGIN };
  }
  if (!isAdminConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const email = parsed.data;

  try {
    const checks = [
      await rateLimit("admin-login-ip", await clientIp(), 10, 15 * 60),
      await rateLimit("admin-login-email", email, 6, 15 * 60),
    ];
    const blocked = checks.find((c) => !c.ok);
    if (blocked && !blocked.ok) {
      return { ok: false, code: "RATE_LIMITED", error: retryMessage(blocked.retryAfterSeconds) };
    }

    const idToken = await verifyPassword(email, passwordInput);
    if (!idToken) return { ok: false, error: BAD_LOGIN };

    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(idToken, true);
    if (decoded.admin !== true || decoded.email_verified !== true) return { ok: false, error: BAD_LOGIN };

    const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
    await setSessionCookie(cookie);
    const db = adminDb();
    await db.collection("users").doc(decoded.uid).set({ email, lastSignInAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("auditLogs").add({
      action: "admin.signin",
      targetType: "user",
      targetId: decoded.uid,
      summary: `${email} admin panelga parol bilan kirdi`,
      actorUid: decoded.uid,
      actorEmail: email,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, data: null };
  } catch (error) {
    console.error("[auth] adminPasswordSignIn failed", error);
    return { ok: false, error: "Tizimga kirib boʻlmadi. Birozdan keyin qayta urinib koʻring." };
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
