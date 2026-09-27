-- Aromiso AI Growth Center — Decision layer tables

CREATE TABLE IF NOT EXISTS ai_daily_briefs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  content_json TEXT NOT NULL DEFAULT '{}',
  health_score INTEGER NOT NULL DEFAULT 0,
  issues_count INTEGER NOT NULL DEFAULT 0,
  opportunities_count INTEGER NOT NULL DEFAULT 0,
  signals_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_briefs_date ON ai_daily_briefs(date);

CREATE TABLE IF NOT EXISTS ai_opportunities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'seo',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'P1',
  status TEXT NOT NULL DEFAULT 'pending',
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_opps_status ON ai_opportunities(status, type);

CREATE TABLE IF NOT EXISTS ai_lead_scores (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'medium',
  factors_json TEXT NOT NULL DEFAULT '{}',
  recommended_action TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_lead_inquiry ON ai_lead_scores(inquiry_id);
