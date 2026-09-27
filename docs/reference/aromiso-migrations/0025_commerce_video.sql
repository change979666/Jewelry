-- 0025: V5.18 商品视频位
-- commerce_products 增加 video_url：后台可填 URL / 上传 R2，可留空。
-- 前台 PDP 有视频时优先展示视频；商城列表封面仍用 cover_image 不变。

ALTER TABLE commerce_products ADD COLUMN video_url TEXT NOT NULL DEFAULT '';
