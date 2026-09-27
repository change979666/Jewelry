// Phase 7 — AI Task Manager
// CRUD operations for the ai_tasks table.
// Wraps D1 operations with proper typing and audit trails.

import type { D1Database } from "@cloudflare/workers-types";

export interface AITaskRow {
  id: number;
  title: string;
  description: string | null;
  task_type: string;
  target_type: string | null;
  target_id: string | null;
  status: string;
  execution_mode: string;
  priority: string;
  ai_role: string | null;
  model_used: string | null;
  prompt_version: string | null;
  input_snapshot: string | null;
  output_snapshot: string | null;
  before_snapshot: string | null;
  after_snapshot: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  rollback_available: number;
  rollback_version_id: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_cny: number;
  duration_ms: number;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  idempotency_key: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  mission_id: string | null;
}

export interface CreateAITaskInput {
  title: string;
  description?: string;
  task_type: string;
  target_type?: string;
  target_id?: string;
  execution_mode?: string;
  priority?: string;
  ai_role?: string;
  idempotency_key?: string;
  input_snapshot?: string;
  before_snapshot?: string;
  created_by?: string;
}

export interface ListAITaskFilters {
  status?: string;
  task_type?: string;
  target_type?: string;
  execution_mode?: string;
  limit?: number;
  offset?: number;
}

/** Create a new AI task. Returns the inserted row id. */
export async function createAITask(db: D1Database, input: CreateAITaskInput): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO ai_tasks (title, description, task_type, target_type, target_id, execution_mode, priority, ai_role, idempotency_key, input_snapshot, before_snapshot, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.title,
      input.description ?? null,
      input.task_type,
      input.target_type ?? null,
      input.target_id ?? null,
      input.execution_mode ?? "L1",
      input.priority ?? "normal",
      input.ai_role ?? null,
      input.idempotency_key ?? null,
      input.input_snapshot ?? null,
      input.before_snapshot ?? null,
      input.created_by ?? "system",
    )
    .run();
  return result.meta.last_row_id as number;
}

/** Get a single AI task by id. */
export async function getAITask(db: D1Database, id: number): Promise<AITaskRow | null> {
  return db.prepare("SELECT * FROM ai_tasks WHERE id = ?").bind(id).first<AITaskRow>();
}

/** List AI tasks with optional filters. */
export async function listAITasks(
  db: D1Database,
  filters: ListAITaskFilters,
): Promise<{ tasks: AITaskRow[]; total: number }> {
  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (filters.status) {
    conditions.push("status = ?");
    binds.push(filters.status);
  }
  if (filters.task_type) {
    conditions.push("task_type = ?");
    binds.push(filters.task_type);
  }
  if (filters.target_type) {
    conditions.push("target_type = ?");
    binds.push(filters.target_type);
  }
  if (filters.execution_mode) {
    conditions.push("execution_mode = ?");
    binds.push(filters.execution_mode);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  // S-07: clamp both bounds — a negative/NaN limit must never become `LIMIT -1`
  // (SQLite treats negative LIMIT as "no limit" → full-table read amplification).
  const rawLimit = filters.limit ?? 50;
  const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, rawLimit)) : 50;
  const rawOffset = filters.offset ?? 0;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

  const countRow = await db
    .prepare(`SELECT COUNT(*) as total FROM ai_tasks ${where}`)
    .bind(...binds)
    .first<{ total: number }>();
  const total = countRow?.total ?? 0;

  const tasks = await db
    .prepare(`SELECT * FROM ai_tasks ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(...binds, limit, offset)
    .all<AITaskRow>();

  return { tasks: tasks.results, total };
}

/** Update task status. */
export async function updateTaskStatus(
  db: D1Database,
  id: number,
  status: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const sets = ["status = ?", "updated_at = datetime('now')"];
  const binds: unknown[] = [status];

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      sets.push(`${key} = ?`);
      binds.push(value);
    }
  }

  binds.push(id);
  await db
    .prepare(`UPDATE ai_tasks SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...binds)
    .run();
}

/** Approve a task (L2 workflow). */
export async function approveAITask(db: D1Database, id: number, approvedBy: string): Promise<void> {
  await db
    .prepare(
      `UPDATE ai_tasks SET status = 'pending', approved_by = ?, approved_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'awaiting_approval'`,
    )
    .bind(approvedBy, id)
    .run();
}

/** Reject a task (L2 workflow). */
export async function rejectAITask(
  db: D1Database,
  id: number,
  rejectedBy: string,
  reason: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE ai_tasks SET status = 'cancelled', rejected_by = ?, rejected_at = datetime('now'), rejection_reason = ?, updated_at = datetime('now') WHERE id = ? AND status = 'awaiting_approval'`,
    )
    .bind(rejectedBy, reason, id)
    .run();
}

/** Increment retry count. */
export async function incrementRetry(db: D1Database, id: number): Promise<void> {
  await db
    .prepare(
      `UPDATE ai_tasks SET retry_count = retry_count +1, updated_at = datetime('now') WHERE id = ?`,
    )
    .bind(id)
    .run();
}

/**
 * Atomic claim（闭环加固 2026-09-02）：唯一执行权的原子抢占。
 * 条件 UPDATE 依赖 SQLite 写锁串行化：并发两个 worker 同时抢同一任务，
 * 只有一个 UPDATE 能命中 status='pending'（changes=1），另一个 changes=0 直接退出。
 * 返回 true 表示本次调用获得执行权。
 */
export async function claimAITask(db: D1Database, id: number): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE ai_tasks SET status = 'running', updated_at = datetime('now')
       WHERE id = ? AND status = 'pending'`,
    )
    .bind(id)
    .run();
  return Number(res.meta.changes) === 1;
}

/**
 * 活性检测（liveness）：heartbeat 即 updated_at。
 * 任务处于 running 但 heartbeat 超过 staleMinutes 未更新 → 判定执行者已崩溃/卡死。
 * 恢复策略：重试次数未超限 → 回到 pending 由下轮重新认领（任务级原子动作，
 * 重跑即从 checkpoint 继续，不会半截叠加）；超限 → failed 进异常队列。
 * 返回 { recovered, exhausted, scanned }。
 */
export async function recoverStaleTasks(
  db: D1Database,
  staleMinutes = 15,
): Promise<{ scanned: number; recovered: number; exhausted: number }> {
  const out = { scanned: 0, recovered: 0, exhausted: 0 };
  const rows = await db
    .prepare(
      `SELECT id, retry_count, max_retries FROM ai_tasks
       WHERE status = 'running' AND updated_at < datetime('now', ?)`,
    )
    .bind(`-${Math.max(1, Math.floor(staleMinutes))} minutes`)
    .all<{ id: number; retry_count: number; max_retries: number }>();

  for (const r of rows.results) {
    out.scanned++;
    const exhausted = Number(r.retry_count) + 1 > Number(r.max_retries || 3);
    if (exhausted) {
      await db
        .prepare(
          `UPDATE ai_tasks SET status = 'failed',
             error_message = '活性检测：执行超时且重试超限，移入异常队列',
             updated_at = datetime('now')
           WHERE id = ? AND status = 'running'`,
        )
        .bind(r.id)
        .run();
      out.exhausted++;
    } else {
      await db
        .prepare(
          `UPDATE ai_tasks SET status = 'pending', retry_count = retry_count + 1,
             error_message = '活性检测：执行超时（疑似崩溃），已恢复待重新认领',
             updated_at = datetime('now')
           WHERE id = ? AND status = 'running'`,
        )
        .bind(r.id)
        .run();
      out.recovered++;
    }
  }
  return out;
}
