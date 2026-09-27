# Jewelry

Modern everyday jewelry for women in **KSA** and the **UAE** — earrings, necklaces, bracelets and gift sets. B2C, direct-to-consumer, with native **English + Arabic (RTL)** storefront, **cash-on-delivery (COD)** first, and easy returns.

This repository was created by **forking the operating system, not the business**: the generic platform (Astro + Cloudflare Pages, D1, R2, KV, the admin shell, RBAC, i18n plumbing, build/test gates) was carried over from an earlier internal project, while all aroma / B2B business content, pages, APIs and data were removed and the Jewelry business layer is being rebuilt.

> **Status: V1.0 local foundation.** The catalog, cart/checkout, orders and payment flows are **not built yet** — see [Roadmap](#roadmap). Cloudflare resources and the production domain are provisioned later.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | [Astro 5](https://astro.5.dev/) (static-first, `.astro` + TypeScript) |
| Styling | Tailwind CSS v4 |
| Hosting | Cloudflare Pages |
| Database | Cloudflare D1 (SQLite) |
| Object storage | Cloudflare R2 (product imagery) |
| Key/value | Cloudflare KV (autosave / drafts) |
| Backend logic | Cloudflare Pages Functions (`functions/`) |
| Tests | Vitest |
| Tooling | ESLint, Prettier, Husky + lint-staged |

**Locales:** `en` (default), `ar` (native RTL). Arabic currently falls back to English where native copy has not been authored — machine translation is intentionally avoided.

---

## Quick start

Prerequisites: Node.js (see `.nvmrc`) and npm.

```bash
# 1. Install dependencies
npm install

# 2. Local dev server
npm run dev

# 3. (Optional) local secrets for wrangler pages dev
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

### Local Cloudflare runtime (later)

```bash
# Create the (free) resources once the Cloudflare account is ready:
wrangler d1 create jewelry-db
wrangler r2 bucket create jewelry-images
wrangler kv namespace create DRAFTS
# Then replace the REPLACE_WITH_* placeholders in wrangler.toml
```

---

## Repository structure

```
.
├── src/
│   ├── pages/          # Astro routes (public storefront + /admin-v2)
│   │   ├── [lang]/     # Locale-scoped public pages (en/ar)
│   │   └── admin-v2/   # Admin dashboard pages
│   ├── components/     # UI components (storefront + admin)
│   ├── layouts/        # BaseLayout (sets lang + dir/RTL)
│   ├── content/        # Content collections config
│   ├── data/           # Editable settings (settings.json)
│   ├── lib/            # Frontend/content helpers
│   ├── i18n.ts         # Locale definitions + translation tree
│   └── styles/         # Global + admin CSS
├── functions/          # Cloudflare Pages Functions (API endpoints, lib)
├── migrations/         # D1 migrations for the Jewelry schema
├── public/             # Static assets (favicon, placeholders, redirects)
├── scripts/            # Local operational scripts
├── tests/              # Vitest suite
└── docs/               # Project docs, architecture reference, change log
```

---

## Configuration & secrets

- **Brand / nav / social:** `src/consts.ts` and `src/data/settings.json`.
- **Cloudflare bindings:** `wrangler.toml` (D1 / R2 / KV). IDs are placeholders until resources are created.
- **Local secrets:** copy `.dev.vars.example` to `.dev.vars` (gitignored).

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Password for `/admin-v2` login |
| `ADMIN_GITHUB_TOKEN` | PAT used to commit published content |
| `ADMIN_GITHUB_REPO` | `owner/repo` (`change979666/Jewelry`) |
| `SILICONFLOW_API_KEY` | OpenAI-compatible AI provider key |

Never commit `.dev.vars`, `.env`, or real tokens. Do **not** embed tokens in the git remote URL.

---

## Business rules (frozen)

- **Price bands (indicative, not hardcoded):** Entry SAR 79–129 · Core SAR 149–249 · Statement SAR 299–399 · Set/Gift SAR 249–399.
- **Product lines:** Everyday · Gulf Design · Gift · Statement.
- **Money:** integer minor units; currencies SAR & AED.
- **VAT:** KSA 15%, UAE 5% — via configuration, never hardcoded.
- **Payments:** provider-agnostic; V1 COD only; a hosted checkout is reserved for later — card data is never touched.
- **Fulfillment:** manual workflow first.
- **No unsubstantiated claims** (e.g. hypoallergenic, waterproof, tarnish-proof, nickel-free, solid 18K gold) — see `functions/lib/fact-registry.json`.

---## Roadmap

1. **Foundation (this phase, local only)** — clean fork, brand/i18n/config, fresh git, docs. ✅
2. **Provisioning** — buy a domain; create Cloudflare D1 / R2 / KV; deploy Pages.
3. **Data model** — initial D1 schema migration (products, collections, customers, orders).
4. **Commerce core** — catalog/collections, product detail, cart, checkout (COD), order management.
5. **Content & polish** — native Arabic copy, homepage per spec, reviews, trust, SEO.
6. **Launch readiness** — fulfillment workflow, notifications, analytics, go-live in KSA then UAE.

---

## Documentation

- [`docs/00-复制与清理清单.md`](docs/00-复制与清理清单.md) — fork planning ledger (keep/delete/modify).
- [`docs/01-项目说明.md`](docs/01-项目说明.md) — project & architecture guide (中文).
- [`docs/02-清理变更记录.md`](docs/02-清理变更记录.md) — cleanup change log with counts (中文).
- [`docs/AGENT_OS_BLUEPRINT.md`](docs/AGENT_OS_BLUEPRINT.md) — the platform/OS blueprint carried over.
- [`docs/v2-architecture/`](docs/v2-architecture/) — architecture reference maps.
