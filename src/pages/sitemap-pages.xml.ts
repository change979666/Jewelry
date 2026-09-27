/**
 * sitemap-pages.xml — static pages + blog posts + guides (V1.0: en/ar only).
 * Product/collection URLs are served by D1 at runtime and are listed in
 * sitemap-dynamic (if enabled); catalog pages live under /product/ & /collection/.
 */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const SITE = "https://jewelry.com";
const LOCALES = ["en", "ar"];

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const GET: APIRoute = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const urls: string[] = [];

  const push = (path: string, priority: string, changefreq = "weekly") => {
    urls.push(
      `  <url>\n    <loc>${escapeXml(`${SITE}${path}`)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`,
    );
  };

  // Static pages per locale (only routes that actually exist in src/pages)
  const staticPages = [
    { path: "", p: "1.0" },
    { path: "/about", p: "0.7" },
    { path: "/contact", p: "0.8" },
    { path: "/faq", p: "0.7" },
    { path: "/blog", p: "0.8" },
    { path: "/resources", p: "0.8" },
    { path: "/cart", p: "0.5" },
  ];

  for (const locale of LOCALES) {
    for (const pg of staticPages) {
      push(`/${locale}${pg.path}/`, pg.p);
    }
  }

  // Blog posts (cross-locale keys; /en always served, /ar only when translated)
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  const postKeys = [...new Set(posts.map((e) => e.data.key))];
  for (const locale of LOCALES) {
    for (const key of postKeys) {
      const hasLocale = posts.some((e) => e.data.key === key && e.data.locale === locale);
      if (locale === "en" || hasLocale) {
        push(`/${locale}/blog/${key}/`, "0.6", "monthly");
      }
    }
  }

  // Guides
  const guides = await getCollection("guides", ({ data }) => !data.draft);
  const guideKeys = [...new Set(guides.map((e) => e.data.key))];
  for (const locale of LOCALES) {
    for (const key of guideKeys) {
      const hasLocale = guides.some((e) => e.data.key === key && e.data.locale === locale);
      if (locale === "en" || hasLocale) {
        push(`/${locale}/resources/${key}/`, "0.6", "monthly");
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
};
