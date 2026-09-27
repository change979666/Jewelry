// ---------------------------------------------------------------------------
//  Jewelry — site constants & navigation
//
//  Brand identity is intentionally kept configurable. The final brand name and
//  domain are set here / in src/data/settings.json; do not hardcode the brand
//  across components. (See 项目复制说明.txt §40.)
// ---------------------------------------------------------------------------

export const SITE = {
  // TODO: replace with the finalized brand name (and Arabic name) once set.
  name: "Jewelry",
  tagline: "Everyday fine jewelry, designed for the Gulf.",
  description:
    "Modern everyday jewelry for women in KSA and the UAE — earrings, necklaces, bracelets and gift sets with cash on delivery and easy returns.",
  // TODO: replace with the purchased production domain.
  url: "https://example.com",
  email: "support@example.com",
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

// Consumer-facing navigation. Collection filters are wired to /shop during the
// Commerce phase; for now they point at the storefront.
export const NAV: NavItem[] = [
  {
    key: "shop",
    label: "Shop",
    href: "/shop",
    columns: 2,
    children: [
      { labelKey: "nav.shop_new", href: "/shop?sort=newest" },
      { labelKey: "nav.shop_best", href: "/shop?filter=best-sellers" },
      { labelKey: "nav.shop_everyday", href: "/shop?collection=everyday" },
      { labelKey: "nav.shop_gulf", href: "/shop?collection=gulf-design" },
      { labelKey: "nav.shop_gift", href: "/shop?collection=gift-sets" },
      { labelKey: "nav.shop_statement", href: "/shop?collection=statement" },
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
