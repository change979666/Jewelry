-- 0027: commerce_products 增加 short_name（干净显示名，A1）
-- 背景：供应商 1688 机翻标题存在关键词堆砌（Home/Bedroom/Living Room/Bathroom 全塞）
--       + 尾部短语重复，PDP 的 H1 在移动端窄屏被放大成 6–7 行文字墙，观感不专业。
-- 方案：显示层与 SEO 层分离——
--       short_name（≤60 字符、去堆砌去重）→ PDP H1 / 列表卡显示层；
--       title（原值不动）→ <title> / JSON-LD / meta，保留完整关键词供 SEO。
-- 回填：scripts/backfill-short-names.mjs（纯规则截断去重，不依赖 AI；AI 精修留 A2）。

ALTER TABLE commerce_products ADD COLUMN short_name TEXT DEFAULT '';

-- 验证：
-- SELECT COUNT(*) total, SUM(CASE WHEN short_name<>'' THEN 1 ELSE 0 END) filled FROM commerce_products;
