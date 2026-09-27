-- ---------------------------------------------------------------------------
--  V5.70 AI Decision Layer — 决策审计结构化 + 幂等去重 + 扫描索引
--
--  背景（owner 2026-09-13 指令）：
--    growth_opportunities 中 status='new' AND exec_level IN ('B','C') 的
--    正常机会必须自动进入 Decision Layer 裁决（PASS/FIX/REJECT/BLOCK），
--    不再挂 NEEDS-YOU 人工队列。
--
--  本迁移纯 DDL（ALTER ADD COLUMN 带常量默认值 + CREATE INDEX），
--  对存量行安全，无数据改写。SQLite / D1 兼容。
--
--  设计要点：
--    1) decisions 表原只有 suggestion/status/reason/task_id/rejection_reason，
--       不足以承载「violated_rule / prevention_rule / detected_problem /
--       suggested_fix / source」结构化审计 → 补列。
--    2) fingerprint = 跨周稳定的业务机会指纹（opp_type|page|query 归一化），
--       UNIQUE 部分索引 → 同一业务机会永不产生第二条决策（幂等地基）。
--    3) growth_opportunities(status, exec_level) 复合索引 → Decision Layer
--       批量扫描走索引，杜绝全表扫描。
-- ---------------------------------------------------------------------------

-- ─── 1. decisions 表补结构化审计列 ─────────────────────────────────────────
ALTER TABLE decisions ADD COLUMN opp_id INTEGER;
ALTER TABLE decisions ADD COLUMN decision TEXT NOT NULL DEFAULT '';
ALTER TABLE decisions ADD COLUMN fingerprint TEXT;
ALTER TABLE decisions ADD COLUMN violated_rule TEXT NOT NULL DEFAULT '';
ALTER TABLE decisions ADD COLUMN prevention_rule TEXT NOT NULL DEFAULT '';
ALTER TABLE decisions ADD COLUMN detected_problem TEXT NOT NULL DEFAULT '';
ALTER TABLE decisions ADD COLUMN suggested_fix TEXT NOT NULL DEFAULT '';
ALTER TABLE decisions ADD COLUMN source TEXT NOT NULL DEFAULT '';
ALTER TABLE decisions ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}';

-- ─── 2. 幂等唯一索引：同一 fingerprint 只允许一条决策 ──────────────────────
-- 部分索引（WHERE fingerprint 非空）→ 不影响历史无指纹的 decisions 行。
CREATE UNIQUE INDEX IF NOT EXISTS idx_decisions_fingerprint
  ON decisions(fingerprint)
  WHERE fingerprint IS NOT NULL AND fingerprint != '';

-- ─── 3. 查询索引 ───────────────────────────────────────────────────────────
-- Decision Layer 批量扫描：WHERE status='new' AND exec_level IN ('B','C')
CREATE INDEX IF NOT EXISTS idx_growth_opp_status_exec
  ON growth_opportunities(status, exec_level);

-- 按 opportunity 反查决策历史（学习闭环 / prevention rule 消费）
CREATE INDEX IF NOT EXISTS idx_decisions_opp
  ON decisions(opp_id);
