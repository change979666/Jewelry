-- ---------------------------------------------------------------------------
--  V5.84 Email Workspace — 客户会话工作状态表 email_thread_state
--
--  目标：把「邮件列表」升级为「客户会话工作台」。以 inquiries.id 为会话根键，
--  用本表作为可查询的会话索引/工作状态，避免每次列表都对 email_messages
--  做窗口函数聚合，也让「待回复 / 未读 / 跟进到期」成为 O(索引) 查询。
--
--  规则（与开发规范 §5 冻结口径一致）：
--    - needs_reply   最新有效消息为 inbound 且之后无成功 outbound → 1
--    - unread_count  新 inbound +1；Owner 打开会话/标记已读 → 0
--    - 归档不删除任何邮件；AI 只写建议字段，绝不自动外联
--
--  纯 DDL，幂等（IF NOT EXISTS），不改写存量数据。
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_thread_state (
  inquiry_id TEXT PRIMARY KEY,
  unread_count INTEGER NOT NULL DEFAULT 0,
  needs_reply INTEGER NOT NULL DEFAULT 0,
  last_message_id INTEGER,
  last_inbound_message_id INTEGER,
  last_outbound_message_id INTEGER,
  last_activity_at INTEGER,
  last_inbound_at INTEGER,
  last_outbound_at INTEGER,
  detected_language TEXT,
  language_confidence REAL,
  intent TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  summary_zh TEXT,
  product_hint TEXT,
  quantity_hint TEXT,
  follow_up_at INTEGER,
  ai_status TEXT NOT NULL DEFAULT 'pending',
  last_ai_analyzed_message_id INTEGER,
  last_error TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_email_thread_needs_reply
  ON email_thread_state(needs_reply, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_thread_unread
  ON email_thread_state(unread_count, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_thread_followup
  ON email_thread_state(follow_up_at, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_thread_priority
  ON email_thread_state(priority, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_thread_activity
  ON email_thread_state(last_activity_at DESC);
