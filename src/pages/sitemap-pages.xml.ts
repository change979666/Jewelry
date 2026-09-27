/**
 * sitemap-pages.xml — static pages, solutions, countries, case studies, shop, blog/resources index.
 */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { COUNTRY_SLUGS } from "../i18n-content";

const SITE = "https://aromiso.com";
const LOCALES = ["en", "es", "de"];

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

  // Static pages per locale
  const staticPages = [
    { path: "", p: "1.0" },
    { path: "/about", p: "0.7" },
    { path: "/contact", p: "0.8" },
    { path: "/products", p: "0.9" },
    { path: "/blog", p: "0.8" },
    { path: "/resources", p: "0.8" },
    { path: "/solutions", p: "0.8" },
    { path: "/export", p: "0.7" },
    { path: "/case-studies", p: "0.7" },
    { path: "/videos", p: "0.7" },
    { path: "/shop", p: "0.8" },
    { path: "/compare", p: "0.6" },
    { path: "/oem", p: "0.8" },
    { path: "/sourcing", p: "0.8" },
  ];

  for (const locale of LOCALES) {
    for (const pg of staticPages) {
      push(`/${locale}${pg.path}/`, pg.p);
    }
  }

  // Solution pages
  const solutions = [
    "hotels",
    "spa-wellness",
    "retail",
    "amazon-sellers",
    "supermarkets",
    "brand-owners",
    "wholesalers",
    "distributors",
  ];
  for (const locale of LOCALES) {
    for (const s of solutions) {
      push(`/${locale}/solutions/${s}/`, "0.7");
    }
  }

  // Export market pages (consolidated from legacy /countries/)
  for (const locale of LOCALES) {
    for (const c of COUNTRY_SLUGS) {
      push(`/${locale}/export/${c}/`, "0.6", "monthly");
    }
  }

  // Case studies
  const cases = await getCollection("caseStudies", ({ data }) => !data.draft);
  const caseKeys = [...new Set(cases.map((e) => e.data.key))];
  for (const locale of LOCALES) {
    for (const key of caseKeys) {
      const hasLocale = cases.some((e) => e.data.key === key && e.data.locale === locale);
      if (locale === "en" || hasLocale) {
        push(`/${locale}/case-studies/${key}/`, "0.6", "monthly");
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
};
