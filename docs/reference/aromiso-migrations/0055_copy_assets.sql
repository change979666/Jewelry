-- 0055: Phase 4 copy assets (13 types x locale x linked entity)

CREATE TABLE IF NOT EXISTS copy_assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  linked_entity_type TEXT,
  linked_entity_id TEXT,
  current_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by_source TEXT NOT NULL,
  ai_role_used TEXT,
  ai_model_used TEXT,
  ai_cost_cents INTEGER DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  deleted_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_copy_assets_type ON copy_assets(type, locale);
CREATE INDEX IF NOT EXISTS idx_copy_assets_linked ON copy_assets(linked_entity_type, linked_entity_id);
CREATE INDEX IF NOT EXISTS idx_copy_assets_status ON copy_assets(status);
