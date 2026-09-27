-- ============================================================================
-- 0080 — V5.55 工作台化：审阅明细 + 知识证据
--
-- ① studio_review_items：Studio 批次逐项审阅明细（云端 Review Inbox / 图片
--    Before-After 页数据源）。产物图（original 已有公开 URL；final/OCR/译文
--    由 Studio 上传 R2 review/ 前缀）+ QA 结论与原因。
-- ② knowledge_v2.evidence_json：候选知识的证据（来源图、OCR 片段、提取上下文）。
--    旧行默认空串；新候选由 enrich 回写时填充。
-- ============================================================================

CREATE TABLE IF NOT EXISTS studio_review_items (
  id TEXT PRIMARY KEY,                 -- {batch_id}:{item_key}
  batch_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  product_id TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  verdict TEXT NOT NULL DEFAULT '',    -- PASS | REVIEW | WARN | FAIL | SKIP
  routing TEXT NOT NULL DEFAULT '',    -- TRANSLATE | KEEP | ...
  qa_reason TEXT NOT NULL DEFAULT '',
  original_url TEXT NOT NULL DEFAULT '',
  final_url TEXT NOT NULL DEFAULT '',  -- R2 review 产物
  ocr_url TEXT NOT NULL DEFAULT '',    -- R2 JSON
  trans_url TEXT NOT NULL DEFAULT '',  -- R2 JSON
  publish_state TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sri_verdict ON studio_review_items (verdict);
CREATE INDEX IF NOT EXISTS idx_sri_product ON studio_review_items (product_id);
CREATE INDEX IF NOT EXISTS idx_sri_batch ON studio_review_items (batch_id);

ALTER TABLE knowledge_v2 ADD COLUMN evidence_json TEXT NOT NULL DEFAULT '';
