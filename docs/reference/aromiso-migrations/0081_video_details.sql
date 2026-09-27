-- ============================================================================
-- 0081 — V5.55 Video Center 明细同步
--
-- studio_video_details：Studio 视频任务的云端可见明细（处理时间线 / 转录 /
-- 译文 / 原片与成片 URL）。云端 Video Center 详情页据此渲染，无需打开 Studio。
-- Studio cloud_sync 每次同步时 upsert（vid 为主键）。
-- ============================================================================

CREATE TABLE IF NOT EXISTS studio_video_details (
  vid TEXT PRIMARY KEY,                  -- Studio video id（如 2026-08-24_v001）
  filename TEXT NOT NULL DEFAULT '',
  phase TEXT NOT NULL DEFAULT '',        -- processing | review | done | failed
  steps_json TEXT NOT NULL DEFAULT '{}', -- {analyze:completed, separate:completed, ...}
  meta_json TEXT NOT NULL DEFAULT '{}',  -- {duration_s,width,height,mode,backend,segments}
  original_url TEXT NOT NULL DEFAULT '', -- 原片 R2 URL（可空=仅本地）
  final_url TEXT NOT NULL DEFAULT '',    -- 成片 R2 URL
  transcript_url TEXT NOT NULL DEFAULT '',-- transcript.json R2 URL
  translation_url TEXT NOT NULL DEFAULT '',-- translation.json R2 URL
  studio_job_id TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_svd_job ON studio_video_details (studio_job_id);
