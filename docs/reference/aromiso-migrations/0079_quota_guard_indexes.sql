-- ============================================================================
-- 0079 — 配额防护索引（V5.54）
--
-- 背景：2026-09-03 因大量全表扫描耗尽 D1 免费层每日行读额度。
-- 自动化触发器每 20 分钟按 created_at 扫 commerce_products / inquiries，
-- worker 每轮按 status 扫 ai_tasks / tasks —— 无索引时每次都全表扫描
-- （2431 行 × 72 轮/日 ≈ 17.5 万行读/日，仅触发器一项）。
-- 索引把范围扫描降到只读匹配区间，结构性降低每日行读消耗。
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cp_status_created
  ON commerce_products (status, created_at);

CREATE INDEX IF NOT EXISTS idx_cp_created_at
  ON commerce_products (created_at);

CREATE INDEX IF NOT EXISTS idx_cp_source_key
  ON commerce_products (source_product_key);

CREATE INDEX IF NOT EXISTS idx_inquiries_created_at
  ON inquiries (created_at);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_status_created
  ON ai_tasks (status, created_at);

CREATE INDEX IF NOT EXISTS idx_tasks_status
  ON tasks (status);

CREATE INDEX IF NOT EXISTS idx_knowledge_v2_status
  ON knowledge_v2 (status);
