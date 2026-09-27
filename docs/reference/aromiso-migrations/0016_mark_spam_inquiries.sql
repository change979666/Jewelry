-- ---------------------------------------------------------------------------
--  Migration 0016 — Mark known spam inquiries from the 2026-08-01/02 attack
--
--  The "Robertbib" botnet flooded POST /api/inquiry with machine-translated
--  spam. This marks the known-bad rows as 'Spam' (non-destructive) so they
--  can be reviewed in the admin and excluded from notifications/analytics.
--
--  Per docs/ANTI_ABUSE_ARCHITECTURE.md §5.6: mark first, observe 24h for any
--  false positives, THEN delete manually. The DELETE is intentionally left
--  commented out — run it by hand only after confirming no real customer hit.
-- ---------------------------------------------------------------------------

UPDATE inquiries
SET status = 'Spam'
WHERE name = 'Robertbib'
   OR lower(email) IN (
     'carlo.marra@libero.it',
     'arthurmoreno@outlook.com',
     'padillaleye@gmail.com',
     'katrinah@lee-stores.com'
   );

-- Manual cleanup (run only after 24h observation, no false positives):
-- DELETE FROM inquiries WHERE status = 'Spam';
