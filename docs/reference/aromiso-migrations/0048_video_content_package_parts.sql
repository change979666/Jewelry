-- ---------------------------------------------------------------------------
-- 0048 — V5.47 Content Package Resilience
-- Spec: docs/dev-specs/V5.47_CONTENT_PACKAGE_RESILIENCE_DEVELOPMENT_SPEC.md
--
-- Adds:
--   video_assets ← package_parts_json
--     Per-segment upload failure ledger written by
--     POST /api/admin/video-content-package/{id}/report-part (§3.3):
--     {"video":{"state":"failed","error":"...","at":"..."}, ...}
--
-- Part state is orthogonal to content_package_status (P2 defers the two-way
-- state machine). Applied via scripts/d1-exec.mjs (statement-splitting).
-- ---------------------------------------------------------------------------

ALTER TABLE video_assets ADD COLUMN package_parts_json TEXT NOT NULL DEFAULT '{}';
