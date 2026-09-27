// Cloudflare Pages Function — smart language redirect for the site root "/".
// Reads the visitor's Accept-Language header and sends them to their
// preferred locale (/en or /ar). Falls back to English.
//
// Maps ONLY to the exact root path "/". All other paths fall through to
// the static build output.

import type { Env } from "./types";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request } = context;
  const url = new URL(request.url);

  // Only intercept the exact root. Anything else continues to static assets.
  if (url.pathname !== "/") return context.next();

  const accept = (request.headers.get("accept-language") || "").toLowerCase();

  let locale = "en";
  if (/\bar\b/.test(accept) || accept.startsWith("ar")) {
    locale = "ar";
  }

  return Response.redirect(`${url.origin}/${locale}`, 302);
};
