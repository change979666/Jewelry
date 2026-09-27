// ---------------------------------------------------------------------------
//  Jewelry — site constants & navigation
//
//  Brand identity is intentionally kept configurable. The final brand name and
//  domain are set here / in src/data/settings.json; do not hardcode the brand
//  across components. (See 项目复制说明.txt §40.)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
//  Production origin — SINGLE SOURCE OF TRUTH.
//
//  Canonical URLs, hreflang alternates, JSON-LD, sitemap-*.xml and robots.txt
//  all derive from `SITE.url` below. Set it in exactly one place:
//    • Cloudflare Pages → Settings → Environment variables → PUBLIC_SITE_URL
//      (build-time variable; applies to production and preview builds), or
//    • the `DEFAULT_SITE_URL` constant underneath.
//  `astro.config.mjs` reads the same variable via process.env so `Astro.site`
//  stays in sync. Do NOT reintroduce a second hardcoded copy elsewhere.
// ---------------------------------------------------------------------------
const DEFAULT_SITE_URL = "https://example.com"; // TODO: replace before launch
const SITE_URL = (
  (import.meta.env.PUBLIC_SITE_URL as string | undefined) || DEFAULT_SITE_URL
).replace(/\/+$/, "");

// Support mailbox — also overridable at runtime via src/data/settings.json
// (admin-editable → SITE_CFG.email). This default is the build-time fallback.
const DEFAULT_SUPPORT_EMAIL = "support@example.com"; // TODO: replace before launch
const SUPPORT_EMAIL =
  (import.meta.env.PUBLIC_SUPPORT_EMAIL as string | undefined) || DEFAULT_SUPPORT_EMAIL;

export const SITE = {
  // TODO: replace with the finalized brand name (and Arabic name) once set.
  name: "Jewelry",
  tagline: "Everyday fine jewelry, designed for the Gulf.",
  description:
    "Modern everyday jewelry for women in KSA and the UAE — earrings, necklaces, bracelets and gift sets with cash on delivery and easy returns.",
  url: SITE_URL,
  email: SUPPORT_EMAIL,
  whatsapp: "",
  address: "",
  hours: "",
  lang: "en",
} as const;

// ---------------------------------------------------------------------------
//  Editable site config — values from src/data/settings.json (managed in the
//  admin CMS) overlay the hardcoded defaults above. The frontend reads
//  SITE_CFG / PAGE so admin edits take effect after a rebuild.
// ---------------------------------------------------------------------------
import settings from "./data/settings.json";

const pick = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.trim() !== "" ? v : fallback;

const s = (settings.site ?? {}) as Record<string, string>;

export const SITE_CFG = {
  ...SITE,
  name: pick(s.name, SITE.name),
  tagline: pick(s.tagline, SITE.tagline),
  email: pick(s.email, SITE.email),
  whatsapp: pick(s.whatsapp, SITE.whatsapp),
  address: pick(s.address, SITE.address),
  hours: pick(s.hours, SITE.hours),
} as const;

const p = (settings.page ?? {}) as {
  heroImage?: string;
  stats?: { num: string; label: string }[];
};

export const PAGE = {
  // Placeholder until the designed homepage (spec §27) and hero asset are built.
  heroImage: pick(p.heroImage, "/images/hero.jpg"),
  stats: Array.isArray(p.stats) && p.stats.length ? p.stats : undefined,
} as const;

export interface NavChild {
  labelKey: string;
  href: string;
}
export interface NavItem {
  key: string;
  label: string;
  href?: string;
  children?: NavChild[];
  /** Number of columns for the desktop dropdown panel (default 1). */
  columns?: number;
}

// Consumer-facing navigation.
// Every href must resolve to a real route under src/pages/[lang]/:
//   /collection/<slug>  → collection/[slug].astro (slugs seeded in migrations/0001 + 0008)
//   /blog, /about, /faq, /contact, /cart
// There is intentionally no "/shop" route in V1.0 — collections are the storefront.
export const NAV: NavItem[] = [
  {
    key: "collections",
    label: "Collections",
    href: "/collection/everyday",
    columns: 2,
    children: [
      { labelKey: "nav.new_arrivals", href: "/collection/new-arrivals" },
      { labelKey: "nav.best_sellers", href: "/collection/best-sellers" },
      { labelKey: "nav.everyday", href: "/collection/everyday" },
      { labelKey: "nav.gulf", href: "/collection/gulf-design" },
      { labelKey: "nav.gift", href: "/collection/gift" },
      { labelKey: "nav.statement", href: "/collection/statement" },
      { labelKey: "nav.gold", href: "/collection/gold" },
      { labelKey: "nav.silver", href: "/collection/silver" },
      { labelKey: "nav.pearls", href: "/collection/pearls" },
    ],
  },
  { key: "journal", label: "Journal", href: "/blog" },
  {
    key: "about",
    label: "About",
    href: "/about",
    children: [
      { labelKey: "nav.about_company", href: "/about" },
      { labelKey: "nav.about_faq", href: "/faq" },
      { labelKey: "nav.about_contact", href: "/contact" },
    ],
  },
  { key: "contact", label: "Contact", href: "/contact" },
  { key: "cart", label: "Cart", href: "/cart" },
];
