-- 0066: Phase 4 batch jobs (batch operation header)

CREATE TABLE IF NOT EXISTS batch_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total INTEGER NOT NULL DEFAULT 0,
  done_count INTEGER DEFAULT 0,
  params_json TEXT,
  created_by TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_bj_status ON batch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bj_created ON batch_jobs(created_at DESC);
