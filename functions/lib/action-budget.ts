// ---------------------------------------------------------------------------
//  Aromiso V5.37 — Action Budget（动作预算安全闸）
//
//  目的：即使某天 Agent 判断出错，也不会「一晚上改 500 个页面」。
//  与权限闸门（permissions.ts）、真实性闸门（truthfulness.ts）并列，
//  是自动执行链路上的第三道保险——限制的不是「能不能做」，而是「一天做多少」。
//
//  三层预算（默认值，可用 KV config:action_budget JSON 覆盖）：
//    1. per_type_daily      每类动作每日上限：meta_fix ≤10 / alt_text_fill ≤20 /
//                           internal_link ≤10（按当日已创建任务数计）
//    2. per_mission_max     单次 Mission 最多产出 5 个可自动执行动作
//                           （growth-sync 一轮扫描内 L3 任务上限；其余降级人工审核）
//    3. daily_production_writes  每日生产写入尝试总量 ≤30
//                           （task-execute 侧按当日执行尝试数计，含失败尝试）
//
//  语义约定：
//    - 路由侧（growth-sync）超预算 → **降级**为 growth_review（人工审核），不丢弃机会。
//    - 执行侧（task-execute）超预算 → **429 拦截**并留痕（recordBlockedAction）。
//    - 统计查询失败 → 路由侧按默认安全路径走（降级人工），执行侧放行计数 0
//      但附带 warning（fail-open 于观测、fail-safe 于动作：宁可转人工，不误杀也不超限）。
// ---------------------------------------------------------------------------

export interface ActionBudgetConfig {
  /** 每类可自动执行动作的每日上限（按当日创建任务数） */
  per_type_daily: Record<string, number>;
  /** 单次 Mission 最多产出的可自动执行动作数 */
  per_mission_max: number;
  /** 每日生产写入尝试总量上限（执行侧） */
  daily_production_writes: number;
}

export const ACTION_BUDGET_DEFAULTS: ActionBudgetConfig = {
  per_type_daily: { meta_fix: 10, alt_text_fill: 20, internal_link: 10 },
  per_mission_max: 5,
  daily_production_writes: 30,
};

export const KV_ACTION_BUDGET_KEY = "config:action_budget";

/** 会被 Action Budget 约束的任务类型（= 可自动执行的生产写入类型） */
export const BUDGETED_TASK_TYPES = [
  "meta_fix",
  "alt_text_fill",
  "internal_link",
  "translate_fill",
  "sitemap_ping",
];

function sanitizePositiveInt(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** 读取预算配置：KV JSON 覆盖默认值（逐字段合并），任何异常回落默认。 */
export async function getActionBudgetConfig(kv?: KVNamespace | null): Promise<ActionBudgetConfig> {
  const cfg: ActionBudgetConfig = {
    per_type_daily: { ...ACTION_BUDGET_DEFAULTS.per_type_daily },
    per_mission_max: ACTION_BUDGET_DEFAULTS.per_mission_max,
    daily_production_writes: ACTION_BUDGET_DEFAULTS.daily_production_writes,
  };
  try {
    const raw = await kv?.get(KV_ACTION_BUDGET_KEY);
    if (!raw) return cfg;
    const parsed = JSON.parse(raw) as Partial<ActionBudgetConfig>;
    if (parsed.per_type_daily && typeof parsed.per_type_daily === "object") {
      for (const [k, v] of Object.entries(parsed.per_type_daily)) {
        cfg.per_type_daily[k] = sanitizePositiveInt(
          v,
          ACTION_BUDGET_DEFAULTS.per_type_daily[k] ?? 10,
        );
      }
    }
    cfg.per_mission_max = sanitizePositiveInt(
      parsed.per_mission_max,
      ACTION_BUDGET_DEFAULTS.per_mission_max,
    );
    cfg.daily_production_writes = sanitizePositiveInt(
      parsed.daily_production_writes,
      ACTION_BUDGET_DEFAULTS.daily_production_writes,
    );
  } catch {
    /* KV/JSON 异常 → 用默认值（保守） */
  }
  return cfg;
}

export interface BudgetUsage {
  date: string;
  /** 当日已创建的受预算约束任务数（按类型） */
  tasks_created_by_type: Record<string, number>;
  /** 当日各类型执行尝试数（task_runs × tasks，含失败尝试） */
  executions_by_type: Record<string, number>;
  /** 当日生产写入执行尝试总数（含失败尝试） */
  production_write_attempts: number;
}

/** 统计当日（UTC）预算用量。查询失败返回零值 + ok=false，由调用方决定降级策略。 */
export async function getBudgetUsage(
  db: D1Database | undefined,
  dateStr: string,
): Promise<BudgetUsage & { ok: boolean }> {
  const usage: BudgetUsage & { ok: boolean } = {
    date: dateStr,
    tasks_created_by_type: {},
    executions_by_type: {},
    production_write_attempts: 0,
    ok: false,
  };
  if (!db) return usage;
  const dayStart = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
  try {
    const inList = BUDGETED_TASK_TYPES.map(() => "?").join(",");
    const rows = await db
      .prepare(
        `SELECT task_type, COUNT(*) as cnt FROM tasks
         WHERE created_at >= ? AND task_type IN (${inList})
         GROUP BY task_type`,
      )
      .bind(dayStart, ...BUDGETED_TASK_TYPES)
      .all();
    for (const r of rows.results as { task_type: string; cnt: number }[]) {
      usage.tasks_created_by_type[r.task_type] = Number(r.cnt || 0);
    }
    const execRows = await db
      .prepare(
        `SELECT t.task_type as task_type, COUNT(*) as cnt FROM task_runs tr
         JOIN tasks t ON t.id = tr.task_id
         WHERE tr.started_at >= ? AND t.task_type IN (${inList})
         GROUP BY t.task_type`,
      )
      .bind(dayStart, ...BUDGETED_TASK_TYPES)
      .all();
    for (const r of execRows.results as { task_type: string; cnt: number }[]) {
      usage.executions_by_type[r.task_type] = Number(r.cnt || 0);
      usage.production_write_attempts += Number(r.cnt || 0);
    }
    usage.ok = true;
  } catch {
    /* 统计失败：调用方按安全路径处理 */
  }
  return usage;
}

export interface BudgetCheck {
  allowed: boolean;
  reason: string;
  limit: number;
  used: number;
}

/**
 * 路由侧检查：某类自动执行任务今日是否还有创建额度。
 * extraCreated = 本轮运行内已创建但尚未计入 DB 统计的同类任务数。
 */
export function checkCreationBudget(
  cfg: ActionBudgetConfig,
  usage: BudgetUsage,
  taskType: string,
  extraCreated = 0,
): BudgetCheck {
  const limit = cfg.per_type_daily[taskType];
  if (limit === undefined) return { allowed: true, reason: "unbudgeted", limit: -1, used: 0 };
  const used = (usage.tasks_created_by_type[taskType] || 0) + extraCreated;
  return {
    allowed: used < limit,
    reason:
      used < limit
        ? "within budget"
        : `${taskType} 当日创建已达上限 ${limit}（已创建 ${used}），转人工审核`,
    limit,
    used,
  };
}

/** 执行侧检查：当日生产写入尝试总量是否还有额度。 */
export function checkProductionWriteBudget(
  cfg: ActionBudgetConfig,
  usage: BudgetUsage,
): BudgetCheck {
  const limit = cfg.daily_production_writes;
  const used = usage.production_write_attempts;
  return {
    allowed: used < limit,
    reason:
      used < limit
        ? "within budget"
        : `当日生产写入尝试已达上限 ${limit}（已尝试 ${used}），明日再试`,
    limit,
    used,
  };
}

/**
 * Mission 内检查：单个 Mission 已记录的执行动作数是否超过 per_mission_max。
 * 供多动作 Mission（未来 Harness/Execution Agent）使用；当前单动作执行器恒通过。
 */
export async function checkMissionActionBudget(
  db: D1Database | undefined,
  kv: KVNamespace | undefined | null,
  missionId: string | null,
  actionType = "execute_capability",
): Promise<BudgetCheck> {
  const cfg = await getActionBudgetConfig(kv);
  const limit = cfg.per_mission_max;
  if (!db || !missionId) return { allowed: true, reason: "no mission scope", limit, used: 0 };
  try {
    const row = await db
      .prepare(
        `SELECT COUNT(*) as cnt FROM ai_action_logs WHERE mission_id = ? AND action_type = ?`,
      )
      .bind(missionId, actionType)
      .first<{ cnt: number }>();
    const used = Number(row?.cnt || 0);
    return {
      allowed: used < limit,
      reason:
        used < limit ? "within budget" : `单 Mission 动作数已达上限 ${limit}（已 ${used} 步）`,
      limit,
      used,
    };
  } catch {
    return { allowed: true, reason: "budget check failed open", limit, used: 0 };
  }
}

/** 供后台面板展示：当前配置 + 当日用量 + 各闸剩余余量。 */
export async function describeActionBudget(
  db: D1Database | undefined,
  kv: KVNamespace | undefined | null,
  dateStr: string,
): Promise<{
  config: ActionBudgetConfig;
  usage: BudgetUsage & { ok: boolean };
  remaining: {
    per_type_daily: Record<string, number>;
    production_writes_today: number;
  };
}> {
  const [config, usage] = await Promise.all([
    getActionBudgetConfig(kv),
    getBudgetUsage(db, dateStr),
  ]);
  const remainingPerType: Record<string, number> = {};
  for (const [type, limit] of Object.entries(config.per_type_daily)) {
    remainingPerType[type] = Math.max(0, limit - (usage.tasks_created_by_type[type] || 0));
  }
  return {
    config,
    usage,
    remaining: {
      per_type_daily: remainingPerType,
      production_writes_today: Math.max(
        0,
        config.daily_production_writes - usage.production_write_attempts,
      ),
    },
  };
}
