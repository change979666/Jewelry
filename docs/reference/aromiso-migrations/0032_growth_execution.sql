-- V5.35 Organic Growth Agent Phase 2：机会表增加意图标注与动作得分
-- 设计稿：docs/ORGANIC_GROWTH_AGENT_PHASE2.md（owner 2026-08-15 指令落地）
-- 纯 DDL：SQLite ALTER TABLE ADD COLUMN（带常量默认值，存量行安全）。

-- ① Query Intent Mapping：query 四类意图（commercial / transactional / informational / navigational）
ALTER TABLE growth_opportunities ADD COLUMN intent TEXT NOT NULL DEFAULT '';

-- ② Opportunity Impact Ranking：Growth Score = Impact × Confidence ÷ Effort（给动作排序）
--    score_json 存 { impact, effort, confidence, risk, score } 五元组
ALTER TABLE growth_opportunities ADD COLUMN score_json TEXT NOT NULL DEFAULT '{}';
