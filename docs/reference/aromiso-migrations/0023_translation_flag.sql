-- 0023: add `translated` flag to commerce_products for resumable EN backfill
ALTER TABLE commerce_products ADD COLUMN translated INTEGER NOT NULL DEFAULT 0;
