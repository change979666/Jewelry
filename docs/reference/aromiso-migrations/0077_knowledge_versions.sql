-- ============================================================================
-- 0077 — knowledge_versions：知识 SSOT 版本历史（V5.54）
--
-- 背景：knowledge_v2 的更新此前直接覆盖 content，无历史可追溯。
-- owner 拍板（V5.54 §三）：每条知识必须可追溯；版本化是审核与回滚的基础。
--
-- 写入时机（均在 functions/lib/knowledge-service.ts 内）：
--   - 候选去重更新（同实体同标题再次提取 → 覆盖前存旧版）
--   - approve（review→active，置信度 100 前存旧版）
--   - invalidate（→deprecated 前存旧版）
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_versions (
  id TEXT PRIMARY KEY,
  knowledge_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT '',          -- 该版本被替换时的知识状态
  content TEXT NOT NULL DEFAULT '',
  confidence INTEGER NOT NULL DEFAULT 0,
  changed_by TEXT NOT NULL DEFAULT 'system', -- 触发者（人/系统）
  change_reason TEXT NOT NULL DEFAULT '',    -- dedupe-update/approve/invalidate/manual-edit
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_versions_kid
  ON knowledge_versions (knowledge_id, version DESC);
