-- Phase 5: Saved Profit/Price Calculations
-- Stores calculation snapshots for the profit calculator tool.

CREATE TABLE IF NOT EXISTS saved_calculations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  admin_user_id TEXT NOT NULL DEFAULT '',
  product_id TEXT,
  input_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT NOT NULL DEFAULT '{}',
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_saved_calculations_user ON saved_calculations(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_calculations_product ON saved_calculations(product_id);
