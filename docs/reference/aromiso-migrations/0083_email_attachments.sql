-- Store attachment metadata separately from message bodies. Binary files live in R2;
-- old email_messages rows remain valid through the JSON default.
ALTER TABLE email_messages ADD COLUMN attachments_json TEXT NOT NULL DEFAULT '[]';
