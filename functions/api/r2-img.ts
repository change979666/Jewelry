// ---------------------------------------------------------------------------
//  R2 image proxy — serve product images from R2 bucket
//  GET /api/r2-img?key=products/907855710068/xxx.jpg
// ---------------------------------------------------------------------------

import type { Env } from "../types";

// Public-object boundary (S-03). Per the owner's full-bucket inventory the R2
// IMAGES bucket only holds three genuinely public top-level prefixes; every
// other prefix (staging/, test/, audit/, email/, internal/, knowledge/, ...) is
// non-public and must never be readable through this anonymous proxy.
// NOTE: the live front-end serves product images from the public bucket domain
// (images on the image CDN domain), NOT from this endpoint, so restricting the proxy does
// not affect front-end image loading.
const PUBLIC_KEY_PREFIXES = ["commerce/", "products/", "catalogs/"] as const;

/** True only when `key` is a well-formed path under an allowed public prefix. */
function isPublicKey(rawKey: string): boolean {
  const key = rawKey.replace(/^\/+/, "");
  if (!key) return false;
  // Reject any path traversal / encoded traversal attempt.
  if (key.split("/").some((seg) => seg === ".." || seg === ".")) return false;
  return PUBLIC_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!key || !env.IMAGES) {
    return new Response("Not found", { status: 404 });
  }

  // Boundary gate: non-public prefixes are refused before any bucket read.
  if (!isPublicKey(key)) {
    return new Response("Forbidden", { status: 403 });
  }

  const object = await env.IMAGES.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
};
