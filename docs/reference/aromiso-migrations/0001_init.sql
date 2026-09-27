-- Aromiso inquiries table (Cloudflare D1)
-- Stores public contact/inquiry form submissions for admin management.

CREATE TABLE IF NOT EXISTS inquiries (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  company    TEXT NOT NULL DEFAULT '',
  country    TEXT NOT NULL DEFAULT '',
  whatsapp   TEXT NOT NULL DEFAULT '',
  product    TEXT NOT NULL DEFAULT '',
  quantity   TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL DEFAULT '',
  source     TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'New',
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_inquiries_status  ON inquiries (status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries (created_at DESC);
