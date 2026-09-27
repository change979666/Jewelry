-- 0071_media_assets.sql — Phase 9 Media Center: unified media asset library
-- Extends the V1 video_assets system with a general-purpose media registry.
-- V1 video_assets/video_publications/video_product_links remain untouched.

-- Media asset registry: images, videos, documents, covers, etc.
CREATE TABLE IF NOT EXISTS media_assets (
  id            TEXT PRIMARY KEY,
  filename      TEXT NOT NULL DEFAULT '',
  mime_type     TEXT NOT NULL DEFAULT '',
  file_size     INTEGER NOT NULL DEFAULT 0,
  width         INTEGER NOT NULL DEFAULT 0,
  height        INTEGER NOT NULL DEFAULT 0,
  r2_key        TEXT NOT NULL DEFAULT '',
  public_url    TEXT NOT NULL DEFAULT '',
  alt_text      TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  tags_json     TEXT NOT NULL DEFAULT '[]',
  media_type    TEXT NOT NULL DEFAULT 'image',   -- image | video | document | cover | other
  source        TEXT NOT NULL DEFAULT 'upload',  -- upload | import | url | video_center
  video_asset_id TEXT NOT NULL DEFAULT '',       -- optional link to video_assets.id
  linked_entity_type TEXT NOT NULL DEFAULT '',   -- product | oem_project | blog | etc.
  linked_entity_id   TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  featured      INTEGER NOT NULL DEFAULT 0,
  deleted_at    TEXT NOT NULL DEFAULT '',
  deleted_by    TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT '',
  updated_at    TEXT NOT NULL DEFAULT '',
  created_by    TEXT NOT NULL DEFAULT ''
);

-- Polymorphic link table: media ↔ entity (many-to-many)
CREATE TABLE IF NOT EXISTS media_links (
  id            TEXT PRIMARY KEY,
  media_id      TEXT NOT NULL,
  entity_type   TEXT NOT NULL DEFAULT '',  -- product | oem_project | blog | video
  entity_id     TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT '',
  UNIQUE(media_id, entity_type, entity_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_type ON media_assets(media_type);
CREATE INDEX IF NOT EXISTS idx_media_assets_source ON media_assets(source);
CREATE INDEX IF NOT EXISTS idx_media_assets_deleted ON media_assets(deleted_at);
CREATE INDEX IF NOT EXISTS idx_media_assets_featured ON media_assets(featured, sort_order);
CREATE INDEX IF NOT EXISTS idx_media_assets_entity ON media_assets(linked_entity_type, linked_entity_id);
CREATE INDEX IF NOT EXISTS idx_media_links_media ON media_links(media_id);
CREATE INDEX IF NOT EXISTS idx_media_links_entity ON media_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_video ON media_assets(video_asset_id);
