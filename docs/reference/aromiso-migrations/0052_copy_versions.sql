-- 0052: Phase 4 copy asset versions (per asset version history)
-- Reuses copy_assets table (0055). Body is short — stored directly (not GitHub).
-- restore = use old body_snapshot as the new edit (no time-travel mechanism)

CREATE TABLE IF NOT EXISTS copy_versions (
  id TEXT PRIMARY KEY,
  copy_asset_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  body_snapshot TEXT NOT NULL,
  author TEXT NOT NULL,
  change_summary TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_copy_versions_asset ON copy_versions(copy_asset_id, version);
