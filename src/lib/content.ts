// ---------------------------------------------------------------------------
//  Jewelry — Content access layer
//  Thin wrappers over Astro's getCollection for blog & guides, scoped by
//  locale. Used by list + detail pages. Cross-locale `key` lets detail pages
//  build hreflang alternates. (The products / caseStudies content collections
//  were retired in V1.0 — the catalog now lives in D1, see src/lib/commerce.)
// ---------------------------------------------------------------------------

import { getCollection, type CollectionEntry } from "astro:content";
import type { Locale } from "../i18n";

export type BlogEntry = CollectionEntry<"blog">;
export type GuideEntry = CollectionEntry<"guides">;

/** Locale used as a fallback when a translation is missing. */
export const FALLBACK_LOCALE: Locale = "en";

/** All published blog posts for a locale, newest first.
 *  For non-fallback locales, keys without a translation are filled in with the
 *  English entry so listing pages never look sparse. */
export async function getBlogPosts(
  locale: Locale,
  opts: { includeDrafts?: boolean } = {},
): Promise<BlogEntry[]> {
  const all = await getCollection("blog", ({ data }) => {
    if (!opts.includeDrafts && data.draft) return false;
    return data.locale === locale || data.locale === FALLBACK_LOCALE;
  });
  const byKey = new Map<string, BlogEntry>();
  // Prefer the requested locale; only fill missing keys from the fallback.
  for (const e of all) {
    if (e.data.locale === locale) byKey.set(e.data.key, e);
  }
  if (locale !== FALLBACK_LOCALE) {
    for (const e of all) {
      if (e.data.locale === FALLBACK_LOCALE && !byKey.has(e.data.key)) byKey.set(e.data.key, e);
    }
  }
  return [...byKey.values()].sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

/** A single blog post by locale + key, or undefined. */
export async function getBlogPost(
  locale: Locale,
  key: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<BlogEntry | undefined> {
  const all = await getCollection("blog", ({ data }) => {
    if (data.locale !== locale) return false;
    if (data.key !== key) return false;
    if (!opts.includeDrafts && data.draft) return false;
    return true;
  });
  return all[0];
}

/** A single blog post with English fallback. `isFallback` is true when the
 *  requested locale had no translation and English is being served instead. */
export async function getBlogEntryResolved(
  locale: Locale,
  key: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<{ entry: BlogEntry; isFallback: boolean } | undefined> {
  const primary = await getBlogPost(locale, key, opts);
  if (primary) return { entry: primary, isFallback: false };
  if (locale === FALLBACK_LOCALE) return undefined;
  const fb = await getBlogPost(FALLBACK_LOCALE, key, opts);
  return fb ? { entry: fb, isFallback: true } : undefined;
}

/** All published guides for a locale, sorted by manual `order` (lower first).
 *  Missing keys fall back to the English entry, like getBlogPosts. */
export async function getGuides(
  locale: Locale,
  opts: { includeDrafts?: boolean } = {},
): Promise<GuideEntry[]> {
  const all = await getCollection("guides", ({ data }) => {
    if (!opts.includeDrafts && data.draft) return false;
    return data.locale === locale || data.locale === FALLBACK_LOCALE;
  });
  const byKey = new Map<string, GuideEntry>();
  for (const e of all) {
    if (e.data.locale === locale) byKey.set(e.data.key, e);
  }
  if (locale !== FALLBACK_LOCALE) {
    for (const e of all) {
      if (e.data.locale === FALLBACK_LOCALE && !byKey.has(e.data.key)) byKey.set(e.data.key, e);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => a.data.order - b.data.order || a.data.pubDate.getTime() - b.data.pubDate.getTime(),
  );
}

/** A single guide by locale + key, or undefined. */
export async function getGuide(
  locale: Locale,
  key: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<GuideEntry | undefined> {
  const all = await getCollection("guides", ({ data }) => {
    if (data.locale !== locale) return false;
    if (data.key !== key) return false;
    if (!opts.includeDrafts && data.draft) return false;
    return true;
  });
  return all[0];
}

/**
 * Per-locale alternate URLs for a detail page, for hreflang tags.
 * `base` is the path WITHOUT locale, e.g. "/blog/verify-factory".
 */
export function alternatesFor(key: string, base: string): { lang: Locale; href: string }[] {
  void key;
  return (["en", "ar"] as Locale[]).map((lang) => ({
    lang,
    href: lang === "en" ? base : `/${lang}${base}`,
  }));
}
