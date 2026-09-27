// Phase 11 — Site Settings API
// GET    — list all settings (optionally filtered by category)
// PUT    — update settings (batch key-value update)

import type { AdminEnv } from "../../../admin/shared";
import { authenticateRequest, requirePermission } from "../../../../lib/admin/rbac";
import { logAction } from "../../../../lib/admin/audit";

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

function ok(data: unknown, meta?: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, error: null, meta: meta ?? null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);

  // GET — list settings
  if (request.method === "GET") {
    const permErr = requirePermission(user, "system", "view");
    if (permErr) return permErr;

    const url = new URL(request.url);
    const category = url.searchParams.get("category") || "";

    let query =
      "SELECT key, value, category, description, updated_by, updated_at FROM site_settings";
    const binds: unknown[] = [];
    if (category) {
      query += " WHERE category = ?";
      binds.push(category);
    }
    query += " ORDER BY category, key";

    const rows = await env.DB.prepare(query)
      .bind(...binds)
      .all();
    return ok(rows.results);
  }

  // PUT — batch update settings
  if (request.method === "PUT") {
    const permErr = requirePermission(user, "system", "manage_settings");
    if (permErr) return permErr;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return fail("INVALID_JSON", "Invalid JSON", 400);
    }

    const settings = body.settings as Record<string, string> | undefined;
    if (!settings || typeof settings !== "object")
      return fail("VALIDATION_ERROR", "settings object required", 422);

    const entries = Object.entries(settings);
    if (entries.length === 0) return fail("VALIDATION_ERROR", "No settings to update", 422);
    if (entries.length > 100) return fail("TOO_MANY", "Max 100 settings per update", 400);

    const now = new Date().toISOString();
    for (const [key, value] of entries) {
      if (typeof key !== "string" || !key.trim()) continue;
      const val = typeof value === "string" ? value : String(value ?? "");
      await env.DB.prepare(
        "INSERT INTO site_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
      )
        .bind(key.slice(0, 100), val.slice(0, 5000), user.username, now)
        .run();
    }

    await logAction(env, {
      actor_type: "human",
      user_id: user.id,
      username: user.username,
      action: "update",
      resource_type: "system",
      resource_id: "site_settings",
      resource_title: "Site Settings",
      change_summary: `Updated ${entries.length} setting(s)`,
    });

    return ok({ updated: entries.length });
  }

  return fail("METHOD_NOT_ALLOWED", "Use GET or PUT", 405);
}
