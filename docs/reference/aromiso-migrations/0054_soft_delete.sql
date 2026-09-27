-- 0054: Phase 4 soft_delete columns (ALTER existing tables)
-- Exact scope determined from V2_DB_MAP_CURRENT cross-reference.
-- Phase 4 targets: commerce_products (required for Recycle Bin).
-- commerce_orders / growth_opportunities / growth_actions: added in their respective Phases.

-- UP
ALTER TABLE commerce_products ADD COLUMN deleted_at DATETIME;
ALTER TABLE commerce_products ADD COLUMN deleted_by TEXT;
