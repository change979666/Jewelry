/**
 * sitemap-products.xml — product pages across locales.
 *
 * PLACEHOLDER (V1.0): the catalog does not exist yet. Products will live in
 * D1 (commerce) and the canonical PDP is /{locale}/shop/{short_id}. Rebuild
 * this endpoint in the Commerce phase to enumerate active products; for now
 * it emits an empty urlset so the build succeeds.
 */
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  // TODO(commerce): fetch active products from D1 (paginated) and emit
  // /{locale}/shop/{short_id} URLs. Until then: no product URLs.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
};
