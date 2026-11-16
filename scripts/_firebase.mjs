// Shared setup for the command-line scripts in this folder.
// Reads the same variables as the app from .env.local (never commit that file).
import { existsSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);

if (!projectId) {
  console.error("FIREBASE_PROJECT_ID is not set. Create .env.local from .env.example first.");
  process.exit(1);
}
if (!emulator && !(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)) {
  console.error("FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY are not set in .env.local.");
  process.exit(1);
}

// Same forgiving parsing as src/server/firebase-admin.ts.
function normalizePrivateKey(raw) {
  let key = raw.trim().replace(/,$/, "").trim();
  const quote = key[0];
  if ((quote === '"' || quote === "'") && key.endsWith(quote)) key = key.slice(1, -1);
  key = key.replace(/\\n/g, "\n").trim();
  if (!key.includes("-----BEGIN")) key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
  return `${key}\n`;
}

const app = initializeApp(
  emulator
    ? { projectId }
    : {
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
        }),
      },
);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const target = emulator ? `EMULATOR (${projectId})` : `LIVE project ${projectId}`;
