/**
 * sitemap-blog.xml — all blog article pages across locales.
 */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { SITE as SITE_CFG } from "../consts";
import { LOCALE_LIST } from "../i18n";

// Single source of truth for the domain (src/consts.ts) and for the shipped
// locales. This endpoint previously hardcoded https://jewelry.com and
// ["en","es","de"], which advertised URLs that do not exist on this site.
const SITE = SITE_CFG.url.replace(/\/$/, "");
const LOCALES = LOCALE_LIST;

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const GET: APIRoute = async () => {
  const entries = await getCollection("blog", ({ data }) => !data.draft);
  const keys = [...new Set(entries.map((e) => e.data.key))];

  const urls: string[] = [];
  for (const locale of LOCALES) {
    for (const key of keys) {
      const hasLocale = entries.some((e) => e.data.key === key && e.data.locale === locale);
      if (locale === "en" || hasLocale) {
        const entry = entries.find((e) => e.data.key === key && e.data.locale === locale);
        const lastmod = entry?.data.updatedDate ?? entry?.data.pubDate ?? new Date();
        urls.push(
          `  <url>\n    <loc>${escapeXml(`${SITE}/${locale}/blog/${key}/`)}</loc>\n    <lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
        );
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
};
