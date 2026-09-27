/**
 * Topic Cluster — cross-linking mappings between guides, products and solutions.
 *
 * Guides carry a free-text `category` + `tags[]`; products carry a category
 * enum slug; solutions are keyed by slug. This module bridges the three
 * taxonomies so every page family can surface relevant internal links.
 */
import { getCollection } from "astro:content";
import type { Locale } from "../i18n";

const FALLBACK_LOCALE: Locale = "en";

/* ─── Guide category (display string) → product category slug ─────────────── */

const GUIDE_CAT_TO_PRODUCT_CAT: Record<string, string> = {
  Candles: "candles",
  "Essential Oils": "essential-oils",
  "Fragrance Oils": "fragrance-oils",
  Diffusers: "reed-diffusers",
  Packaging: "packaging",
  "Packaging & Design": "packaging",
  Products: "home-fragrance",
  Market: "home-fragrance",
  "E-commerce": "candles",
  Solutions: "essential-oils",
};

/* ─── Product category slug → guide categories to surface ─────────────────── */

const PRODUCT_CAT_TO_GUIDE_CATS: Record<string, string[]> = {
  "essential-oils": ["Essential Oils", "Compliance"],
  "fragrance-oils": ["Fragrance Oils", "OEM"],
  "reed-diffusers": ["Diffusers", "Products"],
  candles: ["Candles", "E-commerce"],
  "home-fragrance": ["Products", "Market"],
  packaging: ["Packaging & Design", "Packaging"],
};

/* ─── Solution slug → related guide keys + product categories ─────────────── */

export const SOLUTION_LINKS: Record<string, { guides: string[]; cats: string[] }> = {
  hotels: {
    guides: ["hotel-amenities-guide", "essential-oil-buying-guide", "gift-set-guide"],
    cats: ["essential-oils", "reed-diffusers", "home-fragrance"],
  },
  "spa-wellness": {
    guides: ["essential-oil-buying-guide", "essential-oil-storage", "candle-wax-selection"],
    cats: ["essential-oils", "candles"],
  },
  retail: {
    guides: ["gift-set-guide", "product-photography", "seasonal-collections"],
    cats: ["candles", "home-fragrance"],
  },
  "amazon-sellers": {
    guides: ["amazon-fba-candles", "product-photography", "shipping-from-china"],
    cats: ["candles", "reed-diffusers"],
  },
  supermarkets: {
    guides: ["wholesale-pricing-guide", "gift-set-guide", "clp-labelling-guide"],
    cats: ["candles", "home-fragrance"],
  },
  "brand-owners": {
    guides: ["oem-guide", "private-label-starter", "custom-fragrance-development"],
    cats: ["fragrance-oils", "essential-oils", "packaging"],
  },
  wholesalers: {
    guides: ["wholesale-pricing-guide", "moq-guide", "shipping-from-china"],
    cats: ["candles", "reed-diffusers", "fragrance-oils"],
  },
  distributors: {
    guides: ["wholesale-pricing-guide", "import-guide", "shipping-from-china"],
    cats: ["fragrance-oils", "packaging"],
  },
};

/* ─── Query helpers ────────────────────────────────────────────────────────── */

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
type ProductEntry = {
  id: string;
  data: {
    key: string;
    locale: string;
    title: string;
    excerpt: string;
    category: string;
    moq?: string;
    cover?: string;
    featured?: boolean;
    draft?: boolean;
  };
};

/** Guides whose category maps to the given product category (locale-aware, EN fallback). */
export async function relatedGuidesForProduct(
  locale: Locale,
  productCat: string,
  limit = 3,
): Promise<GuideEntry[]> {
  const cats = PRODUCT_CAT_TO_GUIDE_CATS[productCat] ?? [];
  if (cats.length === 0) return [];
  const all = (await getCollection(
    "guides",
    ({ data }) => !data.draft && (data.locale === locale || data.locale === FALLBACK_LOCALE),
  )) as GuideEntry[];
  const byKey = new Map<string, GuideEntry>();
  for (const g of all) {
    if (!cats.includes(g.data.category)) continue;
    if (g.data.locale === locale) byKey.set(g.data.key, g);
  }
  if (locale !== FALLBACK_LOCALE) {
    for (const g of all) {
      if (!cats.includes(g.data.category)) continue;
      if (g.data.locale === FALLBACK_LOCALE && !byKey.has(g.data.key)) byKey.set(g.data.key, g);
    }
  }
  return [...byKey.values()].slice(0, limit);
}

/** Products matching a guide's category (locale-aware, EN fallback). General guide categories fall back to featured products. */
export async function relatedProductsForGuide(
  locale: Locale,
  guideCat: string,
  limit = 4,
): Promise<ProductEntry[]> {
  const cat = GUIDE_CAT_TO_PRODUCT_CAT[guideCat] ?? null;
  const all = (await getCollection(
    "products",
    ({ data }) => !data.draft && (data.locale === locale || data.locale === FALLBACK_LOCALE),
  )) as ProductEntry[];
  const byKey = new Map<string, ProductEntry>();
  for (const p of all) {
    if (cat && p.data.category !== cat) continue;
    if (p.data.locale === locale) byKey.set(p.data.key, p);
  }
  if (locale !== FALLBACK_LOCALE) {
    for (const p of all) {
      if (cat && p.data.category !== cat) continue;
      if (p.data.locale === FALLBACK_LOCALE && !byKey.has(p.data.key)) byKey.set(p.data.key, p);
    }
  }
  return [...byKey.values()]
    .sort((a, b) => Number(b.data.featured ?? false) - Number(a.data.featured ?? false))
    .slice(0, limit);
}

/** Guides for a solution page by explicit key mapping (locale-aware, EN fallback). */
export async function relatedGuidesForSolution(
  locale: Locale,
  solutionSlug: string,
): Promise<GuideEntry[]> {
  const keys = SOLUTION_LINKS[solutionSlug]?.guides ?? [];
  if (keys.length === 0) return [];
  const all = (await getCollection(
    "guides",
    ({ data }) => !data.draft && (data.locale === locale || data.locale === FALLBACK_LOCALE),
  )) as GuideEntry[];
  const byKey = new Map<string, GuideEntry>();
  for (const g of all) {
    if (!keys.includes(g.data.key)) continue;
    if (g.data.locale === locale) byKey.set(g.data.key, g);
  }
  if (locale !== FALLBACK_LOCALE) {
    for (const g of all) {
      if (!keys.includes(g.data.key)) continue;
      if (g.data.locale === FALLBACK_LOCALE && !byKey.has(g.data.key)) byKey.set(g.data.key, g);
    }
  }
  // Preserve SOLUTION_LINKS order
  return keys.map((k) => byKey.get(k)).filter(Boolean) as GuideEntry[];
}

/** Real products for a solution page from mapped categories (locale-aware, EN fallback). */
export async function relatedProductsForSolution(
  locale: Locale,
  solutionSlug: string,
  limit = 3,
): Promise<ProductEntry[]> {
  const cats = SOLUTION_LINKS[solutionSlug]?.cats ?? [];
  if (cats.length === 0) return [];
  const all = (await getCollection(
    "products",
    ({ data }) => !data.draft && (data.locale === locale || data.locale === FALLBACK_LOCALE),
  )) as ProductEntry[];
  const byKey = new Map<string, ProductEntry>();
  for (const p of all) {
    if (!cats.includes(p.data.category)) continue;
    if (p.data.locale === locale) byKey.set(p.data.key, p);
  }
  if (locale !== FALLBACK_LOCALE) {
    for (const p of all) {
      if (!cats.includes(p.data.category)) continue;
      if (p.data.locale === FALLBACK_LOCALE && !byKey.has(p.data.key)) byKey.set(p.data.key, p);
    }
  }
  return [...byKey.values()]
    .sort((a, b) => Number(b.data.featured ?? false) - Number(a.data.featured ?? false))
    .slice(0, limit);
}

/** Same-category guides first, then others — for the "other guides" section on guide pages. */
export async function otherGuidesPrioritized(
  locale: Locale,
  currentKey: string,
  currentCat: string,
  limit = 3,
): Promise<GuideEntry[]> {
  const all = (await getCollection(
    "guides",
    ({ data }) => !data.draft && (data.locale === locale || data.locale === FALLBACK_LOCALE),
  )) as GuideEntry[];
  const byKey = new Map<string, GuideEntry>();
  for (const g of all) {
    if (g.data.key === currentKey) continue;
    if (g.data.locale === locale) byKey.set(g.data.key, g);
  }
  if (locale !== FALLBACK_LOCALE) {
    for (const g of all) {
      if (g.data.key === currentKey) continue;
      if (g.data.locale === FALLBACK_LOCALE && !byKey.has(g.data.key)) byKey.set(g.data.key, g);
    }
  }
  const list = [...byKey.values()];
  const same = list.filter((g) => g.data.category === currentCat);
  const rest = list.filter((g) => g.data.category !== currentCat);
  return [...same, ...rest].slice(0, limit);
}

/* ─── Blog category → product/guide cross-links ───────────────────────────── */

const BLOG_CAT_TO_PRODUCT_CATS: Record<string, string[]> = {
  "Sourcing & Procurement": ["candles", "reed-diffusers", "essential-oils", "fragrance-oils"],
  "Buying Guides": ["candles", "reed-diffusers", "essential-oils", "fragrance-oils", "packaging"],
  "Product Comparisons": ["candles", "reed-diffusers", "essential-oils"],
  "Market Guides": ["home-fragrance", "candles", "reed-diffusers"],
  "Shipping & Logistics": ["candles", "reed-diffusers", "essential-oils"],
  "Industry Applications": ["home-fragrance", "reed-diffusers", "essential-oils"],
  "Compliance & Safety": ["essential-oils", "fragrance-oils", "candles"],
  "Cost & Pricing": ["candles", "reed-diffusers", "fragrance-oils"],
  "Brand Building": ["home-fragrance", "candles", "packaging"],
  "Trends & Insights": ["home-fragrance", "candles", "reed-diffusers"],
  "Buyer FAQ": ["candles", "reed-diffusers", "essential-oils"],
  "Product Knowledge": [
    "candles",
    "reed-diffusers",
    "essential-oils",
    "fragrance-oils",
    "packaging",
  ],
};

const BLOG_CAT_TO_GUIDE_CATS: Record<string, string[]> = {
  "Sourcing & Procurement": [
    "Business Operations",
    "Market Entry",
    "Import & Logistics",
    "Logistics",
  ],
  "Buying Guides": ["Product Guides", "Candles", "Essential Oils", "Fragrance Oils", "Diffusers"],
  "Product Comparisons": ["Product Guides", "Formulation"],
  "Market Guides": ["Market Entry", "E-commerce", "Marketing & Sales"],
  "Shipping & Logistics": ["Import & Logistics", "Logistics", "Business Operations"],
  "Industry Applications": ["Industry Verticals", "Marketing & Sales"],
  "Compliance & Safety": ["Compliance", "Quality"],
  "Cost & Pricing": ["Pricing & MOQ", "Business Operations", "Business"],
  "Brand Building": ["Marketing & Sales", "Marketing", "E-commerce"],
  "Trends & Insights": ["Trends & Innovation", "Sustainability"],
  "Buyer FAQ": ["Product Guides", "OEM", "OEM & ODM"],
  "Product Knowledge": [
    "Product Guides",
    "Candles",
    "Essential Oils",
    "Fragrance Oils",
    "Diffusers",
    "Formulation",
  ],
};

/** Products relevant to a blog post's category (locale-aware, EN fallback, featured-first). */
export async function relatedProductsForBlog(
  locale: Locale,
  blogCat: string,
  limit = 3,
): Promise<ProductEntry[]> {
  const cats = BLOG_CAT_TO_PRODUCT_CATS[blogCat] ?? [];
  const all = (await getCollection(
    "products",
    ({ data }) => !data.draft && (data.locale === locale || data.locale === FALLBACK_LOCALE),
  )) as ProductEntry[];
  const byKey = new Map<string, ProductEntry>();
  for (const p of all) {
    if (cats.length > 0 && !cats.includes(p.data.category)) continue;
    if (p.data.locale === locale) byKey.set(p.data.key, p);
  }
  if (locale !== FALLBACK_LOCALE) {
    for (const p of all) {
      if (cats.length > 0 && !cats.includes(p.data.category)) continue;
      if (p.data.locale === FALLBACK_LOCALE && !byKey.has(p.data.key)) byKey.set(p.data.key, p);
    }
  }
  return [...byKey.values()]
    .sort((a, b) => Number(b.data.featured ?? false) - Number(a.data.featured ?? false))
    .slice(0, limit);
}

/** Guides relevant to a blog post's category (locale-aware, EN fallback). */
export async function relatedGuidesForBlog(
  locale: Locale,
  blogCat: string,
  limit = 3,
): Promise<GuideEntry[]> {
  const cats = BLOG_CAT_TO_GUIDE_CATS[blogCat] ?? [];
  if (cats.length === 0) return [];
  const all = (await getCollection(
    "guides",
    ({ data }) => !data.draft && (data.locale === locale || data.locale === FALLBACK_LOCALE),
  )) as GuideEntry[];
  const byKey = new Map<string, GuideEntry>();
  for (const g of all) {
    if (!cats.includes(g.data.category)) continue;
    if (g.data.locale === locale) byKey.set(g.data.key, g);
  }
  if (locale !== FALLBACK_LOCALE) {
    for (const g of all) {
      if (!cats.includes(g.data.category)) continue;
      if (g.data.locale === FALLBACK_LOCALE && !byKey.has(g.data.key)) byKey.set(g.data.key, g);
    }
  }
  return [...byKey.values()].slice(0, limit);
}

/* ─── D4: explicit key-based resolvers (AI slug hints → real entries) ──────── */
//
// Content-factory drafts may carry author/AI-suggested `relatedProducts` /
// `relatedGuides` / `relatedPosts` slug hints. These are UNTRUSTED: we validate
// each against real, non-draft collection entries at build time and silently
// drop anything that doesn't resolve (404-safe), preserving the given order and
// falling back to the requested locale's EN counterpart.

type BlogEntry = {
  id: string;
  data: {
    key: string;
    locale: string;
    title: string;
    excerpt: string;
    category: string;
    pubDate: Date;
    draft?: boolean;
  };
};

/** Resolve product slug hints to real entries, in order, dropping unknowns. */
export async function resolveProductsByKeys(
  locale: Locale,
  keys: string[],
  limit = 3,
): Promise<ProductEntry[]> {
  if (!Array.isArray(keys) || keys.length === 0) return [];
  const all = (await getCollection(
    "products",
    ({ data }) => !data.draft && (data.locale === locale || data.locale === FALLBACK_LOCALE),
  )) as ProductEntry[];
  const byKey = new Map<string, ProductEntry>();
  for (const p of all) if (p.data.locale === locale) byKey.set(p.data.key, p);
  if (locale !== FALLBACK_LOCALE) {
    for (const p of all) {
      if (p.data.locale === FALLBACK_LOCALE && !byKey.has(p.data.key)) byKey.set(p.data.key, p);
    }
  }
  return keys
    .map((k) => byKey.get(k))
    .filter(Boolean)
    .slice(0, limit) as ProductEntry[];
}

/** Resolve guide slug hints to real entries, in order, dropping unknowns. */
export async function resolveGuidesByKeys(
  locale: Locale,
  keys: string[],
  limit = 3,
): Promise<GuideEntry[]> {
  if (!Array.isArray(keys) || keys.length === 0) return [];
  const all = (await getCollection(
    "guides",
    ({ data }) => !data.draft && (data.locale === locale || data.locale === FALLBACK_LOCALE),
  )) as GuideEntry[];
  const byKey = new Map<string, GuideEntry>();
  for (const g of all) if (g.data.locale === locale) byKey.set(g.data.key, g);
  if (locale !== FALLBACK_LOCALE) {
    for (const g of all) {
      if (g.data.locale === FALLBACK_LOCALE && !byKey.has(g.data.key)) byKey.set(g.data.key, g);
    }
  }
  return keys
    .map((k) => byKey.get(k))
    .filter(Boolean)
    .slice(0, limit) as GuideEntry[];
}

/** Resolve blog-post slug hints to real entries, in order, dropping unknowns and self. */
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
  const byKey = new Map<string, BlogEntry>();
  for (const p of all) if (p.data.locale === locale) byKey.set(p.data.key, p);
  if (locale !== FALLBACK_LOCALE) {
    for (const p of all) {
      if (p.data.locale === FALLBACK_LOCALE && !byKey.has(p.data.key)) byKey.set(p.data.key, p);
    }
  }
  return keys
    .filter((k) => k !== selfKey)
    .map((k) => byKey.get(k))
    .filter(Boolean)
    .slice(0, limit) as BlogEntry[];
}
