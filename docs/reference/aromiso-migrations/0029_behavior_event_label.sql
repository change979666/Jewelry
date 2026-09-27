-- V5.27: Extend behavior_events with 'label' column for event-specific context
-- Usage: shop_search term, filter_use value, featured_click product_id, etc.
-- Created: 2026-08-11

ALTER TABLE behavior_events ADD COLUMN label TEXT DEFAULT '';

-- Index on label is unnecessary given typical query patterns (group by type/page/date).
-- If needed later, create separately with specific use cases.
