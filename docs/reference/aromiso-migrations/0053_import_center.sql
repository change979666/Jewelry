-- 0053: Phase 12 — Import Center tables

-- Import Jobs: tracks each import session
CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL DEFAULT '1688_zip',  -- 1688_zip | excel | csv
  filename TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'uploaded',       -- uploaded | parsing | parsed | validating | validated | enriching | enriched | confirming | confirmed | creating | completed | failed | cancelled
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  success_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  field_mapping_json TEXT,                        -- JSON: source field → target field mapping
  options_json TEXT,                              -- JSON: import options (skip_errors, auto_enrich, etc.)
  error_report_json TEXT,                         -- JSON: error details for failed rows
  created_by TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Import Items: each row/product in an import job
CREATE TABLE IF NOT EXISTS import_items (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES import_jobs(id),
  row_index INTEGER NOT NULL DEFAULT 0,
  source_data_json TEXT NOT NULL DEFAULT '{}',    -- raw parsed data
  mapped_data_json TEXT,                          -- after field mapping
  validated_data_json TEXT,                       -- after validation
  enriched_data_json TEXT,                        -- after AI enrichment
  status TEXT NOT NULL DEFAULT 'pending',         -- pending | mapped | validated | enriched | creating | created | failed | skipped
  error_message TEXT,
  entity_type TEXT DEFAULT 'commerce_product',    -- commerce_product | sku
  entity_id TEXT,                                 -- created entity ID
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_import_items_job ON import_items(job_id);
CREATE INDEX IF NOT EXISTS idx_import_items_status ON import_items(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
