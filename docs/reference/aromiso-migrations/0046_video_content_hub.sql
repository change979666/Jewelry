-- 0046_video_content_hub.sql — V5.45 Video Content Hub：数据模型升级（Phase 1）。
-- 规范：VIDEO_CONTENT_HUB_V1_DEVELOPMENT_SPEC.md §4 / §5。
-- 原则：只新增不删除；不改变现有视频 URL / R2 对象 / video_code；
--       不改变现有两个视频的公开/非公开事实。
-- 幂等说明：表/索引均 IF NOT EXISTS；回填 UPDATE 本身可重跑；
--   ALTER TABLE ADD COLUMN 无法加 IF NOT EXISTS —— 本迁移执行前已核查生产
--   video_assets 无任一新增列（PRAGMA table_info），整体作为单事务执行，
--   若中途任何语句失败则全部回滚，不会产生半迁移状态。
--
-- Migration A：video_assets 主表扩列（13 列）
ALTER TABLE video_assets ADD COLUMN internal_title TEXT NOT NULL DEFAULT '';
ALTER TABLE video_assets ADD COLUMN internal_description TEXT NOT NULL DEFAULT '';
ALTER TABLE video_assets ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'ingested';
ALTER TABLE video_assets ADD COLUMN editorial_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE video_assets ADD COLUMN category TEXT NOT NULL DEFAULT '';
ALTER TABLE video_assets ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE video_assets ADD COLUMN width INTEGER NOT NULL DEFAULT 0;
ALTER TABLE video_assets ADD COLUMN height INTEGER NOT NULL DEFAULT 0;
ALTER TABLE video_assets ADD COLUMN aspect_ratio REAL NOT NULL DEFAULT 0;
ALTER TABLE video_assets ADD COLUMN orientation TEXT NOT NULL DEFAULT '';
ALTER TABLE video_assets ADD COLUMN format TEXT NOT NULL DEFAULT '';
ALTER TABLE video_assets ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE video_assets ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Migration B：公开多语言内容表（locale 仅允许 en/es/de，由应用层约束）。
-- 不在此处预置空翻译行：三语内容必须由人工/AI 草稿显式写入，
-- 严禁把中文 title 自动冒充 en/es/de（规范 §5.2）。
CREATE TABLE IF NOT EXISTS video_asset_translations (
  id                 TEXT PRIMARY KEY,
  video_id           TEXT NOT NULL,
  locale             TEXT NOT NULL,
  title              TEXT NOT NULL DEFAULT '',
  description        TEXT NOT NULL DEFAULT '',
  seo_title          TEXT NOT NULL DEFAULT '',
  seo_description    TEXT NOT NULL DEFAULT '',
  translation_status TEXT NOT NULL DEFAULT 'draft',
  updated_at         TEXT NOT NULL DEFAULT '',
  UNIQUE(video_id, locale)
);

-- Migration A 回填：
-- 1) 旧 title 原值进 internal_title（中文内部名，不再出现在任何公开输出）。
UPDATE video_assets SET internal_title = title WHERE internal_title = '';
-- 2) 旧 status → processing_status（ingested→ingested / processed→processed /
--    ready→ready / archived→ready，规范 §5.2 映射表）。新列默认 'ingested'，
--    只需修正 processed / ready / archived 三类。
UPDATE video_assets SET processing_status = 'processed' WHERE status = 'processed';
UPDATE video_assets SET processing_status = 'ready' WHERE status IN ('ready', 'archived');
-- 3) 旧 status → editorial_status（默认 'draft'；ready→review / archived→archived）。
--    映射本身不把任何视频变成 Website live（发布账本不动）。
UPDATE video_assets SET editorial_status = 'review' WHERE status = 'ready' AND editorial_status = 'draft';
UPDATE video_assets SET editorial_status = 'archived' WHERE status = 'archived' AND editorial_status = 'draft';

-- Migration C：索引
CREATE INDEX IF NOT EXISTS idx_video_assets_processing_status ON video_assets(processing_status);
CREATE INDEX IF NOT EXISTS idx_video_assets_editorial_status ON video_assets(editorial_status);
CREATE INDEX IF NOT EXISTS idx_video_assets_category ON video_assets(category);
CREATE INDEX IF NOT EXISTS idx_video_assets_orientation ON video_assets(orientation);
CREATE INDEX IF NOT EXISTS idx_video_assets_featured_order ON video_assets(featured, sort_order);
CREATE INDEX IF NOT EXISTS idx_video_translations_video_locale ON video_asset_translations(video_id, locale);
CREATE INDEX IF NOT EXISTS idx_video_publications_channel_status ON video_publications(channel, status);
