// ---------------------------------------------------------------------------
//  Aromiso OS 1.0 — /api/admin/ai-feedback
//
//  Feedback loop for AI outputs. Records 👍/👎/edited/executed/rejected/star
//  on any AI-generated object (task, knowledge, copy, opportunity).
//  The Librarian consumes unconsumed feedback in the next daily run and
//  distills it into reusable preference/experience knowledge.
//
//  GET    — List recent feedback (?limit=50)
//  POST   — Record a feedback { role, target_type, target_id, rating,
//             comment, ai_output, human_edit }
//  Auth: admin cookie
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { readCookie, verifySession } from "./shared";

const VALID_RATINGS = new Set(["up", "down", "executed", "rejected", "edited", "star", "neutral"]);

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const token = readCookie(request);
  if (!(await verifySession(token, env.ADMIN_PASSWORD || ""))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!env.DB) return Response.json({ error: "DB unavailable" }, { status: 503 });
  const db = env.DB;
  const method = request.method.toUpperCase();

  if (method === "GET") {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
    const role = url.searchParams.get("role") || "";
    const rating = url.searchParams.get("rating") || "";

    let sql = `SELECT id, role, target_type, target_id, rating, comment, ai_output, human_edit, consumed, created_at
               FROM ai_feedback WHERE 1=1`;
    const params: (string | number)[] = [];
    if (role) {
      sql += ` AND role = ?`;
      params.push(role);
    }
    if (rating) {
      sql += ` AND rating = ?`;
      params.push(rating);
    }
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const res = await db
      .prepare(sql)
      .bind(...params)
      .all();
    return Response.json({ ok: true, feedback: res.results });
  }

  if (method === "POST") {
    let body: {
      role?: string;
      target_type?: string;
      target_id?: number;
      rating?: string;
      comment?: string;
      ai_output?: string;
      human_edit?: string;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body.rating || !VALID_RATINGS.has(body.rating)) {
      return Response.json({ error: "Invalid rating" }, { status: 400 });
    }

    await db
      .prepare(
        `INSERT INTO ai_feedback (role, target_type, target_id, rating, comment, ai_output, human_edit, consumed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      )
      .bind(
        body.role || "",
        body.target_type || "task",
        body.target_id ?? null,
        body.rating,
        body.comment || "",
        body.ai_output || "",
        body.human_edit || "",
        Math.floor(Date.now() / 1000),
      )
      .run();

    return Response.json({ ok: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};
