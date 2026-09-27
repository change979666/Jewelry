// ---------------------------------------------------------------------------
//  Jewelry — Global search index (build-time)
//  Emits a single static JSON file at /search-index.json. The client-side
//  search modal fetches it once and does full-text matching in the browser —
//  no server, no third-party service.
//
//  SCOPE (V1.0): blog posts + guides. The product catalog lives in D1 and is
//  not available at static build time; catalog search is served by
//  /api/commerce/products and is a separate surface (see docs/01-项目说明.md).
//
//  Entry shape:
//    { type, title, excerpt, url, extra, cover?, read?, year? }
// ---------------------------------------------------------------------------

import { getCollection } from "astro:content";
import { localizedUrl, LOCALE_LIST, type Locale } from "../i18n";

export const prerender = true;

interface SearchEntry {
  type: "post" | "guide";
  title: string;
  excerpt: string;
  url: string;
  extra: string;
  cover?: string;
  read?: number;
  year?: number;
}

/** Rough reading time in minutes (200 wpm, min 1). */
function readingMinutes(body: string | undefined): number {
  const words = (body ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// Every page (including the default locale) lives under a /{locale} segment, so
// the prefix is always required — see localizedUrl in src/i18n.ts.
function urlFor(locale: Locale, section: string, key: string): string {
  return localizedUrl(locale, `/${section}/${key}`);
}

export async function GET() {
  const [posts, guides] = await Promise.all([
    getCollection("blog", ({ data }) => !data.draft),
    getCollection("guides", ({ data }) => !data.draft),
  ]);

  const index: Record<string, SearchEntry[]> = {};
  for (const locale of LOCALE_LIST) {
    const entries: SearchEntry[] = [];

    for (const p of posts) {
      if (p.data.locale !== locale) continue;
      entries.push({
        type: "post",
        title: p.data.title,
        excerpt: p.data.seoDescription ?? "",
        url: urlFor(locale, "blog", p.data.key),
        extra: [p.data.category, ...(p.data.tags ?? [])].filter(Boolean).join(" "),
        read: readingMinutes(p.body),
        year: p.data.pubDate.getFullYear(),
      });
    }

    for (const g of guides) {
      if (g.data.locale !== locale) continue;
      entries.push({
        type: "guide",
        title: g.data.title,
        excerpt: g.data.excerpt,
        url: urlFor(locale, "resources", g.data.key),
        extra: g.data.category ?? "",
      });
    }

    index[locale] = entries;
  }

  return new Response(JSON.stringify(index), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
