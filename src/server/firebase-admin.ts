import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin SDK (server only). The service-account key never reaches
 * the browser: this module is guarded by `server-only` and reads env vars
 * that are not prefixed with NEXT_PUBLIC_.
 */

export function usingEmulators() {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

function projectId() {
  return process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
}

/** True when the server has what it needs to talk to Firebase. */
export function isAdminConfigured() {
  if (!projectId()) return false;
  if (usingEmulators()) return true;
  return Boolean(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

const globalCache = globalThis as unknown as { __mnDb?: Firestore };

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  if (usingEmulators()) {
    // The emulators accept unsigned tokens, so they must never be reachable
    // from a production deployment.
    if (process.env.VERCEL_ENV === "production") {
      throw new Error("Firebase emulator variables are set in production. Remove them from Vercel.");
    }
    return initializeApp({ projectId: projectId() });
  }

  if (!isAdminConfigured()) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.",
    );
  }
  return initializeApp({
    credential: cert({
      projectId: projectId(),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel stores multi-line values with literal "\n" sequences.
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

export function adminDb(): Firestore {
  if (!globalCache.__mnDb) {
    const db = getFirestore(app());
    db.settings({ ignoreUndefinedProperties: true });
    globalCache.__mnDb = db;
  }
  return globalCache.__mnDb;
}

export function adminAuth() {
  return getAuth(app());
}

/** Convert Firestore Timestamp | number | undefined into epoch milliseconds. */
export function toMillis(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}
