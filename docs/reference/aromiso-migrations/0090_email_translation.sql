-- ---------------------------------------------------------------------------
--  V5.72 Email Center 多语翻译工作流 — email_messages 翻译字段
--
--  目标：客户来信（英文/西班牙语/德语等）在后台自动提供中文翻译；管理员用
--  中文回复，发送前翻译成客户语言。原文永远不被翻译结果覆盖。
--
--  纯 DDL（ALTER ADD COLUMN，可空），对存量行安全，无数据改写。
--  字段语义：
--    original_subject    客户来信原始主题（inbound 时留存，防覆盖）
--    original_body       客户来信原始正文（inbound 时留存，防覆盖）
--    detected_language   检测到的客户邮件语言（en/es/de/zh/...）
--    translated_subject_zh  翻译后的中文主题
--    translated_body_zh     翻译后的中文正文
--    translation_status   pending | done | failed | skipped（skipped=原文已是中文）
--    translated_at        翻译完成时间（unix 秒）
-- ---------------------------------------------------------------------------

ALTER TABLE email_messages ADD COLUMN original_subject TEXT;
ALTER TABLE email_messages ADD COLUMN original_body TEXT;
ALTER TABLE email_messages ADD COLUMN detected_language TEXT;
ALTER TABLE email_messages ADD COLUMN translated_subject_zh TEXT;
ALTER TABLE email_messages ADD COLUMN translated_body_zh TEXT;
ALTER TABLE email_messages ADD COLUMN translation_status TEXT;
ALTER TABLE email_messages ADD COLUMN translated_at INTEGER;
