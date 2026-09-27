-- 0042_video_center.sql — V5.43 Video Center（后台视频资产管理）
-- 冻结三表（AI_PRODUCTION_STUDIO_V1 §3.4）首次建表：lean 列，V1 够用即可。
-- video_assets：资产本体（来源/原片/成品/封面/状态）
-- video_product_links：资产 ↔ 商品 多对多（V1 实际 1:1，结构预留）
-- video_publications：发布渠道账本（pdp = 写 commerce_products.video_url）

CREATE TABLE IF NOT EXISTS video_assets (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT '',
  source        TEXT NOT NULL DEFAULT 'manual',   -- 1688 | douyin | supplier | manual | youtube | other
  source_url    TEXT NOT NULL DEFAULT '',         -- 原始来源页 URL
  original_url  TEXT NOT NULL DEFAULT '',         -- 原视频（R2 或外链）
  processed_url TEXT NOT NULL DEFAULT '',         -- AI 处理后成品（Studio 回写）
  cover_url     TEXT NOT NULL DEFAULT '',
  duration_s    INTEGER NOT NULL DEFAULT 0,
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'ingested', -- ingested | processed | ready | archived
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT '',
  updated_at    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS video_product_links (
  id         TEXT PRIMARY KEY,
  video_id   TEXT NOT NULL,
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT '',
  UNIQUE(video_id, product_id)
);

CREATE TABLE IF NOT EXISTS video_publications (
  id           TEXT PRIMARY KEY,
  video_id     TEXT NOT NULL,
  channel      TEXT NOT NULL DEFAULT 'pdp',       -- pdp | youtube | social
  target_url   TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'live',      -- live | unpublished
  published_at TEXT NOT NULL DEFAULT '',
  updated_at   TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_vpl_product ON video_product_links(product_id);
CREATE INDEX IF NOT EXISTS idx_vpl_video   ON video_product_links(video_id);
CREATE INDEX IF NOT EXISTS idx_vpub_video  ON video_publications(video_id);
