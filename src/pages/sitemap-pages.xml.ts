/**
 * sitemap-pages.xml — static pages + blog posts + guides (V1.0: en/ar only).
 * Product/collection URLs are served by D1 at runtime and are listed in
 * sitemap-dynamic (if enabled); catalog pages live under /product/ & /collection/.
 */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { SITE as SITE_CFG } from "../consts";
import { LOCALE_LIST } from "../i18n";

const SITE = SITE_CFG.url.replace(/\/$/, "");
const LOCALES = LOCALE_LIST;

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

  // Static pages per locale. Only routes that actually exist under
  // src/pages/[lang]/ — a sitemap entry for a missing route is a guaranteed 404
  // (there is no /resources route in V1.0; guides are not published).
  const staticPages = [
    { path: "", p: "1.0" },
    { path: "/about", p: "0.7" },
    { path: "/contact", p: "0.8" },
    { path: "/faq", p: "0.7" },
    { path: "/blog", p: "0.8" },
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

  // Guides are intentionally NOT listed: there is no /{locale}/resources/{key}
  // route in V1.0, so every guide URL would 404. Re-add when that route ships
  // (see src/pages/sitemap-guides.xml.ts, which has the same constraint).

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
};
