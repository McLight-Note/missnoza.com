import { connection } from "next/server";
import { adminDb, isAdminConfigured } from "@/server/firebase-admin";

/**
 * Serves a product photo stored in Firestore (collection `productImages`).
 *
 * Photos never change once uploaded (a new upload gets a new address), so
 * the response is cached for a year by browsers and by the hosting CDN.
 * After the first view, a photo is served from cache without touching the
 * database, which keeps usage inside Firebase's free allowance.
 */
export async function GET(_request: Request, { params }: RouteContext<"/img/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id) || !isAdminConfigured()) return new Response("Not found", { status: 404 });

  const snap = await adminDb().collection("productImages").doc(id).get();
  const data = snap.get("data") as Uint8Array | undefined;
  const contentType = snap.get("contentType") as string | undefined;
  // Only ever answer with the image types the uploader accepts.
  if (!snap.exists || !data || !contentType || !/^image\/(jpeg|png|webp)$/.test(contentType)) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "Content-Disposition": "inline",
    },
  });
}
