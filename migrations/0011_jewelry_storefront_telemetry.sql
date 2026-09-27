-- ============================================================================
--  0011 — Storefront telemetry tables (schema source of truth)
--
--  WHY
--  Two tables were reachable from the live storefront but existed outside
--  `migrations/`, which is supposed to be the single source of truth for schema:
--
--   • `subscribers`      — used by POST /api/subscribe (the footer signup form).
--                          The endpoint created it lazily with
--                          `CREATE TABLE IF NOT EXISTS`, so it worked — but the
--                          schema lived in an endpoint, invisible to migration
--                          replay. That lazy DDL has now been removed.
--
--   • `behavior_events`  — used by POST /api/track (navigator.sendBeacon from
--                          BaseLayout on every page view). The endpoint has no
--                          DDL and swallows write errors, so on a fresh database
--                          every analytics write failed SILENTLY with
--                          "no such table: behavior_events".
--
--  Both are additive and safe to run against an existing database: `subscribers`
--  is `IF NOT EXISTS` (a database that already grew it lazily is unaffected),
--  and `behavior_events` did not previously exist at all.
-- ============================================================================

-- ---- Newsletter / footer signup --------------------------------------------
CREATE TABLE IF NOT EXISTS subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  locale     TEXT NOT NULL DEFAULT '',
  source     TEXT NOT NULL DEFAULT 'footer',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscribers_created_at ON subscribers (created_at DESC);

-- ---- Self-hosted behaviour tracking ----------------------------------------
-- `created_at` is a Unix timestamp in SECONDS (see POST /api/track), not an ISO
-- string — do not "normalise" it to TEXT, the tracking code binds a number.
CREATE TABLE IF NOT EXISTS behavior_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type   TEXT NOT NULL,
  page         TEXT,
  product_slug TEXT,
  lang         TEXT,
  country      TEXT,
  device       TEXT,
  referrer     TEXT,
  session_id   TEXT,
  label        TEXT,
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_behavior_events_created_at ON behavior_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_events_type       ON behavior_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_events_session    ON behavior_events (session_id);
