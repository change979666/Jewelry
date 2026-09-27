-- V4.1: Add session_id to inquiries for attribution tracking
-- Links inquiry submissions to the visitor's behavior journey.

ALTER TABLE inquiries ADD COLUMN session_id TEXT DEFAULT '';
