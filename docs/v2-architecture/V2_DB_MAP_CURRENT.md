# Aromiso CMS — V2 Database Map (Current State)

> **Generated**: 2026-08-25  
> **Source**: All 44 migration files (`0001–0048`, gaps 0033–0036 do not exist) + cross-referenced audit `CMS_AUDIT_DATABASE.md`  
> **Database**: Cloudflare D1 (SQLite-compatible, `IF NOT EXISTS` / `ADD COLUMN` only — no DROP, RENAME, or ALTER COLUMN)  
> **Total tables**: 52  
> **Total columns**: ~490  
> **Total indexes**: ~85

---

## Table of Contents

1. [Schema Map by Domain](#1-schema-map-by-domain)
2. [Table-to-Table Relationship Diagram](#2-table-to-table-relationship-diagram)
3. [Migration-to-Table Index](#3-migration-to-table-index)
4. [Missing Foreign Key Report](#4-missing-foreign-key-report)
5. [Orphan & Superseded Table Assessment](#5-orphan--superseded-table-assessment)
6. [V2 Fate Summary](#6-v2-fate-summary)
7. [Appendix: Read/Write Frequency Assessment](#7-appendix-readwrite-frequency-assessment)

---

## 1. Schema Map by Domain

---

### 1.1  `inquiries`

| Property | Value |
|----------|-------|
| **Domain** | content |
| **Created by** | 0001_init.sql |
| **Last modified by** | 0041_video_attribution.sql (+`source_video_id`); 0007_inquiry_session.sql (+`session_id`) |
| **Row estimate** | ~100–500 (growing slowly) |
| **Read frequency** | MEDIUM (admin panel, lead scoring) |
| **Write frequency** | LOW (public form submissions ~2–5/day) |
| **Is orphan?** | NO — actively written by POST `/api/inquiry`, read by admin panel, `ai_lead_scores` |
| **V2 fate** | **保留不变** — core content table, well-structured |

| Column | Type | Constraints / Default | Migration |
|--------|------|-----------------------|-----------|
| `id` | TEXT | **PK** | 0001 |
| `name` | TEXT | NOT NULL | 0001 |
| `email` | TEXT | NOT NULL | 0001 |
| `company` | TEXT | NOT NULL DEFAULT '' | 0001 |
| `country` | TEXT | NOT NULL DEFAULT '' | 0001 |
| `whatsapp` | TEXT | NOT NULL DEFAULT '' | 0001 |
| `product` | TEXT | NOT NULL DEFAULT '' | 0001 |
| `quantity` | TEXT | NOT NULL DEFAULT '' | 0001 |
| `message` | TEXT | NOT NULL DEFAULT '' | 0001 |
| `source` | TEXT | NOT NULL DEFAULT '' | 0001 |
| `status` | TEXT | NOT NULL DEFAULT 'New' | 0001 |
| `created_at` | TEXT | NOT NULL | 0001 |
| `updated_at` | TEXT | | 0001 |
| `session_id` | TEXT | DEFAULT '' | 0007 |
| `source_video_id` | TEXT | NOT NULL DEFAULT '' | 0041 |

**PK**: `id` (TEXT)

**Foreign Keys**:
- *(none declared)*
- ⚠ Missing FK: `email_messages.inquiry_id` → `inquiries.id`
- ⚠ Missing FK: `ai_lead_scores.inquiry_id` → `inquiries.id`

**Indexes**:
- `idx_inquiries_status` ON `(status)`
- `idx_inquiries_created` ON `(created_at DESC)`

---

### 1.2  `subscribers`

| Property | Value |
|----------|-------|
| **Domain** | content |
| **Created by** | 0003_subscribers.sql |
| **Last modified by** | 0003_subscribers.sql (never altered) |
| **Row estimate** | ~10–50 |
| **Read frequency** | LOW (admin review only) |
| **Write frequency** | LOW (footer opt-in ~0–3/week) |
| **Is orphan?** | NO — POST `/api/subscribe` exists |
| **V2 fate** | **保留不变** — simple standalone |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `email` | TEXT | NOT NULL UNIQUE COLLATE NOCASE |
| `locale` | TEXT | NOT NULL DEFAULT '' |
| `source` | TEXT | NOT NULL DEFAULT 'footer' |
| `created_at` | TEXT | NOT NULL |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none)*

**Indexes**:
- `idx_subscribers_created` ON `(created_at DESC)`

---

### 1.3  `commerce_products`

| Property | Value |
|----------|-------|
| **Domain** | commerce |
| **Created by** | 0011_commerce_tables.sql |
| **Last modified by** | 0040_image_localization.sql (+`original_cover_image`, `localization_status`) |
| **Row estimate** | ~404 (from short_id backfill count) |
| **Read frequency** | **HIGH** (PDP pages, shop listing, admin panel — most-read table) |
| **Write frequency** | MEDIUM (admin edits, import, AI fills) |
| **Is orphan?** | NO — central commerce hub |
| **V2 fate** | **新增列** — 66 columns is too wide; consider vertical split; add V2 commerce fields |

| Column | Type | Constraints / Default | Migration |
|--------|------|-----------------------|-----------|
| `id` | TEXT | **PK** | 0011 |
| `product_key` | TEXT | NOT NULL UNIQUE | 0011 |
| `slug` | TEXT | NOT NULL UNIQUE | 0011 |
| `category` | TEXT | NOT NULL DEFAULT '' | 0011 |
| `title` | TEXT | NOT NULL DEFAULT '' | 0011 |
| `short_description` | TEXT | NOT NULL DEFAULT '' | 0011 |
| `description` | TEXT | NOT NULL DEFAULT '' | 0011 |
| `cover_image` | TEXT | NOT NULL DEFAULT '' | 0011 |
| `gallery` | TEXT | NOT NULL DEFAULT '[]' | 0011 |
| `status` | TEXT | NOT NULL DEFAULT 'draft' | 0011 |
| `moq` | INTEGER | NOT NULL DEFAULT 1 | 0011 |
| `stock_status` | TEXT | NOT NULL DEFAULT 'in_stock' | 0011 |
| `lead_time` | TEXT | NOT NULL DEFAULT '' | 0011 |
| `unit` | TEXT | NOT NULL DEFAULT 'pcs' | 0011 |
| `weight` | REAL | | 0011 |
| `certifications` | TEXT | NOT NULL DEFAULT '[]' | 0011 |
| `oem_available` | INTEGER | NOT NULL DEFAULT 1 | 0011 |
| `source_type` | TEXT | NOT NULL DEFAULT 'manual' | 0011 |
| `source_product_key` | TEXT | NOT NULL DEFAULT '' | 0011 |
| `created_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) | 0011 |
| `updated_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) | 0011 |
| `source_platform` | TEXT | NOT NULL DEFAULT '' | 0012 |
| `source_url` | TEXT | NOT NULL DEFAULT '' | 0012 |
| `source_shop_name` | TEXT | NOT NULL DEFAULT '' | 0012 |
| `source_import_method` | TEXT | NOT NULL DEFAULT '' | 0012 |
| `source_imported_at` | INTEGER | | 0012 |
| `cost_price` | REAL | | 0012 |
| `key_features` | TEXT | NOT NULL DEFAULT '[]' | 0013 |
| `specifications` | TEXT | NOT NULL DEFAULT '{}' | 0013 |
| `materials` | TEXT | NOT NULL DEFAULT '' | 0013 |
| `fragrance_options` | TEXT | NOT NULL DEFAULT '[]' | 0013 |
| `packaging_options` | TEXT | NOT NULL DEFAULT '[]' | 0013 |
| `application` | TEXT | NOT NULL DEFAULT '[]' | 0013 |
| `shipping_info` | TEXT | NOT NULL DEFAULT '{}' | 0013 |
| `sample_available` | INTEGER | NOT NULL DEFAULT 1 | 0013 |
| `private_label` | INTEGER | NOT NULL DEFAULT 1 | 0013 |
| `product_highlights` | TEXT | NOT NULL DEFAULT '[]' | 0013 |
| `faq` | TEXT | NOT NULL DEFAULT '[]' | 0013 |
| `seo_title` | TEXT | NOT NULL DEFAULT '' | 0013 |
| `seo_description` | TEXT | NOT NULL DEFAULT '' | 0013 |
| `completeness` | INTEGER | NOT NULL DEFAULT 0 | 0013 |
| `tags` | TEXT | DEFAULT '[]' | 0015 |
| `supplier_name` | TEXT | | 0020 |
| `supplier_shop_url` | TEXT | | 0020 |
| `supplier_product_code` | TEXT | | 0020 |
| `attributes` | TEXT | DEFAULT '{}' | 0020 |
| `category_l1` | TEXT | DEFAULT '' | 0020 |
| `category_l3` | TEXT | DEFAULT '' | 0020 |
| `units_per_carton` | INTEGER | | 0020 |
| `import_batch` | TEXT | | 0020 |
| `source_last_verified` | TEXT | | 0020 |
| `health_status` | TEXT | DEFAULT 'fresh' | 0020 |
| `display_product_code` | TEXT | DEFAULT '' | 0022 |
| `fx_rate_cny_usd` | REAL | | 0022 |
| `markup_rule` | REAL | | 0022 |
| `manual_price_override` | REAL | | 0022 |
| `carton_length_cm` | REAL | | 0022 |
| `carton_width_cm` | REAL | | 0022 |
| `carton_height_cm` | REAL | | 0022 |
| `carton_weight_kg` | REAL | | 0022 |
| `carton_volume_cbm` | REAL | | 0022 |
| `packaging_type` | TEXT | DEFAULT '' | 0022 |
| `logistics_meta` | TEXT | DEFAULT '{}' | 0022 |
| `data_health_json` | TEXT | DEFAULT '{}' | 0022 |
| `translated` | INTEGER | NOT NULL DEFAULT 0 | 0023 |
| `short_id` | TEXT | DEFAULT '' | 0024 |
| `video_url` | TEXT | NOT NULL DEFAULT '' | 0025 |
| `short_name` | TEXT | DEFAULT '' | 0027 |
| `ready_to_ship` | INTEGER | DEFAULT 0 | 0028 |
| `original_cover_image` | TEXT | NOT NULL DEFAULT '' | 0040 |
| `localization_status` | TEXT | NOT NULL DEFAULT 'original' | 0040 |

> ⚠ **66 columns** — widest table in schema. V2 should consider vertical splitting.

**PK**: `id` (TEXT)

**Foreign Keys**: *(none — hub table, referenced by others)*

**Indexes**:
- `idx_commerce_products_status` ON `(status)`
- `idx_commerce_products_category` ON `(category)`
- `idx_commerce_products_slug` ON `(slug)`
- `idx_cp_source_key` ON `(source_product_key)` (added 0020)
- `idx_cp_supplier` ON `(supplier_shop_url)` (added 0020)
- `idx_cp_health` ON `(health_status)` (added 0020)
- `idx_commerce_products_short_id` ON `(short_id)` UNIQUE (added via script after 0024)

---

### 1.4  `commerce_product_variants`

| Property | Value |
|----------|-------|
| **Domain** | commerce |
| **Created by** | 0011_commerce_tables.sql |
| **Last modified by** | 0022_commerce_v5_logistics_pricing.sql (+`display_sku_code`) |
| **Row estimate** | ~500–2000 (varies per product) |
| **Read frequency** | MEDIUM (PDP variant display, admin) |
| **Write frequency** | LOW (admin edits, import) |
| **Is orphan?** | NO — actively used |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default | Migration |
|--------|------|-----------------------|-----------|
| `id` | TEXT | **PK** | 0011 |
| `product_id` | TEXT | NOT NULL **FK → commerce_products(id) ON DELETE CASCADE** | 0011 |
| `sku` | TEXT | NOT NULL DEFAULT '' | 0011 |
| `name` | TEXT | NOT NULL DEFAULT '' | 0011 |
| `options_json` | TEXT | NOT NULL DEFAULT '{}' | 0011 |
| `image` | TEXT | NOT NULL DEFAULT '' | 0011 |
| `stock` | INTEGER | | 0011 |
| `status` | TEXT | NOT NULL DEFAULT 'active' | 0011 |
| `created_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) | 0011 |
| `updated_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) | 0011 |
| `source_sku_id` | TEXT | | 0020 |
| `supplier_sku_code` | TEXT | | 0020 |
| `length_cm` | REAL | | 0020 |
| `width_cm` | REAL | | 0020 |
| `height_cm` | REAL | | 0020 |
| `weight_kg` | REAL | | 0020 |
| `display_sku_code` | TEXT | DEFAULT '' | 0022 |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ✅ `product_id` → `commerce_products(id)` ON DELETE CASCADE

**Indexes**:
- `idx_commerce_variants_product` ON `(product_id)`
- `idx_cpv_sku_id` ON `(source_sku_id)` (added 0020)

---

### 1.5  `commerce_price_tiers`

| Property | Value |
|----------|-------|
| **Domain** | commerce |
| **Created by** | 0011_commerce_tables.sql |
| **Last modified by** | 0030_pricing_markup_2.sql (data update only, no DDL since 0011) |
| **Row estimate** | ~500–2000 |
| **Read frequency** | HIGH (pricing display on PDP/cart) |
| **Write frequency** | LOW (admin edits, import) |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | TEXT | **PK** |
| `product_id` | TEXT | NOT NULL **FK → commerce_products(id) ON DELETE CASCADE** |
| `variant_id` | TEXT | **FK → commerce_product_variants(id) ON DELETE CASCADE** |
| `min_qty` | INTEGER | NOT NULL DEFAULT 1 |
| `max_qty` | INTEGER | |
| `unit_price` | REAL | NOT NULL DEFAULT 0 |
| `currency` | TEXT | NOT NULL DEFAULT 'USD' |
| `created_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) |
| `updated_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ✅ `product_id` → `commerce_products(id)` ON DELETE CASCADE
- ✅ `variant_id` → `commerce_product_variants(id)` ON DELETE CASCADE

**Indexes**:
- `idx_commerce_prices_product` ON `(product_id)`
- `idx_commerce_prices_variant` ON `(variant_id)`

---

### 1.6  `commerce_orders`

| Property | Value |
|----------|-------|
| **Domain** | commerce |
| **Created by** | 0011_commerce_tables.sql |
| **Last modified by** | 0011_commerce_tables.sql (never altered) |
| **Row estimate** | ~0–20 (B2B, low volume) |
| **Read frequency** | LOW (admin order panel) |
| **Write frequency** | LOW (rare B2B orders) |
| **Is orphan?** | NO — order system exists but low volume |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | TEXT | **PK** |
| `order_number` | TEXT | NOT NULL UNIQUE |
| `customer_name` | TEXT | NOT NULL DEFAULT '' |
| `company` | TEXT | NOT NULL DEFAULT '' |
| `email` | TEXT | NOT NULL DEFAULT '' |
| `country` | TEXT | NOT NULL DEFAULT '' |
| `city` | TEXT | NOT NULL DEFAULT '' |
| `address` | TEXT | NOT NULL DEFAULT '' |
| `postal_code` | TEXT | NOT NULL DEFAULT '' |
| `phone` | TEXT | NOT NULL DEFAULT '' |
| `whatsapp` | TEXT | NOT NULL DEFAULT '' |
| `currency` | TEXT | NOT NULL DEFAULT 'USD' |
| `subtotal` | REAL | NOT NULL DEFAULT 0 |
| `shipping_cost` | REAL | |
| `total` | REAL | NOT NULL DEFAULT 0 |
| `status` | TEXT | NOT NULL DEFAULT 'new' |
| `source_type` | TEXT | NOT NULL DEFAULT '' |
| `source_url` | TEXT | NOT NULL DEFAULT '' |
| `source_product_id` | TEXT | NOT NULL DEFAULT '' |
| `source_category` | TEXT | NOT NULL DEFAULT '' |
| `customer_note` | TEXT | NOT NULL DEFAULT '' |
| `admin_note` | TEXT | NOT NULL DEFAULT '' |
| `created_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) |
| `updated_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) |

**PK**: `id` (TEXT)

**Foreign Keys**: *(none — hub table, referenced by others)*

**Indexes**:
- `idx_commerce_orders_status` ON `(status)`
- `idx_commerce_orders_created` ON `(created_at)`
- `idx_commerce_orders_email` ON `(email)`
- `idx_commerce_orders_number` ON `(order_number)`

---

### 1.7  `commerce_order_items`

| Property | Value |
|----------|-------|
| **Domain** | commerce |
| **Created by** | 0011_commerce_tables.sql |
| **Last modified by** | 0022_commerce_v5_logistics_pricing.sql (+`display_product_code_snapshot`, `display_sku_code_snapshot`) |
| **Row estimate** | ~0–60 |
| **Read frequency** | LOW |
| **Write frequency** | LOW |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default | Migration |
|--------|------|-----------------------|-----------|
| `id` | TEXT | **PK** | 0011 |
| `order_id` | TEXT | NOT NULL **FK → commerce_orders(id) ON DELETE CASCADE** | 0011 |
| `product_id` | TEXT | NOT NULL DEFAULT '' (⚠ no FK) | 0011 |
| `variant_id` | TEXT | NOT NULL DEFAULT '' (⚠ no FK) | 0011 |
| `product_name` | TEXT | NOT NULL DEFAULT '' | 0011 |
| `variant_name` | TEXT | NOT NULL DEFAULT '' | 0011 |
| `sku` | TEXT | NOT NULL DEFAULT '' | 0011 |
| `quantity` | INTEGER | NOT NULL DEFAULT 1 | 0011 |
| `unit_price` | REAL | NOT NULL DEFAULT 0 | 0011 |
| `subtotal` | REAL | NOT NULL DEFAULT 0 | 0011 |
| `created_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) | 0011 |
| `product_title_snapshot` | TEXT | | 0020 |
| `variant_name_snapshot` | TEXT | | 0020 |
| `variant_image_snapshot` | TEXT | | 0020 |
| `source_platform` | TEXT | | 0020 |
| `source_product_key` | TEXT | | 0020 |
| `source_url` | TEXT | | 0020 |
| `supplier_name` | TEXT | | 0020 |
| `supplier_product_code` | TEXT | | 0020 |
| `source_sku_id` | TEXT | | 0020 |
| `supplier_sku_code` | TEXT | | 0020 |
| `purchase_cost_cny_snapshot` | REAL | | 0020 |
| `selling_price_usd_snapshot` | REAL | | 0020 |
| `display_product_code_snapshot` | TEXT | DEFAULT '' | 0022 |
| `display_sku_code_snapshot` | TEXT | DEFAULT '' | 0022 |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ✅ `order_id` → `commerce_orders(id)` ON DELETE CASCADE
- ⚠ Missing FK: `product_id` → `commerce_products(id)` (logical only, no constraint)
- ⚠ Missing FK: `variant_id` → `commerce_product_variants(id)` (logical only, no constraint)

**Indexes**:
- `idx_commerce_order_items_order` ON `(order_id)`

---

### 1.8  `commerce_order_events`

| Property | Value |
|----------|-------|
| **Domain** | commerce |
| **Created by** | 0011_commerce_tables.sql |
| **Last modified by** | 0011_commerce_tables.sql (never altered) |
| **Row estimate** | ~0–50 |
| **Read frequency** | LOW |
| **Write frequency** | LOW |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | TEXT | **PK** |
| `order_id` | TEXT | NOT NULL **FK → commerce_orders(id) ON DELETE CASCADE** |
| `from_status` | TEXT | NOT NULL DEFAULT '' |
| `to_status` | TEXT | NOT NULL DEFAULT '' |
| `note` | TEXT | NOT NULL DEFAULT '' |
| `created_by` | TEXT | NOT NULL DEFAULT 'system' |
| `created_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ✅ `order_id` → `commerce_orders(id)` ON DELETE CASCADE

**Indexes**:
- `idx_commerce_order_events_order` ON `(order_id)`

---

### 1.9  `commerce_settings`

| Property | Value |
|----------|-------|
| **Domain** | commerce |
| **Created by** | 0011_commerce_tables.sql |
| **Last modified by** | 0022_commerce_v5_logistics_pricing.sql (seed data); 0030_pricing_markup_2.sql (data update) |
| **Row estimate** | ~8 |
| **Read frequency** | HIGH (every pricing/currency lookup) |
| **Write frequency** | LOW (admin config changes) |
| **Is orphan?** | NO |
| **V2 fate** | **新增列** — consider expanding to structured config table |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `key` | TEXT | **PK** |
| `value` | TEXT | NOT NULL DEFAULT '' |
| `updated_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) |

**PK**: `key` (TEXT)

**Foreign Keys**: *(none — standalone)*

**Seed keys**: `default_currency`, `order_notification_email`, `enable_shop`, `enable_cart`, `enable_crisp`, `fx_rate_cny_usd`, `default_markup`

---

### 1.10  `commerce_product_images`

| Property | Value |
|----------|-------|
| **Domain** | commerce |
| **Created by** | 0012_1688_import.sql |
| **Last modified by** | 0012_1688_import.sql (never altered) |
| **Row estimate** | ~1000–3000 |
| **Read frequency** | HIGH (PDP gallery, admin) |
| **Write frequency** | MEDIUM (import, upload) |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | TEXT | **PK** |
| `product_id` | TEXT | NOT NULL **FK → commerce_products(id) ON DELETE CASCADE** |
| `variant_id` | TEXT | **FK → commerce_product_variants(id) ON DELETE SET NULL** |
| `type` | TEXT | NOT NULL DEFAULT 'main' |
| `url` | TEXT | NOT NULL DEFAULT '' |
| `original_filename` | TEXT | NOT NULL DEFAULT '' |
| `sha256` | TEXT | NOT NULL DEFAULT '' |
| `width` | INTEGER | |
| `height` | INTEGER | |
| `size_bytes` | INTEGER | |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 |
| `source` | TEXT | NOT NULL DEFAULT 'upload' |
| `created_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ✅ `product_id` → `commerce_products(id)` ON DELETE CASCADE
- ✅ `variant_id` → `commerce_product_variants(id)` ON DELETE SET NULL

**Indexes**:
- `idx_commerce_images_product` ON `(product_id)`
- `idx_commerce_images_type` ON `(product_id, type)`
- `idx_commerce_images_sha` ON `(sha256)`

---

### 1.11  `commerce_import_jobs`

| Property | Value |
|----------|-------|
| **Domain** | commerce |
| **Created by** | 0012_1688_import.sql |
| **Last modified by** | 0021_excel_import_tables.sql (+4 cols) |
| **Row estimate** | ~10–50 |
| **Read frequency** | LOW |
| **Write frequency** | LOW |
| **Is orphan?** | NO — import pipeline active |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default | Migration |
|--------|------|-----------------------|-----------|
| `id` | TEXT | **PK** | 0012 |
| `status` | TEXT | NOT NULL DEFAULT 'uploaded' | 0012 |
| `filename` | TEXT | NOT NULL DEFAULT '' | 0012 |
| `total_files` | INTEGER | NOT NULL DEFAULT 0 | 0012 |
| `processed_files` | INTEGER | NOT NULL DEFAULT 0 | 0012 |
| `total_products` | INTEGER | NOT NULL DEFAULT 0 | 0012 |
| `processed_products` | INTEGER | NOT NULL DEFAULT 0 | 0012 |
| `error_count` | INTEGER | NOT NULL DEFAULT 0 | 0012 |
| `draft_json` | TEXT | NOT NULL DEFAULT '[]' | 0012 |
| `created_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) | 0012 |
| `completed_at` | INTEGER | | 0012 |
| `source_method` | TEXT | NOT NULL DEFAULT '' | 0021 |
| `import_batch` | TEXT | NOT NULL DEFAULT '' | 0021 |
| `total_skus` | INTEGER | NOT NULL DEFAULT 0 | 0021 |
| `updated_at` | INTEGER | NOT NULL DEFAULT 0 | 0021 |

**PK**: `id` (TEXT)

**Foreign Keys**: *(none — hub, referenced by commerce_import_errors)*

**Indexes**:
- `idx_commerce_import_status` ON `(status)`

---

### 1.12  `commerce_import_errors`

| Property | Value |
|----------|-------|
| **Domain** | commerce |
| **Created by** | 0012_1688_import.sql |
| **Last modified by** | 0021_excel_import_tables.sql (+`row_index`, `error_message`) |
| **Row estimate** | ~0–200 |
| **Read frequency** | LOW |
| **Write frequency** | LOW |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default | Migration |
|--------|------|-----------------------|-----------|
| `id` | TEXT | **PK** | 0012 |
| `job_id` | TEXT | NOT NULL **FK → commerce_import_jobs(id) ON DELETE CASCADE** | 0012 |
| `product_name` | TEXT | NOT NULL DEFAULT '' | 0012 |
| `file_path` | TEXT | NOT NULL DEFAULT '' | 0012 |
| `error_type` | TEXT | NOT NULL DEFAULT '' | 0012 |
| `message` | TEXT | NOT NULL DEFAULT '' | 0012 |
| `created_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) | 0012 |
| `row_index` | INTEGER | NOT NULL DEFAULT -1 | 0021 |
| `error_message` | TEXT | NOT NULL DEFAULT '' | 0021 |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ✅ `job_id` → `commerce_import_jobs(id)` ON DELETE CASCADE

**Indexes**:
- `idx_commerce_import_errors_job` ON `(job_id)`

---

### 1.13  `commerce_product_reviews`

| Property | Value |
|----------|-------|
| **Domain** | commerce |
| **Created by** | 0013_commerce_v2.sql |
| **Last modified by** | 0013_commerce_v2.sql (never altered) |
| **Row estimate** | ~0–20 |
| **Read frequency** | MEDIUM (PDP social proof) |
| **Write frequency** | LOW |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | TEXT | **PK** |
| `product_id` | TEXT | NOT NULL **FK → commerce_products(id) ON DELETE CASCADE** |
| `order_id` | TEXT | **FK → commerce_orders(id) ON DELETE SET NULL** |
| `reviewer_name` | TEXT | NOT NULL DEFAULT '' |
| `reviewer_email` | TEXT | NOT NULL DEFAULT '' |
| `country` | TEXT | NOT NULL DEFAULT '' |
| `rating` | INTEGER | NOT NULL DEFAULT 5 |
| `title` | TEXT | NOT NULL DEFAULT '' |
| `content` | TEXT | NOT NULL DEFAULT '' |
| `status` | TEXT | NOT NULL DEFAULT 'pending' |
| `verified_buyer` | INTEGER | NOT NULL DEFAULT 0 |
| `created_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ✅ `product_id` → `commerce_products(id)` ON DELETE CASCADE
- ✅ `order_id` → `commerce_orders(id)` ON DELETE SET NULL

**Indexes**:
- `idx_reviews_product` ON `(product_id, status)`

---

### 1.14  `commerce_product_questions`

| Property | Value |
|----------|-------|
| **Domain** | commerce |
| **Created by** | 0013_commerce_v2.sql |
| **Last modified by** | 0013_commerce_v2.sql (never altered) |
| **Row estimate** | ~0–20 |
| **Read frequency** | MEDIUM (PDP Q&A section) |
| **Write frequency** | LOW |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | TEXT | **PK** |
| `product_id` | TEXT | NOT NULL **FK → commerce_products(id) ON DELETE CASCADE** |
| `question` | TEXT | NOT NULL DEFAULT '' |
| `answer` | TEXT | NOT NULL DEFAULT '' |
| `asker_name` | TEXT | NOT NULL DEFAULT '' |
| `asker_email` | TEXT | NOT NULL DEFAULT '' |
| `status` | TEXT | NOT NULL DEFAULT 'pending' |
| `created_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) |
| `answered_at` | INTEGER | |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ✅ `product_id` → `commerce_products(id)` ON DELETE CASCADE

**Indexes**:
- `idx_questions_product` ON `(product_id, status)`

---

### 1.15  `product_merchandising`

| Property | Value |
|----------|-------|
| **Domain** | commerce |
| **Created by** | 0028_shop2_ready_to_ship_merchandising.sql |
| **Last modified by** | 0028 (never altered) |
| **Row estimate** | ~10–50 |
| **Read frequency** | MEDIUM (shop listing) |
| **Write frequency** | LOW (admin curation) |
| **Is orphan?** | NO — Shop 2.0 active |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | TEXT | **PK** |
| `product_id` | TEXT | NOT NULL (⚠ no FK) |
| `placement_type` | TEXT | NOT NULL |
| `priority` | INTEGER | DEFAULT 0 |
| `start_date` | TEXT | |
| `end_date` | TEXT | |
| `campaign_id` | TEXT | |
| `status` | TEXT | DEFAULT 'active' |
| `created_at` | TEXT | DEFAULT (datetime('now')) |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ⚠ Missing FK: `product_id` → `commerce_products(id)`

**Indexes**:
- `idx_merch_product_type` ON `(product_id, placement_type)` UNIQUE
- `idx_merch_type_status` ON `(placement_type, status)`

---

### 1.16  `commerce_image_nos`

| Property | Value |
|----------|-------|
| **Domain** | commerce |
| **Created by** | 0044_image_nos.sql |
| **Last modified by** | 0044 (never altered) |
| **Row estimate** | ~200–1000 |
| **Read frequency** | LOW (admin only) |
| **Write frequency** | LOW |
| **Is orphan?** | NO — owner workflow table |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `url` | TEXT | **PK** |
| `image_no` | INTEGER | NOT NULL UNIQUE |

**PK**: `url` (TEXT)

**Foreign Keys**: *(none — standalone keyed by URL)*

---

### 1.17  `ai_roles`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0009_aromiso_os.sql |
| **Last modified by** | 0019_ai_feedback_loop.sql (+`prompt_version`); 0017/0018/0047 seeded rows |
| **Row estimate** | ~8 (seeded roles) |
| **Read frequency** | HIGH (every AI call loads role prompt) |
| **Write frequency** | LOW (prompt tuning in Role Center) |
| **Is orphan?** | NO — core AI config |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `name` | TEXT | UNIQUE NOT NULL |
| `display_name` | TEXT | |
| `prompt` | TEXT | NOT NULL DEFAULT '' |
| `model` | TEXT | DEFAULT 'deepseek-v4-pro' |
| `reasoning_effort` | TEXT | DEFAULT 'low' |
| `schedule_cron` | TEXT | |
| `inputs` | TEXT | DEFAULT '[]' |
| `outputs` | TEXT | DEFAULT '[]' |
| `enabled` | INTEGER | DEFAULT 1 |
| `updated_at` | INTEGER | |
| `prompt_version` | INTEGER | DEFAULT 1 (added 0019) |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none)*

**Seeded**: `analyst`, `librarian`, `strategist`, `executor`, `auditor` (0009), `translator` (0017), `product_copywriter` (0018), `video_content_editor` (0047)

---

### 1.18  `knowledge`  *(OS 1.0 four-level knowledge)*

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0009_aromiso_os.sql |
| **Last modified by** | 0009 (never altered) |
| **Row estimate** | ~50–500 |
| **Read frequency** | MEDIUM (loaded as AI context) |
| **Write frequency** | MEDIUM (cron Librarian writes) |
| **Is orphan?** | NO — active OS 1.0 knowledge system |
| **V2 fate** | **保留不变** — may coexist with `knowledge_base` |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `level` | TEXT | NOT NULL DEFAULT 'observation' |
| `category` | TEXT | NOT NULL DEFAULT 'operation' |
| `summary` | TEXT | NOT NULL |
| `evidence` | TEXT | DEFAULT '[]' |
| `confidence` | REAL | DEFAULT 50 |
| `importance` | INTEGER | DEFAULT 50 |
| `source` | TEXT | DEFAULT 'ai' |
| `tags` | TEXT | DEFAULT '' |
| `related_products` | TEXT | DEFAULT '' |
| `related_countries` | TEXT | DEFAULT '' |
| `related_industry` | TEXT | DEFAULT '' |
| `decay_rate` | REAL | DEFAULT 1.0 |
| `expire_at` | INTEGER | |
| `version` | INTEGER | DEFAULT 1 |
| `status` | TEXT | DEFAULT 'active' |
| `created_at` | INTEGER | NOT NULL |
| `updated_at` | INTEGER | |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none)*

**Indexes**:
- `idx_knowledge_cat` ON `(category)`
- `idx_knowledge_level` ON `(level)`
- `idx_knowledge_importance` ON `(importance DESC)`
- `idx_knowledge_status` ON `(status)`

---

### 1.19  `decisions`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0009_aromiso_os.sql |
| **Last modified by** | 0019_ai_feedback_loop.sql (+`rejection_reason`) |
| **Row estimate** | ~20–200 |
| **Read frequency** | LOW (Strategist checks before suggesting) |
| **Write frequency** | LOW |
| **Is orphan?** | **Possibly underused** — `ai_feedback` may have absorbed its function |
| **V2 fate** | **废弃** — consolidate into `ai_feedback` |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `suggestion` | TEXT | NOT NULL |
| `status` | TEXT | NOT NULL DEFAULT 'adopted' |
| `reason` | TEXT | DEFAULT '' |
| `task_id` | INTEGER | ⚠ Missing FK → tasks(id) |
| `created_at` | INTEGER | NOT NULL |
| `rejection_reason` | TEXT | DEFAULT '' (added 0019) |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**:
- ⚠ Missing FK: `task_id` → `tasks(id)`

**Indexes**:
- `idx_decisions_status` ON `(status)`

---

### 1.20  `tasks`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0009_aromiso_os.sql |
| **Last modified by** | 0026_os2_task_engine.sql (+8 cols, +index) |
| **Row estimate** | ~50–500 |
| **Read frequency** | MEDIUM (dashboard, AI context) |
| **Write frequency** | MEDIUM (cron + manual task creation) |
| **Is orphan?** | NO — core task engine |
| **V2 fate** | **新增列** — likely needs further OS 2.0 fields |

| Column | Type | Constraints / Default | Migration |
|--------|------|-----------------------|-----------|
| `id` | INTEGER | **PK** AUTOINCREMENT | 0009 |
| `title` | TEXT | NOT NULL | 0009 |
| `detail` | TEXT | DEFAULT '' | 0009 |
| `roi_score` | REAL | DEFAULT 0 | 0009 |
| `impact` | TEXT | DEFAULT 'medium' | 0009 |
| `difficulty` | TEXT | DEFAULT 'medium' | 0009 |
| `business_reason` | TEXT | DEFAULT '' | 0009 |
| `knowledge_refs` | TEXT | DEFAULT '[]' | 0009 |
| `status` | TEXT | DEFAULT 'pending' | 0009 |
| `result` | TEXT | DEFAULT '' | 0009 |
| `created_at` | INTEGER | NOT NULL | 0009 |
| `completed_at` | INTEGER | | 0009 |
| `priority` | TEXT | DEFAULT 'P2' | 0019 |
| `expected_result` | TEXT | DEFAULT '' | 0019 |
| `actual_result` | TEXT | DEFAULT '' | 0019 |
| `verified` | INTEGER | DEFAULT 0 | 0019 |
| `task_type` | TEXT | DEFAULT '' | 0026 |
| `executor` | TEXT | DEFAULT '' | 0026 |
| `execution_mode` | TEXT | DEFAULT 'MANUAL' | 0026 |
| `idempotency_key` | TEXT | DEFAULT '' | 0026 |
| `payload` | TEXT | DEFAULT '{}' | 0026 |
| `before_metrics` | TEXT | DEFAULT '{}' | 0026 |
| `after_metrics` | TEXT | DEFAULT '{}' | 0026 |
| `outcome` | TEXT | DEFAULT '' | 0026 |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none — hub, referenced by task_runs)*

**Indexes**:
- `idx_tasks_status` ON `(status)`
- `idx_tasks_idem` ON `(idempotency_key)` UNIQUE WHERE `idempotency_key != ''`

---

### 1.21  `experiments`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0009_aromiso_os.sql |
| **Last modified by** | 0009 (never altered) |
| **Row estimate** | ~0–20 |
| **Read frequency** | LOW |
| **Write frequency** | LOW |
| **Is orphan?** | **Possibly unused** — `growth_actions` (0031) handles before/after/outcome better |
| **V2 fate** | **废弃** — merge into `growth_actions` |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `name` | TEXT | NOT NULL |
| `hypothesis` | TEXT | DEFAULT '' |
| `target_page` | TEXT | DEFAULT '' |
| `metric` | TEXT | DEFAULT 'ctr' |
| `before_value` | REAL | |
| `after_value` | REAL | |
| `status` | TEXT | DEFAULT 'running' |
| `conclusion` | TEXT | DEFAULT '' |
| `started_at` | INTEGER | |
| `ended_at` | INTEGER | |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none)*

---

### 1.22  `ai_reports`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0009_aromiso_os.sql |
| **Last modified by** | 0009 (never altered) |
| **Row estimate** | ~20–100 |
| **Read frequency** | LOW (admin review) |
| **Write frequency** | MEDIUM (cron generates daily/weekly) |
| **Is orphan?** | NO — but may be superseded by `ai_daily_report` (0037) |
| **V2 fate** | **废弃** — consolidate into `ai_daily_report` |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `type` | TEXT | NOT NULL |
| `period` | TEXT | NOT NULL |
| `content` | TEXT | NOT NULL |
| `created_at` | INTEGER | NOT NULL |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none)*

**Indexes**:
- `idx_reports_type` ON `(type)`
- `idx_reports_period` ON `(period DESC)`

---

### 1.23  `audit_issues`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0009_aromiso_os.sql |
| **Last modified by** | 0009 (never altered) |
| **Row estimate** | ~10–100 |
| **Read frequency** | LOW (admin dashboard) |
| **Write frequency** | MEDIUM (cron Auditor writes) |
| **Is orphan?** | NO — active technical SEO auditing |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `severity` | TEXT | NOT NULL DEFAULT 'P2' |
| `type` | TEXT | DEFAULT '' |
| `page` | TEXT | DEFAULT '' |
| `detail` | TEXT | DEFAULT '' |
| `status` | TEXT | DEFAULT 'open' |
| `found_at` | INTEGER | NOT NULL |
| `fixed_at` | INTEGER | |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none)*

**Indexes**:
- `idx_audit_status` ON `(status)`
- `idx_audit_severity` ON `(severity)`

---

### 1.24  `ai_usage`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0009_aromiso_os.sql |
| **Last modified by** | 0009 (never altered) |
| **Row estimate** | ~200–2000 |
| **Read frequency** | LOW |
| **Write frequency** | HIGH (every AI call logs a row) |
| **Is orphan?** | **Possibly superseded** — `ai_cost_tracking` (0037) more granular |
| **V2 fate** | **废弃** — consolidate into `ai_cost_tracking` |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `role` | TEXT | DEFAULT '' |
| `model` | TEXT | DEFAULT '' |
| `tokens_in` | INTEGER | DEFAULT 0 |
| `tokens_out` | INTEGER | DEFAULT 0 |
| `cost_cny` | REAL | DEFAULT 0 |
| `created_at` | INTEGER | NOT NULL |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none)*

**Indexes**:
- `idx_usage_created` ON `(created_at DESC)`

---

### 1.25  `ai_feedback`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0019_ai_feedback_loop.sql |
| **Last modified by** | 0019 (never altered) |
| **Row estimate** | ~20–200 |
| **Read frequency** | LOW (Librarian consumes unread) |
| **Write frequency** | LOW (human feedback) |
| **Is orphan?** | NO — active learning loop |
| **V2 fate** | **保留不变** — core feedback loop, may absorb `decisions` |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `role` | TEXT | NOT NULL DEFAULT '' |
| `target_type` | TEXT | NOT NULL DEFAULT 'task' |
| `target_id` | INTEGER | |
| `rating` | TEXT | NOT NULL DEFAULT 'neutral' |
| `comment` | TEXT | DEFAULT '' |
| `ai_output` | TEXT | DEFAULT '' |
| `human_edit` | TEXT | DEFAULT '' |
| `consumed` | INTEGER | DEFAULT 0 |
| `created_at` | INTEGER | NOT NULL |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none)*

**Indexes**:
- `idx_ai_feedback_consumed` ON `(consumed, created_at DESC)`
- `idx_ai_feedback_role` ON `(role, created_at DESC)`

---

### 1.26  `ai_daily_briefs`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0014_ai_growth.sql |
| **Last modified by** | 0014 (never altered) |
| **Row estimate** | ~30–90 |
| **Read frequency** | LOW |
| **Write frequency** | MEDIUM (daily cron) |
| **Is orphan?** | **Possibly superseded** — `ai_daily_report` (0037) richer; check if cron still writes here |
| **V2 fate** | **废弃** — consolidate into `ai_daily_report` |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | TEXT | **PK** |
| `date` | TEXT | NOT NULL |
| `content_json` | TEXT | NOT NULL DEFAULT '{}' |
| `health_score` | INTEGER | NOT NULL DEFAULT 0 |
| `issues_count` | INTEGER | NOT NULL DEFAULT 0 |
| `opportunities_count` | INTEGER | NOT NULL DEFAULT 0 |
| `signals_count` | INTEGER | NOT NULL DEFAULT 0 |
| `created_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) |

**PK**: `id` (TEXT)

**Foreign Keys**: *(none)*

**Indexes**:
- `idx_briefs_date` ON `(date)` UNIQUE

---

### 1.27  `ai_opportunities`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0014_ai_growth.sql |
| **Last modified by** | 0014 (never altered) |
| **Row estimate** | ~50–500 |
| **Read frequency** | MEDIUM |
| **Write frequency** | MEDIUM |
| **Is orphan?** | **Possibly superseded** — `growth_opportunities` (0031) more mature |
| **V2 fate** | **废弃** — migrate data to `growth_opportunities` |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | TEXT | **PK** |
| `type` | TEXT | NOT NULL DEFAULT 'seo' |
| `title` | TEXT | NOT NULL DEFAULT '' |
| `description` | TEXT | NOT NULL DEFAULT '' |
| `priority` | TEXT | NOT NULL DEFAULT 'P1' |
| `status` | TEXT | NOT NULL DEFAULT 'pending' |
| `data_json` | TEXT | NOT NULL DEFAULT '{}' |
| `created_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) |
| `resolved_at` | INTEGER | |

**PK**: `id` (TEXT)

**Foreign Keys**: *(none)*

**Indexes**:
- `idx_opps_status` ON `(status, type)`

---

### 1.28  `ai_lead_scores`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0014_ai_growth.sql |
| **Last modified by** | 0014 (never altered) |
| **Row estimate** | ~50–500 |
| **Read frequency** | MEDIUM (admin inquiry review) |
| **Write frequency** | LOW (on new inquiry) |
| **Is orphan?** | NO — lead scoring active |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | TEXT | **PK** |
| `inquiry_id` | TEXT | NOT NULL (⚠ no FK) |
| `score` | INTEGER | NOT NULL DEFAULT 0 |
| `level` | TEXT | NOT NULL DEFAULT 'medium' |
| `factors_json` | TEXT | NOT NULL DEFAULT '{}' |
| `recommended_action` | TEXT | NOT NULL DEFAULT '' |
| `created_at` | INTEGER | NOT NULL DEFAULT (unixepoch()) |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ⚠ Missing FK: `inquiry_id` → `inquiries(id)`

**Indexes**:
- `idx_lead_inquiry` ON `(inquiry_id)`

---

### 1.29  `task_runs`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0026_os2_task_engine.sql |
| **Last modified by** | 0026 (never altered) |
| **Row estimate** | ~50–500 |
| **Read frequency** | MEDIUM (idempotency check before cron runs) |
| **Write frequency** | MEDIUM (every cron run writes a row) |
| **Is orphan?** | NO — vital OS 2.0 idempotency |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `task_id` | INTEGER | (⚠ no FK → tasks) |
| `idempotency_key` | TEXT | NOT NULL DEFAULT '' |
| `status` | TEXT | NOT NULL DEFAULT 'running' |
| `detail` | TEXT | DEFAULT '' |
| `started_at` | INTEGER | NOT NULL |
| `finished_at` | INTEGER | |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**:
- ⚠ Missing FK: `task_id` → `tasks(id)`

**Indexes**:
- `idx_runs_idem` ON `(idempotency_key)` UNIQUE WHERE `idempotency_key != ''`
- `idx_runs_task` ON `(task_id, started_at DESC)`

---

### 1.30  `growth_opportunities`

| Property | Value |
|----------|-------|
| **Domain** | growth |
| **Created by** | 0031_growth_intelligence.sql |
| **Last modified by** | 0032_growth_execution.sql (+`intent`, `score_json`) |
| **Row estimate** | ~50–500 |
| **Read frequency** | HIGH (Growth Action Board) |
| **Write frequency** | MEDIUM (weekly cron) |
| **Is orphan?** | NO — core growth engine |
| **V2 fate** | **新增列** — likely further Growth Engine columns |

| Column | Type | Constraints / Default | Migration |
|--------|------|-----------------------|-----------|
| `id` | INTEGER | **PK** AUTOINCREMENT | 0031 |
| `week` | TEXT | NOT NULL | 0031 |
| `opp_type` | TEXT | NOT NULL | 0031 |
| `page` | TEXT | NOT NULL DEFAULT '' | 0031 |
| `query` | TEXT | NOT NULL DEFAULT '' | 0031 |
| `priority` | TEXT | NOT NULL | 0031 |
| `exec_level` | TEXT | NOT NULL | 0031 |
| `reason` | TEXT | NOT NULL | 0031 |
| `suggested_action` | TEXT | NOT NULL | 0031 |
| `metrics_json` | TEXT | NOT NULL DEFAULT '{}' | 0031 |
| `status` | TEXT | NOT NULL DEFAULT 'new' | 0031 |
| `task_id` | INTEGER | | 0031 |
| `created_at` | INTEGER | NOT NULL | 0031 |
| `intent` | TEXT | NOT NULL DEFAULT '' | 0032 |
| `score_json` | TEXT | NOT NULL DEFAULT '{}' | 0032 |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none — hub, referenced by growth_actions)*

**Indexes**:
- `idx_growth_opp_week` ON `(week, status)`

---

### 1.31  `growth_actions`

| Property | Value |
|----------|-------|
| **Domain** | growth |
| **Created by** | 0031_growth_intelligence.sql |
| **Last modified by** | 0031 (never altered) |
| **Row estimate** | ~20–200 |
| **Read frequency** | MEDIUM (Growth Memory, T+14 verification) |
| **Write frequency** | LOW (when action applied) |
| **Is orphan?** | NO — growth memory active |
| **V2 fate** | **新增列** — may need more outcome fields |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `opp_id` | INTEGER | NOT NULL (⚠ no FK → growth_opportunities) |
| `action` | TEXT | NOT NULL |
| `exec_level` | TEXT | NOT NULL |
| `applied_at` | INTEGER | NOT NULL |
| `before_json` | TEXT | NOT NULL DEFAULT '{}' |
| `after_json` | TEXT | NOT NULL DEFAULT '{}' |
| `verify_after` | TEXT | |
| `outcome` | TEXT | |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**:
- ⚠ Missing FK: `opp_id` → `growth_opportunities(id)`

---

### 1.32  `index_status`

| Property | Value |
|----------|-------|
| **Domain** | growth |
| **Created by** | 0031_growth_intelligence.sql |
| **Last modified by** | 0031 (never altered) |
| **Row estimate** | ~50–500 |
| **Read frequency** | LOW (Index Monitor dashboard) |
| **Write frequency** | LOW (≤20 URL inspections/run) |
| **Is orphan?** | NO — Index Monitor active |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `url` | TEXT | **PK** |
| `status` | TEXT | NOT NULL |
| `detail` | TEXT | NOT NULL DEFAULT '' |
| `inspected_at` | INTEGER | NOT NULL |

**PK**: `url` (TEXT)

**Foreign Keys**: *(none)*

---

### 1.33  `ai_missions`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0037_ai_autonomous_operations.sql |
| **Last modified by** | 0037 (never altered) |
| **Row estimate** | ~20–200 |
| **Read frequency** | HIGH (AI Command Center, daily report) |
| **Write frequency** | MEDIUM (every autonomous AI run) |
| **Is orphan?** | NO — central AI Control Tower table |
| **V2 fate** | **新增列** — likely further mission metadata |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `mission_id` | TEXT | UNIQUE NOT NULL |
| `mission_type` | TEXT | NOT NULL |
| `status` | TEXT | DEFAULT 'scheduled' |
| `scheduled_at` | INTEGER | |
| `started_at` | INTEGER | |
| `completed_at` | INTEGER | |
| `duration_seconds` | INTEGER | |
| `agent_name` | TEXT | |
| `model_used` | TEXT | |
| `prompt_version` | TEXT | |
| `input_data` | JSON* | |
| `target_pages` | TEXT[]* | |
| `target_queries` | TEXT[]* | |
| `output_summary` | TEXT | |
| `actions_taken` | TEXT[]* | |
| `tasks_created` | INTEGER | |
| `recommendations_count` | INTEGER | |
| `blocked_reason` | TEXT | |
| `error_message` | TEXT | |
| `retry_count` | INTEGER | DEFAULT 0 |
| `token_usage` | INTEGER | |
| `cost_usd` | REAL | |
| `human_approval_needed` | BOOLEAN* | DEFAULT FALSE |
| `human_approved_by` | TEXT | |
| `human_approval_timestamp` | INTEGER | |
| `human_corrections` | TEXT | |
| `outcome` | TEXT | |
| `quality_score` | REAL | |
| `created_at` | INTEGER | NOT NULL |
| `updated_at` | INTEGER | NOT NULL |

> \* `JSON`, `TEXT[]`, `BOOLEAN` are non-SQLite types — stored as TEXT in D1 practice. The DDL declares them but SQLite ignores the type constraint.

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none — hub, referenced by ai_action_logs)*

**Indexes**:
- `idx_ai_missions_status` ON `(status)`
- `idx_ai_missions_agent` ON `(agent_name)`
- `idx_ai_missions_model` ON `(model_used)`
- `idx_ai_missions_created` ON `(created_at)`

---

### 1.34  `ai_action_logs`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0037_ai_autonomous_operations.sql |
| **Last modified by** | 0037 (never altered) |
| **Row estimate** | ~100–2000 |
| **Read frequency** | MEDIUM (mission detail view) |
| **Write frequency** | HIGH (every AI tool call) |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `mission_id` | TEXT | NOT NULL **FK → ai_missions(mission_id)** |
| `action_type` | TEXT | NOT NULL |
| `tool_used` | TEXT | |
| `step_number` | INTEGER | |
| `step_input` | JSON* | |
| `step_output` | JSON* | |
| `tool_args` | JSON* | |
| `fact_check_result` | TEXT | |
| `truthfulness_flags` | TEXT[]* | |
| `confidence_score` | REAL | |
| `started_at` | INTEGER | |
| `completed_at` | INTEGER | |
| `duration_ms` | INTEGER | |
| `success` | BOOLEAN* | DEFAULT TRUE |
| `error_message` | TEXT | |
| `affected_files` | TEXT[]* | |
| `sandbox_mode` | BOOLEAN* | DEFAULT TRUE |
| `created_at` | INTEGER | NOT NULL |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**:
- ✅ `mission_id` → `ai_missions(mission_id)` (explicit FK)

**Indexes**:
- `idx_action_logs_mission` ON `(mission_id)`

---

### 1.35  `ai_cost_tracking`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0037_ai_autonomous_operations.sql |
| **Last modified by** | 0037 (never altered) |
| **Row estimate** | ~30–90 |
| **Read frequency** | MEDIUM (cost dashboard) |
| **Write frequency** | MEDIUM (daily aggregation) |
| **Is orphan?** | NO — supersedes `ai_usage` |
| **V2 fate** | **保留不变** — may absorb `ai_usage` data |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `date` | TEXT | NOT NULL |
| `model_name` | TEXT | NOT NULL |
| `total_tokens` | INTEGER | |
| `request_count` | INTEGER | |
| `cost_usd` | REAL | NOT NULL |
| `gsc_tasks_cost` | REAL | |
| `growth_tasks_cost` | REAL | |
| `seo_tasks_cost` | REAL | |
| `content_tasks_cost` | REAL | |
| `notes` | TEXT | |
| `created_at` | INTEGER | NOT NULL |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none)*

**Indexes**:
- `idx_cost_date` ON `(date)`

---

### 1.36  `ai_daily_report`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0037_ai_autonomous_operations.sql |
| **Last modified by** | 0038_agent_health_score.sql (+`health_score`, `health_json`) |
| **Row estimate** | ~10–60 |
| **Read frequency** | HIGH (AI Control Tower daily view) |
| **Write frequency** | MEDIUM (daily cron) |
| **Is orphan?** | NO — supersedes `ai_daily_briefs` and `ai_reports` |
| **V2 fate** | **新增列** — likely further health dimensions |

| Column | Type | Constraints / Default | Migration |
|--------|------|-----------------------|-----------|
| `id` | INTEGER | **PK** AUTOINCREMENT | 0037 |
| `report_date` | TEXT | NOT NULL UNIQUE | 0037 |
| `total_missions` | INTEGER | DEFAULT 0 | 0037 |
| `completed_missions` | INTEGER | DEFAULT 0 | 0037 |
| `skipped_missions` | INTEGER | DEFAULT 0 | 0037 |
| `blocked_missions` | INTEGER | DEFAULT 0 | 0037 |
| `auto_executions` | INTEGER | DEFAULT 0 | 0037 |
| `human_reviewed` | INTEGER | DEFAULT 0 | 0037 |
| `analysis_only` | INTEGER | DEFAULT 0 | 0037 |
| `seo_actions` | INTEGER | DEFAULT 0 | 0037 |
| `growth_actions` | INTEGER | DEFAULT 0 | 0037 |
| `content_actions` | INTEGER | DEFAULT 0 | 0037 |
| `bdf_actions` | INTEGER | DEFAULT 0 | 0037 |
| `factual_violations` | INTEGER | DEFAULT 0 | 0037 |
| `warnings_generated` | INTEGER | DEFAULT 0 | 0037 |
| `blocks_triggered` | INTEGER | DEFAULT 0 | 0037 |
| `total_cost_usd` | REAL | DEFAULT 0 | 0037 |
| `total_tokens` | INTEGER | DEFAULT 0 | 0037 |
| `priority_items` | TEXT[]* | | 0037 |
| `risk_alerts` | TEXT[]* | | 0037 |
| `ai_recommendation` | TEXT | | 0037 |
| `generated_at` | INTEGER | NOT NULL | 0037 |
| `health_score` | REAL | | 0038 |
| `health_json` | TEXT | DEFAULT '{}' | 0038 |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none)*

**Indexes**:
- `idx_report_date` ON `(report_date)`

---

### 1.37  `ai_mission_plan`

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0037_ai_autonomous_operations.sql |
| **Last modified by** | 0037 (never altered) |
| **Row estimate** | ~5–30 |
| **Read frequency** | MEDIUM (daily planning view) |
| **Write frequency** | LOW (daily planner run) |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `plan_date` | TEXT | NOT NULL |
| `horizon_type` | TEXT | NOT NULL |
| `planned_missions` | JSON* | |
| `actual_completed` | INTEGER | DEFAULT 0 |
| `actual_skipped` | INTEGER | DEFAULT 0 |
| `confidence_score` | REAL | |
| `planner_agent` | TEXT | |
| `created_at` | INTEGER | NOT NULL |
| `updated_at` | INTEGER | NOT NULL |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none)*

**Indexes**:
- `idx_plan_date` ON `(plan_date)`

---

### 1.38  `knowledge_base`  *(V4.3 legacy knowledge)*

| Property | Value |
|----------|-------|
| **Domain** | ai |
| **Created by** | 0008_knowledge_base.sql |
| **Last modified by** | 0008 (never altered) |
| **Row estimate** | ~10–50 |
| **Read frequency** | LOW (possibly zero — check API) |
| **Write frequency** | LOW (possibly zero) |
| **Is orphan?** | **Likely orphaned** — superseded by `knowledge` (0009) |
| **V2 fate** | **废弃** — migrate relevant data to `knowledge`, then drop |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `category` | TEXT | NOT NULL DEFAULT 'general' |
| `title` | TEXT | NOT NULL |
| `detail` | TEXT | NOT NULL |
| `source` | TEXT | DEFAULT '' |
| `importance` | INTEGER | DEFAULT 5 |
| `created_at` | INTEGER | NOT NULL |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none)*

**Indexes**:
- `idx_kb_category` ON `(category)`
- `idx_kb_importance` ON `(importance DESC)`

---

### 1.39  `video_assets`

| Property | Value |
|----------|-------|
| **Domain** | video |
| **Created by** | 0042_video_center.sql |
| **Last modified by** | 0048_video_content_package_parts.sql (+`package_parts_json`) |
| **Row estimate** | ~10–100 |
| **Read frequency** | MEDIUM (public video pages, admin Video Center) |
| **Write frequency** | LOW (admin upload/process) |
| **Is orphan?** | NO — core video hub |
| **V2 fate** | **保留不变** — V1 lean schema; sufficient for now |

| Column | Type | Constraints / Default | Migration |
|--------|------|-----------------------|-----------|
| `id` | TEXT | **PK** | 0042 |
| `title` | TEXT | NOT NULL DEFAULT '' | 0042 |
| `source` | TEXT | NOT NULL DEFAULT 'manual' | 0042 |
| `source_url` | TEXT | NOT NULL DEFAULT '' | 0042 |
| `original_url` | TEXT | NOT NULL DEFAULT '' | 0042 |
| `processed_url` | TEXT | NOT NULL DEFAULT '' | 0042 |
| `cover_url` | TEXT | NOT NULL DEFAULT '' | 0042 |
| `duration_s` | INTEGER | NOT NULL DEFAULT 0 | 0042 |
| `size_bytes` | INTEGER | NOT NULL DEFAULT 0 | 0042 |
| `status` | TEXT | NOT NULL DEFAULT 'ingested' | 0042 |
| `notes` | TEXT | NOT NULL DEFAULT '' | 0042 |
| `created_at` | TEXT | NOT NULL DEFAULT '' | 0042 |
| `updated_at` | TEXT | NOT NULL DEFAULT '' | 0042 |
| `video_code` | TEXT | | 0043 |
| `internal_title` | TEXT | NOT NULL DEFAULT '' | 0046 |
| `internal_description` | TEXT | NOT NULL DEFAULT '' | 0046 |
| `processing_status` | TEXT | NOT NULL DEFAULT 'ingested' | 0046 |
| `editorial_status` | TEXT | NOT NULL DEFAULT 'draft' | 0046 |
| `category` | TEXT | NOT NULL DEFAULT '' | 0046 |
| `tags_json` | TEXT | NOT NULL DEFAULT '[]' | 0046 |
| `width` | INTEGER | NOT NULL DEFAULT 0 | 0046 |
| `height` | INTEGER | NOT NULL DEFAULT 0 | 0046 |
| `aspect_ratio` | REAL | NOT NULL DEFAULT 0 | 0046 |
| `orientation` | TEXT | NOT NULL DEFAULT '' | 0046 |
| `format` | TEXT | NOT NULL DEFAULT '' | 0046 |
| `featured` | INTEGER | NOT NULL DEFAULT 0 | 0046 |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 | 0046 |
| `studio_job_id` | TEXT | NOT NULL DEFAULT '' | 0047 |
| `video_sha256` | TEXT | NOT NULL DEFAULT '' | 0047 |
| `cover_sha256` | TEXT | NOT NULL DEFAULT '' | 0047 |
| `content_package_hash` | TEXT | NOT NULL DEFAULT '' | 0047 |
| `content_package_status` | TEXT | NOT NULL DEFAULT 'none' | 0047 |
| `package_parts_json` | TEXT | NOT NULL DEFAULT '{}' | 0048 |

> ⚠ 32 columns — second-widest table. Consider vertical split in V2.

**PK**: `id` (TEXT)

**Foreign Keys**: *(none — hub, referenced by 6 video tables)*

**Indexes**:
- `idx_video_assets_code` ON `(video_code)` UNIQUE (0043)
- `idx_video_assets_studio_job` ON `(source, studio_job_id)` UNIQUE WHERE `studio_job_id != ''` (0047)
- `idx_video_assets_processing_status` ON `(processing_status)` (0046)
- `idx_video_assets_editorial_status` ON `(editorial_status)` (0046)
- `idx_video_assets_category` ON `(category)` (0046)
- `idx_video_assets_orientation` ON `(orientation)` (0046)
- `idx_video_assets_featured_order` ON `(featured, sort_order)` (0046)

---

### 1.40  `video_product_links`

| Property | Value |
|----------|-------|
| **Domain** | video |
| **Created by** | 0042_video_center.sql |
| **Last modified by** | 0042 (never altered) |
| **Row estimate** | ~10–100 |
| **Read frequency** | MEDIUM (linking videos to products) |
| **Write frequency** | LOW |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | TEXT | **PK** |
| `video_id` | TEXT | NOT NULL (⚠ no FK) |
| `product_id` | TEXT | NOT NULL (⚠ no FK) |
| `created_at` | TEXT | NOT NULL DEFAULT '' |
| | | **UNIQUE**(video_id, product_id) |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ⚠ Missing FK: `video_id` → `video_assets(id)`
- ⚠ Missing FK: `product_id` → `commerce_products(id)`

**Indexes**:
- `idx_vpl_product` ON `(product_id)`
- `idx_vpl_video` ON `(video_id)`

---

### 1.41  `video_publications`

| Property | Value |
|----------|-------|
| **Domain** | video |
| **Created by** | 0042_video_center.sql |
| **Last modified by** | 0047_video_content_package.sql (+`locale`, reindex) |
| **Row estimate** | ~10–100 |
| **Read frequency** | MEDIUM (public video pages) |
| **Write frequency** | LOW |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default | Migration |
|--------|------|-----------------------|-----------|
| `id` | TEXT | **PK** | 0042 |
| `video_id` | TEXT | NOT NULL (⚠ no FK) | 0042 |
| `channel` | TEXT | NOT NULL DEFAULT 'pdp' | 0042 |
| `target_url` | TEXT | NOT NULL DEFAULT '' | 0042 |
| `status` | TEXT | NOT NULL DEFAULT 'live' | 0042 |
| `published_at` | TEXT | NOT NULL DEFAULT '' | 0042 |
| `updated_at` | TEXT | NOT NULL DEFAULT '' | 0042 |
| `locale` | TEXT | NOT NULL DEFAULT '' | 0047 |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ⚠ Missing FK: `video_id` → `video_assets(id)`

**Indexes**:
- `idx_vpub_video_channel_locale` ON `(video_id, channel, locale)` UNIQUE (0047, replaces 0045 index)
- `idx_video_publications_channel_status` ON `(channel, status)` (0046)

---

### 1.42  `video_asset_translations`

| Property | Value |
|----------|-------|
| **Domain** | video |
| **Created by** | 0046_video_content_hub.sql |
| **Last modified by** | 0047_video_content_package.sql (+`manual_fields_json`) |
| **Row estimate** | ~30–300 |
| **Read frequency** | MEDIUM (public video pages, 3 locales) |
| **Write frequency** | LOW (AI content generation, human edits) |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default | Migration |
|--------|------|-----------------------|-----------|
| `id` | TEXT | **PK** | 0046 |
| `video_id` | TEXT | NOT NULL (⚠ no FK) | 0046 |
| `locale` | TEXT | NOT NULL | 0046 |
| `title` | TEXT | NOT NULL DEFAULT '' | 0046 |
| `description` | TEXT | NOT NULL DEFAULT '' | 0046 |
| `seo_title` | TEXT | NOT NULL DEFAULT '' | 0046 |
| `seo_description` | TEXT | NOT NULL DEFAULT '' | 0046 |
| `translation_status` | TEXT | NOT NULL DEFAULT 'draft' | 0046 |
| `updated_at` | TEXT | NOT NULL DEFAULT '' | 0046 |
| `manual_fields_json` | TEXT | NOT NULL DEFAULT '[]' | 0047 |
| | | **UNIQUE**(video_id, locale) | |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ⚠ Missing FK: `video_id` → `video_assets(id)`

**Indexes**:
- `idx_video_translations_video_locale` ON `(video_id, locale)` (0046)

---

### 1.43  `video_transcripts`

| Property | Value |
|----------|-------|
| **Domain** | video |
| **Created by** | 0047_video_content_package.sql |
| **Last modified by** | 0047 (never altered) |
| **Row estimate** | ~10–100 |
| **Read frequency** | MEDIUM (AI content generation input) |
| **Write frequency** | LOW (Local Studio generates) |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | TEXT | **PK** |
| `video_id` | TEXT | NOT NULL (⚠ no FK) |
| `language` | TEXT | NOT NULL |
| `text` | TEXT | NOT NULL DEFAULT '' |
| `segments_json` | TEXT | NOT NULL DEFAULT '[]' |
| `source` | TEXT | NOT NULL DEFAULT 'local_studio' |
| `model` | TEXT | NOT NULL DEFAULT '' |
| `source_hash` | TEXT | NOT NULL DEFAULT '' |
| `status` | TEXT | NOT NULL DEFAULT 'ready' |
| `created_at` | TEXT | NOT NULL DEFAULT '' |
| `updated_at` | TEXT | NOT NULL DEFAULT '' |
| | | **UNIQUE**(video_id, language, source_hash) |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ⚠ Missing FK: `video_id` → `video_assets(id)`

**Indexes**:
- `idx_vt_video` ON `(video_id)`

---

### 1.44  `video_content_runs`

| Property | Value |
|----------|-------|
| **Domain** | video |
| **Created by** | 0047_video_content_package.sql |
| **Last modified by** | 0047 (never altered) |
| **Row estimate** | ~10–100 |
| **Read frequency** | MEDIUM (content run review) |
| **Write frequency** | LOW (AI content generation) |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | TEXT | **PK** |
| `video_id` | TEXT | NOT NULL (⚠ no FK) |
| `transcript_id` | TEXT | NOT NULL (⚠ no FK) |
| `status` | TEXT | NOT NULL DEFAULT 'running' |
| `provider` | TEXT | NOT NULL DEFAULT '' |
| `model` | TEXT | NOT NULL DEFAULT '' |
| `role` | TEXT | NOT NULL DEFAULT 'video_content_editor' |
| `prompt_version` | TEXT | NOT NULL DEFAULT '' |
| `input_hash` | TEXT | NOT NULL DEFAULT '' |
| `output_json` | TEXT | NOT NULL DEFAULT '{}' |
| `error` | TEXT | NOT NULL DEFAULT '' |
| `created_at` | TEXT | NOT NULL DEFAULT '' |
| `finished_at` | TEXT | NOT NULL DEFAULT '' |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ⚠ Missing FK: `video_id` → `video_assets(id)`
- ⚠ Missing FK: `transcript_id` → `video_transcripts(id)`

**Indexes**:
- `idx_vcr_video` ON `(video_id)`

---

### 1.45  `video_content_suggestions`

| Property | Value |
|----------|-------|
| **Domain** | video |
| **Created by** | 0047_video_content_package.sql |
| **Last modified by** | 0047 (never altered) |
| **Row estimate** | ~30–300 |
| **Read frequency** | MEDIUM (content review workflow) |
| **Write frequency** | LOW (AI content generation) |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | TEXT | **PK** |
| `run_id` | TEXT | NOT NULL (⚠ no FK) |
| `video_id` | TEXT | NOT NULL (⚠ no FK) |
| `locale` | TEXT | NOT NULL DEFAULT 'en' |
| `field_name` | TEXT | NOT NULL |
| `value_json` | TEXT | NOT NULL DEFAULT 'null' |
| `evidence_json` | TEXT | NOT NULL DEFAULT '[]' |
| `confidence` | REAL | |
| `applied` | INTEGER | NOT NULL DEFAULT 0 |
| `applied_at` | TEXT | NOT NULL DEFAULT '' |
| `created_at` | TEXT | NOT NULL DEFAULT '' |

**PK**: `id` (TEXT)

**Foreign Keys**:
- ⚠ Missing FK: `run_id` → `video_content_runs(id)`
- ⚠ Missing FK: `video_id` → `video_assets(id)`

**Indexes**:
- `idx_vcs_run` ON `(run_id)`
- `idx_vcs_video` ON `(video_id)`

---

### 1.46  `behavior_events`

| Property | Value |
|----------|-------|
| **Domain** | analytics |
| **Created by** | 0004_behavior_events.sql |
| **Last modified by** | 0029_behavior_event_label.sql (+`label`) |
| **Row estimate** | ~1000–10000 |
| **Read frequency** | MEDIUM (dashboard, AI analysis) |
| **Write frequency** | HIGH (every page view/click) |
| **Is orphan?** | NO — active self-built analytics |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `event_type` | TEXT | NOT NULL |
| `page` | TEXT | |
| `product_slug` | TEXT | |
| `lang` | TEXT | |
| `country` | TEXT | |
| `device` | TEXT | |
| `referrer` | TEXT | |
| `session_id` | TEXT | |
| `created_at` | INTEGER | NOT NULL |
| `label` | TEXT | DEFAULT '' (added 0029) |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none)*

**Indexes**:
- `idx_behavior_type_time` ON `(event_type, created_at)`
- `idx_behavior_product` ON `(product_slug, created_at)`
- `idx_behavior_session` ON `(session_id)`

---

### 1.47  `gsc_daily`

| Property | Value |
|----------|-------|
| **Domain** | analytics |
| **Created by** | 0005_google_snapshots.sql |
| **Last modified by** | 0005 (never altered) |
| **Row estimate** | ~5000–50000 |
| **Read frequency** | HIGH (dashboards, AI analysis, cron pulls) |
| **Write frequency** | HIGH (daily cron pull) |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `date` | TEXT | NOT NULL |
| `dimension` | TEXT | NOT NULL |
| `key` | TEXT | NOT NULL |
| `clicks` | INTEGER | DEFAULT 0 |
| `impressions` | INTEGER | DEFAULT 0 |
| `ctr` | REAL | DEFAULT 0 |
| `position` | REAL | DEFAULT 0 |
| | | **PK**(date, dimension, key) |

**PK**: `(date, dimension, key)` composite

**Foreign Keys**: *(none)*

---

### 1.48  `ga_daily`

| Property | Value |
|----------|-------|
| **Domain** | analytics |
| **Created by** | 0005_google_snapshots.sql |
| **Last modified by** | 0005 (never altered) |
| **Row estimate** | ~2000–20000 |
| **Read frequency** | HIGH |
| **Write frequency** | HIGH (daily cron pull) |
| **Is orphan?** | NO |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `date` | TEXT | NOT NULL |
| `dimension` | TEXT | NOT NULL |
| `key` | TEXT | NOT NULL |
| `users` | INTEGER | DEFAULT 0 |
| `sessions` | INTEGER | DEFAULT 0 |
| `bounce_rate` | REAL | DEFAULT 0 |
| `avg_time` | REAL | DEFAULT 0 |
| | | **PK**(date, dimension, key) |

**PK**: `(date, dimension, key)` composite

**Foreign Keys**: *(none)*

---

### 1.49  `daily_recs`

| Property | Value |
|----------|-------|
| **Domain** | analytics |
| **Created by** | 0006_daily_recs.sql |
| **Last modified by** | 0006 (never altered) |
| **Row estimate** | ~50–500 |
| **Read frequency** | LOW |
| **Write frequency** | LOW (possibly zero — verify cron) |
| **Is orphan?** | **Likely orphaned** — superseded by `growth_opportunities` (0031) and `ai_opportunities` (0014) |
| **V2 fate** | **废弃** — legacy V4.1 system, no longer read |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `date` | TEXT | NOT NULL |
| `category` | TEXT | NOT NULL |
| `priority` | TEXT | NOT NULL DEFAULT 'medium' |
| `title` | TEXT | NOT NULL |
| `detail` | TEXT | |
| `metric_val` | REAL | DEFAULT 0 |
| `created_at` | INTEGER | NOT NULL |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**: *(none)*

**Indexes**:
- `idx_daily_recs_date` ON `(date)`
- `idx_daily_recs_category` ON `(category)`

---

### 1.50  `gsc_query_page`

| Property | Value |
|----------|-------|
| **Domain** | growth |
| **Created by** | 0031_growth_intelligence.sql |
| **Last modified by** | 0031 (never altered) |
| **Row estimate** | ~10000–100000 |
| **Read frequency** | HIGH (Opportunity Engine core input) |
| **Write frequency** | HIGH (daily cron pull, top 500 combos/day) |
| **Is orphan?** | NO — core growth data source |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `date` | TEXT | NOT NULL |
| `query` | TEXT | NOT NULL |
| `page` | TEXT | NOT NULL |
| `clicks` | INTEGER | DEFAULT 0 |
| `impressions` | INTEGER | DEFAULT 0 |
| `ctr` | REAL | DEFAULT 0 |
| `position` | REAL | DEFAULT 0 |
| | | **PK**(date, query, page) |

**PK**: `(date, query, page)` composite

**Foreign Keys**: *(none)*

---

### 1.51  `pull_state`

| Property | Value |
|----------|-------|
| **Domain** | system |
| **Created by** | 0039_analytics_backfill.sql |
| **Last modified by** | 0039 (never altered) |
| **Row estimate** | ~100–500 |
| **Read frequency** | MEDIUM (data pull orchestration) |
| **Write frequency** | MEDIUM (every cron pull updates) |
| **Is orphan?** | NO — vital for backfill/resilience |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `source` | TEXT | NOT NULL |
| `date` | TEXT | NOT NULL |
| `status` | TEXT | NOT NULL DEFAULT 'pending' |
| `rows` | INTEGER | NOT NULL DEFAULT 0 |
| `attempts` | INTEGER | NOT NULL DEFAULT 0 |
| `updated_at` | INTEGER | NOT NULL DEFAULT 0 |
| | | **PK**(source, date) |

**PK**: `(source, date)` composite

**Foreign Keys**: *(none)*

---

### 1.52  `email_messages`

| Property | Value |
|----------|-------|
| **Domain** | system |
| **Created by** | 0010_email_messages.sql |
| **Last modified by** | 0010 (never altered) |
| **Row estimate** | ~20–200 |
| **Read frequency** | MEDIUM (admin inquiry thread view) |
| **Write frequency** | LOW (outbound/inbound emails) |
| **Is orphan?** | NO — Resend integration active |
| **V2 fate** | **保留不变** |

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | INTEGER | **PK** AUTOINCREMENT |
| `inquiry_id` | TEXT | NOT NULL (⚠ no FK → inquiries) |
| `direction` | TEXT | NOT NULL DEFAULT 'outbound' |
| `from_email` | TEXT | NOT NULL |
| `to_email` | TEXT | NOT NULL |
| `subject` | TEXT | DEFAULT '' |
| `body_html` | TEXT | DEFAULT '' |
| `body_text` | TEXT | DEFAULT '' |
| `message_id` | TEXT | DEFAULT '' |
| `in_reply_to` | TEXT | DEFAULT '' |
| `status` | TEXT | DEFAULT 'sent' |
| `created_at` | INTEGER | NOT NULL |

**PK**: `id` (INTEGER AUTOINCREMENT)

**Foreign Keys**:
- ⚠ Missing FK: `inquiry_id` → `inquiries(id)`

**Indexes**:
- `idx_email_inquiry` ON `(inquiry_id)`
- `idx_email_created` ON `(created_at DESC)`

---

## 2. Table-to-Table Relationship Diagram

### Core dependency graph (arrow = references / FK)

```
┌─────────────────────────────────────────────────────────────┐
│                     CONTENT HUB                              │
│                                                              │
│  inquiries ─────────────────────────────────────┐            │
│    ├── email_messages.inquiry_id ⚠ (no FK)     │            │
│    ├── ai_lead_scores.inquiry_id ⚠ (no FK)     │            │
│    └── source_video_id → video_assets (logical) │            │
│                                                  │            │
└──────────────────────────────────────────────────┼──────────┘
                                                   │
┌──────────────────────────────────────────────────┼──────────┐
│                   COMMERCE HUB                    │          │
│                                                   │          │
│  commerce_products (66 cols) ◄────────────────────┼────┐     │
│    ├── commerce_product_variants.product_id FK CASCADE   │     │
│    │     ├── commerce_price_tiers.variant_id FK CASCADE  │     │
│    │     └── commerce_product_images.variant_id FK SET NULL│   │
│    ├── commerce_price_tiers.product_id FK CASCADE       │     │
│    ├── commerce_product_images.product_id FK CASCADE    │     │
│    ├── commerce_product_reviews.product_id FK CASCADE   │     │
│    ├── commerce_product_questions.product_id FK CASCADE │     │
│    ├── product_merchandising.product_id ⚠ (no FK)      │     │
│    ├── video_product_links.product_id ⚠ (no FK)        │     │
│    └── commerce_order_items.product_id ⚠ (no FK)       │     │
│                                                          │     │
│  commerce_orders ──────────────────────────────────┐     │     │
│    ├── commerce_order_items.order_id FK CASCADE     │     │     │
│    ├── commerce_order_events.order_id FK CASCADE    │     │     │
│    └── commerce_product_reviews.order_id FK SET NULL│     │     │
│                                                      │     │     │
│  commerce_import_jobs ───┐                           │     │     │
│    └── commerce_import_errors.job_id FK CASCADE      │     │     │
│                                                      │     │     │
│  commerce_settings (standalone key-value)            │     │     │
│  commerce_image_nos (standalone, keyed by URL)       │     │     │
└──────────────────────────────────────────────────────┼─────┼────┘
                                                       │     │
┌──────────────────────────────────────────────────────┼─────┼────┐
│                     VIDEO HUB                         │     │    │
│                                                       │     │    │
│  video_assets (32 cols) ◄─────────────────────────────┼─────┼──┐ │
│    ├── video_product_links.video_id ⚠ (no FK)        │     │  │ │
│    │     └── product_id → commerce_products ⚠─────────┘     │  │ │
│    ├── video_publications.video_id ⚠ (no FK)                │  │ │
│    ├── video_asset_translations.video_id ⚠ (no FK)          │  │ │
│    ├── video_transcripts.video_id ⚠ (no FK)                 │  │ │
│    ├── video_content_runs.video_id ⚠ (no FK)                │  │ │
│    │     └── video_content_suggestions.run_id ⚠ (no FK)     │  │ │
│    └── video_content_suggestions.video_id ⚠ (no FK)         │  │ │
│                                                              │  │ │
│  inquiries.source_video_id → video_assets (logical) ────────┘  │ │
│                                                                 │ │
└─────────────────────────────────────────────────────────────────┘ │
                                                                    │
┌───────────────────────────────────────────────────────────────────┼──┐
│                     AI / GROWTH / OS HUB                          │  │
│                                                                    │  │
│  ai_roles (standalone, seeded)                                     │  │
│  knowledge (standalone, four-level)                                │  │
│  knowledge_base (standalone, legacy — ⚠ ORPHAN)                    │  │
│  decisions (standalone)                                            │  │
│    └── task_id ⚠ (no FK → tasks)                                  │  │
│                                                                     │  │
│  tasks ◄──────────────────────────────────────────────────────────┘  │
│    └── task_runs.task_id ⚠ (no FK)                                  │
│                                                                      │
│  experiments (standalone — ⚠ POSSIBLY UNUSED)                        │
│  ai_reports (standalone — ⚠ SUPERSEDED)                              │
│  audit_issues (standalone)                                           │
│  ai_usage (standalone — ⚠ SUPERSEDED)                                │
│  ai_feedback (standalone, learning loop)                             │
│  ai_daily_briefs (standalone — ⚠ SUPERSEDED)                         │
│  ai_opportunities (standalone — ⚠ SUPERSEDED)                        │
│  ai_lead_scores ─────────────────────────────────────────────────────┤
│    └── inquiry_id ⚠ (no FK → inquiries) ─────────────────────────────┘
│                                                                       │
│  growth_opportunities ◄────────────────────────────────────────────── │
│    └── growth_actions.opp_id ⚠ (no FK)                                │
│                                                                        │
│  index_status (standalone)                                             │
│                                                                         │
│  ai_missions ──────────────────────────────────────────────────────────┤
│    └── ai_action_logs.mission_id FK ✅ (explicit)                      │
│                                                                         │
│  ai_cost_tracking (standalone)                                          │
│  ai_daily_report (standalone)                                           │
│  ai_mission_plan (standalone)                                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐
│         ANALYTICS / SYSTEM            │
│                                       │
│  behavior_events (standalone)         │
│  gsc_daily (standalone)               │
│  ga_daily (standalone)                │
│  daily_recs (standalone — ⚠ ORPHAN)  │
│  gsc_query_page (standalone)          │
│  pull_state (standalone)              │
│  email_messages ──────────────────────┤
│    └── inquiry_id ⚠ (no FK)          │
│  subscribers (standalone)             │
└──────────────────────────────────────┘

LEGEND:
  ✅ = explicit FK constraint exists
  ⚠  = logical relationship, no FK constraint
  ──→ = references / depends on
  ◄── = referenced by
```

---

## 3. Migration-to-Table Index

| Migration | Tables Created | Tables Altered |
|-----------|---------------|----------------|
| **0001** | `inquiries` | — |
| **0002** | — | seed data only (sample inquiries) |
| **0003** | `subscribers` | — |
| **0004** | `behavior_events` | — |
| **0005** | `gsc_daily`, `ga_daily` | — |
| **0006** | `daily_recs` | — |
| **0007** | — | `inquiries` +`session_id` |
| **0008** | `knowledge_base` | — |
| **0009** | `ai_roles`, `knowledge`, `decisions`, `tasks`, `experiments`, `ai_reports`, `audit_issues`, `ai_usage` | — |
| **0010** | `email_messages` | — |
| **0011** | `commerce_products`, `commerce_product_variants`, `commerce_price_tiers`, `commerce_orders`, `commerce_order_items`, `commerce_order_events`, `commerce_settings` | — |
| **0012** | `commerce_product_images`, `commerce_import_jobs`, `commerce_import_errors` | `commerce_products` +6 cols (source tracking) |
| **0013** | `commerce_product_reviews`, `commerce_product_questions` | `commerce_products` +14 cols (PDP fields) |
| **0014** | `ai_daily_briefs`, `ai_opportunities`, `ai_lead_scores` | — |
| **0015** | — | `commerce_products` +`tags` |
| **0016** | — | data fix (spam marking on `inquiries`) |
| **0017** | — | seed `ai_roles` row (`translator`) |
| **0018** | — | seed `ai_roles` row (`product_copywriter`) |
| **0019** | `ai_feedback` | `tasks` +4 cols, `decisions` +`rejection_reason`, `ai_roles` +`prompt_version` |
| **0020** | — | `commerce_products` +10 cols, `commerce_product_variants` +6 cols, `commerce_order_items` +11 cols (supply chain) |
| **0021** | — | `commerce_import_jobs` +4 cols, `commerce_import_errors` +2 cols (Excel import) |
| **0022** | — | `commerce_products` +10 cols, `commerce_product_variants` +`display_sku_code`, `commerce_order_items` +2 cols, `commerce_settings` seed (pricing+logistics) |
| **0023** | — | `commerce_products` +`translated` |
| **0024** | — | `commerce_products` +`short_id` (via script; +UNIQUE index) |
| **0025** | — | `commerce_products` +`video_url` |
| **0026** | `task_runs` | `tasks` +8 cols (OS 2.0 engine) |
| **0027** | — | `commerce_products` +`short_name` |
| **0028** | `product_merchandising` | `commerce_products` +`ready_to_ship` |
| **0029** | — | `behavior_events` +`label` |
| **0030** | — | data update only (pricing `default_markup` 3→2, price_tiers recalc) |
| **0031** | `gsc_query_page`, `growth_opportunities`, `growth_actions`, `index_status` | — |
| **0032** | — | `growth_opportunities` +`intent`, `score_json` |
| **0037** | `ai_missions`, `ai_action_logs`, `ai_cost_tracking`, `ai_daily_report`, `ai_mission_plan` | — |
| **0038** | — | `ai_daily_report` +`health_score`, `health_json` |
| **0039** | `pull_state` | — |
| **0040** | — | `commerce_products` +`original_cover_image`, `localization_status` |
| **0041** | — | `inquiries` +`source_video_id` |
| **0042** | `video_assets`, `video_product_links`, `video_publications` | — |
| **0043** | — | `video_assets` +`video_code` + UNIQUE index |
| **0044** | `commerce_image_nos` | — |
| **0045** | — | `video_publications` UNIQUE index on `(video_id, channel)` |
| **0046** | `video_asset_translations` | `video_assets` +13 cols, `video_publications` +index on `(channel, status)` |
| **0047** | `video_transcripts`, `video_content_runs`, `video_content_suggestions` | `video_assets` +5 cols, `video_publications` +`locale` + reindex, `video_asset_translations` +`manual_fields_json`, seed `ai_roles` (`video_content_editor`) |
| **0048** | — | `video_assets` +`package_parts_json` |

> **Gaps**: Migrations 0033–0036 do not exist in the repository (intentional skip or deleted).

---

## 4. Missing Foreign Key Report

### Summary

**17 logical relationships lack FK constraints** — the column is named `*_id` and references another table, but no `REFERENCES` clause exists.

The pattern is inconsistent:
- **Commerce tables** (0011–0013): Most FKs ARE declared with CASCADE/SET NULL. Exceptions: `commerce_order_items.product_id`, `commerce_order_items.variant_id`, `product_merchandising.product_id`.
- **Video tables** (0042–0048): ALL FKs are systematically omitted — likely intentional for D1 migration flexibility.
- **AI/Growth tables** (0014/0026/0031): Several logical FKs omitted.
- **Content tables** (0001/0010): `email_messages.inquiry_id` and `ai_lead_scores.inquiry_id` both omit FK.

### Complete Missing FK List

| # | Child Table | Child Column | Should Reference | Risk |
|---|-------------|-------------|-----------------|------|
| 1 | `email_messages` | `inquiry_id` | `inquiries(id)` | Orphan emails when inquiry deleted |
| 2 | `ai_lead_scores` | `inquiry_id` | `inquiries(id)` | Orphan lead scores |
| 3 | `commerce_order_items` | `product_id` | `commerce_products(id)` | Orphan order items after product delete |
| 4 | `commerce_order_items` | `variant_id` | `commerce_product_variants(id)` | Orphan variant refs |
| 5 | `product_merchandising` | `product_id` | `commerce_products(id)` | Orphan merchandising row |
| 6 | `video_product_links` | `video_id` | `video_assets(id)` | Orphan video→product links |
| 7 | `video_product_links` | `product_id` | `commerce_products(id)` | Cross-domain orphan |
| 8 | `video_publications` | `video_id` | `video_assets(id)` | Orphan publication records |
| 9 | `video_asset_translations` | `video_id` | `video_assets(id)` | Orphan translations |
| 10 | `video_transcripts` | `video_id` | `video_assets(id)` | Orphan transcripts |
| 11 | `video_content_runs` | `video_id` | `video_assets(id)` | Orphan content runs |
| 12 | `video_content_runs` | `transcript_id` | `video_transcripts(id)` | Broken transcript chain |
| 13 | `video_content_suggestions` | `run_id` | `video_content_runs(id)` | Orphan suggestions |
| 14 | `video_content_suggestions` | `video_id` | `video_assets(id)` | Orphan suggestions |
| 15 | `growth_actions` | `opp_id` | `growth_opportunities(id)` | Orphan growth actions |
| 16 | `task_runs` | `task_id` | `tasks(id)` | Orphan run records |
| 17 | `decisions` | `task_id` | `tasks(id)` | Orphan decision references |

### V2 Recommendation

| Priority | Action |
|----------|--------|
| **P0 (V2 must-fix)** | Add FKs for `email_messages.inquiry_id`, `ai_lead_scores.inquiry_id`, `task_runs.task_id`, `growth_actions.opp_id` — high-read tables where orphan rows silently corrupt dashboards |
| **P1 (V2 should-fix)** | Add FKs for all video tables (6 FKs) — systematically omitted, should be added for V2 referential integrity |
| **P2 (V2 nice-to-have)** | `commerce_order_items.product_id`, `commerce_order_items.variant_id`, `product_merchandising.product_id`, `decisions.task_id` — low-volume tables where orphan risk is minor |

---

## 5. Orphan & Superseded Table Assessment

### Tables flagged for V2 deprecation

| Table | Migration | Reason | V2 Fate | Action Required |
|-------|-----------|--------|---------|-----------------|
| `knowledge_base` | 0008 | Superseded by `knowledge` (0009) which adds levels, decay, evidence, confidence. Same purpose, richer schema. | **废弃** | Verify no API still reads it. Migrate valuable entries to `knowledge`. Drop table. |
| `daily_recs` | 0006 | Legacy V4.1 recommendation system. Superseded by `growth_opportunities` (0031) and `ai_opportunities` (0014). | **废弃** | Verify cron no longer writes. Drop table. |
| `experiments` | 0009 | No FKs, no indexes beyond PK. `growth_actions` (0031) handles before/after/outcome better. | **废弃** | Migrate any active experiments to `growth_actions`. Drop. |
| `ai_opportunities` | 0014 | Superseded by `growth_opportunities` (0031) with better schema (week dedup, exec_level, intent, score_json). | **废弃** | Migrate data to `growth_opportunities`. Drop. |
| `ai_daily_briefs` | 0014 | Superseded by `ai_daily_report` (0037) which has richer daily reporting + health score. | **废弃** | Verify cron writes to 0037 only. Drop. |
| `ai_usage` | 0009 | Superseded by `ai_cost_tracking` (0037) with per-model daily breakdown. | **废弃** | Migrate historical cost data. Drop. |
| `ai_reports` | 0009 | `ai_daily_report` (0037) now handles daily reporting with richer structure. | **废弃** | Verify no reader. Drop. |
| `decisions` | 0009 | Underused; `ai_feedback` (0019) handles learning loop with richer feedback types. | **废弃** | Merge relevant decisions into `ai_feedback`. Drop. |

### V2 deprecation savings

- **8 tables dropped** (~15% of total)
- ~30 columns removed from schema
- ~10 indexes cleaned up
- Eliminates maintenance burden of legacy tables that may still receive cron writes

---

## 6. V2 Fate Summary

### By fate category

| Fate | Count | Tables |
|------|-------|--------|
| **保留不变** (keep as-is) | 36 | `inquiries`, `subscribers`, `commerce_product_variants`, `commerce_price_tiers`, `commerce_orders`, `commerce_order_items`, `commerce_order_events`, `commerce_product_images`, `commerce_import_jobs`, `commerce_import_errors`, `commerce_product_reviews`, `commerce_product_questions`, `product_merchandising`, `commerce_image_nos`, `ai_roles`, `knowledge`, `ai_feedback`, `ai_lead_scores`, `task_runs`, `audit_issues`, `ai_missions`, `ai_action_logs`, `ai_cost_tracking`, `ai_mission_plan`, `index_status`, `video_assets`, `video_product_links`, `video_publications`, `video_asset_translations`, `video_transcripts`, `video_content_runs`, `video_content_suggestions`, `behavior_events`, `gsc_daily`, `ga_daily`, `pull_state` |
| **新增列** (add columns) | 5 | `commerce_products` (66 cols → split), `commerce_settings` (expand structured config), `tasks` (OS 2.0 fields), `growth_opportunities` (more engine fields), `ai_daily_report` (health dimensions) |
| **替换** (replace) | 0 | *(none identified — no table needs full replacement)* |
| **废弃** (deprecate) | 8 | `knowledge_base`, `daily_recs`, `experiments`, `ai_opportunities`, `ai_daily_briefs`, `ai_usage`, `ai_reports`, `decisions` |
| **待定** | 3 | `email_messages`, `gsc_query_page`, `growth_actions` — need API usage audit to confirm active |

### Domain-level summary

| Domain | Tables | V2 Keep | V2 Add Cols | V2 Deprecate | Widest Table (cols) |
|--------|--------|---------|-------------|-------------|---------------------|
| content | 2 | 2 | 0 | 0 | `inquiries` (15) |
| commerce | 14 | 13 | 1 | 0 | `commerce_products` (66) |
| ai | 22 | 12 | 2 | 8 | `ai_missions` (27) |
| growth | 4 | 3 | 1 | 0 | `growth_opportunities` (15) |
| video | 7 | 7 | 0 | 0 | `video_assets` (32) |
| analytics | 5 | 4 | 0 | 1 | `behavior_events` (10) |
| system | 2 | 2 | 0 | 0 | `email_messages` (11) |
| **TOTAL** | **52** | **44** | **5** | **8** | |

---

## 7. Appendix: Read/Write Frequency Assessment

### Methodology
Frequencies are inferred from API usage patterns, table purpose, and cron schedules:
- **HIGH**: Every page load / every AI call / daily cron
- **MEDIUM**: Admin panel views / weekly cron / occasional API calls
- **LOW**: Rare admin operations / deprecated / seed data

### Table frequency matrix

| Table | Read | Write | Rationale |
|-------|------|-------|-----------|
| `inquiries` | MEDIUM | LOW | Admin panel + lead scoring; public form ~2-5/day |
| `subscribers` | LOW | LOW | Admin review only; footer opt-in rare |
| `commerce_products` | **HIGH** | MEDIUM | PDP/shop/listing (most-read); admin edits/imports |
| `commerce_product_variants` | MEDIUM | LOW | PDP variant display; admin edits |
| `commerce_price_tiers` | **HIGH** | LOW | Every pricing display; rarely edited |
| `commerce_orders` | LOW | LOW | Rare B2B orders |
| `commerce_order_items` | LOW | LOW | Order detail view |
| `commerce_order_events` | LOW | LOW | Order timeline |
| `commerce_settings` | **HIGH** | LOW | Every pricing/currency lookup; config rarely changes |
| `commerce_product_images` | **HIGH** | MEDIUM | PDP gallery; import/upload |
| `commerce_import_jobs` | LOW | LOW | Import pipeline |
| `commerce_import_errors` | LOW | LOW | Import error review |
| `commerce_product_reviews` | MEDIUM | LOW | PDP social proof |
| `commerce_product_questions` | MEDIUM | LOW | PDP Q&A |
| `product_merchandising` | MEDIUM | LOW | Shop listing curation |
| `commerce_image_nos` | LOW | LOW | Admin workflow only |
| `ai_roles` | **HIGH** | LOW | Every AI call loads prompt; Role Center tuning rare |
| `knowledge` | MEDIUM | MEDIUM | AI context loading; cron Librarian writes |
| `decisions` | LOW | LOW | Strategist checks; rarely written |
| `tasks` | MEDIUM | MEDIUM | Dashboard + AI context; cron/manual creates |
| `experiments` | LOW | LOW | Possibly unused |
| `ai_reports` | LOW | MEDIUM | Admin review; cron daily/weekly writes |
| `audit_issues` | LOW | MEDIUM | Admin dashboard; cron Auditor writes |
| `ai_usage` | LOW | **HIGH** | Rarely read; every AI call writes |
| `ai_feedback` | LOW | LOW | Librarian consumes; human feedback rare |
| `ai_daily_briefs` | LOW | MEDIUM | Possibly obsolete; cron daily writes |
| `ai_opportunities` | MEDIUM | MEDIUM | Dashboards; cron writes |
| `ai_lead_scores` | MEDIUM | LOW | Admin inquiry review; on new inquiry |
| `task_runs` | MEDIUM | MEDIUM | Idempotency check per cron run; cron writes |
| `growth_opportunities` | **HIGH** | MEDIUM | Growth Action Board (main dashboard); weekly cron |
| `growth_actions` | MEDIUM | LOW | Growth Memory; T+14 verification |
| `index_status` | LOW | LOW | Index Monitor; ≤20 inspections/run |
| `ai_missions` | **HIGH** | MEDIUM | AI Control Tower; every autonomous run |
| `ai_action_logs` | MEDIUM | **HIGH** | Mission detail view; every AI tool call writes |
| `ai_cost_tracking` | MEDIUM | MEDIUM | Cost dashboard; daily aggregation |
| `ai_daily_report` | **HIGH** | MEDIUM | AI Control Tower daily view; daily cron |
| `ai_mission_plan` | MEDIUM | LOW | Planning view; daily planner run |
| `knowledge_base` | LOW | LOW | Likely orphaned |
| `video_assets` | MEDIUM | LOW | Public video pages + admin; upload occasional |
| `video_product_links` | MEDIUM | LOW | Video↔product linking |
| `video_publications` | MEDIUM | LOW | Public video pages; publish rare |
| `video_asset_translations` | MEDIUM | LOW | Public video pages (3 locales); AI generation |
| `video_transcripts` | MEDIUM | LOW | AI content input; Local Studio generates |
| `video_content_runs` | MEDIUM | LOW | Content run review; AI generation |
| `video_content_suggestions` | MEDIUM | LOW | Content review workflow; AI generation |
| `behavior_events` | MEDIUM | **HIGH** | Dashboard + AI analysis; every page view/click |
| `gsc_daily` | **HIGH** | **HIGH** | Dashboards + AI + cron reads; daily cron pull |
| `ga_daily` | **HIGH** | **HIGH** | Dashboards + AI; daily cron pull |
| `daily_recs` | LOW | LOW | Likely orphaned |
| `gsc_query_page` | **HIGH** | **HIGH** | Opportunity Engine core input; daily cron pull |
| `pull_state` | MEDIUM | MEDIUM | Pull orchestration; every cron pull updates |
| `email_messages` | MEDIUM | LOW | Admin inquiry thread; outbound/inbound |

### Top 10 highest-traffic tables (combined read + write)

| Rank | Table | Read | Write | Domain |
|------|-------|------|-------|--------|
| 1 | `commerce_products` | HIGH | MEDIUM | commerce |
| 2 | `gsc_daily` | HIGH | HIGH | analytics |
| 3 | `gsc_query_page` | HIGH | HIGH | growth |
| 4 | `ga_daily` | HIGH | HIGH | analytics |
| 5 | `behavior_events` | MEDIUM | HIGH | analytics |
| 6 | `ai_action_logs` | MEDIUM | HIGH | ai |
| 7 | `commerce_settings` | HIGH | LOW | commerce |
| 8 | `ai_roles` | HIGH | LOW | ai |
| 9 | `ai_daily_report` | HIGH | MEDIUM | ai |
| 10 | `ai_missions` | HIGH | MEDIUM | ai |

---

## Appendix: Column Type Distribution

| Type | Approx Count | Notes |
|------|-------------|-------|
| TEXT | ~290 | Dominant type; JSON stored as TEXT (D1/SQLite has no native JSON) |
| INTEGER | ~120 | AUTOINCREMENT PKs, timestamps (unixepoch), counters, booleans (0/1) |
| REAL | ~45 | Prices, scores, dimensions, weights, rates |
| JSON / TEXT[] / BOOLEAN | ~15 | `ai_missions` + `ai_action_logs` + `ai_mission_plan` use non-SQLite types — stored as TEXT in practice |

> ⚠ **Warning**: `JSON`, `TEXT[]`, `BOOLEAN` declared in 0037 migration (`ai_missions`, `ai_action_logs`, `ai_mission_plan`, `ai_daily_report`). D1/SQLite ignores these type constraints and stores as TEXT. `PRAGMA table_info` will show the declared type but the actual storage is TEXT. This may confuse tooling that reads schema metadata.

---

*End of V2 Database Map. Generated from all 44 migration files (`0001–0048`) and cross-referenced with `CMS_AUDIT_DATABASE.md`. No files were modified.*