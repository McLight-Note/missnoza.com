import { NextResponse, type NextRequest } from "next/server";
import { adminBasePath } from "@/lib/admin-path";

/**
 * Serves the admin area from the hidden address in ADMIN_PATH and makes the
 * well-known /admin address answer "not found". When ADMIN_PATH is not set
 * this does nothing. Authorization is NOT done here: the admin pages and
 * actions verify the session themselves.
 */
export function proxy(request: NextRequest) {
  const base = adminBasePath();
  if (base === "/admin") return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    // No page exists here, so the normal 404 page is shown.
    return NextResponse.rewrite(new URL("/__not-found__", request.url));
  }
  if (pathname === base || pathname.startsWith(`${base}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = `/admin${pathname.slice(base.length)}`;
    const response = NextResponse.rewrite(url);
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  return NextResponse.next();
}

export const config = {
  // Skip build assets, product photos and files in /public.
  matcher: ["/((?!_next/static|_next/image|img/|brand/|placeholders/|icon.svg|robots.txt|sitemap.xml).*)"],
};
