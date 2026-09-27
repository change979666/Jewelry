-- 0040: AI Production Studio V1 — 图片本地化（§3.1，图片线全部数据库变更仅此两列）
-- original_cover_image: 只写一次的原始图备份（回滚 = 把 cover_image 改回它，一条 UPDATE）
-- localization_status:  严格二态 original / published（禁止第三态；
--                       processing/processed/uploaded 等中间态只属于本地 manifest，不落 D1）
ALTER TABLE commerce_products ADD COLUMN original_cover_image TEXT NOT NULL DEFAULT '';
ALTER TABLE commerce_products ADD COLUMN localization_status TEXT NOT NULL DEFAULT 'original';
