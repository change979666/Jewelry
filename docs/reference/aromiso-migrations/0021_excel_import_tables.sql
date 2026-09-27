-- Excel Import Jobs — add missing columns for the new Excel import pipeline
-- This migration updates commerce_import_jobs and commerce_import_errors to support
-- the Excel import workflow (source_method, import_batch, total_skus, updated_at).

ALTER TABLE commerce_import_jobs ADD COLUMN source_method TEXT NOT NULL DEFAULT '';
ALTER TABLE commerce_import_jobs ADD COLUMN import_batch TEXT NOT NULL DEFAULT '';
ALTER TABLE commerce_import_jobs ADD COLUMN total_skus INTEGER NOT NULL DEFAULT 0;
ALTER TABLE commerce_import_jobs ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
-- Backfill: sync updated_at with created_at for existing rows
UPDATE commerce_import_jobs SET updated_at = created_at WHERE updated_at = 0;

-- Update commerce_import_errors to match the new schema
ALTER TABLE commerce_import_errors ADD COLUMN row_index INTEGER NOT NULL DEFAULT -1;
ALTER TABLE commerce_import_errors ADD COLUMN error_message TEXT NOT NULL DEFAULT '';
