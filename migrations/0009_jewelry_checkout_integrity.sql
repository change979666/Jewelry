-- 0009_jewelry_checkout_integrity.sql
--
-- Checkout integrity (P0-3):
--   carts.checked_out_at  — single-use claim on a cart. Checkout atomically
--     claims the cart (UPDATE ... WHERE checked_out_at IS NULL) so a double
--     submit / double click cannot create two orders from one cart.
--
-- Inventory is reserved with a conditional UPDATE inside the checkout flow
-- (see src/lib/commerce/inventory.service.ts); no schema change is required
-- for that because D1 serialises writes and the guard lives in the WHERE
-- clause. This migration only adds the cart claim column + lookup index.

ALTER TABLE carts ADD COLUMN checked_out_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_carts_session_active
  ON carts(session_id)
  WHERE checked_out_at IS NULL;
