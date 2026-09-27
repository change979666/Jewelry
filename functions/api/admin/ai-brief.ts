// ---------------------------------------------------------------------------
//  Aromiso AI Growth Center — /api/admin/ai-brief
//
//  GET  — Return the latest daily brief
//  POST — Generate a new AI-powered daily brief from recent business data
//
//  Auth: admin cookie (isAuthed)
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { isAuthed, json } from "./shared";
import { aiCall } from "../../lib/ai";
import { classifyHealthBuckets, type HealthBuckets } from "../../lib/health-buckets";

// NOTE (V5.415 P1-4): health_score in ai_daily_briefs is a legacy LLM self-assessment and has been DEPRECATED.
// It is retained in the table for historical continuity (no tampering), but the UI no longer trusts it.
// The single source of truth (SSOT) is ai_daily_report.health_score with bands ≥85 GREEN / 60–84 YELLOW / <60 RED.
const SYSTEM_PROMPT = `You are Aromiso's AI business analyst. Analyze the data and produce a JSON brief with: summary (string), issues (array of {title, severity, suggestion}), opportunities (array of {title, type, priority, action}), signals (array of string), health_score (0-100, LEGACY DEPRECATED — do not use; read unified_health from API response), top_3_actions (array of string)`;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const db = env.DB;
  if (!db) return json({ error: "Database not available" }, 503);

  const row = await db
    .prepare(
      `SELECT id, date, content_json, health_score, issues_count, opportunities_count, signals_count, created_at
       FROM ai_daily_briefs ORDER BY date DESC LIMIT 1`,
    )
    .first();

  if (!row) return json({ ok: true, brief: null });

  const brief = row as Record<string, unknown>;
  let content: unknown;
  try {
    content = JSON.parse(brief.content_json as string);
  } catch {
    content = {};
  }

  // V5.415 (P1-4): unified_health SSOT from ai_daily_report (legacy score retained only for history).
  let unifiedHealth: { score: number; level: string; source: string; date?: string } | null = null;
  try {
    const rep = await db
      .prepare(
        `SELECT report_date, health_score FROM ai_daily_report ORDER BY report_date DESC LIMIT 1`,
      )
      .first();
    if (rep?.health_score != null) {
      const s = Number(rep.health_score);
      unifiedHealth = {
        score: s,
        level: s >= 85 ? "GREEN" : s >= 60 ? "YELLOW" : "RED",
        source: "ai_daily_report",
        date: String(rep.report_date || ""),
      };
    }
  } catch {
    /* P1-4: SSOT lookup best-effort */
  }

  // V5.69：健康分「失败信号分桶」——让一个 RED 可被一眼定位（system/external/true_fail/
  // slow_success/false_fail）。只读诊断，任一表缺失都返回 null，绝不阻断 brief。
  let healthBuckets: HealthBuckets | null = null;
  try {
    healthBuckets = await classifyHealthBuckets(db, 7);
  } catch {
    /* 诊断层失败不阻断主响应 */
  }

  return json({
    ok: true,
    brief: {
      id: brief.id,
      date: brief.date,
      content: content,
      health_score_deprecated: true,
      health_score: brief.health_score,
      issues_count: brief.issues_count,
      opportunities_count: brief.opportunities_count,
      signals_count: brief.signals_count,
      created_at: brief.created_at,
      unified_health: unifiedHealth,
      health_buckets: healthBuckets,
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const db = env.DB;
  if (!db) return json({ error: "Database not available" }, 503);

  const now = Math.floor(Date.now() / 1000);
  const sevenDaysAgo = now - 7 * 86400;

  // 1. Collect recent business data
  let inquiryCount = 0;
  let orderCount = 0;
  let productCounts: unknown[] = [];
  let behaviorCount = 0;

  try {
    const inq = await db
      .prepare(`SELECT COUNT(*) as cnt FROM inquiries WHERE created_at >= ?`)
      .bind(new Date(sevenDaysAgo * 1000).toISOString())
      .first<{ cnt: number }>();
    inquiryCount = inq?.cnt ?? 0;
  } catch {
    /* table may not exist */
  }

  try {
    const ord = await db
      .prepare(`SELECT COUNT(*) as cnt FROM commerce_orders WHERE created_at >= ?`)
      .bind(sevenDaysAgo)
      .first<{ cnt: number }>();
    orderCount = ord?.cnt ?? 0;
  } catch {
    /* table may not exist */
  }

  try {
    const prod = await db
      .prepare(`SELECT status, COUNT(*) as cnt FROM commerce_products GROUP BY status`)
      .all();
    productCounts = prod.results;
  } catch {
    /* table may not exist */
  }

  try {
    const beh = await db
      .prepare(`SELECT COUNT(*) as cnt FROM behavior_events WHERE created_at >= ?`)
      .bind(sevenDaysAgo)
      .first<{ cnt: number }>();
    behaviorCount = beh?.cnt ?? 0;
  } catch {
    /* table may not exist */
  }

  const stats = {
    period: "last_7_days",
    inquiries: inquiryCount,
    orders: orderCount,
    products_by_status: productCounts,
    behavior_events: behaviorCount,
    generated_at: new Date().toISOString(),
  };

  // 2. Call DeepSeek AI
  const result = await aiCall(
    env,
    db,
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(stats) },
    ],
    { json_mode: true, role: "ai_brief", max_tokens: 4000 },
  );

  if (!result) {
    return json({ error: "AI generation failed (budget or API error)" }, 502);
  }

  // 3. Parse AI response
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    const match = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        parsed = JSON.parse(match[1].trim());
      } catch {
        return json({ error: "Failed to parse AI response" }, 502);
      }
    } else {
      return json({ error: "Failed to parse AI response" }, 502);
    }
  }

  const healthScore = typeof parsed.health_score === "number" ? parsed.health_score : 0;
  const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
  const opportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
  const signals = Array.isArray(parsed.signals) ? parsed.signals : [];

  // 4. Insert into ai_daily_briefs
  const id = crypto.randomUUID();
  const date = new Date().toISOString().slice(0, 10);

  await db
    .prepare(
      `INSERT INTO ai_daily_briefs (id, date, content_json, health_score, issues_count, opportunities_count, signals_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      date,
      JSON.stringify(parsed),
      healthScore,
      issues.length,
      opportunities.length,
      signals.length,
      now,
    )
    .run();

  // V5.415 (P1-4): unified_health SSOT from ai_daily_report
  let unifiedHealth: { score: number; level: string; source: string; date?: string } | null = null;
  try {
    const rep = await db
      .prepare(
        `SELECT report_date, health_score FROM ai_daily_report ORDER BY report_date DESC LIMIT 1`,
      )
      .first();
    if (rep?.health_score != null) {
      const s = Number(rep.health_score);
      unifiedHealth = {
        score: s,
        level: s >= 85 ? "GREEN" : s >= 60 ? "YELLOW" : "RED",
        source: "ai_daily_report",
        date: String(rep.report_date || ""),
      };
    }
  } catch {
    /* P1-4: SSOT lookup best-effort */
  }

  // V5.69：健康分「失败信号分桶」（与 GET 同口径），只读诊断、失败不阻断。
  let healthBucketsPost: HealthBuckets | null = null;
  try {
    healthBucketsPost = await classifyHealthBuckets(db, 7);
  } catch {
    /* 诊断层失败不阻断主响应 */
  }

  return json({
    ok: true,
    brief: {
      id,
      date,
      content: parsed,
      health_score_deprecated: true,
      health_score: healthScore,
      issues_count: issues.length,
      opportunities_count: opportunities.length,
      signals_count: signals.length,
      created_at: now,
      unified_health: unifiedHealth,
      health_buckets: healthBucketsPost,
    },
  });
};
