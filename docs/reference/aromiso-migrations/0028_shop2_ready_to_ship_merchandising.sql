-- Shop 2.0 P0（V5.25/V5.26）: 现货标记 + 商品运营位（Merchandising）
-- 文档：Aromiso-Shop-2.0-开发文档.md §7（标签/运营位分离）、§12.1

-- 现货可发标记：采购筛选层②⑤、卡片角标 READY TO SHIP、自动 Badge 共用。
-- 回填：stock_status='in_stock' 的商品置 1（见 V5.25 回填记录）。
ALTER TABLE commerce_products ADD COLUMN ready_to_ship INTEGER DEFAULT 0;

-- 运营位：Featured 为加权排序（非硬置顶），Best Seller/Trending 等后续按数据接入。
-- 约束：同一商品同一 placement_type 仅一行（后台开关式管理）。
CREATE TABLE IF NOT EXISTS product_merchandising (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  placement_type TEXT NOT NULL, -- featured / best_seller / trending / seasonal / new_arrival
  priority INTEGER DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  campaign_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merch_product_type
  ON product_merchandising (product_id, placement_type);

CREATE INDEX IF NOT EXISTS idx_merch_type_status
  ON product_merchandising (placement_type, status);
