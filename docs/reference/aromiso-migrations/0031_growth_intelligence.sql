-- V5.34 Organic Growth Intelligence P0：增长数据四表
-- 设计稿：docs/ORGANIC_GROWTH_DESIGN.md（owner 2026-08-15 指令落地）
-- 注意：SQLite 的 CREATE TABLE IF NOT EXISTS 安全；本迁移纯 DDL，无存量数据改动。

-- 1) GSC query×page 交叉维度（Query→Page 映射，Opportunity Engine 核心输入）
--    cron-pull 每日 T-2 拉取 top 500 组合
CREATE TABLE IF NOT EXISTS gsc_query_page (
  date        TEXT NOT NULL,         -- YYYY-MM-DD
  query       TEXT NOT NULL,
  page        TEXT NOT NULL,         -- 完整 URL
  clicks      INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr         REAL DEFAULT 0,
  position    REAL DEFAULT 0,
  PRIMARY KEY (date, query, page)
);

-- 2) SEO Growth Action Board（机会板，按周去重）
CREATE TABLE IF NOT EXISTS growth_opportunities (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  week             TEXT NOT NULL,    -- 周一日期 YYYY-MM-DD，去重周期
  opp_type         TEXT NOT NULL,    -- page1_candidate / protect / low_ctr / content_gap / query_page_mismatch / index_issue / shopping
  page             TEXT NOT NULL DEFAULT '',
  query            TEXT NOT NULL DEFAULT '',
  priority         TEXT NOT NULL,    -- P0 / P1 / P2
  exec_level       TEXT NOT NULL,    -- A / B / C（执行三级）
  reason           TEXT NOT NULL,
  suggested_action TEXT NOT NULL,
  metrics_json     TEXT NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'new',  -- new / approved / applied / verified / skipped
  task_id          INTEGER,
  created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_growth_opp_week ON growth_opportunities(week, status);

-- 3) Growth Memory（改前/改后数据 = Experience Memory；自动执行器预留，Phase 1 经 tasks 列积累）
CREATE TABLE IF NOT EXISTS growth_actions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  opp_id       INTEGER NOT NULL,
  action       TEXT NOT NULL,
  exec_level   TEXT NOT NULL,
  applied_at   INTEGER NOT NULL,
  before_json  TEXT NOT NULL DEFAULT '{}',
  after_json   TEXT NOT NULL DEFAULT '{}',
  verify_after TEXT,                 -- YYYY-MM-DD（T+14 验证窗口）
  outcome      TEXT                 -- NULL=pending / positive / negative / no_effect
);

-- 4) Index Monitor 快照（URL Inspection API 抽样）
CREATE TABLE IF NOT EXISTS index_status (
  url          TEXT PRIMARY KEY,
  status       TEXT NOT NULL,        -- indexed / crawled_not_indexed / discovered_not_indexed / duplicate / not_found / unknown
  detail       TEXT NOT NULL DEFAULT '',
  inspected_at INTEGER NOT NULL
);
