-- 0072: Phase 10 notifications — system notifications for admin users
-- Stores events: new inquiry, new order, AI complete/fail, SEO alert, OEM pending, etc.
-- Rollback: DROP TABLE (reversible, no business data depends on it)

-- UP ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  type TEXT NOT NULL,           -- 'inquiry' | 'order' | 'ai_task' | 'seo_alert' | 'oem' | 'commerce' | 'system'
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',           -- admin-v2 relative path for click-through
  entity_type TEXT NOT NULL DEFAULT '',    -- optional: 'blog' | 'commerce_product' | 'customer' | 'oem_project' | ...
  entity_id TEXT NOT NULL DEFAULT '',      -- optional: related entity id
  is_read INTEGER NOT NULL DEFAULT 0,      -- 0 = unread, 1 = read
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- DOWN ----------------------------------------------------------------------

DROP TABLE IF EXISTS notifications;
