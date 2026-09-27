// ---------------------------------------------------------------------------
//  Aromiso Commerce — Admin Reviews & Questions Moderation API
//  GET  /api/admin/commerce-reviews?kind=reviews&status=pending   → list reviews
//  GET  /api/admin/commerce-reviews?kind=questions&status=pending → list questions
//  POST /api/admin/commerce-reviews  → moderate
//       { kind:"review", id, status:"approved"|"rejected" }
//       { kind:"question", id, answer:"..." }   (sets status=answered)
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { isAuthed, json } from "./shared";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);
  const db = env.DB!;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "questions" ? "questions" : "reviews";
  const status = url.searchParams.get("status") || "";

  try {
    if (kind === "reviews") {
      let sql =
        "SELECT r.*, p.title AS product_title, p.slug AS product_slug FROM commerce_product_reviews r LEFT JOIN commerce_products p ON p.id = r.product_id";
      const params: string[] = [];
      if (status) {
        sql += " WHERE r.status = ?";
        params.push(status);
      }
      sql += " ORDER BY r.created_at DESC LIMIT 200";
      const res = await (params.length ? db.prepare(sql).bind(...params) : db.prepare(sql)).all<
        Record<string, unknown>
      >();
      return json({ ok: true, reviews: res.results });
    }

    let sql =
      "SELECT q.*, p.title AS product_title, p.slug AS product_slug FROM commerce_product_questions q LEFT JOIN commerce_products p ON p.id = q.product_id";
    const params: string[] = [];
    if (status) {
      sql += " WHERE q.status = ?";
      params.push(status);
    }
    sql += " ORDER BY q.created_at DESC LIMIT 200";
    const res = await (params.length ? db.prepare(sql).bind(...params) : db.prepare(sql)).all<
      Record<string, unknown>
    >();
    return json({ ok: true, questions: res.results });
  } catch (err) {
    return json({ error: "Internal error", detail: String(err) }, 500);
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);
  const db = env.DB!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const kind = body.kind === "question" ? "question" : "review";
  const id = String(body.id || "").trim();
  if (!id) return json({ error: "id is required" }, 422);

  try {
    if (kind === "review") {
      const status = body.status === "approved" ? "approved" : "rejected";
      await db
        .prepare("UPDATE commerce_product_reviews SET status = ? WHERE id = ?")
        .bind(status, id)
        .run();
      return json({ ok: true, id, status });
    }

    // question → answer
    const answer = String(body.answer || "").trim();
    if (!answer) return json({ error: "answer is required" }, 422);
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        "UPDATE commerce_product_questions SET answer = ?, status = 'answered', answered_at = ? WHERE id = ?",
      )
      .bind(answer, now, id)
      .run();
    return json({ ok: true, id, status: "answered" });
  } catch (err) {
    return json({ error: "Internal error", detail: String(err) }, 500);
  }
};
