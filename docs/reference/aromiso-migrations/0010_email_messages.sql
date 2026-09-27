-- ===========================================================================
--  Email thread system — stores all inbound/outbound messages per inquiry
-- ===========================================================================

CREATE TABLE IF NOT EXISTS email_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inquiry_id TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT DEFAULT '',
  body_html TEXT DEFAULT '',
  body_text TEXT DEFAULT '',
  message_id TEXT DEFAULT '',
  in_reply_to TEXT DEFAULT '',
  status TEXT DEFAULT 'sent',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_inquiry ON email_messages(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_email_created ON email_messages(created_at DESC);
