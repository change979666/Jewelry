# SEO / GROWTH GOVERNANCE — RTS rule, Taxonomy mapping, Dedupe candidates, Enrichment/Association pipelines

> ⚠️ **历史快照 — 非当前文档。** 本文描述的是前身项目 **Aromiso（香薰 B2B）** 时期的实现，
> 其中的 `functions/` 目录、`commerce_*` 表、en/es/de 三语、`/admin`（V1）等均**已不存在**。
> 保留此文仅作迁移对照与决策留痕。**当前架构与约定以 [`README.md`](../README.md) 与
> [`docs/01-项目说明.md`](./01-项目说明.md) 为准。**

> 2026-09-10 · LONG-TERM OPERATING MODE. Read-only analysis + dry-run proposals. **No production data mutated, no RTS/Catalog/taxonomy re-key, no deletions.**
> Companion to `MASTER_CONSOLIDATION_BACKLOG.md` (the single ledger) and `NEW_RTS_DIFFUSER_PIPELINE.md`.

## 1. RTS_TRUTH_RULE — proposal, verdict B (OWNER DECISION; not applied)
Two reasonable interpretations exist and **code cannot decide** (pause-condition B):
- **(I) Admin-column semantics**: `admin-v2/commerce/editor.astro:494` exposes `ready_to_ship` (f-rts) as a per-product RTS toggle → the column IS the owner's RTS control. But the column = 1 on **2431/2431** (blanket import default) → currently meaningless.
- **(II) Derived curated signal**: `tags LIKE '%ready_to_ship%' AND has ≥1 price tier` = **404** (perfect tag∩price overlap; the only curated, self-consistent subset; all from 1688 batches that also got pricing).

**Proposed RTS_TRUTH_RULE (deterministic, auditable, repeatable — satisfies all 5 requirements):**
```
RTS(p) := p.status='active' AND p.deleted_at IS NULL
          AND p.tags LIKE '%ready_to_ship%'
          AND EXISTS (SELECT 1 FROM commerce_price_tiers pt WHERE pt.product_id = p.id)
```
→ yields 404 today. Does NOT rely on the distorted column, NOT on import provenance, NOT on price alone (requires tag AND price), maps to real "curated + priced = sellable now" semantics.
**Why not auto-applied**: adopting (II) site-wide changes the public `?rts=1` filter (Shop RTS filter + many "Ready to Ship" quick-links in `i18n-content.ts` + Catalog) from 2431→404 AND diverges from the admin column toggle (I). That is a business-semantics decision → **OWNER**: confirm RTS = the derived 404 (then I apply the rule to the API filter + fix Catalog total/pagination + reconcile the admin toggle to write the tag), OR define a different curated collection.
**Ready-to-apply on owner confirm** (atomic, no column rewrite): change `functions/api/commerce/products.ts:410` rts filter to the rule above; keep `ready_to_ship` column as documented legacy/import artifact; Catalog uses API `total` + pagination (see §2 of NEW_RTS_DIFFUSER_PIPELINE).

## 2. PHASE F — Taxonomy SOURCE→PUBLIC mapping (DRY-RUN proposal; do NOT re-key 2431)
Source `category_l1`(15)/`category_l3`(33) = raw 1688 values (Chinese dept/type names + bare numeric IDs). Public = 5 buckets (Home Fragrance 1663/68%, Scented Candles 524, Car Fragrance 192, Aroma Diffusers 30, Gift Sets 22).

| source L3 (real) | L1 | count | sample title | proposed public type | confidence | owner_review |
|---|---|---|---|---|---|---|
| 无火香薰 (fireless aroma) | 家装家饰 | 1464 | "100% Soy Wax Handmade Aromatherapy Candle" | **MIXED** → split Candle / Reed Diffuser / Home Fragrance by title | low (bucket is mixed) | YES |
| 156 (numeric) | 67 | 379 | "Bamboo You Are Safe Plum Frying Tea Aroma" | Home Fragrance (unresolved) | low | YES (1688 lookup) |
| 香薰 (aromatherapy) | 个护/家清 | 326 | "100ml Car Perfume Ornaments Aromatherapy" | Car Fragrance / Home Fragrance (mixed) | low-med | YES |
| 1032118 | 122916002 | 63 | "2026 New High-End Car Fragrance" | **Car Fragrance** | med | YES |
| 201330316 | 67 | 45 | "Aromatherapy Essential Oil Diffuser Stone" | **Diffuser Stone / Plaster** | med | YES |
| 车用香水香薰 (car perfume) | 汽车用品 | 44 | "120ml car aromatherapy ornaments" | **Car Fragrance** | high | no |
| 蜡烛 (candle) | 办公、文化 | 20 | "20g Round Orange Wardrobe Aromatherapy Wax" | **Scented Candles / Wax** | high | no |
| 122286002 | 家装家饰 | 17 | "100ML Flat Bottle No Fire Aromatherapy" | **Reed Diffusers (fireless)** | med | YES |
| 香薰机 (aroma machine) | 家用电器 | 6 | "500ml Large-Capacity Spray Home Aromatherapy" | **Aroma Diffuser Machine / Electric** | high | no |
| 创意礼品套装 (gift set) | 办公、文化 | 6 | "Aromatherapy Candle Gift Box, Niche High-E" | **Gift Sets** | high | no |
| 201160502 / 201237501 / 201308506 / 1031967 / 1038172 / 122798003 / 124190009 / 201221508 | various | ≤7 each | candle gift box / crystal stone candle / hotel fragrance / flower aroma / wax lamp / machine spray / fire-free | Candle / Gift Set / Diffuser / Machine (per sample) | low-med | YES (numeric IDs need 1688 lookup) |

**Proposed public category tree (candidate, from real values only):** Reed Diffusers (fireless) · Scented Candles & Wax Melts · Car Fragrance · Aroma Diffuser Machines (electric) · Diffuser Stones / Plaster · Essential Oils · Fragrance Oils · Gift Sets · Home Fragrance (residual).
**Impact / blockers**: the two biggest buckets (无火香薰 1464, 156 numeric 379) are **mixed/unresolved** → cannot be auto-mapped from L3 alone; need title/spec classification or a 1688 numeric-ID lookup table. **Ambiguous/unmapped**: all numeric L3 IDs (≈12 distinct) + the mixed 无火香薰 bucket. **Do NOT re-key 2431 rows on raw L1/L3.** Next step (owner): approve building a curated `taxonomy_map` (source value → product type) with the numeric IDs resolved, dry-run + sample review, then migrate behind a flag.

## 3. PHASE G — DEDUPE_CANDIDATES (read-only; NO deletion / NO auto-rename)
- **Shared cover_image**: 160 groups / **359 products**. Top group = **7 products** on one image (`…2215413011303-0-cib.jpg`): 516d738cb9, 88ad58e7a4, 91bcc851cf, a6c2e70eae, dbf6a21446, 1b9a253dff, 56aee92a72. Several groups of 5. Multiple groups share supplier id `2215413011303` → **likely intentional same-supplier family/variant sharing**, but some may be accidental duplicate listings.
- **Exact same title**: 14 groups / **29 products** → likely variant/family or accidental dupes.
- Heuristic: same cover + same supplier-id + similar title = **likely intentional family** (candidate for variant-merge, not delete); same cover + different category/title = **likely accidental** (candidate for review). Confidence per group to be computed in the full candidate export.
- Action: **candidates only** — no image/product deletion, no title rewrite. The 24 new reed-diffuser variants are themselves a deliberate D-type family (1 product + 24 variants), the model to prefer over duplicate listings.

## 4. PHASE D/E — pipelines (designed; dry-run before any write; reversible/auditable)
- **D — 961 thin enrichment**: deterministic composer that builds short/long description + highlights **only from real existing fields** (title, category, `specifications` JSON [present on all 2431], `attributes`, gallery). Absent facts → `UNKNOWN` / `QUOTE_REQUIRED` / `CONTACT_FOR_DETAILS`; **never** invent material/capacity/scent/MOQ/cert; **never** title-stitch a fake spec; **no** template copy across products. Reversible (write via admin API with audit_logs + a stored prior-value snapshot), `--dry-run` default, per-day cap. Mass-write to 961 = large content change → execute only after a reviewed dry-run sample (owner-aware), not blind.
- **E — Tier-1 content_association**: deterministic, idempotent (no duplicate inserts), dry-run-first, rollback/reconcile, outputs orphan/ambiguous report. Tier-1 = high-value + customizable + rich-media + stable slug + clear family. Link `Product → Category → Customization → Catalog → Download → Quote`; where no bespoke content page exists, associate to the **category / custom-capability** page (NOT 2431 thin pages). Currently 0 product_content entities exist for commerce → Tier-1 must first define the target content entities (category/custom-capability), so this is a build program, not a one-shot write.

## 5. Status
- ✅ Executed (read-only, real data): RTS rule proposal, taxonomy mapping dry-run, dedupe candidates, value tiers (A1470/B0/C961/D359+29).
- ⛔ OWNER: RTS interpretation (I vs II) → unblocks Catalog count/pagination + 24-into-catalog; taxonomy numeric-ID resolution + re-key approval; 961 enrichment sample review; 24 artwork de-brand authorization + public scent naming.
- 🔵 NEXT AUTONOMOUS (no owner needed, dry-run/reversible): build D composer + E association tool with `--dry-run` and orphan/ambiguous reports; full 359/29 dedupe candidate export with per-group confidence; taxonomy title-classification dry-run for the mixed 无火香薰 bucket.
- No P0/P1 introduced; nothing fabricated, deleted, or published with brand risk.
