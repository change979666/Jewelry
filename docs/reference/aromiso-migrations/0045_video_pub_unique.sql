-- 0045_video_pub_unique.sql — V5.44 Public Video Center：发布账本幂等硬约束。
-- (video_id, channel) 唯一：重复发布只允许 upsert，绝不产生重复 publication 行。
-- 建索引前须确认无重复行（生产现况 2 行、video_id 各异，已核查）。
CREATE UNIQUE INDEX IF NOT EXISTS idx_vpub_video_channel ON video_publications(video_id, channel);
