// ---------------------------------------------------------------------------
//  Jewelry — Runtime Search API
//  GET /api/search?q=lavender&type=all&limit=20
//  Searches commerce products in D1 at runtime. Static content (guides, blog)
//  is still handled client-side via /search-index.json (build-time).
// ---------------------------------------------------------------------------

import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";
import { LOCALE_LIST, type Locale } from "@/i18n";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
  });
}

async function handlerGet({ request, env }: PagesCtx): Promise<Response> {
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
  // PDPs live under /{locale}/product/{slug}; without the prefix the result links
  // would 404 (en is prefixed too — see localizedUrl in src/i18n.ts).
  const rawLocale = url.searchParams.get("locale") || "";
  const locale: Locale = (LOCALE_LIST as string[]).includes(rawLocale)
    ? (rawLocale as Locale)
    : "en";
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
      // `products` has no category/cover_image/tags columns: the cover image lives
      // in product_media and the category is the product's first collection.
      const products = await db
        .prepare(
          `SELECT
             p.id, p.slug, p.title, p.short_description,
             COALESCE(
               (SELECT m.url FROM product_media m
                 WHERE m.product_id = p.id AND m.type IN ('hero','gallery')
                 ORDER BY m.sort_order ASC LIMIT 1), ''
             ) AS cover_image,
             COALESCE(
               (SELECT c.name FROM collection_products cp
                 JOIN collections c ON c.id = cp.collection_id
                 WHERE cp.product_id = p.id
                 ORDER BY cp.sort_order ASC LIMIT 1), ''
             ) AS category
           FROM products p
           WHERE p.status = 'active'
             AND (p.title LIKE ? OR p.short_description LIKE ? OR p.description LIKE ?)
           ORDER BY p.created_at DESC
           LIMIT ?`,
        )
        .bind(like, like, like, limit)
        .all<Record<string, unknown>>();

      for (const p of products.results) {
        results.push({
          type: "product",
          slug: p.slug as string,
          title: p.title as string,
          description: (p.short_description as string) || "",
          category: (p.category as string) || "",
          image: (p.cover_image as string) || "",
          url: `/${locale}/product/${p.slug}`,
          tags: [],
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
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const GET = endpoint(handlerGet);
