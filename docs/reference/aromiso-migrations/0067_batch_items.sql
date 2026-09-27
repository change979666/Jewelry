-- 0067: Phase 4 batch items (per-item tracking)

CREATE TABLE IF NOT EXISTS batch_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  locale TEXT,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at DATETIME,
  finished_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_bi_batch ON batch_items(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_bi_status ON batch_items(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bi_idempotency ON batch_items(batch_id, idempotency_key);
