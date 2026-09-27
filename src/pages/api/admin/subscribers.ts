// Admin subscribers API — backed by Cloudflare D1 (binding `DB`).
// Collect-only newsletter list for review and manual outreach (no auto-send).
//
// GET    /api/admin/subscribers?search=        list (newest first)
// GET    /api/admin/subscribers?export=csv     download CSV
// DELETE /api/admin/subscribers?id=            remove a subscriber

import { isAuthed, json } from "@/pages/api/admin/_shared";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

interface Subscriber {
  id: number;
  email: string;
  locale: string;
  source: string;
  createdAt: string;
}

interface SubscriberRow {
  id: number;
  email?: string;
  locale?: string;
  source?: string;
  created_at?: string;
  createdAt?: string;
}

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  locale     TEXT NOT NULL DEFAULT '',
  source     TEXT NOT NULL DEFAULT 'footer',
  created_at TEXT NOT NULL
)`;

function rowToSubscriber(r: SubscriberRow): Subscriber {
  return {
    id: r.id,
    email: r.email || "",
    locale: r.locale || "",
    source: r.source || "",
    createdAt: r.created_at || r.createdAt || "",
  };
}

function toCsv(items: Subscriber[]): string {
  const headers = ["id", "email", "locale", "source", "createdAt"] as const;
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const it of items) {
    lines.push(headers.map((h) => esc(it[h])).join(","));
  }
  return "\uFEFF" + lines.join("\r\n"); // BOM for Excel UTF-8
}

async function handlerAll({ request, env }: PagesCtx): Promise<Response> {
  if (!(await isAuthed(request, env))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const db = env.DB;
  if (!db) return json({ error: "No database configured" }, 500);

  const url = new URL(request.url);

  // ---- GET -----------------------------------------------------------------
  if (request.method === "GET") {
    const search = (url.searchParams.get("search") || "").trim();
    const exportCsv = url.searchParams.get("export") === "csv";

    let items: Subscriber[];
    try {
      // Defensive create so the view works even before the migration is applied.
      await db.prepare(CREATE_TABLE).run();
      const clauses: string[] = [];
      const params: string[] = [];
      if (search) {
        clauses.push("(email LIKE ? OR locale LIKE ? OR source LIKE ?)");
        const s = `%${search}%`;
        params.push(s, s, s);
      }
      const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
      const { results } = await db
        .prepare(`SELECT * FROM subscribers${where} ORDER BY created_at DESC`)
        .bind(...params)
        .all<SubscriberRow>();
      items = results.map(rowToSubscriber);
    } catch (e) {
      return json(
        { error: `Database query failed: ${e instanceof Error ? e.message : String(e)}` },
        500,
      );
    }

    if (exportCsv) {
      return new Response(toCsv(items), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return json({ ok: true, subscribers: items, total: items.length });
  }

  // ---- DELETE --------------------------------------------------------------
  if (request.method === "DELETE") {
    let body: { id?: number | string };
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const id = body?.id ?? url.searchParams.get("id");
    if (id == null || id === "") return json({ error: "Missing id" }, 422);

    const res = await db.prepare("DELETE FROM subscribers WHERE id = ?1").bind(id).run();
    if (!res.meta.changes) return json({ error: "Subscriber not found" }, 404);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const ALL = endpoint(handlerAll);
