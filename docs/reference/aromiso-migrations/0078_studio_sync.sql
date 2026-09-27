-- ============================================================================
-- 0078 — Studio↔Cloud 同步：批次快照 + 统一异常队列（V5.54）
--
-- 背景：图片/视频本地化任务在 Local Studio（本机）执行，云端 /admin-v2
-- 此前完全看不到它们的状态与异常。owner 要求（V5.54 §十/§二十三）：
--   - Review 中心必须知道"现在有什么需要我处理"（含 Studio 批次）
--   - 异常统一进 Exception Queue（task/step/error/retry/建议动作/证据）
--
-- studio_sync_snapshots：Studio 每批次最新状态快照（upsert by batch_id）
-- studio_exceptions：跨域统一异常队列（image/video/knowledge/seo/automation/publish）
-- ============================================================================

CREATE TABLE IF NOT EXISTS studio_sync_snapshots (
  batch_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'image',         -- image | video
  preset TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',            -- running | plan_ready | published | partial | failed
  item_count INTEGER NOT NULL DEFAULT 0,
  pass_count INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  exception_count INTEGER NOT NULL DEFAULT 0,
  published_count INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT NOT NULL DEFAULT '{}',
  reported_by TEXT NOT NULL DEFAULT 'studio',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS studio_exceptions (
  id TEXT PRIMARY KEY,                        -- 稳定键：{batch}:{item}:{step} 或云端生成
  batch_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'image',         -- image/video/knowledge/seo/automation/publish
  item_key TEXT NOT NULL DEFAULT '',
  product_id TEXT NOT NULL DEFAULT '',
  step TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  retry_count INTEGER NOT NULL DEFAULT 0,
  recommended_action TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  resolution TEXT NOT NULL DEFAULT '',        -- '' = open | retry | skip | abort | resolved
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_studio_exceptions_open
  ON studio_exceptions (resolution, kind);

CREATE INDEX IF NOT EXISTS idx_studio_exceptions_batch
  ON studio_exceptions (batch_id);
