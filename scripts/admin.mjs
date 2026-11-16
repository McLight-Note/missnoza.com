// Manage who has admin access.
//
//   npm run admin:create -- admin@example.com   (admin with a password; asks for it)
//   npm run admin:grant -- owner@example.com
//   npm run admin:revoke -- someone@example.com
//   npm run admin:list
//
// Admin access is a Firebase "custom claim" stored by Firebase itself. It can
// only be set with the service-account key (this script, or the server's
// ADMIN_EMAILS bootstrap) — never from a browser.
import { createInterface } from "node:readline";
import { FieldValue } from "firebase-admin/firestore";
import { auth, db, target } from "./_firebase.mjs";

const [command, emailArg] = process.argv.slice(2);
const email = (emailArg || "").trim().toLowerCase();

async function log(action, uid, summary) {
  await db.collection("auditLogs").add({
    action,
    targetType: "user",
    targetId: uid,
    summary,
    actorUid: "cli",
    actorEmail: "command line",
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function findOrCreate() {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    console.log(`No account for ${email} yet — creating one. They sign in with the emailed link as usual.`);
    return auth.createUser({ email });
  }
}

/** Ask for secrets on the terminal without showing what is typed. */
function hiddenPrompt() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY === true });
  rl._writeToOutput = () => {}; // never echo keystrokes
  const lines = rl[Symbol.asyncIterator]();
  return {
    async ask(question) {
      process.stdout.write(question);
      const { value } = await lines.next();
      process.stdout.write("\n");
      return value ?? "";
    },
    close: () => rl.close(),
  };
}

console.log(`Target: ${target}`);

if (command === "list") {
  let token;
  let found = 0;
  do {
    const page = await auth.listUsers(1000, token);
    for (const user of page.users) {
      if (user.customClaims?.admin === true) {
        found += 1;
        console.log(`- ${user.email ?? user.uid}${user.emailVerified ? "" : " (email not verified yet: sign in once to activate)"}`);
      }
    }
    token = page.pageToken;
  } while (token);
  if (found === 0) console.log("No admins yet.");
} else if (command === "create" && /^\S+@\S+\.\S+$/.test(email)) {
  // An admin who signs in with email + password on the admin login page.
  // The password goes straight to Firebase; it is never written to a file.
  const prompt = hiddenPrompt();
  const password = await prompt.ask("Choose a password (at least 12 characters, typing is hidden): ");
  const again = password.length >= 12 ? await prompt.ask("Type it again: ") : "";
  prompt.close();
  if (password.length < 12) {
    console.error("Password is too short: use at least 12 characters. Nothing was changed.");
    process.exit(1);
  }
  if (again !== password) {
    console.error("The two passwords do not match. Nothing was changed.");
    process.exit(1);
  }
  let user;
  try {
    user = await auth.getUserByEmail(email);
    // Marked verified because whoever holds the service-account key vouches for it.
    user = await auth.updateUser(user.uid, { password, emailVerified: true });
    console.log(`Account for ${email} already existed: its password was replaced.`);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    user = await auth.createUser({ email, password, emailVerified: true });
  }
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true });
  // Ends any session opened with the old password.
  await auth.revokeRefreshTokens(user.uid);
  await log("admin.grant", user.uid, `Admin account with password set up for ${email} (command line)`);
  console.log(`Done. ${email} can sign in with this password on the admin login page.`);
  console.log("Run the same command again any time to change the password.");
} else if ((command === "grant" || command === "revoke") && /^\S+@\S+\.\S+$/.test(email)) {
  if (command === "grant") {
    const user = await findOrCreate();
    await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true });
    await log("admin.grant", user.uid, `Admin access granted to ${email} (command line)`);
    console.log(`Done. ${email} is an admin. If they are signed in, they must sign out and in again.`);
  } else {
    const user = await auth.getUserByEmail(email);
    const rest = { ...(user.customClaims ?? {}) };
    delete rest.admin;
    await auth.setCustomUserClaims(user.uid, rest);
    // Ends their current sessions immediately.
    await auth.revokeRefreshTokens(user.uid);
    await log("admin.revoke", user.uid, `Admin access removed from ${email} (command line)`);
    console.log(`Done. ${email} is no longer an admin and has been signed out everywhere.`);
    console.log("Also remove the address from ADMIN_EMAILS, or it will be granted again at next sign-in.");
  }
} else {
  console.log("Usage:\n  npm run admin:create -- admin@example.com\n  npm run admin:grant -- you@example.com\n  npm run admin:revoke -- you@example.com\n  npm run admin:list");
  process.exit(1);
}
process.exit(0);
