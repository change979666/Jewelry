-- ---------------------------------------------------------------------------
--  V5.72 knowledge_v2 BLOCK 收口 — 一次性数据 reconciliation
--
--  背景（owner 2026-09-13 §一）：V5.71 统一 Decision Layer 把 308 条低置信
--  （confidence<70）L0 原始知识碎片判为 BLOCK，但旧政策让 BLOCK 项停留
--  status='review'，导致 Admin inbox / workforce NEEDS-YOU 把它们当成 308 条
--  「待人工审核」虚假 backlog。
--
--  新政策（decideKnowledge）已改为 BLOCK→deprecated（复用 knowledge_v2 现有合法
--  生命周期终态，见 knowledge-service.ts:352）。但【已决策】的 308 条被
--  decided-exclusion（scan NOT IN 已决策 entity_id）排除，不会被新政策重扫。
--  故本迁移做一次性 reconciliation：把已被判 BLOCK 但仍停留 review 的知识项
--  对齐到终态 deprecated。
--
--  安全：
--    - 幂等：仅影响 status='review' 且有 BLOCK 决策行的项；重复执行第二次 0 行。
--    - 绝不改成 active（§一约束1）；绝不伪造 PASS（约束2）。
--    - 不动 decisions 审计（reason/risk_level/evidence/prevention_rule 全部保留，约束3/4）。
--    - deprecated 被 ai.ts（只读 active）与所有 NEEDS-YOU/inbox 聚合（只数 review）
--      排除 → 退出 review scan、Tick 不再处理、不产生人工负载（约束5/6/7）。
-- ---------------------------------------------------------------------------

UPDATE knowledge_v2
   SET status = 'deprecated',
       verified_by = 'ai-decision-layer',
       updated_at = CURRENT_TIMESTAMP
 WHERE status = 'review'
   AND id IN (
     SELECT entity_id FROM decisions
      WHERE entity_type = 'knowledge_v2' AND decision = 'BLOCK'
   );
