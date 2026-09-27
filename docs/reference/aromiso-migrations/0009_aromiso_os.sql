-- ===========================================================================
--  Aromiso OS 1.0 — Full schema migration
--  Creates all tables for the AI Growth Center.
--  Run in CF D1 console. Safe to re-run (IF NOT EXISTS).
-- ===========================================================================

-- ─── AI Role Center (Prompt 配置化) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT,
  prompt TEXT NOT NULL DEFAULT '',
  model TEXT DEFAULT 'deepseek-v4-pro',
  reasoning_effort TEXT DEFAULT 'low',
  schedule_cron TEXT,
  inputs TEXT DEFAULT '[]',
  outputs TEXT DEFAULT '[]',
  enabled INTEGER DEFAULT 1,
  updated_at INTEGER
);

-- ─── Business Knowledge (四级知识体系) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL DEFAULT 'observation',
  category TEXT NOT NULL DEFAULT 'operation',
  summary TEXT NOT NULL,
  evidence TEXT DEFAULT '[]',
  confidence REAL DEFAULT 50,
  importance INTEGER DEFAULT 50,
  source TEXT DEFAULT 'ai',
  tags TEXT DEFAULT '',
  related_products TEXT DEFAULT '',
  related_countries TEXT DEFAULT '',
  related_industry TEXT DEFAULT '',
  decay_rate REAL DEFAULT 1.0,
  expire_at INTEGER,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_knowledge_cat ON knowledge(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_level ON knowledge(level);
CREATE INDEX IF NOT EXISTS idx_knowledge_importance ON knowledge(importance DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge(status);

-- ─── Decision Library (防重复建议) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  suggestion TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'adopted',
  reason TEXT DEFAULT '',
  task_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);

-- ─── Tasks (Top5 建议 → 执行闭环) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  roi_score REAL DEFAULT 0,
  impact TEXT DEFAULT 'medium',
  difficulty TEXT DEFAULT 'medium',
  business_reason TEXT DEFAULT '',
  knowledge_refs TEXT DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  result TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- ─── Experiments (增长实验中心) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hypothesis TEXT DEFAULT '',
  target_page TEXT DEFAULT '',
  metric TEXT DEFAULT 'ctr',
  before_value REAL,
  after_value REAL,
  status TEXT DEFAULT 'running',
  conclusion TEXT DEFAULT '',
  started_at INTEGER,
  ended_at INTEGER
);

-- ─── AI Reports (日/周/月/季报告存档) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  period TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_type ON ai_reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_period ON ai_reports(period DESC);

-- ─── Audit Issues (网站审计) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  severity TEXT NOT NULL DEFAULT 'P2',
  type TEXT DEFAULT '',
  page TEXT DEFAULT '',
  detail TEXT DEFAULT '',
  status TEXT DEFAULT 'open',
  found_at INTEGER NOT NULL,
  fixed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_audit_status ON audit_issues(status);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_issues(severity);

-- ─── AI Usage (逐笔记账) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT DEFAULT '',
  model TEXT DEFAULT '',
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_cny REAL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_created ON ai_usage(created_at DESC);

-- ─── Seed default AI roles ──────────────────────────────────────────────────
INSERT OR IGNORE INTO ai_roles (name, display_name, prompt, model, reasoning_effort, schedule_cron, inputs, outputs, enabled, updated_at)
VALUES
  ('analyst', '数据分析师', '# Identity\n你是 Aromiso 的数据分析师。\n# Mission\n发现数据异动与增长机会。\n# KPI\n每日产出 3-5 条有证据支撑的机会/异常。\n# Input\nGSC 快照、GA4 快照、行为事件、询盘统计。\n# Output\nJSON: opportunities[{type,score,impact,evidence,recommendation,confidence}]\n# Rules\n每条必须引用具体数据证据。置信度<60%标记low-confidence。\n# Constraints\n不写文案、不做营销copy、不编造数据。', 'deepseek-v4-pro', 'low', '15 6 * * *', '["gsc_daily","ga_daily","behavior_events","inquiries"]', '["opportunities"]', 1, 1753833600),
  ('librarian', '知识管理员', '# Identity\n你是 Aromiso 的知识管理员。\n# Mission\n将分析发现转化为结构化业务知识。\n# KPI\n每日沉淀 2-4 条高质量知识条目。\n# Input\nAnalyst 产出的 opportunities、现有 knowledge 表。\n# Output\nJSON: entries[{level,category,summary,evidence,confidence,importance,decay_rate}]\n# Rules\n存结论不存Prompt。必须标注证据来源。数据类decay_rate=0.95,经验类=1.0。\n# Constraints\n不提建议、不做优化、不编造。', 'deepseek-v4-pro', 'low', '25 6 * * *', '["opportunities","knowledge"]', '["knowledge"]', 1, 1753833600),
  ('strategist', '策略总监', '# Identity\n你是 Aromiso 的策略总监。\n# Mission\n每天输出 Top 5 优先级行动建议。\n# KPI\n建议被采纳率>60%；不重复已拒绝建议。\n# Input\nopportunities、knowledge(Top-20)、decisions(近30天)、tasks(未完成)。\n# Output\nJSON: tasks[{title,roi_score,impact,difficulty,business_reason,knowledge_refs}]\n# Rules\n出题前查decisions防重复。每条带ROI/难度/预期影响/业务理由。引用knowledge.id。\n# Constraints\n不泛泛而谈；每日最多5条。', 'deepseek-v4-pro', 'medium', '35 6 * * *', '["opportunities","knowledge","decisions","tasks"]', '["tasks"]', 1, 1753833600),
  ('executor', '执行教练', '# Identity\n你是 Aromiso 的执行教练。\n# Mission\n跟进历史任务执行情况，回填效果。\n# KPI\n任务关闭率；效果回填准确率。\n# Input\ntasks(未完成)、最新GSC/GA数据(验证效果)。\n# Output\nJSON: updates[{task_id,status,result}] + daily_summary\n# Rules\n完成的任务回填实际效果数据。超7天未完成发提醒。\n# Constraints\n不创造新策略。', 'deepseek-v4-pro', 'low', '45 6 * * *', '["tasks","gsc_daily","ga_daily"]', '["tasks","ai_reports"]', 1, 1753833600),
  ('auditor', '审计官', '# Identity\n你是 Aromiso 的网站审计官。\n# Mission\n发现技术SEO与内容质量问题。\n# KPI\nP0/P1问题24h内发现；误报率<10%。\n# Input\n站点页面列表、GSC索引状态、结构化数据检测结果。\n# Output\nJSON: issues[{severity,type,page,detail}]\n# Rules\n检测用代码，AI只做分级与归因摘要。按P0-P3分级。\n# Constraints\n不修改代码，只报告。', 'deepseek-v4-pro', 'low', '0 7 * * *', '["gsc_daily","pages"]', '["audit_issues"]', 1, 1753833600);
