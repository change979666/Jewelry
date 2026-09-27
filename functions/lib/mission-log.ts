// ---------------------------------------------------------------------------
//  Aromiso V5.36 — AI Mission 记录层（AI Command Center / AI Replay 地基）
//
//  目标：让每一个 AI 行为「可观察、可追溯、可复盘」——
//    今天 AI 做了什么？为什么做？哪个 AI 做的？读了哪些数据？
//    修改了什么？为什么没改？有没有异常？需不需要人管？
//
//  铁律：记录层永远不阻断主流程——所有写入 try/catch 吞错，
//       观测系统出问题时自动化照常运行。
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D1Row = Record<string, any>;

export interface MissionSpec {
  /** 任务类型：gsc_sync / ga4_sync / daily_recommendations / growth_sync /
   *  opportunity_scan / knowledge_distill / task_planning / task_followup /
   *  outcome_verification / action_execution / seo_audit ... */
  mission_type: string;
  /** 哪个 AI 角色（含中文注释）：Data Collector（数据采集）等 */
  agent_name: string;
  model_used?: string | null;
  prompt_version?: string | null;
  /** 结构化输入摘要（读到了什么） */
  input_data?: unknown;
  human_approval_needed?: 0 | 1;
}

export interface MissionResult {
  status: "completed" | "skipped" | "blocked";
  output_summary?: string;
  /** 本次真正做了的事（每条一句话） */
  actions_taken?: string[];
  tasks_created?: number;
  recommendations_count?: number;
  blocked_reason?: string;
  error_message?: string;
  token_usage?: number;
  cost_usd?: number;
  /** 实际使用的模型（调用后才知道时回填） */
  model_used?: string | null;
  /** 是否需要人工处理（如产生了待审任务） */
  human_approval_needed?: 0 | 1;
}

export interface ActionSpec {
  action_type: string;
  tool_used?: string;
  step_input?: unknown;
  step_output?: unknown;
  tool_args?: unknown;
  fact_check_result?: "safe" | "warning" | "blocked";
  truthfulness_flags?: string[];
  confidence_score?: number;
  success?: boolean;
  error_message?: string;
  affected_files?: string[];
  sandbox_mode?: boolean;
  duration_ms?: number;
}

/** 生成稳定可读的 mission id：MSN-20260815-gsc_sync-a1b2c3 */
export function newMissionId(type: string): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(16).slice(2, 8);
  return `MSN-${d}-${type.replace(/[^a-z0-9_]/gi, "").slice(0, 32)}-${rand}`;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function safeJson(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s.length > 20000 ? s.slice(0, 20000) : s;
  } catch {
    return null;
  }
}

/** 开始一个任务（status=running）。失败返回 null（不阻断主流程）。 */
export async function startMission(
  db: D1Database | undefined,
  spec: MissionSpec,
): Promise<string | null> {
  if (!db) return null;
  const missionId = newMissionId(spec.mission_type);
  const now = nowSec();
  // V5.69：孤儿阈值 30min→90min。慢但合法的任务（如 GSC 全量拉取）常超 30min，
  // 旧阈值会把「成功但慢」的 mission 误标 failed/blocked，污染健康分（假失败）。
  // 90min 仍足以捕获真正 hang/被中断的执行。
  const ORPHAN_SEC = 5400;
  try {
    // V5.415 (P1-6): Dual-table orphan cleanup — both ai_missions and task_runs can hang in "running" if execution is killed mid-flight.
    // Running > ORPHAN_SEC → mark as failed/blocked with a clear reason; never fake success/failure.

    // ① ai_missions (original V5.361 + V5.415 extension to task_runs)
    try {
      await db
        .prepare(
          `UPDATE ai_missions SET status = 'blocked',
             blocked_reason = '超时未完成（running 超 90 分钟，自动标记：执行环境被中断或已结束）',
             error_message = 'startMission 孤儿任务扫描自动清理',
             completed_at = ?, updated_at = ?
           WHERE status = 'running' AND started_at IS NOT NULL AND started_at < ?`,
        )
        .bind(now, now, now - ORPHAN_SEC)
        .run();
    } catch {
      /* 观测层失败不阻断 */
    }

    // ② task_runs (V5.415 P1-6 new)
    // 注意 schema：task_runs 只有 detail / finished_at 列（无 completed_at /
    // updated_at / error_message），写错列名会「no such column」被静默吞掉。
    try {
      await db
        .prepare(
          `UPDATE task_runs SET status = 'failed', finished_at = ?,
             detail = 'startMission 孤儿任务扫描自动清理：running 超 90 分钟'
           WHERE status = 'running' AND started_at IS NOT NULL AND started_at < ?`,
        )
        .bind(now, now - ORPHAN_SEC)
        .run();
      console.info("[mission-log] task_runs orphans scanned (90min threshold)");
    } catch {
      /* 观测层失败不阻断 */
    }
    await db
      .prepare(
        `INSERT INTO ai_missions
           (mission_id, mission_type, status, scheduled_at, started_at,
            agent_name, model_used, prompt_version, input_data,
            human_approval_needed, created_at, updated_at)
         VALUES (?, ?, 'running', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        missionId,
        spec.mission_type,
        now,
        now,
        spec.agent_name,
        spec.model_used || null,
        spec.prompt_version || null,
        safeJson(spec.input_data),
        spec.human_approval_needed ? 1 : 0,
        now,
        now,
      )
      .run();
    return missionId;
  } catch (e) {
    console.error("[mission-log] startMission failed:", e);
    return null;
  }
}

/** 结束一个任务（completed / skipped / blocked）。永远不抛错。 */
export async function finishMission(
  db: D1Database | undefined,
  missionId: string | null,
  result: MissionResult,
): Promise<void> {
  if (!db || !missionId) return;
  try {
    const row = await db
      .prepare(`SELECT started_at FROM ai_missions WHERE mission_id = ?`)
      .bind(missionId)
      .first<D1Row>();
    const startedAt = Number(row?.started_at || 0);
    const now = nowSec();
    await db
      .prepare(
        `UPDATE ai_missions SET
           status = ?, completed_at = ?, duration_seconds = ?,
           output_summary = ?, actions_taken = ?,
           tasks_created = ?, recommendations_count = ?,
           blocked_reason = ?, error_message = ?,
           token_usage = ?, cost_usd = ?,
           model_used = COALESCE(?, model_used),
           human_approval_needed = COALESCE(?, human_approval_needed), updated_at = ?
         WHERE mission_id = ?`,
      )
      .bind(
        result.status,
        now,
        startedAt > 0 ? now - startedAt : null,
        (result.output_summary || "").slice(0, 2000),
        safeJson(result.actions_taken || []),
        result.tasks_created ?? null,
        result.recommendations_count ?? null,
        result.blocked_reason || null,
        result.error_message || null,
        result.token_usage ?? null,
        result.cost_usd ?? null,
        result.model_used ?? null,
        result.human_approval_needed ?? null,
        now,
        missionId,
      )
      .run();
  } catch (e) {
    console.error("[mission-log] finishMission failed:", e);
  }
}

/** 记录任务内的一个动作步骤（AI Replay 的最小单元）。自动取步序号。 */
export async function logAction(
  db: D1Database | undefined,
  missionId: string | null,
  spec: ActionSpec,
): Promise<void> {
  if (!db || !missionId) return;
  try {
    const prev = await db
      .prepare(`SELECT COALESCE(MAX(step_number), 0) as n FROM ai_action_logs WHERE mission_id = ?`)
      .bind(missionId)
      .first<D1Row>();
    const step = Number(prev?.n || 0) + 1;
    const now = nowSec();
    await db
      .prepare(
        `INSERT INTO ai_action_logs
           (mission_id, action_type, tool_used, step_number, step_input, step_output,
            tool_args, fact_check_result, truthfulness_flags, confidence_score,
            started_at, completed_at, duration_ms, success, error_message,
            affected_files, sandbox_mode, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        missionId,
        spec.action_type,
        spec.tool_used || null,
        step,
        safeJson(spec.step_input),
        safeJson(spec.step_output),
        safeJson(spec.tool_args),
        spec.fact_check_result || null,
        safeJson(spec.truthfulness_flags || []),
        spec.confidence_score ?? null,
        now,
        now,
        spec.duration_ms ?? null,
        spec.success === false ? 0 : 1,
        spec.error_message || null,
        safeJson(spec.affected_files || []),
        spec.sandbox_mode === false ? 0 : 1,
        now,
      )
      .run();
  } catch (e) {
    console.error("[mission-log] logAction failed:", e);
  }
}

export type ActionLogger = (spec: ActionSpec) => Promise<void>;

/**
 * 任务包装器：startMission → fn(log) → finishMission。
 * fn 抛错时任务记为 blocked 并继续抛出（主流程错误语义不变）。
 * fn 返回 { _mission?: Partial<MissionResult> } 可覆盖结束状态。
 */
export async function withMission<T>(
  db: D1Database | undefined,
  spec: MissionSpec,
  fn: (log: ActionLogger) => Promise<T>,
): Promise<T> {
  const missionId = await startMission(db, spec);
  const log: ActionLogger = (a) => logAction(db, missionId, a);
  try {
    const result = await fn(log);
    // 允许 fn 通过返回值携带任务级摘要
    const extra =
      result && typeof result === "object" && "_mission" in (result as Record<string, unknown>)
        ? ((result as Record<string, unknown>)._mission as Partial<MissionResult>)
        : {};
    await finishMission(db, missionId, { status: "completed", ...extra });
    return result;
  } catch (e) {
    await finishMission(db, missionId, {
      status: "blocked",
      blocked_reason: "执行异常",
      error_message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

/** 记录一次「被拒绝/被闸门拦截」的动作（Truthfulness / 权限闸的可追溯性）。 */
export async function recordBlockedAction(
  db: D1Database | undefined,
  opts: {
    mission_type: string;
    agent_name: string;
    reason: string;
    detail?: unknown;
  },
): Promise<void> {
  if (!db) return;
  const missionId = await startMission(db, {
    mission_type: opts.mission_type,
    agent_name: opts.agent_name,
    input_data: opts.detail,
  });
  await logAction(db, missionId, {
    action_type: "blocked_by_gate",
    tool_used: "truthfulness/permissions",
    step_input: opts.detail,
    fact_check_result: "blocked",
    success: false,
    error_message: opts.reason,
  });
  await finishMission(db, missionId, {
    status: "blocked",
    blocked_reason: opts.reason.slice(0, 500),
    output_summary: `动作被安全闸门拦截：${opts.reason.slice(0, 300)}`,
  });
}

// ---------------------------------------------------------------------------
//  AI Daily Report（每日报告）+ Mission Plan（任务计划）
// ---------------------------------------------------------------------------

/** 汇总当日 AI 行为，写 ai_daily_report（upsert）。失败不抛错。 */
export async function generateDailyReport(
  db: D1Database | undefined,
  dateStr: string,
): Promise<void> {
  if (!db) return;
  try {
    const dayStart = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
    const dayEnd = dayStart + 86400;

    const stats = await db
      .prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status='skipped' THEN 1 ELSE 0 END) as skipped,
                SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END) as blocked,
                SUM(CASE WHEN human_approval_needed=1 THEN 1 ELSE 0 END) as approvals
         FROM ai_missions WHERE created_at >= ? AND created_at < ?`,
      )
      .bind(dayStart, dayEnd)
      .first<D1Row>();

    const byType = await db
      .prepare(
        `SELECT mission_type, COUNT(*) as cnt FROM ai_missions
         WHERE created_at >= ? AND created_at < ? GROUP BY mission_type`,
      )
      .bind(dayStart, dayEnd)
      .all();

    const riskRows = await db
      .prepare(
        `SELECT mission_type, agent_name, blocked_reason, error_message FROM ai_missions
         WHERE created_at >= ? AND created_at < ? AND status = 'blocked'
         ORDER BY created_at DESC LIMIT 5`,
      )
      .bind(dayStart, dayEnd)
      .all();

    // 成本：ai_usage 已是全量 AI 调用的真实账本（CNY）
    const cost = await db
      .prepare(
        `SELECT COALESCE(SUM(cost_cny),0) as cny, COALESCE(SUM(tokens_in+tokens_out),0) as tokens
                FROM ai_usage WHERE created_at >= ? AND created_at < ?`,
      )
      .bind(dayStart, dayEnd)
      .first<D1Row>();

    // 明日三件最重要：取待审高价值机会（exec_level B/C 且未处理）
    let priorities: string[] = [];
    try {
      const opps = await db
        .prepare(
          `SELECT opp_type, page, query FROM growth_opportunities
           WHERE status = 'new' AND exec_level IN ('B','C')
           ORDER BY id DESC LIMIT 3`,
        )
        .all();
      priorities = (opps.results as D1Row[]).map((o) =>
        [o.opp_type, o.query || o.page].filter(Boolean).join(" · "),
      );
    } catch {
      /* growth_opportunities 表缺失时忽略 */
    }

    const total = Number(stats?.total || 0);
    const completed = Number(stats?.completed || 0);
    const blocked = Number(stats?.blocked || 0);
    const riskAlerts = (riskRows.results as D1Row[]).map(
      (r) =>
        `${r.agent_name}/${r.mission_type}: ${r.blocked_reason || r.error_message || "未知异常"}`,
    );
    const cny = Number(cost?.cny || 0);

    // ---- V5.37 Agent Health Score：当日 AI 行为六项子分（缺数据 = null） ----
    // 事实安全 / 误报代理：来自 ai_action_logs 的 fact_check_result 与 success
    let factBlocked = 0;
    let factWarn = 0;
    let factChecked = 0;
    let logsTotal = 0;
    let logsFailed = 0;
    try {
      const fact = await db
        .prepare(
          `SELECT
             COALESCE(SUM(CASE WHEN fact_check_result = 'blocked' THEN 1 ELSE 0 END), 0) as fb,
             COALESCE(SUM(CASE WHEN fact_check_result = 'warning' THEN 1 ELSE 0 END), 0) as fw,
             COUNT(*) as fc
           FROM ai_action_logs
           WHERE created_at >= ? AND created_at < ?
             AND fact_check_result IS NOT NULL AND fact_check_result != ''`,
        )
        .bind(dayStart, dayEnd)
        .first<D1Row>();
      factBlocked = Number(fact?.fb || 0);
      factWarn = Number(fact?.fw || 0);
      factChecked = Number(fact?.fc || 0);
      const logs = await db
        .prepare(
          `SELECT COUNT(*) as total,
                  COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) as failed
           FROM ai_action_logs WHERE created_at >= ? AND created_at < ?`,
        )
        .bind(dayStart, dayEnd)
        .first<D1Row>();
      logsTotal = Number(logs?.total || 0);
      logsFailed = Number(logs?.failed || 0);
    } catch {
      /* 子分缺数据按 null 处理 */
    }
    // 动作成功率：growth_actions 全量已验证实验（positive / negative / no_effect）
    let expPositive = 0;
    let expDecided = 0;
    try {
      const exp = await db
        .prepare(
          `SELECT
             COALESCE(SUM(CASE WHEN outcome = 'positive' THEN 1 ELSE 0 END), 0) as pos,
             COUNT(*) as decided
           FROM growth_actions WHERE outcome IS NOT NULL AND outcome != ''`,
        )
        .first<D1Row>();
      expPositive = Number(exp?.pos || 0);
      expDecided = Number(exp?.decided || 0);
    } catch {
      /* growth_actions 缺失时忽略 */
    }
    // 自动执行数：当日 action_execution 任务中真正完成（非拦截）的次数
    let autoExec = 0;
    try {
      const ae = await db
        .prepare(
          `SELECT COUNT(*) as cnt FROM ai_missions
           WHERE created_at >= ? AND created_at < ?
             AND mission_type = 'action_execution' AND status = 'completed'`,
        )
        .bind(dayStart, dayEnd)
        .first<D1Row>();
      autoExec = Number(ae?.cnt || 0);
    } catch {
      /* ignore */
    }

    const round1 = (v: number) => Math.round(v * 10) / 10;
    const clamp01 = (v: number) => Math.max(0, Math.min(100, v));
    const health: Record<string, number | null> = {};
    // ① 任务完成率：completed / (completed + blocked)（skipped 为有意跳过不计失败）
    health.completion =
      completed + blocked > 0 ? round1((100 * completed) / (completed + blocked)) : null;
    // ② 事实安全：违规一次 -15，警告一次 -3
    health.fact_safety =
      factChecked > 0 ? round1(clamp01(100 - factBlocked * 15 - factWarn * 3)) : null;
    // ③ 误报率代理：步骤级失败率的补数（未来接 Human Correction Rate 真口径）
    health.precision = logsTotal > 0 ? round1(100 * (1 - logsFailed / logsTotal)) : null;
    // ④ 动作成功率：T+14 实验 positive 占已出结果实验比例（观察期初期通常无数据）
    health.action_success = expDecided > 0 ? round1((100 * expPositive) / expDecided) : null;
    // ⑤ 无异常率：1 - blocked/total
    health.anomaly_free = total > 0 ? round1(100 * (1 - blocked / total)) : null;
    // ⑥ 成本效率：日均基准 ¥1（月预算 ¥30），≤¥1 满分，¥5 归零，线性
    health.cost_efficiency = round1(clamp01((100 * (5 - cny)) / 4));

    const WEIGHTS: Record<string, number> = {
      completion: 0.25,
      fact_safety: 0.25,
      precision: 0.15,
      action_success: 0.15,
      anomaly_free: 0.1,
      cost_efficiency: 0.1,
    };
    let wSum = 0;
    let acc = 0;
    for (const [k, w] of Object.entries(WEIGHTS)) {
      const v = health[k];
      if (v !== null) {
        wSum += w;
        acc += w * v;
      }
    }
    const healthScore = wSum > 0 ? round1(acc / wSum) : null;
    const healthJson = safeJson({
      score: healthScore,
      sub_scores: health,
      weights: WEIGHTS,
      inputs: { factChecked, factBlocked, factWarn, logsTotal, logsFailed, expDecided, cny },
      note: "null = 数据不足不计权；action_success 观察期初期通常为空，待 T+14 实验出结果",
    });

    const recommendation =
      total === 0
        ? "今日无 AI 任务运行记录。请检查自动化触发链路（cron / 手动触发）。"
        : blocked > 0
          ? `今日 ${total} 项任务中 ${blocked} 项被拦截/异常，请优先查看风险警报；其余 ${completed} 项正常完成。`
          : `今日 ${total} 项任务全部正常完成（${completed} 成功）。AI 成本 ¥${cny.toFixed(2)}。继续观察 GSC 商业词排名变化。`;

    const typeMap: Record<string, number> = {};
    for (const r of byType.results as D1Row[]) typeMap[String(r.mission_type)] = Number(r.cnt);

    await db.prepare(`DELETE FROM ai_daily_report WHERE report_date = ?`).bind(dateStr).run();
    await db
      .prepare(
        `INSERT INTO ai_daily_report
           (report_date, total_missions, completed_missions, skipped_missions, blocked_missions,
            auto_executions, human_reviewed, analysis_only,
            seo_actions, growth_actions, content_actions, bdf_actions,
            factual_violations, warnings_generated, blocks_triggered,
            total_cost_usd, total_tokens, priority_items, risk_alerts, ai_recommendation,
            health_score, health_json, generated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        dateStr,
        total,
        completed,
        Number(stats?.skipped || 0),
        blocked,
        autoExec,
        Number(stats?.approvals || 0),
        total - completed - blocked,
        typeMap["seo_audit"] || 0,
        (typeMap["growth_sync"] || 0) + (typeMap["opportunity_scan"] || 0),
        typeMap["daily_recommendations"] || 0,
        typeMap["bdf_check"] || 0,
        factBlocked,
        factWarn,
        blocked,
        Math.round((cny / 7.1) * 100) / 100,
        Number(cost?.tokens || 0),
        safeJson(priorities),
        safeJson(riskAlerts),
        recommendation,
        healthScore,
        healthJson,
        nowSec(),
      )
      .run();
  } catch (e) {
    console.error("[mission-log] generateDailyReport failed:", e);
  }
}

/** 标准每日循环（明日计划的确定性模板，规则驱动、不瞎编）。 */
const STANDARD_CYCLE = [
  { type: "gsc_sync", agent: "Data Collector（数据采集）", desc: "同步 GSC T-2 搜索数据" },
  { type: "ga4_sync", agent: "Data Collector（数据采集）", desc: "同步 GA4 T-2 访问数据" },
  {
    type: "daily_recommendations",
    agent: "Analyst（增长分析师）",
    desc: "基于近 28 天数据生成运营建议",
  },
  {
    type: "growth_sync",
    agent: "Opportunity Analyst（机会引擎）",
    desc: "扫描增长机会 + 技术审计 → 任务路由",
  },
  {
    type: "os_daily",
    agent: "Analyst/Librarian/Strategist/Executor",
    desc: "四角色日循环：发现 → 沉淀 → 规划 → 跟进",
  },
  {
    type: "outcome_verification",
    agent: "Executor（结果验证官）",
    desc: "T+14 到期实验前后对比，回写三态结论",
  },
];

/** 写明日计划 + 未来 7 天预览（幂等覆盖）。失败不抛错。 */
export async function writeMissionPlans(
  db: D1Database | undefined,
  todayStr: string,
): Promise<void> {
  if (!db) return;
  try {
    const now = nowSec();
    const tomorrow = new Date(new Date(`${todayStr}T00:00:00Z`).getTime() + 86400000)
      .toISOString()
      .slice(0, 10);

    await db
      .prepare(
        `DELETE FROM ai_mission_plan WHERE plan_date = ? AND horizon_type IN ('tomorrow','week_preview')`,
      )
      .bind(tomorrow)
      .run();

    await db
      .prepare(
        `INSERT INTO ai_mission_plan
           (plan_date, horizon_type, planned_missions, confidence_score, planner_agent, created_at, updated_at)
         VALUES (?, 'tomorrow', ?, 0.9, 'Mission Planner（规则驱动）', ?, ?)`,
      )
      .bind(tomorrow, safeJson(STANDARD_CYCLE), now, now)
      .run();

    const week: { date: string; cycle: string[]; note: string }[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(new Date(`${todayStr}T00:00:00Z`).getTime() + i * 86400000)
        .toISOString()
        .slice(0, 10);
      week.push({
        date: d,
        cycle: STANDARD_CYCLE.map((c) => c.type),
        note:
          i === 7
            ? "周复盘：汇总 Opportunity→Action→Outcome 转化率与 Human Correction Rate"
            : i === 1
              ? "标准每日循环 + 观察 GSC 商业词排名变化"
              : "标准每日循环",
      });
    }
    await db
      .prepare(
        `INSERT INTO ai_mission_plan
           (plan_date, horizon_type, planned_missions, confidence_score, planner_agent, created_at, updated_at)
         VALUES (?, 'week_preview', ?, 0.8, 'Mission Planner（规则驱动）', ?, ?)`,
      )
      .bind(tomorrow, safeJson(week), now, now)
      .run();
  } catch (e) {
    console.error("[mission-log] writeMissionPlans failed:", e);
  }
}
