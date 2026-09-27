// ---------------------------------------------------------------------------
//  Jewelry — Runtime Search API
//  GET /api/search?q=lavender&type=all&limit=20
//  Searches commerce products in D1 at runtime. Static content (guides, blog)
//  is still handled client-side via /search-index.json (build-time).
// ---------------------------------------------------------------------------

import type { Env } from "../types";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.DB;
  if (!db) return json({ error: "Database unavailable" }, 500);

  const url = new URL(request.url);
  // S-04: cap query length. Cloudflare D1's SQLite rejects an overly long LIKE
  // pattern with "LIKE or GLOB pattern too complex" (empirically ~48+ chars),
  // which surfaced as a 500. 40 chars keeps the wrapped `%q%` pattern (~42) well
  // under that limit and is generous for product keyword search. Also clamp
  // limit to a safe inclusive range — a negative/zero limit must NOT become
  // `LIMIT -1` (which in SQLite means "no limit" and would return the whole table).
  const MAX_Q_LEN = 40;
  const MAX_LIMIT = 50;
  const DEFAULT_LIMIT = 20;
  const q = (url.searchParams.get("q") || "").trim().toLowerCase().slice(0, MAX_Q_LEN);
  const type = url.searchParams.get("type") || "all"; // all|products
  const rawLimit = parseInt(url.searchParams.get("limit") || "", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, rawLimit))
    : DEFAULT_LIMIT;

  if (!q) return json({ ok: true, results: [], total: 0 });

  const results: {
    type: string;
    slug: string;
    title: string;
    description: string;
    category: string;
    image: string;
    url: string;
    tags: string[];
  }[] = [];

  try {
    // Search commerce products (D1 runtime)
    if (type === "all" || type === "products") {
      // S-04: strip LIKE wildcards (%, _, \) rather than escape them — escaping
      // would double the length of all-wildcard input and could still exceed D1's
      // LIKE pattern limit, whereas stripping keeps the pattern short and makes
      // wildcard-semantics injection impossible. Normal keyword queries contain
      // none of these characters, so their results are unchanged.
      const sanitized = q.replace(/[%_\\]/g, "");
      const like = `%${sanitized}%`;
      const products = await db
        .prepare(
          `SELECT id, slug, title, short_description, category, cover_image, tags
           FROM commerce_products
           WHERE status = 'active' AND (title LIKE ? OR short_description LIKE ? OR category LIKE ?)
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .bind(like, like, like, limit)
        .all<Record<string, unknown>>();

      for (const p of products.results) {
        let tags: string[] = [];
        try {
          tags = JSON.parse((p.tags as string) || "[]");
        } catch {
          /* empty */
        }
        results.push({
          type: "product",
          slug: p.slug as string,
          title: p.title as string,
          description: (p.short_description as string) || "",
          category: (p.category as string) || "",
          image: (p.cover_image as string) || "",
          url: `/en/shop/${p.slug}`,
          tags,
        });
      }
    }

    // For guides/pages/blog, the client-side search index (/search-index.json)
    // is still used — this endpoint primarily adds D1 product search capability.

    return json({ ok: true, results, total: results.length });
  } catch (err) {
    // S-04: never leak internal error detail (D1 messages, stack) to the client.
    console.error("[search] query failed:", err instanceof Error ? err.message : String(err));
    return json({ error: "Internal error" }, 500);
  }
};
