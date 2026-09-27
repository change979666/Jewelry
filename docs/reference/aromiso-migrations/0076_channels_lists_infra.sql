-- ============================================================================
-- 0076 — 渠道/清单/询盘行/基建（Phase 1）
-- 总文档 §4.2-E/F/G/H/I ｜ 幂等：CREATE TABLE IF NOT EXISTS
-- ============================================================================

-- ── E. 收藏清单 + 询盘行 + 分享链接 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_saved_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_ref TEXT NOT NULL DEFAULT '',         -- 客户标识（匿名会话或客户 id）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shop_saved_list_items (
  list_id INTEGER NOT NULL REFERENCES shop_saved_lists(id),
  product_id TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (list_id, product_id)
);

-- 询盘行：询盘里的商品行（规格快照 + 数量 + 定制要求）
CREATE TABLE IF NOT EXISTS shop_inquiry_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inquiry_id TEXT NOT NULL,                   -- inquiries.id
  product_id TEXT NOT NULL,
  specs_snapshot_json TEXT NOT NULL DEFAULT '{}', -- 规格快照（容量/香味/包装）
  quantity INTEGER,
  customization TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shop_ii_inquiry ON shop_inquiry_items(inquiry_id);

CREATE TABLE IF NOT EXISTS shop_share_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,                  -- 短码（A20260903 式）
  product_ids_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

-- ── F. Feed 与导出 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_feed_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL UNIQUE,               -- meta/google/pinterest
  name TEXT NOT NULL DEFAULT '',
  feed_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',       -- draft/active/paused
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shop_feed_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',     -- running/success/warning/failed
  total INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  detail_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_shop_feed_jobs_ch ON shop_feed_jobs(channel, started_at);

CREATE TABLE IF NOT EXISTS shop_feed_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER REFERENCES shop_feed_jobs(id),
  channel TEXT NOT NULL,
  product_id TEXT NOT NULL,
  error_reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',        -- open/fixing/resolved/ignored
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shop_feed_err_ch ON shop_feed_errors(channel, status);

CREATE TABLE IF NOT EXISTS shop_export_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'csv',         -- csv/xlsx/json/xml
  fields_json TEXT NOT NULL DEFAULT '[]',
  filters_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── G. AI 建议 + 数据质量 + 事件 ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_ai_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  field TEXT NOT NULL,                        -- category/capacity/fragrance/seo_title/...
  suggested_value_json TEXT NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'ai_inferred', -- ai_extracted/ai_inferred/vlm/ocr
  confidence INTEGER NOT NULL DEFAULT 0,
  review_status TEXT NOT NULL DEFAULT 'pending', -- pending/auto_approved/accepted/rejected
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shop_ai_sugg_status ON shop_ai_suggestions(review_status, field);
CREATE INDEX IF NOT EXISTS idx_shop_ai_sugg_product ON shop_ai_suggestions(product_id);

CREATE TABLE IF NOT EXISTS shop_product_data_quality (
  product_id TEXT PRIMARY KEY,
  health_score INTEGER NOT NULL DEFAULT 0,    -- 0-100
  missing_json TEXT NOT NULL DEFAULT '[]',    -- 缺失字段列表快照
  completeness INTEGER NOT NULL DEFAULT 0,    -- 完整度百分比
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── H. 媒体/合规/市场 ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_product_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',   -- image/video（视频结构预留）
  url TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'detail',        -- primary/detail/scene/packaging
  quality_score INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shop_pmedia_product ON shop_product_media(product_id);

CREATE TABLE IF NOT EXISTS shop_compliance_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT,                            -- 可空 = 公司级文档
  doc_type TEXT NOT NULL DEFAULT '',          -- MSDS/IFRA/COA/Certification/Test Report
  file_url TEXT NOT NULL DEFAULT '',
  market TEXT NOT NULL DEFAULT '',
  expiry_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shop_markets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,                  -- EU/US/ME/...
  name_zh TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  compliance_notes TEXT NOT NULL DEFAULT ''   -- IFRA/REACH/CLP/Prop 65 差异
);

CREATE TABLE IF NOT EXISTS shop_product_markets (
  product_id TEXT NOT NULL,
  market_id INTEGER NOT NULL REFERENCES shop_markets(id),
  compatible INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (product_id, market_id)
);

-- ── I. 版本/开关/自动化/健康 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_product_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,                -- 变更时的字段快照（可比较/回滚）
  changed_fields_json TEXT NOT NULL DEFAULT '[]',
  changed_by TEXT NOT NULL DEFAULT '',        -- 人工账号或 AI 任务 id
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shop_pver_product ON shop_product_versions(product_id, created_at);

CREATE TABLE IF NOT EXISTS shop_feature_flags (
  flag TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  rollout_pct INTEGER NOT NULL DEFAULT 100,   -- 0-100 灰度
  description TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shop_automation_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type TEXT NOT NULL,                     -- import/enrich/classify/feed_sync/seo_check/image_check/...
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',     -- pending/running/success/failed/waiting_review/skipped
  progress INTEGER NOT NULL DEFAULT 0,        -- 0-100（断点续跑）
  cursor_json TEXT NOT NULL DEFAULT '{}',     -- 断点游标（处理到哪）
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error TEXT NOT NULL DEFAULT '',
  scheduled_at TEXT,
  started_at TEXT,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_shop_auto_status ON shop_automation_jobs(status, job_type);

CREATE TABLE IF NOT EXISTS shop_system_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  check_type TEXT NOT NULL,                   -- search/automation_success/feed_freshness/queue_backlog/index_lag/backup
  status TEXT NOT NULL DEFAULT 'ok',          -- ok/warning/fail
  value_json TEXT NOT NULL DEFAULT '{}',
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shop_health_type ON shop_system_health(check_type, checked_at);
