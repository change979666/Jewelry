-- Phase 7: AI Tasks — unified V2 task queue
-- Bridges existing tasks/task_runs with a denormalized V2 view

CREATE TABLE IF NOT EXISTS ai_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Task identity
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'analysis',
  -- Target entity (polymorphic)
  target_type TEXT,           -- 'product' | 'content' | 'customer' | 'oem' | 'inquiry' | null
  target_id TEXT,             -- entity id or key
  -- Execution
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed | cancelled | awaiting_approval
  execution_mode TEXT NOT NULL DEFAULT 'L1',  -- L1|L2|L3|L4|MANUAL (code-enforced, not AI-reported)
  priority TEXT NOT NULL DEFAULT 'normal',  -- low | normal | high | urgent
  -- AI details
  ai_role TEXT,               -- which ai_roles row was used
  model_used TEXT,
  prompt_version TEXT,
  input_snapshot TEXT,        -- JSON of inputs sent to AI
  output_snapshot TEXT,       -- JSON of AI response
  -- Diff / before-after
  before_snapshot TEXT,       -- JSON of entity state before AI action
  after_snapshot TEXT,        -- JSON of entity state after AI action
  -- Approval workflow
  approved_by TEXT,           -- admin username who approved
  approved_at TEXT,           -- ISO timestamp
  rejected_by TEXT,
  rejected_at TEXT,
  rejection_reason TEXT,
  -- Rollback
  rollback_available INTEGER NOT NULL DEFAULT 0,
  rollback_version_id TEXT,   -- content_versions id or similar
  -- Metrics
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_cny REAL DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  -- Idempotency
  idempotency_key TEXT UNIQUE,
  -- Audit
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  -- Foreign key to missions (optional link)
  mission_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_type ON ai_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_target ON ai_tasks(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_created ON ai_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_mode ON ai_tasks(execution_mode);
