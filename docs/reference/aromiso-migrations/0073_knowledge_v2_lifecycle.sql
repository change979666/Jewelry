-- 0073 — knowledge_v2 生命周期列（Knowledge Center 正式化最小变更）
-- 2026-09-03：owner 批准（「继续做完」授权），已通过 REST D1 手工应用并同步
-- d1_migrations 记录（幂等：列已存在则跳过）。
-- 用途：知识状态机（draft/active/review/deprecated/archived）+ 过期机制
-- （商业时效类事实 expires_at）+ 人工确认追溯（verified_by/verified_at）。
ALTER TABLE knowledge_v2 ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE knowledge_v2 ADD COLUMN expires_at DATETIME;
ALTER TABLE knowledge_v2 ADD COLUMN verified_by TEXT;
ALTER TABLE knowledge_v2 ADD COLUMN verified_at DATETIME;
CREATE INDEX IF NOT EXISTS idx_kb_v2_status ON knowledge_v2(status);
