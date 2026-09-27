-- 0041: AI Production Studio V1 — 视频线归因（§15）
-- source_video_id: 询盘来自哪条本地化视频（inquiries.source 复用，值填 "video"）
ALTER TABLE inquiries ADD COLUMN source_video_id TEXT NOT NULL DEFAULT '';
