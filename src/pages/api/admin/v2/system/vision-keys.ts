// GET  /api/admin/v2/system/vision-keys        — list vision providers (masked; ?full=1 for full)
// POST /api/admin/v2/system/vision-keys        — upsert { provider, api_key, base_url, model, enabled }
import { authenticateRequest, requirePermission } from "@/lib/admin/rbac";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

const mask = (k: string) => (k && k.length > 11 ? k.slice(0, 7) + "…" + k.slice(-4) : "****");

interface VisionKeyRow {
  provider: string;
  api_key: string;
  base_url: string | null;
  model: string | null;
  enabled: number;
  updated_at: string;
}

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function handlerGet(context: PagesCtx): Promise<Response> {
  const { request, env } = context;
  const user = await authenticateRequest(request, env).catch(() => null);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);
  const permissionError = requirePermission(user, "system", "view");
  if (permissionError) return permissionError;
  if (!env.DB) return fail("INTERNAL_ERROR", "DB unavailable", 500);
  const rows = (
    await env.DB.prepare(
      `SELECT provider, api_key, base_url, model, enabled, updated_at FROM vision_keys ORDER BY provider`,
    )
      .all<VisionKeyRow>()
      .catch(() => ({ results: [] as VisionKeyRow[] }))
  ).results;
  const data = rows.map((r) => ({
    provider: r.provider,
    api_key: mask(r.api_key),
    base_url: r.base_url,
    model: r.model,
    enabled: r.enabled,
    updated_at: r.updated_at,
  }));
  return new Response(JSON.stringify({ success: true, data, error: null, meta: null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function handlerPost(context: PagesCtx): Promise<Response> {
  const { request, env } = context;
  const user = await authenticateRequest(request, env).catch(() => null);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);
  const permissionError = requirePermission(user, "system", "manage_settings");
  if (permissionError) return permissionError;
  if (!env.DB) return fail("INTERNAL_ERROR", "DB unavailable", 500);
  let b: {
    provider?: string;
    api_key?: string;
    base_url?: string;
    model?: string;
    enabled?: unknown;
  };
  try {
    b = await request.json();
  } catch {
    return fail("BAD_REQUEST", "invalid JSON", 400);
  }
  if (!b.provider) return fail("BAD_REQUEST", "provider required", 400);
  if (!b.api_key && (b.enabled === 0 || b.enabled === 1)) {
    const result = await env.DB.prepare(
      `UPDATE vision_keys SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE provider = ?`,
    )
      .bind(b.enabled, b.provider)
      .run();
    if (!result.meta?.changes) return fail("NOT_FOUND", "vision provider not found", 404);
    return new Response(JSON.stringify({ success: true, data: null, error: null, meta: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!b.api_key) return fail("BAD_REQUEST", "api_key required when saving a provider", 400);
  await env.DB.prepare(
    `INSERT INTO vision_keys (provider, api_key, base_url, model, enabled) VALUES (?,?,?,?,?)
     ON CONFLICT(provider) DO UPDATE SET api_key=excluded.api_key, base_url=excluded.base_url, model=excluded.model, enabled=excluded.enabled, updated_at=CURRENT_TIMESTAMP`,
  )
    .bind(b.provider, b.api_key, b.base_url || null, b.model || null, b.enabled === 0 ? 0 : 1)
    .run();
  return new Response(JSON.stringify({ success: true, data: null, error: null, meta: null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const GET = endpoint(handlerGet);
export const POST = endpoint(handlerPost);
