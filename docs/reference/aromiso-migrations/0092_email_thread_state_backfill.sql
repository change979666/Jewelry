-- ---------------------------------------------------------------------------
--  V5.84 — email_thread_state 历史回填（幂等，可重复执行）
--
--  规则（开发规范 §6）：
--    - 不删除/不改写任何历史邮件；只 seed 会话工作状态。
--    - unread_count 初始为 0（历史未读无法可靠推断，不伪造）。
--    - needs_reply 由「最新一封消息方向」判定：最新为 inbound 或 failed
--      outbound → 1；最新为成功 outbound → 0。
--    - detected_language 复用该询盘最近一次已检测的 inbound 语言；没有则留空。
--    - summary_zh / intent 等不批量消耗 AI 预算，留待懒生成（ai_status=pending）。
--    - ON CONFLICT DO NOTHING：重复执行无副作用；实时状态由 worker/send 钩子维护。
--
--  无邮件的询盘不 seed（列表查询时 LEFT JOIN 实时合成，不造假状态）。
-- ---------------------------------------------------------------------------

INSERT INTO email_thread_state (
  inquiry_id, unread_count, needs_reply,
  last_message_id, last_inbound_message_id, last_outbound_message_id,
  last_activity_at, last_inbound_at, last_outbound_at,
  detected_language, last_error, ai_status, updated_at
)
SELECT
  t.inquiry_id,
  0,
  CASE WHEN lm.direction = 'inbound' OR lm.status = 'failed' THEN 1 ELSE 0 END,
  lm.id,
  li.id,
  lo.id,
  lm.created_at,
  li.created_at,
  lo.created_at,
  ld.detected_language,
  CASE
    WHEN lm.direction = 'outbound' AND lm.status = 'failed'
      THEN COALESCE(lm.failure_reason, '发送失败')
    ELSE NULL
  END,
  'pending',
  unixepoch()
FROM (
  SELECT inquiry_id
  FROM email_messages
  WHERE inquiry_id IS NOT NULL AND inquiry_id != ''
    AND inquiry_id NOT LIKE 'unmatched-%'
  GROUP BY inquiry_id
) t
JOIN email_messages lm
  ON lm.id = (
    SELECT em.id FROM email_messages em
    WHERE em.inquiry_id = t.inquiry_id
    ORDER BY em.created_at DESC, em.id DESC LIMIT 1
  )
LEFT JOIN email_messages li
  ON li.id = (
    SELECT em.id FROM email_messages em
    WHERE em.inquiry_id = t.inquiry_id AND em.direction = 'inbound'
    ORDER BY em.created_at DESC, em.id DESC LIMIT 1
  )
LEFT JOIN email_messages lo
  ON lo.id = (
    SELECT em.id FROM email_messages em
    WHERE em.inquiry_id = t.inquiry_id AND em.direction = 'outbound' AND em.status = 'sent'
    ORDER BY em.created_at DESC, em.id DESC LIMIT 1
  )
LEFT JOIN email_messages ld
  ON ld.id = (
    SELECT em.id FROM email_messages em
    WHERE em.inquiry_id = t.inquiry_id AND em.direction = 'inbound'
      AND em.detected_language IS NOT NULL AND em.detected_language != ''
    ORDER BY em.created_at DESC, em.id DESC LIMIT 1
  )
ON CONFLICT(inquiry_id) DO NOTHING;
