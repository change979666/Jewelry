-- 0065: Phase 4 content publish ledger (five-state publish machine)
-- Tracks every publish attempt per (entity_type, entity_key, locale).
-- Five states: committing → building → deployed / build_failed
-- Current state = latest row per (entity, locale).
-- Rollback = new publish record with source='rollback'.

CREATE TABLE IF NOT EXISTS content_publishments (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  locale TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'committing',
  content_hash TEXT NOT NULL,
  github_commit_sha TEXT,
  build_signal TEXT DEFAULT 'pending',
  attempt_count INTEGER DEFAULT 1,
  retry_of TEXT,
  error_message TEXT,
  created_by TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cp_entity ON content_publishments(entity_type, entity_key, locale, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cp_status ON content_publishments(status);
