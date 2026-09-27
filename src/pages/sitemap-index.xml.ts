/**
 * sitemap-index.xml — references the four bucketed child sitemaps.
 * GSC can monitor indexing rate per content type.
 */
import type { APIRoute } from "astro";

const SITE = "https://aromiso.com";

export const GET: APIRoute = () => {
  const now = new Date().toISOString();
  const children = [
    "sitemap-products.xml",
    "sitemap-blog.xml",
    "sitemap-guides.xml",
    "sitemap-pages.xml",
    "sitemap-videos.xml",
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${children.map((c) => `  <sitemap>\n    <loc>${SITE}/${c}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`).join("\n")}
</sitemapindex>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
};
