-- ---------------------------------------------------------------------------
-- 0047 — V5.46 AI Video Content Package
-- Spec: docs/dev-specs/V5.46_AI_VIDEO_CONTENT_PACKAGE_DEVELOPMENT_SPEC.md
--
-- Adds:
--   video_assets     ← studio_job_id / video_sha256 / cover_sha256 /
--                      content_package_hash / content_package_status
--   video_publications ← locale dimension (EN-first publish, §9)
--   video_asset_translations ← manual_fields_json (human-edit protection, §11.4)
--   video_transcripts / video_content_runs / video_content_suggestions (new)
--   ai_roles ← video_content_editor
--
-- Idempotency anchor: (source='local_studio', studio_job_id) UNIQUE (§4.3).
-- NOTE: applied via scripts/d1-exec.mjs (statement-splitting; see its header).
-- ---------------------------------------------------------------------------

ALTER TABLE video_assets ADD COLUMN studio_job_id TEXT NOT NULL DEFAULT '';

ALTER TABLE video_assets ADD COLUMN video_sha256 TEXT NOT NULL DEFAULT '';

ALTER TABLE video_assets ADD COLUMN cover_sha256 TEXT NOT NULL DEFAULT '';

ALTER TABLE video_assets ADD COLUMN content_package_hash TEXT NOT NULL DEFAULT '';

ALTER TABLE video_assets ADD COLUMN content_package_status TEXT NOT NULL DEFAULT 'none';

CREATE UNIQUE INDEX IF NOT EXISTS idx_video_assets_studio_job
  ON video_assets(source, studio_job_id) WHERE studio_job_id != '';

CREATE TABLE IF NOT EXISTS video_transcripts (
  id            TEXT PRIMARY KEY,
  video_id      TEXT NOT NULL,
  language      TEXT NOT NULL,
  text          TEXT NOT NULL DEFAULT '',
  segments_json TEXT NOT NULL DEFAULT '[]',
  source        TEXT NOT NULL DEFAULT 'local_studio',
  model         TEXT NOT NULL DEFAULT '',
  source_hash   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'ready',
  created_at    TEXT NOT NULL DEFAULT '',
  updated_at    TEXT NOT NULL DEFAULT '',
  UNIQUE(video_id, language, source_hash)
);

CREATE INDEX IF NOT EXISTS idx_vt_video ON video_transcripts(video_id);

CREATE TABLE IF NOT EXISTS video_content_runs (
  id             TEXT PRIMARY KEY,
  video_id       TEXT NOT NULL,
  transcript_id  TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'running',
  provider       TEXT NOT NULL DEFAULT '',
  model          TEXT NOT NULL DEFAULT '',
  role           TEXT NOT NULL DEFAULT 'video_content_editor',
  prompt_version TEXT NOT NULL DEFAULT '',
  input_hash     TEXT NOT NULL DEFAULT '',
  output_json    TEXT NOT NULL DEFAULT '{}',
  error          TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT '',
  finished_at    TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_vcr_video ON video_content_runs(video_id);

CREATE TABLE IF NOT EXISTS video_content_suggestions (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL,
  video_id      TEXT NOT NULL,
  locale        TEXT NOT NULL DEFAULT 'en',
  field_name    TEXT NOT NULL,
  value_json    TEXT NOT NULL DEFAULT 'null',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  confidence    REAL,
  applied       INTEGER NOT NULL DEFAULT 0,
  applied_at    TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_vcs_run ON video_content_suggestions(run_id);

CREATE INDEX IF NOT EXISTS idx_vcs_video ON video_content_suggestions(video_id);

ALTER TABLE video_publications ADD COLUMN locale TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS idx_vpub_video_channel;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vpub_video_channel_locale
  ON video_publications(video_id, channel, locale);

ALTER TABLE video_asset_translations ADD COLUMN manual_fields_json TEXT NOT NULL DEFAULT '[]';

INSERT OR IGNORE INTO ai_roles (name, display_name, prompt, model, reasoning_effort, enabled)
VALUES (
  'video_content_editor',
  '视频内容编辑助手',
  'You are Aromiso''s Video Content Editor. Aromiso is a B2B aroma diffuser and essential oil supplier connecting international buyers with verified Chinese factories.

You cannot watch or interpret video frames. You may only use the supplied transcript, explicit media metadata, and public facts from explicitly linked products.

Do not fabricate product specifications, materials, certifications, MOQ, pricing, performance claims, factory capabilities, customer names, or numeric claims.

If the transcript cannot prove a claim, omit it. If the transcript is empty or too short, return warnings and do not invent content.

Write natural buyer-facing English. Keep titles under 60 characters and meta descriptions under 155 characters when possible. Category must be exactly one of: product_demo, product_showcase, how_to, usage_tips, fragrance_knowledge, applications, factory_oem, industry_insights, faq, other. Tags: 3-8 short lowercase English phrases.

Return ONLY one JSON object with keys: title, description, seo_title, seo_description, category, tags (array of strings), recommended_products (array of {title, reason, confidence}), warnings (array of strings), confidence (number 0-1), evidence (array of {field, quote, segment_start, segment_end}).

All outputs are drafts and require human review. Never publish content. Never automatically modify product relations. Never mark translation content as reviewed.',
  'deepseek-v4-flash',
  'low',
  1
);
