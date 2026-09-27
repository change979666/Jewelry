-- V5.68 P0/email-tool: record WHY an outbound business email failed.
-- Additive, nullable, backward-compatible. email-send.ts now persists a
-- status='failed' row (instead of only returning 502) so the inquiry/customer
-- timeline shows the real outcome and the failure reason — never a fake success.
ALTER TABLE email_messages ADD COLUMN failure_reason TEXT;
