// ---------------------------------------------------------------------------
//  Jewelry — Blog related-content resolution (blog ↔ guides cross-links)
//  V1.0: blog → product cross-links are retired with the old products content
//  collection (catalog now lives in D1); blog → guide and blog → blog links
//  are preserved here.
// ---------------------------------------------------------------------------

import { getCollection } from "astro:content";
import type { Locale } from "../i18n";

const FALLBACK_LOCALE: Locale = "en";

type GuideEntry = {
  id: string;
  data: {
    key: string;
    locale: string;
    title: string;
    excerpt: string;
    category: string;
    tags: string[];
    draft?: boolean;
  };
};

type BlogEntry = {
  id: string;
  data: {
    key: string;
    locale: string;
    title: string;
    excerpt: string;
    category: string;
    tags: string[];
    draft?: boolean;
    pubDate: Date;
  };
};

// Blog category → candidate guide categories. Unmapped blog categories simply
// produce no guide cross-links (relatedGuidesForBlog returns []), so this table
// only needs the categories the editorial team actually uses.
const BLOG_CAT_TO_GUIDE_CATS: Record<string, string[]> = {
  Gifting: ["Gifting", "Buying Guides"],
  Occasions: ["Gifting", "Occasions"],
  Styling: ["Styling", "Buying Guides"],
  "Care & Cleaning": ["Care & Cleaning", "Product Guides"],
  Sizing: ["Sizing", "Buying Guides"],
  Materials: ["Materials", "Product Guides"],
  "Buying Guides": ["Buying Guides", "Product Guides"],
  "Trends & Insights": ["Trends", "Styling"],
  Stories: ["Styling", "Gifting"],
};

async function loadGuides(locale: Locale): Promise<GuideEntry[]> {
  return (await getCollection(
    "guides",
    ({ data }) => !data.draft && (data.locale === locale || data.locale === FALLBACK_LOCALE),
  )) as GuideEntry[];
}

function indexByKey<T extends { data: { key: string; locale: string } }>(
  all: T[],
  locale: Locale,
): Map<string, T> {
  const byKey = new Map<string, T>();
  for (const g of all) if (g.data.locale === locale) byKey.set(g.data.key, g);
  if (locale !== FALLBACK_LOCALE) {
    for (const g of all) {
      if (g.data.locale === FALLBACK_LOCALE && !byKey.has(g.data.key)) byKey.set(g.data.key, g);
    }
  }
  return byKey;
}

/** Guides whose category maps to the given blog category (locale-aware, EN fallback). */
export async function relatedGuidesForBlog(
  locale: Locale,
  blogCat: string,
  limit = 3,
): Promise<GuideEntry[]> {
  const cats = BLOG_CAT_TO_GUIDE_CATS[blogCat] ?? [];
  if (cats.length === 0) return [];
  const all = await loadGuides(locale);
  const matched = all.filter((g) => cats.includes(g.data.category));
  return [...indexByKey(matched, locale).values()].slice(0, limit);
}

/** Resolve explicit guide keys (locale-aware, EN fallback). */
export async function resolveGuidesByKeys(
  locale: Locale,
  keys: string[],
  limit = 3,
): Promise<GuideEntry[]> {
  if (!Array.isArray(keys) || keys.length === 0) return [];
  const byKey = indexByKey(await loadGuides(locale), locale);
  return keys
    .map((k) => byKey.get(k))
    .filter(Boolean)
    .slice(0, limit) as GuideEntry[];
}

/** Resolve explicit blog post keys, excluding the current post (locale-aware, EN fallback). */
export async function resolvePostsByKeys(
  locale: Locale,
  keys: string[],
  selfKey: string,
  limit = 3,
): Promise<BlogEntry[]> {
  if (!Array.isArray(keys) || keys.length === 0) return [];
  const all = (await getCollection(
    "blog",
    ({ data }) => !data.draft && (data.locale === locale || data.locale === FALLBACK_LOCALE),
  )) as BlogEntry[];
  const byKey = indexByKey(all, locale);
  return keys
    .filter((k) => k !== selfKey)
    .map((k) => byKey.get(k))
    .filter(Boolean)
    .slice(0, limit) as BlogEntry[];
}
