-- ============================================================================
--  0010 — RBAC resource rename: `oem` -> `shipping`
--
--  WHY
--  The RBAC resource list was inherited from the Aromiso B2B project, where
--  `oem` guarded the OEM/private-label project pipeline. Jewelry is a DTC
--  storefront with no OEM surface; its fulfilment flow (COD order -> confirm
--  -> ship -> deliver) is backed by the real `shipments` / `shipment_events` /
--  `markets` tables, so `shipping` is the resource that actually maps to an
--  admin capability area in this product.
--
--  The permission matrix itself (which role gets which action) is unchanged —
--  only the resource identifier moves.
--
--  Safe to re-run: UPDATE OR IGNORE skips rows that would collide with an
--  existing (role_id,'shipping',action) tuple, and the trailing DELETE clears
--  any left-over 'oem' row.
--
--  NOTE (2026-09-27): migration 0003 has since been corrected in place to seed
--  'shipping' directly. On a FRESH database replay (0001 -> 0010) both
--  statements below therefore match zero rows and are no-ops; this file is kept
--  because it is the only thing that migrates databases which already ran the
--  original 0003 (i.e. the local dev DB and any deployed environment).
-- ============================================================================

UPDATE OR IGNORE admin_permissions SET resource = 'shipping' WHERE resource = 'oem';
DELETE FROM admin_permissions WHERE resource = 'oem';
