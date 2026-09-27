// ---------------------------------------------------------------------------
//  Jewelry — 健康分「失败信号分桶」诊断器 (Automation OS 收口)
//
//  背景：ai_daily_report.health_score 是全站健康 SSOT（≥85 GREEN / 60–84 YELLOW /
//  <60 RED）。但当它变 RED 时，owner 过去只能看到一个数字，无法立刻判断「这次红
//  到底是真故障，还是第三方挂了，还是我们自己的库/迁移坏了，还是慢成功被误杀，
//  还是孤儿扫描的假失败」。本模块把最近 N 天的失败信号按性质分桶，让一个 RED
//  可被「一眼定位」。
//
//  五大桶（first-match-wins，顺序即优先级）：
//    ① slow_success  慢成功——被孤儿扫描自动标记 failed/blocked，但底层数据其实已落库
//                    （如 GSC 慢拉取超过阈值被误杀）。不该算真失败。
//    ② false_fail    假失败——被孤儿扫描/超时清理标记，但没有任何真实故障证据，
//                    且无法确认数据已落库。属清理产物，非真故障。
//    ③ external      外部依赖故障——GA4 / GSC / Google / Resend / GitHub /
//                    DeepSeek / SiliconFlow / 403 / 429 / timeout / quota /
//                    PERMISSION_DENIED / 网络。我们无法直接修，只能等/换密钥/申权限。
//    ④ system        自有基础设施故障——D1 / KV / R2 / SQL / schema / 迁移 /
//                    bind / no such column|table。这是我们的 bug，必须修。
//    ⑤ true_fail     真实业务失败——上述都不匹配的失败（AI 无产出、写入失败、
//                    事实校验拦截等）。需要人看一眼。
//
//  设计红线：
//    - 每个数据源查询独立 try/catch：任一表缺失/迁移未跑都绝不阻断，也绝不把
//      「查不到」伪装成「没问题」。查不到 → 该源贡献 0 信号（如实）。
//    - 纯代码、零 AI、零写入：只读诊断，不改任何状态。
//    - 关键词判定全部小写化后匹配，避免大小写漏判。
// ---------------------------------------------------------------------------

export type HealthBucket = "slow_success" | "false_fail" | "external" | "system" | "true_fail";

export interface BucketSignal {
  bucket: HealthBucket;
  source: "task_runs" | "ai_missions" | "action_logs" | "pull_state";
  /** 触发分桶的原始文本（截断），供 owner 直接看到「为什么这么归类」 */
  text: string;
  /** 命中的关键词，便于校验分类是否正确 */
  matched: string;
}

export interface HealthBuckets {
  window_days: number;
  totals: Record<HealthBucket, number>;
  signal_count: number;
  /** 每桶最多保留若干条样例，避免响应体过大 */
  examples: Record<HealthBucket, string[]>;
  /** 处于 degraded 的数据源（如 GA4 持续 0 行），单独列出 */
  degraded_sources: string[];
  /** 一句话人读摘要：owner 扫一眼就知道红在哪 */
  summary: string;
  /** 是否「干净」：无 true_fail / system 信号（external -only 的红不该半夜爬起来改代码） */
  clean_of_own_faults: boolean;
  /**
   * PHASE E：可执行的调参/排查建议（仅建议，绝不自动改任何阈值/配置）。
   * 例如 slow_success 持续偏高 → 建议上调孤儿扫描阈值 ORPHAN_SEC。
   */
  advisories: string[];
}

// ---- 关键词表（全部小写匹配）------------------------------------------------

/** 孤儿扫描 / 超时清理产物标记（→ slow_success 或 false_fail） */
const ORPHAN_MARKERS = [
  "孤儿任务扫描",
  "orphan",
  "超时未完成",
  "running 超",
  "自动清理",
  "自动标记",
];

/** 外部依赖故障关键词 */
const EXTERNAL_KEYWORDS = [
  "ga4",
  "gsc",
  "google",
  "search console",
  "analytics",
  "resend",
  "github",
  "deepseek",
  "siliconflow",
  "openai",
  "anthropic",
  "403",
  "429",
  "401",
  "502",
  "503",
  "504",
  "timeout",
  "timed out",
  "quota",
  "rate limit",
  "rate_limit",
  "permission_denied",
  "permission denied",
  "unauthorized",
  "forbidden",
  "econnreset",
  "econnrefused",
  "etimedout",
  "network",
  "fetch failed",
  "upstream",
  "服务账号",
  "外部",
  "第三方",
  "api 调用失败",
  "budget",
  "余额",
];

/** 自有基础设施故障关键词 */
const SYSTEM_KEYWORDS = [
  "d1",
  "kv",
  "r2",
  "sql",
  "sqlite",
  "no such column",
  "no such table",
  "migration",
  "迁移",
  "schema",
  "bind",
  "database",
  "constraint",
  "unique constraint",
  "foreign key",
  "syntax error",
  "prepare",
  "事务",
  "transaction",
];

const MAX_EXAMPLES_PER_BUCKET = 4;
const MAX_TEXT_LEN = 160;

function clip(s: string, n = MAX_TEXT_LEN): string {
  const t = (s || "").trim().replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n) + "…" : t;
}

function firstMatch(haystackLower: string, needles: string[]): string {
  for (const n of needles) {
    if (haystackLower.includes(n)) return n;
  }
  return "";
}

/**
 * 对单条失败信号文本分桶。
 * @param text           原始失败文本（detail / error_message / blocked_reason 拼接）
 * @param pullOkInWindow 窗口内是否存在成功入库的拉取（用于区分 slow_success / false_fail）
 */
export function classifySignal(
  text: string,
  pullOkInWindow: boolean,
): { bucket: HealthBucket; matched: string } {
  const lower = (text || "").toLowerCase();

  // ① 孤儿扫描 / 超时清理产物
  const orphanHit = firstMatch(lower, ORPHAN_MARKERS);
  if (orphanHit) {
    // 若窗口内确有成功落库的拉取，说明这类「running 超时被杀」多为慢成功误杀；
    // 否则无法证明数据已落库，保守归为假失败（清理产物，非真故障）。
    return { bucket: pullOkInWindow ? "slow_success" : "false_fail", matched: orphanHit };
  }

  // ② 外部依赖
  const extHit = firstMatch(lower, EXTERNAL_KEYWORDS);
  if (extHit) return { bucket: "external", matched: extHit };

  // ③ 自有基础设施
  const sysHit = firstMatch(lower, SYSTEM_KEYWORDS);
  if (sysHit) return { bucket: "system", matched: sysHit };

  // ④ 其余 = 真实业务失败
  return { bucket: "true_fail", matched: "" };
}

/**
 * 汇总最近 windowDays 天的失败信号并分桶。只读、纯代码、每源独立容错。
 * 任一表缺失都不会抛错，也不会把「查不到」当成「健康」。
 */
export async function classifyHealthBuckets(
  db: D1Database | undefined,
  windowDays = 7,
): Promise<HealthBuckets | null> {
  if (!db) return null;

  const now = Math.floor(Date.now() / 1000);
  const since = now - windowDays * 86400;
  const sinceDate = new Date(since * 1000).toISOString().slice(0, 10);

  const totals: Record<HealthBucket, number> = {
    slow_success: 0,
    false_fail: 0,
    external: 0,
    system: 0,
    true_fail: 0,
  };
  const examples: Record<HealthBucket, string[]> = {
    slow_success: [],
    false_fail: [],
    external: [],
    system: [],
    true_fail: [],
  };
  const degradedSources: string[] = [];
  const signals: BucketSignal[] = [];

  // 先探测：窗口内是否有成功入库的拉取（pull_state status='ok' 且 rows>0）。
  // 用于把孤儿扫描产物区分为「慢成功」还是「假失败」。查不到保守 false。
  let pullOkInWindow = false;
  try {
    const ok = await db
      .prepare(
        `SELECT COUNT(*) AS c FROM pull_state WHERE status = 'ok' AND rows > 0 AND date >= ?`,
      )
      .bind(sinceDate)
      .first<{ c: number }>();
    pullOkInWindow = Number(ok?.c || 0) > 0;
  } catch {
    /* pull_state 缺失/迁移未跑 → 保守 false，绝不阻断 */
  }

  // 数据源 A：pull_state degraded（GA4 持续 0 行等）→ 直接归 external（摄取断裂多为外部权限/访问）
  try {
    const deg = await db
      .prepare(
        `SELECT source, date FROM pull_state WHERE status = 'degraded' AND date >= ? ORDER BY date DESC LIMIT 20`,
      )
      .bind(sinceDate)
      .all();
    for (const r of deg.results as { source: string; date: string }[]) {
      const tag = `${r.source}/${r.date}`;
      if (!degradedSources.includes(tag)) degradedSources.push(tag);
      const cls = classifySignal(`${r.source} degraded 摄取中断`, pullOkInWindow);
      signals.push({
        bucket: cls.bucket,
        source: "pull_state",
        text: clip(`pull_state degraded: ${tag}`),
        matched: cls.matched || r.source,
      });
    }
  } catch {
    /* 表缺失 → 0 信号 */
  }

  // 数据源 B：task_runs failed
  try {
    const runs = await db
      .prepare(
        `SELECT idempotency_key, detail FROM task_runs
         WHERE status = 'failed' AND started_at >= ?
         ORDER BY started_at DESC LIMIT 40`,
      )
      .bind(since)
      .all();
    for (const r of runs.results as { idempotency_key: string; detail: string | null }[]) {
      const text = `${r.idempotency_key || ""} ${r.detail || ""}`.trim();
      if (!text) continue;
      const cls = classifySignal(text, pullOkInWindow);
      signals.push({
        bucket: cls.bucket,
        source: "task_runs",
        text: clip(text),
        matched: cls.matched,
      });
    }
  } catch {
    /* 表缺失 → 0 信号 */
  }

  // 数据源 C：ai_missions blocked
  try {
    const missions = await db
      .prepare(
        `SELECT mission_type, agent_name, blocked_reason, error_message FROM ai_missions
         WHERE status = 'blocked' AND created_at >= ?
         ORDER BY created_at DESC LIMIT 40`,
      )
      .bind(since)
      .all();
    for (const r of missions.results as {
      mission_type: string;
      agent_name: string | null;
      blocked_reason: string | null;
      error_message: string | null;
    }[]) {
      const text =
        `${r.agent_name || ""}/${r.mission_type || ""}: ${r.blocked_reason || r.error_message || ""}`.trim();
      if (!text) continue;
      const cls = classifySignal(text, pullOkInWindow);
      signals.push({
        bucket: cls.bucket,
        source: "ai_missions",
        text: clip(text),
        matched: cls.matched,
      });
    }
  } catch {
    /* 表缺失 → 0 信号 */
  }

  // 数据源 D：ai_action_logs success=0（步骤级失败）
  try {
    const logs = await db
      .prepare(
        `SELECT action_type, tool_used, error_message FROM ai_action_logs
         WHERE success = 0 AND created_at >= ?
         ORDER BY created_at DESC LIMIT 40`,
      )
      .bind(since)
      .all();
    for (const r of logs.results as {
      action_type: string;
      tool_used: string | null;
      error_message: string | null;
    }[]) {
      const text = `${r.action_type || ""} ${r.tool_used || ""}: ${r.error_message || ""}`.trim();
      if (!text) continue;
      const cls = classifySignal(text, pullOkInWindow);
      signals.push({
        bucket: cls.bucket,
        source: "action_logs",
        text: clip(text),
        matched: cls.matched,
      });
    }
  } catch {
    /* 表缺失 → 0 信号 */
  }

  // 汇总 + 每桶样例
  for (const s of signals) {
    totals[s.bucket]++;
    if (examples[s.bucket].length < MAX_EXAMPLES_PER_BUCKET) {
      examples[s.bucket].push(s.matched ? `[${s.matched}] ${s.text}` : s.text);
    }
  }

  const signalCount = signals.length;
  const cleanOfOwnFaults = totals.system === 0 && totals.true_fail === 0;

  // 一句话人读摘要
  const summary = buildSummary(totals, signalCount, degradedSources, cleanOfOwnFaults);
  // PHASE E：调参/排查建议（仅建议，绝不自动改阈值/配置）
  const advisories = buildAdvisories(totals, degradedSources);

  return {
    window_days: windowDays,
    totals,
    signal_count: signalCount,
    examples,
    degraded_sources: degradedSources,
    summary,
    clean_of_own_faults: cleanOfOwnFaults,
    advisories,
  };
}

/**
 * PHASE E：把分桶结果翻译成「可执行建议」。铁律：只给建议，绝不自动改任何阈值/配置
 * （自动调参属未经验证的动作，违反真实性红线）。阈值类建议明确指向 ORPHAN_SEC 供人工定夺。
 */
function buildAdvisories(
  totals: Record<HealthBucket, number>,
  degradedSources: string[],
): string[] {
  const out: string[] = [];
  // 慢成功误杀偏多 → 孤儿扫描阈值可能过短，建议人工上调 ORPHAN_SEC（当前 5400s/90min）。
  if (totals.slow_success >= 3) {
    out.push(
      `近 7 天 ${totals.slow_success} 条「慢成功被孤儿扫描误杀」：数据其实已落库却被标 failed/blocked。建议人工上调 mission-log.ts 的 ORPHAN_SEC（当前 90min），或核对相关 mission 为何长期 running——系统不会自动改阈值。`,
    );
  }
  // 假失败偏多 → 孤儿清理产物噪音大，建议核对触发频率/执行时长。
  if (totals.false_fail >= 5) {
    out.push(
      `近 7 天 ${totals.false_fail} 条「孤儿扫描假失败」：多为执行环境被中断的清理产物，非真故障。若持续偏高，建议核对 cron 触发频率与任务实际时长，避免正常慢任务被反复清理。`,
    );
  }
  // 外部依赖降级源 → 指向具体排查动作（权限/密钥），不改代码。
  if (degradedSources.length > 0) {
    out.push(
      `数据源摄取降级（${degradedSources.slice(0, 3).join("、")}）：多为第三方权限/访问问题。建议核对对应服务账号权限与密钥；系统已保证修复前不伪造数据。`,
    );
  }
  return out;
}

function buildSummary(
  totals: Record<HealthBucket, number>,
  signalCount: number,
  degradedSources: string[],
  cleanOfOwnFaults: boolean,
): string {
  if (signalCount === 0) {
    return "近 7 天无失败信号：任务/拉取/动作日志均未见 failed/blocked/degraded。";
  }
  const parts: string[] = [];
  if (totals.system > 0) parts.push(`自有故障 ${totals.system}（D1/KV/R2/SQL/迁移，需修代码）`);
  if (totals.true_fail > 0) parts.push(`真实失败 ${totals.true_fail}（需人看一眼）`);
  if (totals.external > 0)
    parts.push(`外部依赖 ${totals.external}（GA4/GSC/邮件/AI 等，非我方可直接修）`);
  if (totals.slow_success > 0) parts.push(`慢成功误杀 ${totals.slow_success}（数据其实已落库）`);
  if (totals.false_fail > 0) parts.push(`假失败 ${totals.false_fail}（孤儿扫描清理产物）`);
  if (degradedSources.length > 0)
    parts.push(`摄取降级源：${degradedSources.slice(0, 3).join("、")}`);

  const head = cleanOfOwnFaults
    ? "本次红/黄主要来自外部依赖或清理产物，非自有代码故障——不必紧急改代码，先核对第三方权限/密钥。"
    : "本次红/黄含自有故障或真实失败，需优先排查 system / true_fail 桶。";
  return `${head} 明细：${parts.join("；") || "无"}。`;
}
