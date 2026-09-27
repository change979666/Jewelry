// ---------------------------------------------------------------------------
//  Jewelry — Content Collections
//
//  Editorial / SEO content (blog posts and evergreen guides) is authored as
//  Markdown under src/content/. Each entry carries a `locale` (en | ar) and a
//  locale-agnostic `key` so the same piece of content can exist in both
//  languages and be linked via hreflang.
//
//  NOTE: Sellable products are NOT content collections in Jewelry. They live in
//  the D1-backed Commerce Core (Product / Variant / Collection). Only editorial
//  content (blog, guides) uses these collections.
//
//  File naming:
//    src/content/blog/<key>.<locale>.md     e.g. ramadan-gifting.en.md
//    src/content/guides/<key>.<locale>.md
// ---------------------------------------------------------------------------

import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    key: z.string(),
    locale: z.enum(["en", "ar"]),
    title: z.string(),
    excerpt: z.string(),
    category: z.string().default("Stories"),
    cover: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default("Jewelry Team"),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    keywords: z.array(z.string()).default([]),
  }),
});

// Evergreen editorial / buying guides (gifting, care, styling, sizing).
// `order` controls manual sorting on the hub; they are not dated news.
const guides = defineCollection({
  type: "content",
  schema: z.object({
    key: z.string(),
    locale: z.enum(["en", "ar"]),
    title: z.string(),
    excerpt: z.string(),
    category: z.string().default("Guides"),
    cover: z.string().optional(),
    pubDate: z.coerce.date(),
    author: z.string().default("Jewelry Team"),
    order: z.number().default(0),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    keywords: z.array(z.string()).default([]),
  }),
});

export const collections = { blog, guides };
