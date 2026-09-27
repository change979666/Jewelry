// ---------------------------------------------------------------------------
//  Astro middleware
//
//  Replaces the retired `functions/_middleware.ts`. Two responsibilities, both
//  preserved verbatim from the Pages version:
//
//   1. /api/**  — lightweight request telemetry (structured logs only, no D1
//                 writes). Admin/automation traffic sampled at 100%, public
//                 API traffic at 10%.
//   2. /admin-v2/** — server-side auth gate for the admin HTML surface. An
//                 unauthenticated browser request is 302'd to the login page
//                 BEFORE any admin DOM is rendered, so the admin UI is never
//                 leaked to anonymous visitors. API routes authenticate in
//                 their own handlers.
//   3. every response — force an explicit `charset=utf-8` on HTML documents.
//
//  NOTE: this file only runs because the API now lives under src/pages/api/**.
//  While the handlers were Pages Functions, Cloudflare never executed them (see
//  docs/01-项目说明.md), so this gate was inert as well.
// ---------------------------------------------------------------------------

import { defineMiddleware } from "astro:middleware";
import type { APIContext } from "astro";
import type { Env } from "@/lib/env";
import { authenticateRequest } from "@/lib/admin/rbac";

/**
 * Ensure HTML responses declare their character set.
 *
 * WHY THIS IS HERE AND NOT IN EACH PAGE
 * Astro's SSR runtime emits `Content-Type: text/html` with no charset. Correct
 * decoding then depends entirely on a `<meta charset>` in the document. The
 * storefront is fine (BaseLayout declares it), but the admin sub-pages
 * (commerce/orders, commerce/products, media, customers/*, system/*, ...)
 * render no `<!doctype>/<html>/<head>` skeleton at all — they start straight at
 * <AdminShell> — so they ship with NO charset signal anywhere.
 *
 * The browser then falls back to the platform default, which on a zh-CN Windows
 * box is GBK: every Chinese label in the admin became mojibake
 * ("电商管理后台" -> "鐢靛晢绠＄悊鍚庡彴"). On a Western machine it degrades to
 * windows-1252 instead. Fixing it per page would mean editing ~15 files and
 * would regress the moment someone adds a page; declaring it once at the
 * transport layer fixes the whole class.
 */
async function ensureHtmlCharset(response: Response): Promise<Response> {
  const contentType = response.headers.get("Content-Type");
  if (!contentType || !/^text\/html\b/i.test(contentType)) return response;
  if (/charset=/i.test(contentType)) return response;

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Static asset extensions: even if such a file ever ends up under /admin-v2/,
// it must not be blocked by the auth gate.
const STATIC_ASSET_RE =
  /\.(css|js|mjs|map|json|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|pdf)$/i;

export const onRequest = defineMiddleware(async (context, next) => {
  return ensureHtmlCharset(await handleRequest(context, next));
});

async function handleRequest(
  context: APIContext,
  next: () => Promise<Response>,
): Promise<Response> {
  const { request, locals } = context;
  const env = locals.runtime.env as unknown as Env;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // ---- 1. API request telemetry -------------------------------------------
  if (pathname.startsWith("/api/")) {
    const startedAt = Date.now();
    const source = pathname.startsWith("/api/admin/v2/ai/automation")
      ? "automation"
      : pathname.startsWith("/api/admin/v2/")
        ? "admin"
        : pathname.startsWith("/api/admin/cron") || pathname.startsWith("/api/admin/os-")
          ? "cron"
          : pathname.startsWith("/api/commerce")
            ? "commerce"
            : pathname.startsWith("/api/knowledge")
              ? "knowledge"
              : pathname.startsWith("/api/content")
                ? "content"
                : pathname.startsWith("/api/sitemap")
                  ? "seo"
                  : "api";
    const sampled = source !== "api" || Math.random() < 0.1;
    const response = await next();
    if (sampled) {
      console.log(
        JSON.stringify({
          event: "request_metric",
          source,
          module: pathname.split("/").slice(3, 5).join("/") || "root",
          operation: request.method,
          path: pathname,
          status: response.status,
          success: response.status < 400,
          duration_ms: Date.now() - startedAt,
          d1_read_count: "not_available_from_runtime",
        }),
      );
    }
    return response;
  }

  // ---- 2. Admin V2 page protection ----------------------------------------
  if (pathname !== "/admin-v2" && !pathname.startsWith("/admin-v2/")) {
    return next();
  }

  // Allow the login page itself.
  if (pathname === "/admin-v2/login" || pathname.startsWith("/admin-v2/login/")) {
    return next();
  }

  // API routes handle their own auth.
  if (pathname.startsWith("/api/")) {
    return next();
  }

  // Static assets never require auth.
  if (STATIC_ASSET_RE.test(pathname)) {
    return next();
  }

  let user: Awaited<ReturnType<typeof authenticateRequest>>;
  try {
    user = await authenticateRequest(request, env);
  } catch (err) {
    // Auth dependency failure is fail-closed: a session/KV outage must not
    // become a window in which the admin HTML is served to anyone.
    console.error("[middleware] authenticateRequest failed, fail-closed:", err);
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: { code: "AUTH_UNAVAILABLE", message: "Authentication temporarily unavailable" },
        meta: null,
      }),
      { status: 503, headers: { "Content-Type": "application/json", "Retry-After": "30" } },
    );
  }

  if (!user) {
    const accept = request.headers.get("Accept") || "";
    if (accept.includes("application/json")) {
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: "UNAUTHORIZED", message: "Login required" },
          meta: null,
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Browser request: 302 to the login page; the body contains no admin HTML.
    return Response.redirect(`${url.origin}/admin-v2/login`, 302);
  }

  return next();
}
