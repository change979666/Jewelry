// Cloudflare Pages Functions — Global middleware
// Protects /admin-v2/* routes server-side. Unauthenticated requests to admin pages
// are redirected to /admin-v2/login BEFORE the static HTML is served, so the admin
// DOM / API surface is never leaked to anonymous visitors.
// API routes under /api/* skip this middleware and enforce auth in their own handlers.

import type { AdminEnv } from "./api/admin/shared";
import { authenticateRequest } from "./lib/admin/rbac";

// 静态资源扩展名：即使将来被放在 /admin-v2/ 下，也不应被鉴权拦截
const STATIC_ASSET_RE =
  /\.(css|js|mjs|map|json|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|pdf)$/i;

export async function onRequest(context: {
  request: Request;
  env: AdminEnv;
  next: () => Promise<Response>;
}) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Lightweight request telemetry: structured logs only, no D1 writes.
  // Admin/automation traffic is sampled at 100%; public API traffic at 10%.
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

  // Only protect Admin V2 routes
  if (pathname !== "/admin-v2" && !pathname.startsWith("/admin-v2/")) {
    return next();
  }

  // Allow login page
  if (pathname === "/admin-v2/login" || pathname.startsWith("/admin-v2/login/")) {
    return next();
  }

  // API routes handle their own auth
  if (pathname.startsWith("/api/")) {
    return next();
  }

  // Static assets never require auth
  if (STATIC_ASSET_RE.test(pathname)) {
    return next();
  }

  let user: Awaited<ReturnType<typeof authenticateRequest>>;
  try {
    user = await authenticateRequest(request, env);
  } catch (err) {
    // 鉴权依赖异常时 fail-closed：不能把 session/KV 故障变成后台 HTML 泄露窗口。
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

    // 浏览器请求直接 302 到登录页，响应体不含任何后台 HTML
    return Response.redirect(`${url.origin}/admin-v2/login`, 302);
  }

  return next();
}
