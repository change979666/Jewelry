-- 0064: Phase 2 admin_entities — Search Index (INV-1)
-- NOT a Domain Model. 5 fields only. Never add columns.
-- entity_type + entity_id = PRIMARY KEY.
-- Populated by syncAdminEntity() from V2 API handlers.
-- Initial seed: one-time script after migration.
-- Rollback: DROP TABLE (reversible, seed data is rebuildable)

-- UP ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_entities (
  entity_type TEXT NOT NULL,      -- 'blog' | 'product_content' | 'commerce_product' | 'customer' | 'inquiry' | 'oem_project' | 'video' | 'copy_asset'
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_entities_status ON admin_entities(status);
CREATE INDEX IF NOT EXISTS idx_admin_entities_updated ON admin_entities(updated_at);

-- DOWN ----------------------------------------------------------------------

DROP TABLE IF EXISTS admin_entities;