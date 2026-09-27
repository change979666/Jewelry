-- 0050: Phase 2 Audit Logs
-- Records all write operations: who, when, what, before/after
-- actor_type distinguishes human / ai / cron / system
-- Rollback: DROP TABLE (reversible, audit data is non-critical for system function)

-- UP ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT,
  action TEXT NOT NULL,           -- 'create' | 'update' | 'delete' | 'publish' | 'approve_ai' | 'reject_ai' | 'login' | 'logout' | 'rollback'
  resource_type TEXT NOT NULL,    -- 'content' | 'commerce_product' | 'order' | 'customer' | 'inquiry' | 'oem_project' | 'video' | 'copy_asset' | 'ai_task' | 'system'
  resource_id TEXT,
  resource_title TEXT,
  change_summary TEXT,            -- Human-readable: "Changed title from X to Y"
  before_snippet TEXT,            -- Key changed fields only (not full JSON snapshot — avoids storage bomb)
  after_snippet TEXT,             -- Key changed fields only
  actor_type TEXT NOT NULL DEFAULT 'human',  -- 'human' | 'ai' | 'cron' | 'system'
  ip_address TEXT,
  request_id TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at);

-- DOWN ----------------------------------------------------------------------

DROP TABLE IF EXISTS audit_logs;