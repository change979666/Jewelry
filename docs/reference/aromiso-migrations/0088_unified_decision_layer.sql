-- ---------------------------------------------------------------------------
--  V5.71 全局统一 AI Decision Layer — 统一决策审计 schema + 各队列扫描索引
--
--  owner 2026-09-13 指令：把 Growth 专用决策层升级为【全局统一 Decision Layer】，
--  覆盖所有正常人工审核/批准/拒绝/裁决/Triage/冲突处理入口。
--
--  设计原则（§六 统一 Decision Result Schema / §九 Single Source of Truth）：
--    复用既有 decisions 表作为【唯一】决策审计表（不新建平行表），补齐统一字段：
--    entity_type / entity_id / risk_level / evidence / policy_version。
--    上一轮（0087）已加 opp_id/decision/fingerprint/violated_rule/prevention_rule/
--    detected_problem/suggested_fix/source/payload_json，本轮补齐剩余统一字段。
--
--  纯 DDL（ALTER ADD COLUMN 带默认值 + CREATE INDEX IF NOT EXISTS），存量行安全。
-- ---------------------------------------------------------------------------

-- ─── 1. decisions 补齐统一审计字段（§六）─────────────────────────────────────
ALTER TABLE decisions ADD COLUMN entity_type TEXT NOT NULL DEFAULT '';
ALTER TABLE decisions ADD COLUMN entity_id TEXT NOT NULL DEFAULT '';
ALTER TABLE decisions ADD COLUMN risk_level TEXT NOT NULL DEFAULT '';
ALTER TABLE decisions ADD COLUMN evidence TEXT NOT NULL DEFAULT '{}';
ALTER TABLE decisions ADD COLUMN policy_version TEXT NOT NULL DEFAULT '';

-- ─── 2. 统一审计查询索引 ─────────────────────────────────────────────────────
-- 按实体反查决策（loop 防护：扫描排除已裁决实体；学习闭环消费）
CREATE INDEX IF NOT EXISTS idx_decisions_entity
  ON decisions(entity_type, entity_id);

-- ─── 3. 各人工审核队列的扫描索引（杜绝全表扫描）──────────────────────────────
-- task 家族：NEEDS-YOU = status='pending' AND execution_mode IN('L2','L4')
CREATE INDEX IF NOT EXISTS idx_tasks_status_mode
  ON tasks(status, execution_mode);

-- knowledge_v2(status) 已有 idx_kb_v2_status（0073）；video_assets(editorial_status)
-- 已有 idx_video_assets_editorial_status（0046）；growth_opportunities(status,exec_level)
-- 已有 idx_growth_opp_status_exec（0087）。此处仅补 task 家族缺失的复合索引。
