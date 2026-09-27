// Phase 3 — Dashboard Recent Work endpoint
// Recent content versions + recent inquiries, each gated by module permission

import type { AdminEnv } from "../../../admin/shared";
import { authenticateRequest, checkPermission } from "../../../../lib/admin/rbac";

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;
  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);
  if (request.method !== "GET") return fail("METHOD_NOT_ALLOWED", "Use GET", 405);
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  const result: Record<string, unknown> = {};

  // Recent content versions — content:view
  if (checkPermission(user, "content", "view")) {
    try {
      const rows = await env.DB.prepare(
        "SELECT id, entity_type, entity_key, version, author, change_summary, created_at FROM content_versions ORDER BY created_at DESC LIMIT 5",
      ).all();
      result.recentContent = rows.results;
    } catch {
      result.recentContent = [];
    }
  } else {
    result.recentContent = null;
  }

  // Recent inquiries — customers:view
  if (checkPermission(user, "customers", "view")) {
    try {
      const rows = await env.DB.prepare(
        "SELECT id, name, email, company, country, status, created_at FROM inquiries ORDER BY created_at DESC LIMIT 5",
      ).all();
      result.recentInquiries = rows.results;
    } catch {
      result.recentInquiries = [];
    }
  } else {
    result.recentInquiries = null;
  }

  return new Response(JSON.stringify({ success: true, data: result, error: null, meta: null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
