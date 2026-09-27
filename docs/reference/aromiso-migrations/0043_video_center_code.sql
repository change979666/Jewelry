-- V5.431: human-friendly independent video ID (VID-0001 …) for Video Center.
-- Auto-assigned on create by /api/admin/video-center; immutable afterwards.
-- NOTE: d1-exec.mjs runs only the FIRST statement per file — apply the two
-- statements separately (see sql_vc43a.sql / sql_vc43b.sql).
ALTER TABLE video_assets ADD COLUMN video_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_assets_code ON video_assets(video_code);
