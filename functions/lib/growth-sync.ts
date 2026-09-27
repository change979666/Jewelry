// ---------------------------------------------------------------------------
//  Aromiso V5.34→V5.35 — Organic Growth Intelligence · Sync Core
//
//  runGrowthSync：GSC 快照（gsc_daily / gsc_query_page）→ 机会引擎 →
//  growth_opportunities（按周去重）→ 头部机会按 Growth Score 排序路由为任务
//  → Index Monitor 抽样（URL Inspection，≤20/次，无凭证优雅跳过）
//  → Shopping 齐备度审计（featured 商品）。
//
//  V5.35 新增（docs/ORGANIC_GROWTH_AGENT_PHASE2.md）：
//   - Technical Audit 合并（growth-audit.ts：canonical/hreflang/meta/h1/
//     JSON-LD/alt/死链/孤页/sitemap），与 GSC 机会同表同排序；
//   - 任务路由：autofix 开关（KV config:growth_autofix_enabled，默认关）——
//     关闭时全部走 growth_review L2 人工审核；开启时仅 internal_link /
//     alt_text_fill / meta_fix 三类路由到已注册 L3（复用权限闸门）；
//   - Experiment 闭环：机会任务完成 → 自动捕获 before 快照入 growth_actions
//     （T+14 验证窗口）→ 到期自动对比 GSC 前后数据 → outcome 三态。
//
//  安全边界（docs/ORGANIC_GROWTH_DESIGN.md 横幅）：
//   - 只读 Google 数据 + 读自家站点 HTML + 写内部账本，绝不刷搜索/刷点击；
//   - 不自动写生产内容：修复只「检测 + 路由」，执行走既有任务权限体系；
//   - C 级（商业字段）任务文案明确「owner 提供，AI 不得自填」。
// ---------------------------------------------------------------------------

import type { Env } from "../types";
import { runGrowthEngine, shortPage, scoreOpportunity } from "./growth-engine";
import type {
  Opportunity,
  PageAgg,
  QueryPageAgg,
  IndexEntry,
  ShoppingProduct,
} from "./growth-engine";
import { runTechnicalAudit, pMap } from "./growth-audit";
import { getAccessToken, inspectUrl } from "../api/admin/google";
import type { UrlInspection } from "../api/admin/google";
import { enforceMode } from "./permissions";
import { getActionBudgetConfig, getBudgetUsage, checkCreationBudget } from "./action-budget";
import { runDecisionLayer, type DecisionLayerStats } from "./decision-layer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D1Row = Record<string, any>;

/** Safe Auto-Fix 路由开关（默认关；"on" 时仅可逆低风险技术任务路由到已注册 L3）。 */
export const KV_AUTOFIX_KEY = "config:growth_autofix_enabled";
// P0-3 灰度闸：即便开关打开，也只允许【可逆、低风险】的内链/Alt 补填自动执行。
// meta_fix 刻意排除（可逆性不足、更靠近商业/SEO 字段）——永远走人工审核，任何开关都打不开。
const AUTOFIX_TASK_TYPES = new Set(["internal_link", "alt_text_fill"]);
// P0-3 灰度闸：单轮自动执行样本上限（<=5）。默认不全量打开；先用小样本 + Won/Lost
// ground truth 验证有效性，再考虑扩大。与 Action Budget 的 per_mission_max 取较小值。
const AUTOFIX_GRAY_RUN_MAX = 5;

export interface GrowthSyncResult {
  opps: number;
  inserted: number;
  tasks: number;
  inspected: number;
  shoppingChecked: number;
  audited: number; // V5.35：技术审计 findings 数
  expCaptured: number; // V5.35：新捕获实验数
  expEvaluated: number; // V5.35：到期验证实验数
  /** V5.70：AI Decision Layer 本轮裁决统计（B/C 机会自动 PASS/REJECT/BLOCK）。 */
  decision: DecisionLayerStats;
  notes: string[];
}

/** 周一日期作为周去重键（YYYY-MM-DD）。 */
export function weekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay() || 7; // 周日=7
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

// CF Free 计划每次调用仅 50 个子请求（Workers limits）。growth 阶段预算：
// sitemap ~6 + 审计页 10 + 死链 15 + Inspection 12 = 43 ≤ 50，留余量。
const INSPECT_LIMIT = 12;
const TASK_LIMIT = 12;

export async function runGrowthSync(env: Env, dateStr: string): Promise<GrowthSyncResult> {
  const db = env.DB;
  const notes: string[] = [];
  if (!db)
    return {
      opps: 0,
      inserted: 0,
      tasks: 0,
      inspected: 0,
      shoppingChecked: 0,
      audited: 0,
      expCaptured: 0,
      expEvaluated: 0,
      decision: emptyDecisionStats(),
      notes: ["no DB"],
    };

  const since = `${dateStr}T00:00:00Z`;
  const sinceDate = new Date(new Date(since).getTime() - 27 * 86400000).toISOString().slice(0, 10);
  const week = weekKey(dateStr);
  const nowTs = Math.floor(Date.now() / 1000);

  // ---- 1) 28 天聚合 ---------------------------------------------------------
  const [pageRes, qpRes] = await Promise.all([
    db
      .prepare(
        `SELECT key AS page, SUM(clicks) AS clicks, SUM(impressions) AS impressions,
                AVG(ctr) AS ctr, AVG(position) AS position
         FROM gsc_daily WHERE dimension = 'page' AND date >= ?
         GROUP BY key HAVING SUM(impressions) > 0`,
      )
      .bind(sinceDate)
      .all(),
    db
      .prepare(
        `SELECT query, page, SUM(clicks) AS clicks, SUM(impressions) AS impressions,
                AVG(ctr) AS ctr, AVG(position) AS position
         FROM gsc_query_page WHERE date >= ?
         GROUP BY query, page HAVING SUM(impressions) > 0`,
      )
      .bind(sinceDate)
      .all(),
  ]);

  const pages: PageAgg[] = (pageRes.results as D1Row[]).map((r) => ({
    page: String(r.page),
    clicks: Number(r.clicks),
    impressions: Number(r.impressions),
    ctr: Number(r.ctr),
    position: Number(r.position),
  }));
  const queryPages: QueryPageAgg[] = (qpRes.results as D1Row[]).map((r) => ({
    query: String(r.query),
    page: String(r.page),
    clicks: Number(r.clicks),
    impressions: Number(r.impressions),
    ctr: Number(r.ctr),
    position: Number(r.position),
  }));

  if (pages.length === 0) {
    notes.push("no GSC data in last 28d — engine skipped");
    const exp = await runExperimentCycle(db, dateStr, sinceDate, nowTs, notes);
    return {
      opps: 0,
      inserted: 0,
      tasks: 0,
      inspected: 0,
      shoppingChecked: 0,
      audited: 0,
      expCaptured: exp.captured,
      expEvaluated: exp.evaluated,
      decision: emptyDecisionStats(),
      notes,
    };
  }

  // ---- 2) Index Monitor 抽样（无凭证/失败 → 跳过，不阻塞） --------------------
  const indexStatuses: IndexEntry[] = [];
  let inspected = 0;
  try {
    const token = await getAccessToken(env);
    const topPages = [...pages]
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 15)
      .map((p) => p.page);
    const prevIssues = (
      (await db.prepare(`SELECT url FROM index_status WHERE status != 'indexed'`).all())
        .results as D1Row[]
    ).map((r) => String(r.url));
    const urls = [...new Set([...topPages, ...prevIssues])].slice(0, INSPECT_LIMIT);
    // V5.361：限并发批量调用（此前 20 次串行会把 growth 阶段堆过 CF 边缘 100s 超时）
    const inspectResults = await pMap(
      urls,
      async (url): Promise<{ r?: UrlInspection; err?: string }> => {
        try {
          return { r: await inspectUrl(env, token, url) };
        } catch (e) {
          return {
            err: `inspect failed: ${shortPage(url)} (${e instanceof Error ? e.message : e})`,
          };
        }
      },
      4,
    );
    for (const { r, err } of inspectResults) {
      if (err) {
        notes.push(err);
        continue;
      }
      if (!r) continue;
      try {
        await db
          .prepare(
            `INSERT INTO index_status (url, status, detail, inspected_at) VALUES (?, ?, ?, ?)
             ON CONFLICT(url) DO UPDATE SET status = excluded.status, detail = excluded.detail,
               inspected_at = excluded.inspected_at`,
          )
          .bind(r.url, r.status, r.detail, nowTs)
          .run();
        indexStatuses.push({ url: r.url, status: r.status });
        inspected++;
      } catch {
        /* 单条落库失败不阻塞 */
      }
    }
  } catch (e) {
    notes.push(`index monitor skipped: ${e instanceof Error ? e.message : e}`);
    // 降级：沿用上次快照
    const prev = (await db.prepare(`SELECT url, status FROM index_status`).all())
      .results as D1Row[];
    for (const r of prev) indexStatuses.push({ url: String(r.url), status: String(r.status) });
  }

  // ---- 3) Shopping 齐备度审计（featured 商品 = GSC 建议的 20 个展示位候选） -------
  const shoppingRows = (
    await db
      .prepare(
        `SELECT p.slug, p.title, p.description, p.cover_image, p.status,
                (SELECT COUNT(*) FROM commerce_price_tiers t WHERE t.product_id = p.id) AS tiers,
                (SELECT COUNT(*) FROM product_merchandising m
                  WHERE m.product_id = p.id AND m.placement_type = 'featured'
                    AND m.status = 'active') AS featured
         FROM commerce_products p WHERE p.status = 'active'
           AND (featured > 0 OR tiers > 0)
         ORDER BY featured DESC, tiers DESC LIMIT 40`,
      )
      .all()
  ).results as D1Row[];

  const shopping: ShoppingProduct[] = shoppingRows.map((r) => {
    const missingTech: string[] = [];
    if (!r.cover_image) missingTech.push("image");
    if (!r.description) missingTech.push("description");
    if (!r.title) missingTech.push("title");
    if (Number(r.tiers) === 0) missingTech.push("price");
    return {
      slug: String(r.slug),
      title: String(r.title),
      featured: Number(r.featured) > 0,
      missingTech,
      // V5.391：业务字段已有确定性策略，不再无条件标记缺失（原写法每轮固定产出
      // exec-level-C「需 owner」误报）：brand 自有目录默认 "Aromiso"（可核实的自有品牌事实）；
      // GTIN 无注册条码的 OEM/定制商品按 Google Merchant 规则声明 identifier_exists=false，
      // 绝不伪造条码。故 missingBiz 恒为空。
      missingBiz: [],
    };
  });

  // ---- 4) 机会引擎 + V5.35 Technical Audit 合并 -------------------------------
  const opps = runGrowthEngine({ queryPages, pages, indexStatuses, shopping });

  let audited = 0;
  try {
    const topPages = [...pages]
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10)
      .map((p) => p.page);
    const audit = await runTechnicalAudit({ priorityUrls: topPages });
    const findings = audit.findings
      .sort((a, b) => a.priority.localeCompare(b.priority))
      .slice(0, 40);
    for (const f of findings) {
      const o: Opportunity = { ...f, intent: null };
      o.score = scoreOpportunity(o);
      opps.push(o);
    }
    audited = findings.length;
    notes.push(
      `tech audit: ${audit.pagesChecked} pages / ${audit.sitemapUrls} sitemap urls → ${findings.length} findings`,
    );
    notes.push(...audit.notes);
    // 与 GSC 机会统一按 Growth Score 排序（protect 沉底）
    opps.sort(
      (a, b) =>
        (a.opp_type === "protect" ? 1 : 0) - (b.opp_type === "protect" ? 1 : 0) ||
        (b.score?.score ?? 0) - (a.score?.score ?? 0),
    );
  } catch (e) {
    notes.push(`tech audit skipped: ${e instanceof Error ? e.message : e}`);
  }

  // ---- 5) 按周去重落库 + 头部机会按得分路由为任务 -------------------------------
  // autofix 开关（默认关）：关闭时全部 growth_review（L2 人工审核）；
  // 开启时仅【可逆低风险】的 internal_link / alt_text_fill 路由到已注册 L3 任务类型
  // （meta_fix 永不自动，权限闸门仍由 enforceMode 裁定）；且受灰度样本上限约束。
  let autofixOn: boolean;
  try {
    autofixOn = (await env.DRAFTS?.get(KV_AUTOFIX_KEY)) === "on";
  } catch {
    autofixOn = false;
  }

  // V5.37 Action Budget：路由前取预算配置 + 当日用量。
  // 超「分类型日额度」或「单轮额度（per_mission_max）」→ 降级 growth_review
  // 人工审核，不丢弃机会；统计查询失败时同样走人工路径（fail-safe）。
  const budgetCfg = await getActionBudgetConfig(env.DRAFTS);
  // 注意：dateStr 是 T-2 数据日；预算按「今天」（UTC）计，任务 created_at 是当下。
  const budgetUsage = await getBudgetUsage(db, new Date().toISOString().slice(0, 10));
  // P0-3 灰度闸：单轮自动任务样本上限 = min(Action Budget 单轮额度, 5)。默认不全量打开。
  const grayRunCap = Math.min(budgetCfg.per_mission_max, AUTOFIX_GRAY_RUN_MAX);
  const localAutoCreated: Record<string, number> = {};
  let autoTasksThisRun = 0;
  let budgetDowngrades = 0;

  let inserted = 0;
  let tasks = 0;
  for (const o of opps) {
    const existing = await db
      .prepare(
        `SELECT id, status FROM growth_opportunities
         WHERE week = ? AND opp_type = ? AND page = ? AND query = ?`,
      )
      .bind(week, o.opp_type, o.page, o.query)
      .first();
    let oppId: number;
    if (existing) {
      oppId = Number((existing as D1Row).id);
      await db
        .prepare(
          `UPDATE growth_opportunities
           SET priority = ?, metrics_json = ?, intent = ?, score_json = ? WHERE id = ?`,
        )
        .bind(
          o.priority,
          JSON.stringify(o.metrics),
          o.intent || "",
          JSON.stringify(o.score || {}),
          oppId,
        )
        .run();
    } else {
      const ins = await db
        .prepare(
          `INSERT INTO growth_opportunities
             (week, opp_type, page, query, priority, exec_level, reason, suggested_action,
              metrics_json, status, created_at, intent, score_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`,
        )
        .bind(
          week,
          o.opp_type,
          o.page,
          o.query,
          o.priority,
          o.exec_level,
          o.reason,
          o.suggested_action,
          JSON.stringify(o.metrics),
          nowTs,
          o.intent || "",
          JSON.stringify(o.score || {}),
        )
        .run();
      inserted++;
      oppId = Number(ins.meta.last_row_id);
    }

    // 头部非 protect 机会 → 任务（按得分从高到低消耗预算；protect = NO ACTION 不建任务）
    if (o.opp_type !== "protect" && tasks < TASK_LIMIT) {
      const idem = `task:growth:${week}:${o.opp_type}:${shortPage(o.page)}:${o.query}`.slice(
        0,
        190,
      );
      const dup = await db
        .prepare(`SELECT id FROM tasks WHERE idempotency_key = ?`)
        .bind(idem)
        .first();
      if (!dup) {
        let taskType = "growth_review";
        if (autofixOn && o.fix_type && AUTOFIX_TASK_TYPES.has(o.fix_type)) {
          // V5.37 Action Budget：单轮额度 + 分类型日额度双重闸。
          // P0-3 灰度闸：单轮额度收紧为 grayRunCap（<=5，小样本）。
          // 超额或用量统计不可用（ok=false）→ 保持 growth_review 人工审核。
          if (autoTasksThisRun >= grayRunCap || !budgetUsage.ok) {
            budgetDowngrades++;
          } else {
            const cb = checkCreationBudget(
              budgetCfg,
              budgetUsage,
              o.fix_type,
              localAutoCreated[o.fix_type] || 0,
            );
            if (cb.allowed) {
              taskType = o.fix_type;
              localAutoCreated[o.fix_type] = (localAutoCreated[o.fix_type] || 0) + 1;
              autoTasksThisRun++;
            } else {
              budgetDowngrades++;
            }
          }
        }
        const enforced = enforceMode(taskType);
        const scoreLine = o.score
          ? `\nGrowth Score：${o.score.score}（impact ${o.score.impact} / effort ${o.score.effort} / confidence ${o.score.confidence} / risk ${o.score.risk}）`
          : "";
        const taskIns = await db
          .prepare(
            `INSERT INTO tasks (title, detail, roi_score, impact, difficulty, business_reason,
                                knowledge_refs, priority, expected_result, status, created_at,
                                task_type, executor, execution_mode, idempotency_key, payload)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            `增长看板（Growth Board）${o.priority}：${o.opp_type} ${shortPage(o.page)}`,
            `${o.reason}\n建议动作：${o.suggested_action}\n执行级别：${o.exec_level}（A 技术项 / B 进审核 / C owner 确认）${scoreLine}`,
            Math.min(100, Math.round(o.score?.score ?? 0)),
            o.priority === "P0" ? "high" : "medium",
            "low",
            "V5.35 Organic Growth Agent：从发现机会到执行可验证的自然增长动作（Demand Generation 引擎）",
            "docs/ORGANIC_GROWTH_AGENT_PHASE2.md",
            o.priority,
            o.suggested_action,
            nowTs,
            taskType,
            "growth_review",
            enforced,
            idem,
            JSON.stringify({ opp_id: oppId, ...o }),
          )
          .run();
        await db
          .prepare(`UPDATE growth_opportunities SET task_id = ? WHERE id = ?`)
          .bind(Number(taskIns.meta.last_row_id), oppId)
          .run();
        tasks++;
      }
    }
  }
  notes.push(
    `action budget: 本轮 ${autoTasksThisRun} 个 L3 自动任务${
      budgetDowngrades > 0 ? `，${budgetDowngrades} 个超预算转人工审核` : ""
    }（灰度上限单轮 ≤${grayRunCap}；仅 internal_link/alt_text_fill 可自动，meta_fix 永不自动；日上限 meta ${budgetCfg.per_type_daily.meta_fix} / alt ${budgetCfg.per_type_daily.alt_text_fill} / link ${budgetCfg.per_type_daily.internal_link}）`,
  );

  // ---- 6) V5.35 Experiment 闭环：捕获 + T+14 验证 ------------------------------
  const exp = await runExperimentCycle(db, dateStr, sinceDate, nowTs, notes);

  // ---- 7) V5.70 AI Decision Layer：B/C 机会自动裁决（PASS/REJECT/BLOCK）---------
  // 先成功落库，再裁决（owner 指令 §四）。失败绝不拖垮数据管道——
  // 机会保持 status='new'，下一轮 tick 自然重试（无内部 retry 循环）。
  let decision: DecisionLayerStats = emptyDecisionStats();
  try {
    decision = await runDecisionLayer(db, { now: nowTs });
    notes.push(
      `decision layer: 扫描 ${decision.scanned} → PASS ${decision.passed} / REJECT ${decision.rejected} / BLOCK ${decision.blocked} / 去重 ${decision.duplicates}${
        decision.truncated ? "（达批量上限，下轮继续）" : ""
      }${decision.errors.length ? `；异常：${decision.errors.join("; ")}` : ""}`,
    );
  } catch (e) {
    decision.errors.push(e instanceof Error ? e.message : String(e));
    notes.push(`decision layer skipped: ${e instanceof Error ? e.message : e}`);
  }

  return {
    opps: opps.length,
    inserted,
    tasks,
    inspected,
    shoppingChecked: shopping.length,
    audited,
    expCaptured: exp.captured,
    expEvaluated: exp.evaluated,
    decision,
    notes,
  };
}

/** V5.70：空 Decision Layer 统计（早退路径占位，保持返回结构一致）。 */
function emptyDecisionStats(): DecisionLayerStats {
  return {
    scanned: 0,
    passed: 0,
    rejected: 0,
    blocked: 0,
    duplicates: 0,
    casLost: 0,
    errors: [],
    truncated: false,
    dryRun: false,
  };
}

// ---- V5.35 Experiment & Outcome Learning ------------------------------------
// 概念：一个「动作」= 一个实验。任务被路由时记录 before 基线，T+14 到期后
// 对比同一 page（或 query+page）的 GSC 前后数据，落 outcome（三态），
// 让「动一个 → 看结果 → 学会」成为结构化记忆（growth_actions 表）。

const VERIFY_DAYS = 14;

/** 读取某页（或 query+page）近 28 天的 GSC 汇总，作为实验前/后快照。 */
async function gscSnapshot(
  db: D1Database,
  page: string,
  query: string,
  sinceDate: string,
): Promise<{ clicks: number; impressions: number; rows: number }> {
  // S10：额外返回匹配行数 rows，用于区分「窗口内 0 行（无数据）」与「有行但点击真的为 0」，
  // 避免把「读不到数据」误判成「点击回落 → negative」。
  if (query) {
    const r = await db
      .prepare(
        `SELECT COUNT(*) AS cnt, SUM(clicks) AS clicks, SUM(impressions) AS impressions
         FROM gsc_query_page WHERE page = ? AND query = ? AND date >= ?`,
      )
      .bind(page, query, sinceDate)
      .first<D1Row>();
    return {
      clicks: Number(r?.clicks || 0),
      impressions: Number(r?.impressions || 0),
      rows: Number(r?.cnt || 0),
    };
  }
  const r = await db
    .prepare(
      `SELECT COUNT(*) AS cnt, SUM(clicks) AS clicks, SUM(impressions) AS impressions
       FROM gsc_daily WHERE dimension = 'page' AND key = ? AND date >= ?`,
    )
    .bind(page, sinceDate)
    .first<D1Row>();
  return {
    clicks: Number(r?.clicks || 0),
    impressions: Number(r?.impressions || 0),
    rows: Number(r?.cnt || 0),
  };
}

function addDays(dateStr: string, days: number): string {
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + days * 86400000)
    .toISOString()
    .slice(0, 10);
}

export interface ExperimentCycleResult {
  captured: number;
  evaluated: number;
}

/**
 * Experiment 闭环：
 *  ① 捕获：已路由任务（task_id 非空）且状态进入 done/applied，但尚未建实验记录
 *     → 记录 before 快照 + verify_after（T+14）。
 *  ② 验证：到期（verify_after ≤ 今天）且 outcome 为空 → 对比 after，落三态。
 */
export async function runExperimentCycle(
  db: D1Database,
  dateStr: string,
  sinceDate: string,
  nowTs: number,
  notes: string[],
): Promise<ExperimentCycleResult> {
  let captured = 0;
  let evaluated = 0;

  // ① 捕获：任务已完成的非 protect 机会（一次性，建过实验就不再重复）
  try {
    const done = (
      await db
        .prepare(
          `SELECT o.id, o.page, o.query, o.suggested_action, o.exec_level, t.status AS task_status
           FROM growth_opportunities o
           JOIN tasks t ON t.id = o.task_id
           WHERE o.opp_type != 'protect'
             AND o.task_id IS NOT NULL
             AND t.status IN ('done', 'applied', 'closed')
             AND NOT EXISTS (SELECT 1 FROM growth_actions g WHERE g.opp_id = o.id)
           LIMIT 20`,
        )
        .all()
    ).results as D1Row[];
    for (const r of done) {
      const before = await gscSnapshot(db, String(r.page), String(r.query || ""), sinceDate);
      await db
        .prepare(
          `INSERT INTO growth_actions (opp_id, action, exec_level, applied_at, before_json, after_json, verify_after, outcome)
           VALUES (?, ?, ?, ?, ?, '{}', ?, NULL)`,
        )
        .bind(
          Number(r.id),
          String(r.suggested_action || "").slice(0, 500),
          String(r.exec_level || "B"),
          nowTs,
          JSON.stringify(before),
          addDays(dateStr, VERIFY_DAYS),
        )
        .run();
      captured++;
    }
    if (captured > 0) notes.push(`experiments captured: ${captured}`);
  } catch (e) {
    notes.push(`experiment capture skipped: ${e instanceof Error ? e.message : e}`);
  }

  // ② 验证：到期实验对比前后数据
  try {
    const due = (
      await db
        .prepare(
          `SELECT g.id, g.opp_id, g.before_json, o.page, o.query
           FROM growth_actions g JOIN growth_opportunities o ON o.id = g.opp_id
           WHERE g.outcome IS NULL AND g.verify_after IS NOT NULL AND g.verify_after <= ?
           LIMIT 20`,
        )
        .bind(dateStr)
        .all()
    ).results as D1Row[];
    for (const r of due) {
      // S11：before_json 损坏/缺失时，旧的 safeParse 会塌缩成 {} → bClicks=0 → 伪造 positive。
      // 改用严格 parseBefore：解析失败或无有效数值基线 → 跳过对比，绝不判 positive/verified。
      const before = parseBefore(r.before_json);
      if (!before.ok) {
        await db
          .prepare(
            `UPDATE growth_actions SET after_json = ?, outcome = 'insufficient_data' WHERE id = ?`,
          )
          .bind(JSON.stringify({ skipped: true, reason: "before_json_unparseable" }), Number(r.id))
          .run();
        evaluated++;
        notes.push(
          `experiment #${r.id} insufficient_data: before_json 损坏/缺失，跳过对比（不伪造 positive，S11）`,
        );
        continue; // 不同步机会状态（既不 verified 也不 skipped）
      }

      const after = await gscSnapshot(db, String(r.page), String(r.query || ""), sinceDate);

      // S10：after 窗口 0 行 = 无数据（GSC 未覆盖/未同步），不是「点击回落」。
      // 判 insufficient_data，绝不判 negative 把有效实验静默关闭。
      if (after.rows === 0) {
        await db
          .prepare(
            `UPDATE growth_actions SET after_json = ?, outcome = 'insufficient_data' WHERE id = ?`,
          )
          .bind(JSON.stringify({ ...after, reason: "no_gsc_rows_in_after_window" }), Number(r.id))
          .run();
        evaluated++;
        notes.push(
          `experiment #${r.id} insufficient_data: after 窗口 0 行 GSC 数据（不判 negative，S10）`,
        );
        continue; // 不同步机会状态为 skipped
      }

      const bClicks = before.clicks;
      const bImpr = before.impressions;
      const aClicks = Number(after.clicks || 0);
      const aImpr = Number(after.impressions || 0);
      // 三态判定：点击或曝光显著提升 = positive；双双回落 = negative；否则 no_effect
      let outcome = "no_effect";
      if (aClicks > bClicks || (bImpr > 0 && aImpr >= bImpr * 1.2) || (bImpr === 0 && aImpr > 0)) {
        outcome = "positive";
      } else if (aClicks < bClicks || (bImpr > 0 && aImpr < bImpr * 0.8)) {
        outcome = "negative";
      }
      await db
        .prepare(`UPDATE growth_actions SET after_json = ?, outcome = ? WHERE id = ?`)
        .bind(JSON.stringify(after), outcome, Number(r.id))
        .run();
      // 同步机会状态，便于看板展示
      await db
        .prepare(`UPDATE growth_opportunities SET status = ? WHERE id = ?`)
        .bind(
          outcome === "positive" ? "verified" : outcome === "negative" ? "skipped" : "applied",
          Number(r.opp_id),
        )
        .run();
      evaluated++;
      notes.push(`experiment #${r.id} verified: ${outcome}`);
    }
  } catch (e) {
    notes.push(`experiment evaluation skipped: ${e instanceof Error ? e.message : e}`);
  }

  return { captured, evaluated };
}

/**
 * S11：严格解析实验 before 基线。损坏/缺失/非对象/无数值字段 → { ok:false }，
 * 调用方据此跳过对比，绝不用 {} 兜底把 bClicks 当成 0 从而伪造 positive。
 */
function parseBefore(
  s: string | null | undefined,
): { ok: true; clicks: number; impressions: number } | { ok: false } {
  if (!s) return { ok: false };
  let v: unknown;
  try {
    v = JSON.parse(s);
  } catch {
    return { ok: false };
  }
  if (!v || typeof v !== "object") return { ok: false };
  const o = v as Record<string, unknown>;
  // 必须含至少一个数值基线字段，否则视为无效基线（例如损坏后被写成 {}）
  if (typeof o.clicks !== "number" && typeof o.impressions !== "number") return { ok: false };
  return { ok: true, clicks: Number(o.clicks || 0), impressions: Number(o.impressions || 0) };
}

export type { Opportunity };
