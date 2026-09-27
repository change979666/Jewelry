-- ===========================================================================
--  V5.85 Sales Inbox 会话化 — email_messages 结构扩展（纯加列，幂等）
--
--  原则：
--    - 只 ADD 列与索引，绝不修改/删除既有列与历史数据（事实源不动）。
--    - body_clean 回填 = 现有 body_text（展示等价），旧邮件 quoted_body 留空，
--      UI 对空 quoted_body 不渲染折叠区，行为与现状一致。
--    - kind='system_auto_ack' 从本轮起由 inquiry.ts 自动确认流程写入；
--      历史数据 kind 全为 ''（正常邮件），无需回填。
-- ===========================================================================

-- 注意：references 是 SQLite 保留字，列名必须加引号，所有 SQL 统一写 "references"
ALTER TABLE email_messages ADD COLUMN "references" TEXT NOT NULL DEFAULT '';
ALTER TABLE email_messages ADD COLUMN body_raw TEXT NOT NULL DEFAULT '';
ALTER TABLE email_messages ADD COLUMN body_clean TEXT NOT NULL DEFAULT '';
ALTER TABLE email_messages ADD COLUMN quoted_body TEXT NOT NULL DEFAULT '';
ALTER TABLE email_messages ADD COLUMN kind TEXT NOT NULL DEFAULT '';

-- 线程头反查索引（worker 入站关联：Message-ID / In-Reply-To / References）
CREATE INDEX IF NOT EXISTS idx_email_message_id ON email_messages(message_id);

-- 展示等价回填：body_clean 为空的历史邮件用现有正文（不改写事实数据）
UPDATE email_messages SET body_clean = body_text WHERE body_clean = '' AND body_text != '';
