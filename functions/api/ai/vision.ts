// ---------------------------------------------------------------------------
// POST /api/ai/vision — Aromiso 统一视觉模型入口（Vision Router）
//
// Body: { image: string (url), prompt?: string }
// 返回: { success, data: { provider, parsed, raw } | null, error, meta }
//
// 防护：需携带 x-vision-key == env.VISION_INTERNAL_KEY（或已登录 admin）。
// 未配置任何视觉提供商 key 时返回 data:null（降级，不报错）。
// 提供商顺序与切换见 lib/vision-router.ts。
// ---------------------------------------------------------------------------
import type { AdminEnv } from "../admin/shared";
import { authenticateRequest, requirePermission } from "../../lib/admin/rbac";
import { callVision, parseVisionJson, VISION_PROMPT } from "../../lib/vision-router";

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

export async function onRequestPost(context: {
  request: Request;
  env: AdminEnv;
}): Promise<Response> {
  const { request, env } = context;
  const E = env as unknown as Record<string, string | undefined>;

  // Auth: internal key OR logged-in admin
  const hdrKey = request.headers.get("x-vision-key") || "";
  const internalOk = !!E.VISION_INTERNAL_KEY && hdrKey === E.VISION_INTERNAL_KEY;
  let adminUser: Awaited<ReturnType<typeof authenticateRequest>> = null;
  if (!internalOk) {
    adminUser = await authenticateRequest(request, env).catch(() => null);
  }
  if (!internalOk && !adminUser) return fail("UNAUTHORIZED", "Authentication required", 401);
  if (!internalOk && adminUser) {
    const permissionError = requirePermission(adminUser, "ai", "execute_ai");
    if (permissionError) return permissionError;
  }

  let body: { image?: string; prompt?: string };
  try {
    body = await request.json();
  } catch {
    return fail("BAD_REQUEST", "invalid JSON body", 400);
  }
  if (!body.image) return fail("BAD_REQUEST", "image url required", 400);

  const caller = internalOk ? "internal-key" : `user:${adminUser?.username || "unknown"}`;
  const result = await callVision(E, body.image, body.prompt || VISION_PROMPT, caller);
  if (!result) {
    return new Response(
      JSON.stringify({
        success: true,
        data: null,
        error: null,
        meta: { note: "no vision provider configured or all failed" },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: { provider: result.provider, parsed: parseVisionJson(result.text), raw: result.text },
      error: null,
      meta: null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
