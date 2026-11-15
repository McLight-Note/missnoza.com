"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";

/**
 * Firebase in the browser is used for one thing only: completing the
 * email-link sign-in. These NEXT_PUBLIC_ values are the public web-app
 * config (safe to expose); all privileged access happens on the server.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseClientConfigured = Boolean(config.apiKey && config.projectId);

let authPromise: Promise<Auth> | null = null;

export function getClientAuth(): Promise<Auth> {
  if (!isFirebaseClientConfigured) return Promise.reject(new Error("Firebase is not configured."));
  if (!authPromise) {
    authPromise = (async () => {
      const app = getApps().length ? getApp() : initializeApp(config);
      const auth = getAuth(app);
      const emulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
      if (emulator) connectAuthEmulator(auth, `http://${emulator}`, { disableWarnings: true });
      // The long-lived session lives in an httpOnly cookie set by the server,
      // so the Firebase SDK keeps nothing in browser storage.
      await setPersistence(auth, inMemoryPersistence);
      return auth;
    })();
  }
  return authPromise;
}
