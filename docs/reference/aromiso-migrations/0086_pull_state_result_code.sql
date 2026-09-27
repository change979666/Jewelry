-- 0086: pull_state machine-readable result codes.
-- Previously "rows = 0" alone had to carry error semantics, conflating
-- "API returned a valid empty response" with "API request failed" /
-- "D1 write failed" / "permission denied". Add explicit columns so every
-- ingestion outcome is machine-readable while legacy status/rows/attempts
-- remain untouched for compatibility.
ALTER TABLE pull_state ADD COLUMN error_code TEXT;
ALTER TABLE pull_state ADD COLUMN error_message TEXT;
