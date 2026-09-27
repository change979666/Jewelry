// ---------------------------------------------------------------------------
//  V5.29 — Category-page Buyer FAQ (admin-managed)
//  Source of truth: src/data/category-faqs.json, edited in the admin CMS
//  (/admin/faqs → POST /api/admin/faqs → GitHub commit → CF Pages rebuild).
//  Replaces the old hardcoded `categories.*.faqs` arrays in i18n-content.ts,
//  which are kept only for backwards compatibility and no longer rendered.
// ---------------------------------------------------------------------------

import raw from "../data/category-faqs.json";
import type { Locale } from "../i18n";

export type FaqGroup = "product" | "wholesale" | "oem" | "shipping";

export interface CategoryFaqEntry {
  id: string;
  group: FaqGroup;
  priority: number;
  status: "active" | "hidden";
  q: Record<string, string>;
  a: Record<string, string>;
}

export const FAQ_GROUP_ORDER: FaqGroup[] = ["product", "wholesale", "oem", "shipping"];

export const FAQ_GROUP_LABELS: Record<string, Record<FaqGroup, string>> = {
  en: {
    product: "Product",
    wholesale: "Bulk & Wholesale",
    oem: "Private Label & OEM",
    shipping: "Shipping & Compliance",
  },
  es: {
    product: "Producto",
    wholesale: "Venta al por mayor",
    oem: "Marca privada y OEM",
    shipping: "Envío y cumplimiento",
  },
  de: {
    product: "Produkt",
    wholesale: "Großhandel",
    oem: "Private Label & OEM",
    shipping: "Versand & Compliance",
  },
};

/** Category → in-depth guide deep link (locale-safe: guides fall back to EN). */
export const CATEGORY_GUIDE: Record<string, string> = {
  "essential-oils": "essential-oil-grades-explained-for-buyers",
  "fragrance-oils": "fragrance-oil-vs-essential-oil-for-products",
  candles: "candle-wax-comparison-soy-coconut-paraffin",
  "reed-diffusers": "reed-diffuser-manufacturing",
  "home-fragrance": "reed-diffuser-vs-candle",
  packaging: "packaging-guide",
};

const doc = raw as { categories?: Record<string, CategoryFaqEntry[]> };

/** Active entries for a category, sorted by group order then priority. */
export function categoryFaqEntries(cat: string): CategoryFaqEntry[] {
  const list = (doc.categories?.[cat] ?? []).filter(
    (e) => e && e.status === "active" && e.q?.en && e.a?.en,
  );
  return [...list].sort((a, b) => {
    const ga = FAQ_GROUP_ORDER.indexOf(a.group);
    const gb = FAQ_GROUP_ORDER.indexOf(b.group);
    if (ga !== gb) return ga - gb;
    return (a.priority ?? 0) - (b.priority ?? 0);
  });
}

export interface FaqGroupView {
  group: FaqGroup;
  label: string;
  items: { id: string; q: string; a: string }[];
}

/** Grouped, localized view for rendering the on-page accordion. */
export function groupedCategoryFaqs(locale: Locale, cat: string): FaqGroupView[] {
  const entries = categoryFaqEntries(cat);
  const labels = FAQ_GROUP_LABELS[locale] ?? FAQ_GROUP_LABELS.en;
  return FAQ_GROUP_ORDER.map((g) => ({
    group: g,
    label: labels[g],
    items: entries
      .filter((e) => e.group === g)
      .map((e) => ({
        id: e.id,
        q: e.q?.[locale] || e.q?.en || "",
        a: e.a?.[locale] || e.a?.en || "",
      }))
      .filter((x) => x.q && x.a),
  })).filter((g) => g.items.length > 0);
}

/** Flat localized list — used for FAQPage JSON-LD. */
export function flatCategoryFaqs(locale: Locale, cat: string): { q: string; a: string }[] {
  return groupedCategoryFaqs(locale, cat).flatMap((g) =>
    g.items.map((item) => ({ q: item.q, a: item.a })),
  );
}
