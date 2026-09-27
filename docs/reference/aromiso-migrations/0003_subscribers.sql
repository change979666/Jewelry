-- Aromiso newsletter subscribers table (Cloudflare D1)
-- Stores footer newsletter opt-ins for admin review / manual outreach.
-- Collect only — no automatic email is sent to these addresses.

CREATE TABLE IF NOT EXISTS subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  locale     TEXT NOT NULL DEFAULT '',
  source     TEXT NOT NULL DEFAULT 'footer',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscribers_created ON subscribers (created_at DESC);
