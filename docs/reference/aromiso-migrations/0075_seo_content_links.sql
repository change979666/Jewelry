-- ============================================================================
-- 0075 — SEO 注册表 + 内容知识图谱（Phase 1）
-- 总文档 §4.2-D / §8 ｜ 幂等：CREATE TABLE IF NOT EXISTS
-- ============================================================================

-- SEO Landing Page 注册表：哪些组合有资格成为可索引页（Eligibility Engine 的账本）
CREATE TABLE IF NOT EXISTS shop_seo_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,                  -- /shop/{slug}
  source_type TEXT NOT NULL DEFAULT 'category', -- category/attribute/fragrance/application/collection/spec/intent
  source_id INTEGER,                          -- 来源实体 id
  source_label TEXT NOT NULL DEFAULT '',      -- 可读标签（如 200ml reed diffusers）
  eligibility_score INTEGER NOT NULL DEFAULT 0, -- 资格引擎评分
  indexability TEXT NOT NULL DEFAULT 'candidate', -- index/noindex/candidate
  status TEXT NOT NULL DEFAULT 'draft',       -- draft/published/archived
  seo_title_json TEXT NOT NULL DEFAULT '{}',  -- {en,es,de}
  seo_description_json TEXT NOT NULL DEFAULT '{}',
  intro_json TEXT NOT NULL DEFAULT '{}',      -- 各语言 Intro 文案
  faq_json TEXT NOT NULL DEFAULT '{}',
  generated_by TEXT NOT NULL DEFAULT 'manual', -- manual/rule/ai
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shop_seo_source ON shop_seo_pages(source_type, source_id);

-- 各实体各语言的 SEO 元数据（商品/分类/集合共用）
CREATE TABLE IF NOT EXISTS shop_seo_metadata (
  owner_type TEXT NOT NULL,                   -- product/category/collection/application
  owner_id TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',          -- en/es/de
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  canonical TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (owner_type, owner_id, locale)
);

-- 内容知识图谱：产品↔分类↔集合↔FAQ↔采购指南↔文章（内链自动维护的账本）
CREATE TABLE IF NOT EXISTS shop_content_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_type TEXT NOT NULL,                    -- product/category/collection/guide/blog/faq
  from_id TEXT NOT NULL,
  to_type TEXT NOT NULL,
  to_id TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'related',  -- related/same_scent/same_capacity/same_scene/category/guide/faq/blog
  source TEXT NOT NULL DEFAULT 'rule',        -- rule/ai/manual
  confidence INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (from_type, from_id, to_type, to_id, link_type)
);
CREATE INDEX IF NOT EXISTS idx_shop_cl_from ON shop_content_links(from_type, from_id);
CREATE INDEX IF NOT EXISTS idx_shop_cl_to ON shop_content_links(to_type, to_id);
