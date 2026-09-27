-- 0019: AI Growth Center 反馈学习闭环（V4.8）
--
-- 目标：把现有 AI 角色从「重复分析」升级成「感知→记忆→决策→执行→验证→再学习」闭环。
-- 本迁移做四件事：
--   1) 新建 ai_feedback 表：记录你对每条 AI 输出的反馈（有用/没用/已执行/拒绝/编辑差异）
--   2) tasks 增加 优先级 + 预期结果 + 实际结果 字段（Outcome 验证）
--   3) decisions 增加 拒绝原因 字段（让 Strategist 学习你的经营偏好）
--   4) ai_roles 增加 prompt 版本号（每次编辑 +1，便于追踪哪个版本更好）
--
-- 全部使用 IF NOT EXISTS / 幂等写法，重复执行安全。

-- ─── 1. AI 反馈表 ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL DEFAULT '',
  -- 产生该输出的角色：strategist / analyst / product_copywriter / translator ...
  target_type TEXT NOT NULL DEFAULT 'task',
  -- 反馈对象类型：task（任务建议）/ knowledge（知识条目）/ copy（商品文案）/ opportunity（机会）
  target_id INTEGER,
  -- 关联对象 id（可为空，例如文案反馈无持久对象）
  rating TEXT NOT NULL DEFAULT 'neutral',
  -- up（有用）/ down（没用）/ executed（已执行）/ rejected（不执行）/ edited（人工修改）/ star（非常有价值）
  comment TEXT DEFAULT '',
  -- 拒绝原因 / 备注
  ai_output TEXT DEFAULT '',
  -- AI 原始输出（用于对比学习）
  human_edit TEXT DEFAULT '',
  -- 人工修改后的版本（rating=edited 时）
  consumed INTEGER DEFAULT 0,
  -- 是否已被 Librarian 提炼进知识库（0=未消费 1=已消费）
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_consumed ON ai_feedback (consumed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_role ON ai_feedback (role, created_at DESC);

-- ─── 2. tasks 增加 Outcome 字段 ─────────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'P2';
-- P0 必须今天做 / P1 本周 / P2 可排期 / P3 观察
ALTER TABLE tasks ADD COLUMN expected_result TEXT DEFAULT '';
-- AI 预期效果（执行前）
ALTER TABLE tasks ADD COLUMN actual_result TEXT DEFAULT '';
-- 实际效果（执行后由 Executor 回填）
ALTER TABLE tasks ADD COLUMN verified INTEGER DEFAULT 0;
-- 是否已做结果验证（0=未验证 1=已验证）

-- ─── 3. decisions 增加拒绝原因 ──────────────────────────────────────────────
ALTER TABLE decisions ADD COLUMN rejection_reason TEXT DEFAULT '';
-- 为什么拒绝（区别于 reason：reason 偏采纳理由，rejection_reason 偏拒绝动机）

-- ─── 4. ai_roles 增加 prompt 版本号 ─────────────────────────────────────────
ALTER TABLE ai_roles ADD COLUMN prompt_version INTEGER DEFAULT 1;
