-- ---------------------------------------------------------------------------
--  Aromiso V5.37 — Agent Health Score（AI 行为健康分）
--
--  ai_daily_report 增加两列：
--    health_score  当日综合健康分（0-100；NULL = 当日数据不足以评分）
--    health_json   子分明细 JSON（完成率/事实安全/误报代理/动作成功率/
--                  无异常率/成本效率 + 权重 + 输入量）
--  计算逻辑见 functions/lib/mission-log.ts generateDailyReport。
-- ---------------------------------------------------------------------------

ALTER TABLE ai_daily_report ADD COLUMN health_score REAL;

ALTER TABLE ai_daily_report ADD COLUMN health_json TEXT DEFAULT '{}';
