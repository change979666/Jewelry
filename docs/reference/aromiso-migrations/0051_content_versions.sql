-- 0051: Phase 2 Content Versions (metadata-only, ADR-11)
-- Records version metadata. Body fetched from GitHub API (no body_snapshot).
-- github_commit_sha: links version to GitHub commit (1-API-call rollback)
-- rollback_to_version_id: traces version chain for multi-rollback scenarios
-- Rollback: DROP TABLE (reversible, initial version data is expendable)

-- UP ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS content_versions (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,      -- 'blog' | 'product_content' | 'guide' | 'case_study' | 'faq' | 'copy_asset'
  entity_key TEXT NOT NULL,       -- content key/slug
  locale TEXT NOT NULL DEFAULT 'en',
  version INTEGER NOT NULL,
  author TEXT NOT NULL,           -- 'human:<username>' | 'ai:<role_name>'
  source TEXT,                    -- 'manual_edit' | 'ai_generate' | 'ai_translate' | 'publish' | 'rollback'
  change_summary TEXT,
  github_commit_sha TEXT,         -- GitHub commit SHA at time of publish (enables 1-call rollback, ADR-11)
  rollback_to_version_id TEXT,    -- If this version is a rollback, points to the version it restored
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_versions_entity ON content_versions(entity_type, entity_key, locale);
CREATE INDEX IF NOT EXISTS idx_content_versions_created ON content_versions(created_at);
CREATE INDEX IF NOT EXISTS idx_content_versions_sha ON content_versions(github_commit_sha);

-- DOWN ----------------------------------------------------------------------

DROP TABLE IF EXISTS content_versions;