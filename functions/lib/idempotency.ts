// ---------------------------------------------------------------------------
//  Aromiso OS 2.0 — 幂等执行地基（V5.19）
//
//  为 cron / 定时逻辑动作提供「同一幂等键只成功执行一次」的保证，根治
//  周报重复生成、任务重复入库等问题。
//
//  用法：
//    const run = await beginRun(db, "weekly-report:2026-W33");
//    if (run.skip) return; // 已成功执行过，直接跳过
//    try {
//      ... 真正的副作用逻辑 ...
//      await finishRun(db, run.key, "success", "生成周报 2026-W33");
//    } catch (e) {
//      await finishRun(db, run.key, "failed", String(e));
//      throw e;
//    }
//
//  语义（V5.415 P2-1 原子化）：
//    - 无记录        → INSERT OR IGNORE 成功（changes=1），我创建该行 → skip:false
//    - 已 success    → skip:true（幂等短路）
//    - running 且新鲜（<30 分钟）→ 视为他人持锁 → skip:true（互斥核心：
//                      两个 cron 并发只有一个获得执行权）
//    - running 且僵尸（≥30 分钟）→ 以 started_at 为 CAS 令牌抢占，并发抢占
//                      只有一个 UPDATE 命中（changes=1），输家 skip:true
//    - failed/skipped → CAS 复位为 running（WHERE status=旧态），并发重试
//                      只有一个命中，输家 skip:true
//
//  依赖 migrations/0026：task_runs 表 + idempotency_key 唯一索引
//  （idx_runs_idem，key != '' 全量唯一，非仅 success）。
// ---------------------------------------------------------------------------

export interface RunHandle {
  key: string;
  skip: boolean;
  /**
   * V5.67（S21）：true 表示幂等地基本身不可用（DB 异常/表缺失），本次决策是
   * 「无法确认」下的降级结果，而非确定的「该执行/该跳过」。调用方应记录可见。
   */
  degraded?: boolean;
}

/**
 * 开始一次幂等执行。若该 key 之前已成功执行，返回 skip=true。
 * V5.415（P2-1）：改为原子声明——INSERT OR IGNORE 由唯一索引仲裁，
 * 已存在行用 CAS（WHERE 旧状态）复位，僵尸行用 started_at 令牌抢占；
 * 并发调用同一 key 时恰好一个调用方拿到 skip=false。
 *
 * V5.67（S21）：地基异常（task_runs 缺失 / D1 抛错）时 **fail-closed**——
 * 无法确认幂等就跳过执行（skip=true）并标 degraded，杜绝「并发都拿执行权 →
 * cron 重复生成 / 重复花费」。自动任务属花钱/副作用路径，宁可漏跑一次（下个
 * cron 周期会重试），也不能重复执行。异常大声记日志，绝不静默。
 * 如某调用方明确希望地基未就绪时仍放行，可传 { failClosedOnError: false }。
 */
export async function beginRun(
  db: D1Database,
  key: string,
  taskId?: number,
  opts?: { failClosedOnError?: boolean },
): Promise<RunHandle> {
  const now = Math.floor(Date.now() / 1000);
  // 空键不参与唯一索引（兼容历史/人工任务），不做协调直接执行
  if (!key) return { key, skip: false };
  try {
    // ① 原子声明第一步：INSERT OR IGNORE。唯一索引保证并发插入只有一个命中。
    const ins = await db
      .prepare(
        `INSERT OR IGNORE INTO task_runs (task_id, idempotency_key, status, started_at) VALUES (?, ?, 'running', ?)`,
      )
      .bind(taskId ?? null, key, now)
      .run();
    if ((ins.meta.changes || 0) > 0) return { key, skip: false }; // 行由我创建 → 我持有执行权

    // ② 行已存在：读取当前状态再决定
    const existing = await db
      .prepare(`SELECT id, status, started_at FROM task_runs WHERE idempotency_key = ?`)
      .bind(key)
      .first<{ id: number; status: string; started_at: number | null }>();
    if (!existing) {
      // 极罕见：INSERT 被忽略后又读不到行（并发删除）→ 按无人认领处理
      return { key, skip: false };
    }
    if (existing.status === "success") return { key, skip: true }; // 幂等短路

    if (existing.status === "running") {
      const startedAt = Number(existing.started_at || 0);
      // 新鲜 running（<30 分钟）：视为他人持锁 → 互斥排除自己
      if (now - startedAt < 1800) return { key, skip: true };
      // 僵尸 running（≥30 分钟）：CAS 抢占。WHERE 带旧 started_at，
      // 抢占会改写 started_at → 并发抢占最多一个命中。
      const steal = await db
        .prepare(
          `UPDATE task_runs SET status = 'running', started_at = ?, finished_at = NULL, detail = ''
           WHERE id = ? AND status = 'running' AND started_at = ?`,
        )
        .bind(now, existing.id, startedAt)
        .run();
      return { key, skip: (steal.meta.changes || 0) === 0 };
    }

    // ③ failed / skipped → CAS 复位重试：WHERE 带旧状态，并发重试最多一个命中
    const claim = await db
      .prepare(
        `UPDATE task_runs SET status = 'running', started_at = ?, finished_at = NULL, detail = ''
         WHERE id = ? AND status = ?`,
      )
      .bind(now, existing.id, existing.status)
      .run();
    return { key, skip: (claim.meta.changes || 0) === 0 };
  } catch (e) {
    const failClosed = opts?.failClosedOnError ?? true;
    const detail = e instanceof Error ? e.message : String(e);
    console.error(
      `[idempotency] beginRun DB error for key=${key} — ${failClosed ? "fail-CLOSED (skip)" : "fail-open (run)"}:`,
      detail,
    );
    return { key, skip: failClosed, degraded: true };
  }
}

/**
 * 结束一次幂等执行，写回终态。status 建议：success / failed / skipped。
 * V5.67（S39）：返回 { ok, changes }。UPDATE 命中 0 行或抛错时大声记日志——
 * 否则行会停留在 running，30 分钟后被僵尸抢占逻辑重复执行。
 */
export async function finishRun(
  db: D1Database,
  key: string,
  status: "success" | "failed" | "skipped",
  detail = "",
): Promise<{ ok: boolean; changes: number }> {
  const now = Math.floor(Date.now() / 1000);
  try {
    const r = await db
      .prepare(
        `UPDATE task_runs SET status = ?, detail = ?, finished_at = ? WHERE idempotency_key = ?`,
      )
      .bind(status, detail.slice(0, 2000), now, key)
      .run();
    const changes = Number(r.meta?.changes ?? 0);
    if (changes === 0) {
      console.error(
        `[idempotency] finishRun updated 0 rows for key=${key} (status=${status}) — run state NOT finalized; row may stay running and be re-executed after 30min`,
      );
    }
    return { ok: true, changes };
  } catch (e) {
    console.error(
      `[idempotency] finishRun failed for key=${key} (status=${status}):`,
      e instanceof Error ? e.message : String(e),
    );
    return { ok: false, changes: 0 };
  }
}
