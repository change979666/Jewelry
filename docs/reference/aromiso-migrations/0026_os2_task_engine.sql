-- 0026: OS 2.0 阶段 0 — Task Engine 地基 + 幂等（V5.19）
--
-- 目标：为 OS 2.0 的「结构化任务 + 四级权限 + 可追溯执行」打地基，并根治
--       cron 重复触发导致的周报/任务重复生成问题。
-- 本迁移做两件事：
--   1) tasks 表新增 8 个 OS 2.0 字段（任务类型 / 执行者 / 执行模式 / 幂等键 /
--      载荷 / 执行前后指标 / 结果判定）——全部可空并带默认值，向后兼容。
--   2) 新建 task_runs 表：记录每次（幂等键维度）执行的生命周期，供 beginRun /
--      finishRun 判重，避免同一逻辑动作重复执行。
--
-- 注意：SQLite 的 ALTER TABLE ADD COLUMN 不支持 IF NOT EXISTS。以下 8 列经线上
--       实测均不存在，故用裸 ALTER；本迁移只应用一次。

-- ─── 1. tasks 表新增 OS 2.0 字段 ────────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT '';
-- 任务类型：meta_fix / internal_link / translate_fill / faq_append / content_refresh ...
ALTER TABLE tasks ADD COLUMN executor TEXT DEFAULT '';
-- 执行者/执行能力路由标识（对应 task-execute 端点内置能力名）
ALTER TABLE tasks ADD COLUMN execution_mode TEXT DEFAULT 'MANUAL';
-- 执行模式：L1 / L2 / L3 / L4 / MANUAL（权限四级闸门，MANUAL 永不自动执行）
ALTER TABLE tasks ADD COLUMN idempotency_key TEXT DEFAULT '';
-- 幂等键：同键任务/执行只生效一次
ALTER TABLE tasks ADD COLUMN payload TEXT DEFAULT '{}';
-- 执行所需结构化参数（JSON）
ALTER TABLE tasks ADD COLUMN before_metrics TEXT DEFAULT '{}';
-- 执行前指标快照（如该页 7 日 GSC 数据，JSON）
ALTER TABLE tasks ADD COLUMN after_metrics TEXT DEFAULT '{}';
-- 执行后指标快照（JSON）
ALTER TABLE tasks ADD COLUMN outcome TEXT DEFAULT '';
-- 结果判定：SUCCESS / FAILED / NO_EFFECT

-- 幂等键唯一索引（空串不参与唯一约束，兼容历史与人工任务）
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_idem
  ON tasks (idempotency_key) WHERE idempotency_key != '';

-- ─── 2. task_runs 执行流水表（幂等地基）─────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,
  -- 关联 tasks.id（cron 类逻辑动作可为空）
  idempotency_key TEXT NOT NULL DEFAULT '',
  -- 幂等键，如 weekly-report:2026-W33 / os-daily:2026-08-10:strategist / cron-pull:2026-08-08
  status TEXT NOT NULL DEFAULT 'running',
  -- running / success / failed / skipped
  detail TEXT DEFAULT '',
  -- 执行摘要或错误信息
  started_at INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_idem
  ON task_runs (idempotency_key) WHERE idempotency_key != '';
CREATE INDEX IF NOT EXISTS idx_runs_task ON task_runs (task_id, started_at DESC);
