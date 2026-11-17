import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { adminHref } from "@/lib/admin-path";
import { adminAuth, isAdminConfigured } from "@/server/firebase-admin";

export const SESSION_COOKIE = "__session";
// Admin sessions last 14 days, the longest Firebase allows.
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  /** True only when Firebase holds a verified `admin` custom claim. */
  isAdmin: boolean;
};

/**
 * Read and verify the signed session cookie. The cookie is httpOnly and is
 * verified with Firebase on every call (including revocation), so nothing a
 * visitor edits in the browser can make them someone else, or an admin.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  // Sessions are checked per request only: never while prerendering or
  // prefetching a page.
  await connection();
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value || !isAdminConfigured()) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(value, true);
    const emailVerified = decoded.email_verified === true;
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      emailVerified,
      isAdmin: decoded.admin === true && emailVerified,
    };
  } catch {
    return null;
  }
});

export class AuthError extends Error {
  constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(code);
  }
}

/** For server actions / data functions: throws unless the caller is an admin. */
export async function assertAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError("UNAUTHENTICATED");
  if (!session.isAdmin) throw new AuthError("FORBIDDEN");
  return session;
}

/** For admin pages: redirects instead of throwing. */
export async function requireAdminPage(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect(adminHref("/login"));
  if (!session.isAdmin) redirect("/not-authorized");
  return session;
}

export async function setSessionCookie(value: string) {
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
