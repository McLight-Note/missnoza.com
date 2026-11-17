// Security-rules tests. Run with:  npm run test:rules
// (starts the Firestore emulator, runs this file, then stops it)
//
// These prove what a browser talking to Firebase DIRECTLY can and cannot do,
// independent of the website's own server-side checks.
// The opening comment of firestore.rules explains the model.
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, deleteDoc, where } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-missnoza",
  firestore: { rules: readFileSync("firestore.rules", "utf8") },
});

let passed = 0;
let failed = 0;
async function check(name, promise) {
  try {
    await promise;
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL ${name}\n       ${error.message}`);
  }
}

// Seed data with rules bypassed (as the server would write it).
await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "products/visible"), { name: "Visible", active: true, price: 100 });
  await setDoc(doc(db, "products/hidden"), { name: "Hidden", active: false, price: 100 });
  await setDoc(doc(db, "categories/skincare"), { name: "Skincare" });
  await setDoc(doc(db, "orders/old-order"), { userId: "alice", total: 100, customer: { phone: "+998901234567" } });
  await setDoc(doc(db, "orders/guest-order"), { total: 200, customer: { phone: "+998907654321", telegram: "someone" } });
  await setDoc(doc(db, "users/alice"), { email: "alice@example.com", name: "Alice" });
  await setDoc(doc(db, "settings/store"), { ownerEmail: "owner@example.com" });
  await setDoc(doc(db, "auditLogs/one"), { summary: "x" });
  await setDoc(doc(db, "rateLimits/one"), { count: 1 });
  await setDoc(doc(db, "productImages/photo"), { contentType: "image/jpeg", size: 3 });
});

const guest = env.unauthenticatedContext();
const alice = env.authenticatedContext("alice", { email: "alice@example.com", email_verified: true });
const admin = env.authenticatedContext("owner", { email: "owner@example.com", email_verified: true, admin: true });
const unverifiedAdmin = env.authenticatedContext("fake", { email: "fake@example.com", email_verified: false, admin: true });

console.log("\nCatalogue");
await check("guest can read a visible product", assertSucceeds(getDoc(doc(guest.firestore(), "products/visible"))));
await check("guest cannot read a hidden product", assertFails(getDoc(doc(guest.firestore(), "products/hidden"))));
await check("guest can list visible products", assertSucceeds(getDocs(query(collection(guest.firestore(), "products"), where("active", "==", true)))));
await check("guest cannot list all products", assertFails(getDocs(collection(guest.firestore(), "products"))));
await check("guest can read categories", assertSucceeds(getDoc(doc(guest.firestore(), "categories/skincare"))));
await check("customer cannot change a price", assertFails(updateDoc(doc(alice.firestore(), "products/visible"), { price: 1 })));
await check("customer cannot create a product", assertFails(setDoc(doc(alice.firestore(), "products/new"), { name: "x", active: true })));
await check("customer cannot delete a product", assertFails(deleteDoc(doc(alice.firestore(), "products/visible"))));
await check("even an admin cannot write products from a browser", assertFails(updateDoc(doc(admin.firestore(), "products/visible"), { price: 1 })));
await check("admin can read a hidden product", assertSucceeds(getDoc(doc(admin.firestore(), "products/hidden"))));

console.log("\nOrders");
await check("guest cannot read an order", assertFails(getDoc(doc(guest.firestore(), "orders/guest-order"))));
await check("guest cannot list orders", assertFails(getDocs(collection(guest.firestore(), "orders"))));
await check("guest cannot create an order directly", assertFails(setDoc(doc(guest.firestore(), "orders/x"), { total: 1 })));
await check("signed-in non-admin cannot read an order", assertFails(getDoc(doc(alice.firestore(), "orders/guest-order"))));
await check("an old order's userId no longer gives access", assertFails(getDoc(doc(alice.firestore(), "orders/old-order"))));
await check("non-admin cannot list orders by userId", assertFails(getDocs(query(collection(alice.firestore(), "orders"), where("userId", "==", "alice")))));
await check("customer cannot list everyone's orders", assertFails(getDocs(collection(alice.firestore(), "orders"))));
await check("customer cannot change their order (e.g. total or status)", assertFails(updateDoc(doc(alice.firestore(), "orders/old-order"), { total: 1 })));
await check("admin can read any order", assertSucceeds(getDoc(doc(admin.firestore(), "orders/guest-order"))));
await check("admin can list orders", assertSucceeds(getDocs(collection(admin.firestore(), "orders"))));
await check("admin claim without a verified email is not admin", assertFails(getDocs(collection(unverifiedAdmin.firestore(), "orders"))));

console.log("\nOld customer profiles (no longer used)");
await check("nobody can read a profile from a browser", assertFails(getDoc(doc(alice.firestore(), "users/alice"))));
await check("nobody can write a profile from a browser", assertFails(updateDoc(doc(alice.firestore(), "users/alice"), { admin: true })));
await check("guest cannot read a profile", assertFails(getDoc(doc(guest.firestore(), "users/alice"))));

console.log("\nSettings, audit log, rate limits");
await check("guest cannot read settings (owner email)", assertFails(getDoc(doc(guest.firestore(), "settings/store"))));
await check("customer cannot read settings", assertFails(getDoc(doc(alice.firestore(), "settings/store"))));
await check("customer cannot write settings", assertFails(setDoc(doc(alice.firestore(), "settings/store"), { ordersEnabled: false })));
await check("admin can read settings", assertSucceeds(getDoc(doc(admin.firestore(), "settings/store"))));
await check("customer cannot read the audit log", assertFails(getDoc(doc(alice.firestore(), "auditLogs/one"))));
await check("admin can read the audit log", assertSucceeds(getDoc(doc(admin.firestore(), "auditLogs/one"))));
await check("nobody can write the audit log from a browser", assertFails(setDoc(doc(admin.firestore(), "auditLogs/two"), { summary: "x" })));
await check("rate-limit records are private even from admins", assertFails(getDoc(doc(admin.firestore(), "rateLimits/one"))));
await check("unknown collections are denied", assertFails(setDoc(doc(alice.firestore(), "anything/else"), { a: 1 })));

console.log("\nProduct photos (served by the website, not read directly)");
await check("guest cannot read photo records directly", assertFails(getDoc(doc(guest.firestore(), "productImages/photo"))));
await check("customer cannot upload a photo record", assertFails(setDoc(doc(alice.firestore(), "productImages/x"), { contentType: "image/jpeg" })));
await check("customer cannot overwrite a photo", assertFails(updateDoc(doc(alice.firestore(), "productImages/photo"), { contentType: "text/html" })));
await check("even an admin cannot write photos from a browser", assertFails(setDoc(doc(admin.firestore(), "productImages/y"), { contentType: "image/jpeg" })));
await check("nobody can delete a photo from a browser", assertFails(deleteDoc(doc(admin.firestore(), "productImages/photo"))));

await env.cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
