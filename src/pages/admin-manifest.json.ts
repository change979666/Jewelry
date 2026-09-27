// Build-time static endpoint: outputs a JSON manifest of content entries with
// their frontmatter summaries. The admin content loader fetches this single
// file (1 subrequest) instead of fetching each .md individually.
//
// Output: /admin-manifest.json
// Shape: { blog: Entry[], products: Entry[], guides: Entry[], caseStudies: Entry[] }
//
// PLACEHOLDER (V1.0): only the `blog` and `guides` content collections exist.
// `products` / `caseStudies` are emitted as empty arrays to keep the shape
// stable; commerce products will come from D1 (not a content collection).

import { getCollection } from "astro:content";

export async function GET() {
  const [blogAll, guidesAll] = await Promise.all([
    getCollection("blog"),
    getCollection("guides"),
  ]);

  const blog = blogAll.map((e) => ({
    key: e.data.key,
    locale: e.data.locale,
    id: e.id,
    title: e.data.title,
    category: e.data.category || "",
    cover: e.data.cover || "",
    pubDate: e.data.pubDate ? e.data.pubDate.toISOString() : "",
    featured: !!e.data.featured,
    draft: !!e.data.draft,
  }));

  const guides = guidesAll.map((e) => ({
    key: e.data.key,
    locale: e.data.locale,
    id: e.id,
    title: e.data.title,
    category: e.data.category || "",
    cover: e.data.cover || "",
    pubDate: e.data.pubDate ? e.data.pubDate.toISOString() : "",
    order: e.data.order || 0,
    featured: false,
    draft: !!e.data.draft,
  }));

  // TODO(commerce): products are managed in D1 via /admin-v2/commerce/products,
  // not markdown. caseStudies are not part of the Jewelry model.
  return new Response(
    JSON.stringify({ blog, products: [], guides, caseStudies: [] }),
    { headers: { "Content-Type": "application/json" } },
  );
}
