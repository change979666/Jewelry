# Jewelry

Modern everyday jewelry for women in **KSA** and the **UAE** — earrings, necklaces, bracelets and gift sets. B2C, direct-to-consumer, with a native **English + Arabic (RTL)** storefront, **cash-on-delivery (COD)** first, and easy returns.

This repository was created by **forking the operating system, not the business**: the generic platform (Astro + Cloudflare Pages, D1, R2, KV, the admin shell, RBAC, i18n plumbing, build/test gates) was carried over from an earlier internal project, while all aroma / B2B business content, pages, APIs and data were removed and the Jewelry business layer rebuilt on top.

> **Status: V1.0 Commerce Core — delivered and frozen (2026-09-27).**
> Catalog, cart, COD checkout, order state machine, admin commerce and the D1/R2/KV bindings are implemented and verified. What remains is **business-layer work, not engineering**: real SKU data + photography, native Arabic copy review, and the live pilot order. See [Roadmap](#roadmap) and [Known limitations](#known-limitations).

---

## Verified state (run these to confirm)

| Gate | Command | Last result |
| --- | --- | --- |
| Types / Astro diagnostics | `npm run check` | **0 errors**, 0 warnings |
| Unit + security tests | `npm test` | **51 passed / 51** (6 files) |
| Production build | `npm run build` | completes, `dist/` |
| Clean migration replay | replay of `migrations/0001–0010` | all statements OK, 26 tables |
| Legacy residue | `git grep -i aromiso -- src public` | **0 matches** |

> Note: `functions/` no longer exists. The Cloudflare adapter builds `dist/_worker.js` from Astro, and **Cloudflare Pages ignores the whole `/functions` directory** when that file is present — so all API routes now live in `src/pages/api/**` and actually execute. See `docs/01-项目说明.md`.

### What is implemented

| Module | Where |
| --- | --- |
| Schema (single source of truth) | `migrations/0001–0010` — 26 tables, products/variants/carts/orders/payments/shipments |
| Pricing (server-side, integer minor units) | `src/lib/commerce/pricing.ts`, fully recomputed at checkout |
| Order state machine | `src/lib/commerce/order.service.ts` — `ORDER_TRANSITIONS` + `canTransition()` |
| Inventory atomicity + duplicate-submit guard | `src/lib/commerce/inventory.service.ts` (P0-3) |
| Cart JSON API | `src/pages/api/cart/*` (`session_id` cookie) |
| Catalog API | `src/pages/api/commerce/products.ts`, `reviews.ts` |
| Storefront | `src/pages/[lang]/` — home, `collection/[slug]`, `product/[slug]`, `cart`, `checkout`, `order-confirmation` |
| Admin V2 | `src/pages/admin-v2/`, `src/pages/api/admin/v2/*` — RBAC, products, orders, dashboard KPI |
| API auth gate + telemetry | `src/middleware.ts` — `/admin-v2/**` server-side session check, `/api/**` request metrics |
| Locale routing | `src/i18n.ts` (`localizedUrl`, `localeFromPath`) + `src/lib/locale.ts` (`requireLocale`) |
| Payments | `CODProvider` live; `HostedCheckoutProvider` behind `site_settings.feature.enable_online_payment` (off) |

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | [Astro 5](https://astro.build/) (static-first, `.astro` + TypeScript) |
| Styling | Tailwind CSS v4 |
| Hosting | Cloudflare Pages |
| Database | Cloudflare D1 (SQLite) |
| Object storage | Cloudflare R2 (product imagery) |
| Key/value | Cloudflare KV (autosave / rate limits) |
| Backend logic | Astro server endpoints (`src/pages/api/**`) built to Cloudflare Workers |
| Tests | Vitest |
| Tooling | ESLint, Prettier, Husky + lint-staged |

**Runtime:** Node **22** — pinned in `.nvmrc`, `.node-version` and CI (`wrangler` 4.x requires ≥22). Keep these three in sync.

**Locales:** `en` (default), `ar` (native RTL). `src/i18n.ts` holds interface strings for **both** locales — Arabic is authored natively, never machine-translated. Page-level content (FAQ entries, CTA band, footer collection labels) lives next to its component.

---

## Quick start

```bash
npm install
npm run db:migrate:local   # apply migrations/0001–0010 to the local D1 (seed demo catalog included)
npm run dev                # Astro dev server
```

Local secrets for `wrangler pages dev`:

```bash
cp .dev.vars.example .dev.vars   # then fill in real values
```

### Common commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Astro dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the Vitest suite once |
| `npm run check` | Type-check / Astro diagnostics |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run ci` | Full gate: check + lint + format + test + build |
| `npm run db:migrate:local` | Apply migrations to the local D1 (idempotent) |
| `npm run db:migrate:remote` | Apply migrations to the production D1 |
| `npm run db:console -- "SELECT ..."` | Ad-hoc SQL against the local D1 |

---

## Repository structure

```
.
├── src/
│   ├── pages/          # Astro routes (storefront + /admin-v2)
│   │   ├── [lang]/     # Locale-scoped public pages (en/ar)
│   │   └── admin-v2/   # Admin dashboard pages
│   ├── components/     # UI components (storefront + admin)
│   ├── layouts/        # BaseLayout (sets lang + dir/RTL)
│   ├── content/        # Blog + guide content collections
│   ├── data/           # Editable settings (settings.json, category-faqs.json)
│   ├── lib/
│   │   ├── commerce/   # Commerce core (pricing, cart, orders, inventory, providers)
│   │   └── *.ts        # Content/i18n helpers, locale guard
│   ├── pages/
│   │   ├── [lang]/     # Localized storefront (every route is SSR — see src/lib/locale.ts)
│   │   ├── admin-v2/   # Admin console pages
│   │   └── api/        # JSON API endpoints (cart, commerce, admin/v2, search, …)
│   ├── i18n.ts         # Locale definitions + UI dictionary (en/ar) + URL helpers
│   └── middleware.ts   # Admin auth gate + API telemetry
├── migrations/         # D1 migrations — the schema source of truth
├── public/             # Static assets (favicon, placeholders, redirects)
├── scripts/            # Operational scripts (d1-exec)
├── tests/              # Vitest suite
└── docs/               # Project docs, architecture reference, change log
```

---

## Configuration & secrets

- **Brand / nav:** `src/consts.ts` and `src/data/settings.json`. Navigation hrefs must point at real routes (`/collection/<slug>` — there is no `/shop` route).
- **Cloudflare bindings:** `wrangler.toml` — **real resource IDs are committed** for D1 `jewelry-db`, R2 `jewelry-images`, KV `DRAFTS`.
- **Local secrets:** copy `.dev.vars.example` to `.dev.vars` (gitignored).

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | `/admin-v2` bootstrap + login. On a fresh database the first login with this password creates the Owner account. |
| `ADMIN_GITHUB_TOKEN` | PAT used to commit published content |
| `ADMIN_GITHUB_REPO` | `owner/repo` (`change979666/Jewelry`) |
| `SILICONFLOW_API_KEY` | OpenAI-compatible AI provider key |

Never commit `.dev.vars`, `.env`, or real tokens. Do **not** embed tokens in the git remote URL.

---

## Business rules (frozen)

- **Price bands (indicative, not hardcoded):** Entry SAR 79–129 · Core SAR 149–249 · Statement SAR 299–399 · Set/Gift SAR 249–399.
- **Collections (seeded slugs, the storefront's IA):** `everyday` · `new-arrivals` · `best-sellers` · `gift` · `statement` · `gulf-design` · `gold` · `silver` · `pearls`.
- **Money:** integer minor units; currencies SAR & AED.
- **VAT:** KSA 15%, UAE 5% — from the `markets` table, never hardcoded.
- **Shipping:** flat rate + free-shipping threshold, per market (`markets.flat_shipping_rate` / `free_shipping_threshold`).
- **Payments:** provider-agnostic; V1 COD only; hosted checkout reserved for later — card data is never touched.
- **Fulfillment:** manual workflow first.
- **No unsubstantiated claims** (hypoallergenic, waterproof, tarnish-proof, nickel-free, solid 18K gold, certificates) — the demo catalog in `migrations/0008` follows this rule; keep it when replacing the data.

---

## Roadmap

1. **Foundation** — clean fork, brand/i18n/config, fresh git, docs. ✅
2. **Provisioning** — Cloudflare D1 / R2 / KV created and bound; domain pending. ✅ (domain outstanding)
3. **Data model** — schema migrations `0001–0010`. ✅
4. **Commerce core** — catalog/collections, product detail, cart, atomic COD checkout, order state machine, admin commerce. ✅
5. **P0 clearance** — Node 22 alignment, en/ar dictionary rebuild, nav/route unification, inventory atomicity, README freeze. ✅
6. **P0 clearance II** — SSR locale fix (all `[lang]` pages were rendering English), URL-prefix unification via `localizedUrl()`, soft-404 guard, `functions/` retirement, RBAC `oem`→`shipping`, jewelry FAQ rewrite, sitemap fixes, API-level COD close-loop verified. ✅
6. **Real catalog** — replace the demo fixture with the real 20–30 SKUs (verified cost, real photography, confirmed materials, native Arabic copy review).
7. **Pilot order** — first live KSA COD order end-to-end: storefront → admin → dispatch → delivery confirmation.

---

## Known limitations

1. **Demo catalog.** `migrations/0008_jewelry_seed.sql` is a fixture (8 products, placeholder imagery, `country_of_origin` NULL). Replace before taking live orders.
2. **Single currency per variant.** All seeded variants are SAR; AED pricing is not yet modelled.
3. **Catalog search.** The global search modal indexes blog posts + guides only; D1 products are searched through `/api/commerce/products`.
4. **Legacy admin V1 pages** (`src/pages/admin/`, distinct from `admin-v2/`) are unreferenced but not yet deleted.
5. **Arabic copy review** — the dictionary is complete, but a native review pass is still required before launch.
6. **Online payment** — schema and provider abstraction are ready; no PSP is integrated (`feature.enable_online_payment` = off).

---

## Documentation

- [`docs/00-复制与清理清单.md`](docs/00-复制与清理清单.md) — fork planning ledger (keep/delete/modify).
- [`docs/01-项目说明.md`](docs/01-项目说明.md) — project & architecture guide (中文).
- [`docs/02-清理变更记录.md`](docs/02-清理变更记录.md) — cleanup change log with counts (中文).
- [`docs/v2-architecture/`](docs/v2-architecture/) — architecture reference maps.
