-- V4: Self-built behavior tracking events
CREATE TABLE IF NOT EXISTS behavior_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type   TEXT NOT NULL,        -- page_view / click_quote / click_whatsapp
                                     -- click_email / download_catalog / newsletter / inquiry_submit
  page         TEXT,                 -- /en/products/lavender-essential-oil
  product_slug TEXT,                 -- lavender-essential-oil (nullable)
  lang         TEXT,                 -- en / es / de
  country      TEXT,                 -- US / DE (from CF-IPCountry, not precise IP)
  device       TEXT,                 -- desktop / mobile / tablet
  referrer     TEXT,                 -- source (google / direct / linkedin ...)
  session_id   TEXT,                 -- anonymous session ID (random string, not PII)
  created_at   INTEGER NOT NULL      -- Unix timestamp (seconds)
);

CREATE INDEX IF NOT EXISTS idx_behavior_type_time ON behavior_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_behavior_product   ON behavior_events(product_slug, created_at);
CREATE INDEX IF NOT EXISTS idx_behavior_session   ON behavior_events(session_id);
