// ---------------------------------------------------------------------------
//  Aromiso — Content access layer
//  Thin wrappers over Astro's getCollection for blog & products, scoped by
//  locale. Used by list + detail pages. Cross-locale `key` lets detail pages
//  build hreflang alternates.
// ---------------------------------------------------------------------------

import { getCollection, type CollectionEntry } from "astro:content";
import type { Locale } from "../i18n";

export type BlogEntry = CollectionEntry<"blog">;
export type ProductEntry = CollectionEntry<"products">;
export type GuideEntry = CollectionEntry<"guides">;
export type CaseStudyEntry = CollectionEntry<"caseStudies">;

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

/** All published products for a locale (featured first).
 *  Missing keys fall back to the English entry, like getBlogPosts. */
export async function getProducts(
  locale: Locale,
  opts: { includeDrafts?: boolean } = {},
): Promise<ProductEntry[]> {
  const all = await getCollection("products", ({ data }) => {
    if (!opts.includeDrafts && data.draft) return false;
    return data.locale === locale || data.locale === FALLBACK_LOCALE;
  });
  const byKey = new Map<string, ProductEntry>();
  for (const e of all) {
    if (e.data.locale === locale) byKey.set(e.data.key, e);
  }
  if (locale !== FALLBACK_LOCALE) {
    for (const e of all) {
      if (e.data.locale === FALLBACK_LOCALE && !byKey.has(e.data.key)) byKey.set(e.data.key, e);
    }
  }
  return [...byKey.values()].sort((a, b) => Number(b.data.featured) - Number(a.data.featured));
}

/** A single product by locale + key, or undefined. */
export async function getProduct(
  locale: Locale,
  key: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<ProductEntry | undefined> {
  const all = await getCollection("products", ({ data }) => {
    if (data.locale !== locale) return false;
    if (data.key !== key) return false;
    if (!opts.includeDrafts && data.draft) return false;
    return true;
  });
  return all[0];
}

/** A single product with English fallback. */
export async function getProductEntryResolved(
  locale: Locale,
  key: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<{ entry: ProductEntry; isFallback: boolean } | undefined> {
  const primary = await getProduct(locale, key, opts);
  if (primary) return { entry: primary, isFallback: false };
  if (locale === FALLBACK_LOCALE) return undefined;
  const fb = await getProduct(FALLBACK_LOCALE, key, opts);
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

/** A single guide with English fallback. */
export async function getGuideEntryResolved(
  locale: Locale,
  key: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<{ entry: GuideEntry; isFallback: boolean } | undefined> {
  const primary = await getGuide(locale, key, opts);
  if (primary) return { entry: primary, isFallback: false };
  if (locale === FALLBACK_LOCALE) return undefined;
  const fb = await getGuide(FALLBACK_LOCALE, key, opts);
  return fb ? { entry: fb, isFallback: true } : undefined;
}

/**
 * Per-locale alternate URLs for a detail page, for hreflang tags.
 * `base` is the path WITHOUT locale, e.g. "/blog/verify-factory".
 */
export function alternatesFor(key: string, base: string): { lang: Locale; href: string }[] {
  return (["en", "es", "de"] as Locale[]).map((lang) => ({
    lang,
    href: lang === "en" ? base : `/${lang}${base}`,
  }));
}

// ---------------------------------------------------------------------------
//  Case Studies
// ---------------------------------------------------------------------------

/** All published case studies for a locale, sorted by `order` then date.
 *  Missing keys fall back to the English entry. */
export async function getCaseStudies(
  locale: Locale,
  opts: { includeDrafts?: boolean } = {},
): Promise<CaseStudyEntry[]> {
  const all = await getCollection("caseStudies", ({ data }) => {
    if (!opts.includeDrafts && data.draft) return false;
    return data.locale === locale || data.locale === FALLBACK_LOCALE;
  });
  const byKey = new Map<string, CaseStudyEntry>();
  for (const e of all) {
    if (e.data.locale === locale) byKey.set(e.data.key, e);
  }
  if (locale !== FALLBACK_LOCALE) {
    for (const e of all) {
      if (e.data.locale === FALLBACK_LOCALE && !byKey.has(e.data.key)) byKey.set(e.data.key, e);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => a.data.order - b.data.order || b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  );
}

/** A single case study by locale + key, or undefined. */
export async function getCaseStudy(
  locale: Locale,
  key: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<CaseStudyEntry | undefined> {
  const all = await getCollection("caseStudies", ({ data }) => {
    if (data.locale !== locale) return false;
    if (data.key !== key) return false;
    if (!opts.includeDrafts && data.draft) return false;
    return true;
  });
  return all[0];
}

/** A single case study with English fallback. */
export async function getCaseStudyEntryResolved(
  locale: Locale,
  key: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<{ entry: CaseStudyEntry; isFallback: boolean } | undefined> {
  const primary = await getCaseStudy(locale, key, opts);
  if (primary) return { entry: primary, isFallback: false };
  if (locale === FALLBACK_LOCALE) return undefined;
  const fb = await getCaseStudy(FALLBACK_LOCALE, key, opts);
  return fb ? { entry: fb, isFallback: true } : undefined;
}
