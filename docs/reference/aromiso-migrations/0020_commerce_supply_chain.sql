-- 0020_commerce_supply_chain.sql
-- 1688 供应链身份 + 物流 + 订单快照
-- 详见 Aromiso-Commerce-1688现货商城开发文档.md §1

-- ========== commerce_products：供应链身份 + 物流 ==========
-- source_url / source_imported_at 已在 0012 中添加，不重复
ALTER TABLE commerce_products ADD COLUMN supplier_name TEXT;            -- 供应商公司名（本批为空，二期补）
ALTER TABLE commerce_products ADD COLUMN supplier_shop_url TEXT;        -- 店铺 URL，供应商去重 key
ALTER TABLE commerce_products ADD COLUMN supplier_product_code TEXT;    -- 产品级货号，保守推导，可空
ALTER TABLE commerce_products ADD COLUMN attributes TEXT DEFAULT '{}';  -- 1688 原始属性全量 JSON
ALTER TABLE commerce_products ADD COLUMN category_l1 TEXT DEFAULT '';   -- 1688 一级类目中文（备查）
ALTER TABLE commerce_products ADD COLUMN category_l3 TEXT DEFAULT '';   -- 1688 三级类目中文（备查）
ALTER TABLE commerce_products ADD COLUMN units_per_carton INTEGER;      -- 装箱数（属性归一化提取，可空）
ALTER TABLE commerce_products ADD COLUMN import_batch TEXT;             -- 导入批次号，如 "2026-08-pilot"
ALTER TABLE commerce_products ADD COLUMN source_last_verified TEXT;     -- 最近货源确认时间
ALTER TABLE commerce_products ADD COLUMN health_status TEXT DEFAULT 'fresh'; -- fresh/review/risk/unavailable
CREATE INDEX IF NOT EXISTS idx_cp_source_key ON commerce_products(source_product_key);
CREATE INDEX IF NOT EXISTS idx_cp_supplier ON commerce_products(supplier_shop_url);
CREATE INDEX IF NOT EXISTS idx_cp_health ON commerce_products(health_status);

-- lead_time：只弃用不 DROP（D1 ALTER 限制 + 防止 SELECT * 炸代码），
-- 代码层停止读写，下次重建表时清理。

-- ========== commerce_product_variants：SKU 供应链身份 + 物流 ==========
ALTER TABLE commerce_product_variants ADD COLUMN source_sku_id TEXT;        -- 1688 SKU ID
ALTER TABLE commerce_product_variants ADD COLUMN supplier_sku_code TEXT;    -- SKU 货号（如 8701-嗅境-旷野）
ALTER TABLE commerce_product_variants ADD COLUMN length_cm REAL;            -- 保留 2 位小数
ALTER TABLE commerce_product_variants ADD COLUMN width_cm REAL;
ALTER TABLE commerce_product_variants ADD COLUMN height_cm REAL;
ALTER TABLE commerce_product_variants ADD COLUMN weight_kg REAL;
-- options_json 已存在：写入解析后的结构化选项轴
CREATE INDEX IF NOT EXISTS idx_cpv_sku_id ON commerce_product_variants(source_sku_id);

-- ========== commerce_order_items：采购快照（下单时写死） ==========
ALTER TABLE commerce_order_items ADD COLUMN product_title_snapshot TEXT;
ALTER TABLE commerce_order_items ADD COLUMN variant_name_snapshot TEXT;     -- 如 "Yulong Tea / 500ml"
ALTER TABLE commerce_order_items ADD COLUMN variant_image_snapshot TEXT;    -- 售后纠纷关键证据
ALTER TABLE commerce_order_items ADD COLUMN source_platform TEXT;
ALTER TABLE commerce_order_items ADD COLUMN source_product_key TEXT;        -- 供应链主索引
ALTER TABLE commerce_order_items ADD COLUMN source_url TEXT;
ALTER TABLE commerce_order_items ADD COLUMN supplier_name TEXT;
ALTER TABLE commerce_order_items ADD COLUMN supplier_product_code TEXT;
ALTER TABLE commerce_order_items ADD COLUMN source_sku_id TEXT;
ALTER TABLE commerce_order_items ADD COLUMN supplier_sku_code TEXT;
ALTER TABLE commerce_order_items ADD COLUMN purchase_cost_cny_snapshot REAL;
ALTER TABLE commerce_order_items ADD COLUMN selling_price_usd_snapshot REAL;
