-- ============================================================================
-- 0022_commerce_v5_logistics_pricing.sql
-- Aromiso V5.0 现货商城闭环改造 · 数据模型补齐
-- 目标：定价引擎 + 箱规 + 物流溯源 Data Source + 可读货号 + Data Health 8 维
-- 说明：本迁移仅 ADD COLUMN / 种子配置，不破坏旧数据（D1 ALTER ADD COLUMN 安全）
-- ============================================================================

-- ---------- commerce_products：定价引擎 + 箱规 + 溯源 + 可读货号 ----------
ALTER TABLE commerce_products ADD COLUMN display_product_code   TEXT DEFAULT '';    -- 可读展示货号 AR-HF-xxxx（前台对外，替代 1688 ID）
ALTER TABLE commerce_products ADD COLUMN fx_rate_cny_usd        REAL;                -- 商品级汇率，缺省回退全局
ALTER TABLE commerce_products ADD COLUMN markup_rule           REAL;                -- 商品级加价倍数，缺省回退全局
ALTER TABLE commerce_products ADD COLUMN manual_price_override REAL;                -- 商品级人工覆盖基价(USD)，优先于成本计算价
ALTER TABLE commerce_products ADD COLUMN carton_length_cm       REAL;                -- 箱规长
ALTER TABLE commerce_products ADD COLUMN carton_width_cm        REAL;                -- 箱规宽
ALTER TABLE commerce_products ADD COLUMN carton_height_cm       REAL;                -- 箱规高
ALTER TABLE commerce_products ADD COLUMN carton_weight_kg       REAL;                -- 箱重
ALTER TABLE commerce_products ADD COLUMN carton_volume_cbm      REAL;                -- 箱体积 = L*W*H/1e6，保存时计算，缺任一不计算（前台 To be confirmed）
ALTER TABLE commerce_products ADD COLUMN packaging_type         TEXT DEFAULT '';     -- Individual Box / Gift Box / Bulk 等
ALTER TABLE commerce_products ADD COLUMN logistics_meta         TEXT DEFAULT '{}';   -- {"units_per_carton":"supplier","carton_length_cm":"manual",...} 各物流字段 Data Source 溯源
ALTER TABLE commerce_products ADD COLUMN data_health_json       TEXT DEFAULT '{}';   -- 8 维健康度 {basic,images,sku,pricing,attributes,logistics,seo,source,score}，保存时计算

-- ---------- commerce_product_variants：可读 SKU 货号 ----------
ALTER TABLE commerce_product_variants ADD COLUMN display_sku_code TEXT DEFAULT '';   -- AR-HF-xxxx-500-YLQC（前台对外）

-- ---------- commerce_order_items：人类可读货号快照（供应链溯源用） ----------
ALTER TABLE commerce_order_items ADD COLUMN display_product_code_snapshot TEXT DEFAULT '';
ALTER TABLE commerce_order_items ADD COLUMN display_sku_code_snapshot     TEXT DEFAULT '';

-- ---------- 全局定价配置（commerce_settings 为 key/value 表，见 0011） ----------
INSERT OR IGNORE INTO commerce_settings (key, value) VALUES ('fx_rate_cny_usd', '7.10');  -- 人民币→美元汇率
INSERT OR IGNORE INTO commerce_settings (key, value) VALUES ('default_markup',   '3.0');  -- 默认加价倍数（成本 × Markup = 基价）
