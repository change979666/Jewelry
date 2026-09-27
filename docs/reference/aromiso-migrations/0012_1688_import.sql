-- Aromiso 1688 Import V1 — Import system tables + product source fields

-- Add source tracking fields to commerce_products
ALTER TABLE commerce_products ADD COLUMN source_platform TEXT NOT NULL DEFAULT '';
ALTER TABLE commerce_products ADD COLUMN source_url TEXT NOT NULL DEFAULT '';
ALTER TABLE commerce_products ADD COLUMN source_shop_name TEXT NOT NULL DEFAULT '';
ALTER TABLE commerce_products ADD COLUMN source_import_method TEXT NOT NULL DEFAULT '';
ALTER TABLE commerce_products ADD COLUMN source_imported_at INTEGER;
ALTER TABLE commerce_products ADD COLUMN cost_price REAL;

-- Product images (multi-image support with dedup)
CREATE TABLE IF NOT EXISTS commerce_product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES commerce_product_variants(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'main',
  url TEXT NOT NULL DEFAULT '',
  original_filename TEXT NOT NULL DEFAULT '',
  sha256 TEXT NOT NULL DEFAULT '',
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'upload',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_commerce_images_product ON commerce_product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_commerce_images_type ON commerce_product_images(product_id, type);
CREATE INDEX IF NOT EXISTS idx_commerce_images_sha ON commerce_product_images(sha256);

-- Import jobs (track upload → scan → ready lifecycle)
CREATE TABLE IF NOT EXISTS commerce_import_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'uploaded',
  filename TEXT NOT NULL DEFAULT '',
  total_files INTEGER NOT NULL DEFAULT 0,
  processed_files INTEGER NOT NULL DEFAULT 0,
  total_products INTEGER NOT NULL DEFAULT 0,
  processed_products INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  draft_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_commerce_import_status ON commerce_import_jobs(status);

-- Import errors (per-file granular error tracking)
CREATE TABLE IF NOT EXISTS commerce_import_errors (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES commerce_import_jobs(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT '',
  error_type TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_commerce_import_errors_job ON commerce_import_errors(job_id);
