/**
 * Where the admin area lives. By default it is /admin; set ADMIN_PATH (a
 * server-only environment variable) to move it to an address that is hard to
 * guess, e.g. ADMIN_PATH=boshqaruv-7k2m9x4q. The hidden address is an extra
 * layer only: every admin page and action still verifies the admin session.
 *
 * Server-side only. Browser components get the value through AdminShell's
 * context (useAdminHref) so it never has to be a NEXT_PUBLIC_ variable.
 */

/** Top-level addresses the shop already uses; ADMIN_PATH may not shadow them. */
const RESERVED = new Set([
  "admin", "account", "auth", "cart", "checkout", "contact", "img", "order",
  "privacy", "products", "sign-in", "not-authorized", "api", "brand", "placeholders",
]);

let warned = false;

export function adminBasePath(): string {
  const raw = (process.env.ADMIN_PATH || "").trim().replace(/^\/+|\/+$/g, "").toLowerCase();
  if (!raw) return "/admin";
  if (!/^[a-z0-9][a-z0-9-]{7,63}$/.test(raw) || RESERVED.has(raw)) {
    if (!warned) {
      warned = true;
      console.warn("[admin] ADMIN_PATH is ignored: use 8-64 lowercase letters, digits or hyphens. Falling back to /admin.");
    }
    return "/admin";
  }
  return `/${raw}`;
}

/** Build a link inside the admin area: adminHref("/orders") → "/<base>/orders". */
export function adminHref(sub = ""): string {
  return `${adminBasePath()}${sub}`;
}
