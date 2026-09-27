// Phase 3 — Dashboard Funnel endpoint
// Inquiry funnel: total → Contacted → Negotiating → Won
// Commerce funnel: total → paid/processing/shipped/completed → completed
// Stages without data source return null (frontend shows —)
// Each funnel gated by its module permission

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

  // Inquiry funnel — customers:view
  if (checkPermission(user, "customers", "view")) {
    try {
      const rows = await env.DB.prepare(
        "SELECT status, COUNT(*) AS c FROM inquiries GROUP BY status",
      ).all<{ status: string; c: number }>();
      const map = new Map(rows.results.map((r) => [r.status, r.c]));
      const total = rows.results.reduce((s, r) => s + r.c, 0);
      result.inquiryFunnel = [
        { label: "询盘总数", value: total },
        { label: "已联系", value: map.get("Contacted") ?? 0 },
        { label: "谈判中", value: map.get("Negotiating") ?? 0 },
        { label: "已成交", value: map.get("Won") ?? 0 },
      ];
    } catch {
      result.inquiryFunnel = null;
    }
  } else {
    result.inquiryFunnel = null;
  }

  // Commerce funnel — commerce:view
  if (checkPermission(user, "commerce", "view")) {
    try {
      const rows = await env.DB.prepare(
        "SELECT status, COUNT(*) AS c FROM commerce_orders GROUP BY status",
      ).all<{ status: string; c: number }>();
      const map = new Map(rows.results.map((r) => [r.status, r.c]));
      const total = rows.results.reduce((s, r) => s + r.c, 0);
      const paid =
        (map.get("paid") ?? 0) +
        (map.get("processing") ?? 0) +
        (map.get("shipped") ?? 0) +
        (map.get("completed") ?? 0);
      result.commerceFunnel = [
        { label: "订单总数", value: total },
        { label: "已付款+", value: paid },
        { label: "已完成", value: map.get("completed") ?? 0 },
      ];
    } catch {
      result.commerceFunnel = null;
    }
  } else {
    result.commerceFunnel = null;
  }

  return new Response(JSON.stringify({ success: true, data: result, error: null, meta: null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
