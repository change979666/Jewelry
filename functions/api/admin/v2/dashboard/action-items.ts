// Phase 3 — Dashboard Action Items endpoint
// Sections with real data: ai_pending (ai:view), new_inquiries (customers:view), video_pending (media:view)
// Sections without data source (product_missing, seo_issues, oem_pending): always 0
// Each section gated by its module permission; null if unauthorized

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

  const result: Record<string, number | null> = {
    productMissing: 0, // no data source yet (Phase 5)
    seoIssues: 0, // no data source yet (Phase 8)
    oemPending: 0, // no data source yet (Phase 6)
  };

  // AI pending confirmation — ai:view
  if (checkPermission(user, "ai", "view")) {
    try {
      const r = await env.DB.prepare(
        "SELECT COUNT(*) AS c FROM ai_missions WHERE human_approval_needed = 1 AND human_approved_by IS NULL",
      ).first<{ c: number }>();
      result.aiPending = r?.c ?? 0;
    } catch {
      result.aiPending = 0;
    }
  } else {
    result.aiPending = null;
  }

  // New inquiries — customers:view
  if (checkPermission(user, "customers", "view")) {
    try {
      const r = await env.DB.prepare(
        "SELECT COUNT(*) AS c FROM inquiries WHERE status = 'New'",
      ).first<{ c: number }>();
      result.newInquiries = r?.c ?? 0;
    } catch {
      result.newInquiries = 0;
    }
  } else {
    result.newInquiries = null;
  }

  // Video pending review — media:view (ready + editorial_status='draft')
  if (checkPermission(user, "media", "view")) {
    try {
      const r = await env.DB.prepare(
        "SELECT COUNT(*) AS c FROM video_assets WHERE processing_status = 'ready' AND editorial_status = 'draft'",
      ).first<{ c: number }>();
      result.videoPending = r?.c ?? 0;
    } catch {
      result.videoPending = 0;
    }
  } else {
    result.videoPending = null;
  }

  return new Response(JSON.stringify({ success: true, data: result, error: null, meta: null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
