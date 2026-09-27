// ---------------------------------------------------------------------------
//  Jewelry — Global search index (build-time)
//  Emits a single static JSON file at /search-index.json. The client-side
//  search modal fetches it once and does full-text matching in the browser —
//  no server, no third-party service.
//
//  PLACEHOLDER (V1.0): the catalog and content are not built yet, so each
//  locale emits an empty list. In the Commerce/Content phase, populate it
//  with products (from D1), blog posts and FAQ items.
//
//  Entry shape:
//    { type, title, excerpt, url, extra, cover?, price?, read?, year? }
// ---------------------------------------------------------------------------

import type { Locale } from "../i18n";

export const prerender = true;

const LOCALES: Locale[] = ["en", "ar"];

interface SearchEntry {
  type: "product" | "post" | "faq";
  title: string;
  excerpt: string;
  url: string;
  extra: string;
  cover?: string;
  read?: number;
  year?: number;
}

export async function GET() {
  const index: Record<string, SearchEntry[]> = {};
  for (const locale of LOCALES) {
    // TODO(commerce/content): products from D1, blog posts, FAQ items.
    index[locale] = [];
  }

  return new Response(JSON.stringify(index), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
