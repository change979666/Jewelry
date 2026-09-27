-- ============================================================================
-- 0082 — knowledge_v2 候选幂等加固（V5.56 资源保护 + 防重复候选）
--
-- 根因（审计）：knowledge_v2 无 UNIQUE 约束，createCandidateKnowledge 仅应用层
-- SELECT-then-INSERT（竞态：并发双双 miss → 双 INSERT）。
--
-- 实测：按 (实体,分类,标题,来源) 去重键统计，现有 review/draft 候选中精确重复为 0
-- （352→969 是合法的首轮 enrich：每商品多条不同事实候选，非重复）。故无需归档，
-- 直接建部分 UNIQUE 索引防止未来重复候选。
--
-- 部分 UNIQUE 索引：仅约束 review/draft 候选；已批准(active)/弃用/归档行不受约束，
-- 绝不影响/覆盖已批准知识。COALESCE 表达式索引，NULL 实体按空串归一。
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_kb_v2_candidate_dedupe
  ON knowledge_v2 (
    COALESCE(linked_entity_type, ''),
    COALESCE(linked_entity_id, ''),
    category, title, source
  )
  WHERE status IN ('review', 'draft');
