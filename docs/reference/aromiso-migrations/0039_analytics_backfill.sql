-- 0039: V5.38 分析数据长期仓库 — 补拉账本表
-- pull_state 记录每个数据源（gsc / ga4）每一天的拉取状态：
--   pending = 待拉取（含次日重试）, ok = 已入库有数据,
--   empty   = 拉过但当天无数据（次日自动重试）, gaveup = 重试 6 次仍无数据（视为真实空日）
-- 后台日期选择器据此把「没出来的日期」置灰不可选。
CREATE TABLE IF NOT EXISTS pull_state (
  source TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  rows INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (source, date)
);
