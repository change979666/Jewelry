// Phase 3 — Dashboard AI Status endpoint
// health score, today's missions, completed, pending approval, total cost
// Requires ai:view — returns null fields if unauthorized

import type { AdminEnv } from "../../../admin/shared";
import {
  authenticateRequest,
  checkPermission,
  cronSecretAuthorized,
} from "../../../../lib/admin/rbac";
import { classifyHealthBuckets, type HealthBuckets } from "../../../../lib/health-buckets";

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;
  const user = await authenticateRequest(request, env);
  const machine = cronSecretAuthorized(request, env);
  if (!user && !machine) return fail("UNAUTHORIZED", "Login required", 401);
  if (request.method !== "GET") return fail("METHOD_NOT_ALLOWED", "Use GET", 405);
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  if (user && !checkPermission(user, "ai", "view")) {
    return new Response(JSON.stringify({ success: true, data: null, error: null, meta: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let healthRow: {
    health_score: number;
    total_missions: number;
    completed_missions: number;
    total_cost_usd: number;
  } | null = null;
  let pendingRow: { c: number } | null = null;
  let todayMissionsRow: { c: number } | null = null;
  let completedTodayRow: { c: number } | null = null;

  try {
    healthRow = await env.DB.prepare(
      "SELECT health_score, total_missions, completed_missions, total_cost_usd FROM ai_daily_report WHERE report_date = date('now') ORDER BY generated_at DESC LIMIT 1",
    ).first<{
      health_score: number;
      total_missions: number;
      completed_missions: number;
      total_cost_usd: number;
    }>();
  } catch {
    /* table may not exist yet */
  }

  try {
    pendingRow = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM ai_missions WHERE human_approval_needed = 1 AND human_approved_by IS NULL",
    ).first<{ c: number }>();
  } catch {
    /* table may not exist yet */
  }

  try {
    // created_at is an INTEGER unix timestamp; comparing to date('now') TEXT
    // always yields 0 (SQLite type order INTEGER < TEXT) — use unixepoch.
    todayMissionsRow = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM ai_missions WHERE created_at >= unixepoch('now','start of day','-8 hours')",
    ).first<{ c: number }>();
  } catch {
    /* table may not exist yet */
  }

  try {
    completedTodayRow = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM ai_missions WHERE status = 'completed' AND completed_at >= unixepoch('now','start of day','-8 hours')",
    ).first<{ c: number }>();
  } catch {
    /* table may not exist yet */
  }

  // AI Suggestions from growth_opportunities — growth:view
  let suggestions: Array<{
    query: string;
    reason: string;
    suggestedAction: string;
    priority: string;
  }> = [];
  if (checkPermission(user, "growth", "view")) {
    try {
      const sugRows = await env.DB.prepare(
        "SELECT query, reason, suggested_action, priority FROM growth_opportunities WHERE status = 'new' ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC LIMIT 5",
      ).all<{ query: string; reason: string; suggested_action: string; priority: string }>();
      suggestions = sugRows.results.map((r) => ({
        query: r.query || "",
        reason: r.reason || "",
        suggestedAction: r.suggested_action || "",
        priority: r.priority || "medium",
      }));
    } catch {
      /* table may not exist yet */
    }
  }

  // V5.69：健康分失败信号分桶——让 dashboard 上的 RED 可被一眼定位。
  // 只读诊断，任一表缺失返回 null，绝不阻断状态卡。
  let healthBuckets: HealthBuckets | null = null;
  try {
    healthBuckets = await classifyHealthBuckets(env.DB, 7);
  } catch {
    /* 诊断层失败不阻断 */
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        healthScore: healthRow?.health_score ?? null,
        todayMissions: todayMissionsRow?.c ?? 0,
        completedToday: completedTodayRow?.c || healthRow?.completed_missions || 0,
        pendingApproval: pendingRow?.c ?? 0,
        totalCost: healthRow?.total_cost_usd ?? 0,
        suggestions,
        healthBuckets,
      },
      error: null,
      meta: null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
