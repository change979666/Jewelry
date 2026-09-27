-- Aromiso V4.3 — AI Knowledge Base
-- Stores insights learned from data analysis so the AI gets smarter over time.
-- Each entry is a factual observation about the website's SEO, content, or user behavior.
-- The AI loads recent entries as context before each call, building cumulative understanding.

CREATE TABLE IF NOT EXISTS knowledge_base (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category    TEXT NOT NULL DEFAULT 'general',
  -- Categories: seo_keyword / page_insight / content_gap / user_behavior / optimization_result / site_fact
  title       TEXT NOT NULL,
  detail      TEXT NOT NULL,
  source      TEXT DEFAULT '',
  -- Where this knowledge came from: 'cron-pull', 'ai-assist', 'manual'
  importance  INTEGER DEFAULT 5,
  -- 1-10, higher = more important to keep
  created_at  INTEGER NOT NULL
);

-- Index for fast recent lookups
CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_kb_importance ON knowledge_base(importance DESC);
