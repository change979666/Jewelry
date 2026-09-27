// ---------------------------------------------------------------------------
//  Aromiso V5.70 — AI Decision Layer（运行时代码，非文档）
//  functions/lib/decision-layer.ts
//
//  owner 2026-09-13 指令落地：
//    Detect → AI Decision Layer → PASS / FIX / REJECT / BLOCK
//           → Execute/Skip → Verify → Record → Prevent
//
//  职责：把 growth_opportunities 中 status='new' AND exec_level IN ('B','C')
//  的正常机会自动裁决，不再挂 NEEDS-YOU 人工队列。
//
//  铁律（与 permissions.ts / truthfulness.ts / action-budget.ts 并列）：
//    - 白名单制：只有明确登记的 (opp_type, exec_level) 才允许自动 PASS；
//      不认识的一律 BLOCK（宁可 BLOCK，不允许为了「减少人工任务」强行 PASS）。
//    - 业务真实性红线不可绕过：命中 fact-registry 红线 → REJECT + 结构化原因。
//    - PASS ≠ 执行：PASS 只把机会标 verified（AI 确认有效，排队等待执行授权）；
//      SEO 自动写回仍受既有「暂不执行」约束，本层绝不解锁。
//    - BLOCK 是少量真正异常兜底，不是新的常规 NEEDS-YOU 队列。
//
//  D1 成本安全（硬约束）：
//    - 单次批量上限 DECISION_BATCH_LIMIT（默认 50），达到即停，下轮继续。
//    - 扫描走 idx_growth_opp_status_exec 复合索引，LIMIT 收敛，无全表扫描。
//    - 指纹去重用单条 IN(...) 批量查询，杜绝 N+1。
//    - 写入用 db.batch([...]) 原子批，一条 opportunity 最多 1 INSERT + 1 CAS UPDATE。
//    - CAS：UPDATE ... WHERE id=? AND status='new' → 并发裁决最多一个命中。
//    - fingerprint UNIQUE 部分索引 → INSERT OR IGNORE → 重复决策零写入。
//    - 无内部 retry 循环：失败如实记账，下一轮 tick 自然重试（幂等地基兜底）。
// ---------------------------------------------------------------------------

import { FACT_REGISTRY, checkClaims } from "./truthfulness";
import { enforceMode } from "./permissions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D1Row = Record<string, any>;

// ---- 决策语义 ----------------------------------------------------------------

export type Decision = "PASS" | "FIX_THEN_PASS" | "REJECT" | "BLOCK";

/** 决策落库后的 opportunity 终态（BLOCK 不改状态，留在异常队列）。 */
export type DecisionStatus = "verified" | "skipped";

export interface OpportunityRow {
  id: number;
  week: string;
  opp_type: string;
  page: string;
  query: string;
  priority: string;
  exec_level: string;
  reason: string;
  suggested_action: string;
  metrics_json: string;
  intent: string;
  score_json: string;
  status: string;
  task_id: number | null;
  created_at: number;
}

export interface DecisionResult {
  decision: Decision;
  /** PASS/FIX → verified；REJECT → skipped；BLOCK → null（不改状态）。 */
  status: DecisionStatus | null;
  reason: string;
  violated_rule: string;
  detected_problem: string;
  suggested_fix: string;
  prevention_rule: string;
  fingerprint: string;
}

export interface DecisionLayerStats {
  scanned: number;
  passed: number;
  rejected: number;
  blocked: number;
  /** 指纹已存在（跨周重复 / 并发裁决）→ 复用既有决策，不新建。 */
  duplicates: number;
  /** CAS UPDATE 命中 0 行（被并发或旧逻辑抢先改状态）。 */
  casLost: number;
  errors: string[];
  /** 本轮是否因达到 batch limit 而提前停止（下轮继续）。 */
  truncated: boolean;
  dryRun: boolean;
}

// ---- 批量上限（D1 成本硬约束）-------------------------------------------------

/**
 * 单次 Decision Layer 运行最多裁决的 opportunity 数。
 * 依据：Automation Tick ~20min 一轮 → 50/轮 = 150/h = 3600/day 上限；
 * 当前真实队列 ~15 条，一轮即清。每轮 D1 操作 = 1 SELECT(扫描) +
 * 1 SELECT(指纹批量去重) + 1 batch(INSERT decisions) + 1 batch(CAS UPDATE)
 * + 1 batch(关闭 linked task) ≈ 5 次网络往返，远低于 Free 计划限额。
 */
export const DECISION_BATCH_LIMIT = 50;

/**
 * 指纹去重 IN(...) 查询的分块大小。D1/SQLite 对单条语句绑定变量数有上限
 * （生产实测：70 binds 通过、101 binds 报 "too many SQL variables"）。
 * 取 64 → 统一查询每块 ≤65 binds（含 entity_type），growth 查询每块 ≤64 binds，
 * 均安全低于上限。默认 familyBatchLimit=50 时恒为 1 块（无额外开销）。
 */
export const DEDUPE_CHUNK = 64;

/**
 * 分块查询已决策指纹，规避 D1 绑定变量上限。entityType 为 null 时走旧版
 * （无 entity_type 过滤，growth 专用）；否则按 entity_type 精确匹配（统一层）。
 * 每块一条 SELECT，块数 = ceil(N/64)，有界；任一异常向上抛由调用方 fail-safe 处理。
 */
async function chunkedFingerprintQuery<T>(
  db: D1Database,
  entityType: string | null,
  fingerprints: string[],
  selectCols: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < fingerprints.length; i += DEDUPE_CHUNK) {
    const chunk = fingerprints.slice(i, i + DEDUPE_CHUNK);
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => "?").join(",");
    const sql = entityType
      ? `SELECT ${selectCols} FROM decisions WHERE entity_type = ? AND fingerprint IN (${placeholders})`
      : `SELECT ${selectCols} FROM decisions WHERE fingerprint IN (${placeholders})`;
    const binds: unknown[] = entityType ? [entityType, ...chunk] : chunk;
    const res = await db
      .prepare(sql)
      .bind(...binds)
      .all();
    for (const r of (res.results as T[]) || []) out.push(r);
  }
  return out;
}

// ---- 白名单 Policy（明确登记，非「AI 觉得应该可以」）--------------------------

/**
 * 允许自动 PASS 的 (opp_type, exec_level) 白名单。
 * 这些机会的共同特征：
 *   - 建议动作是「评估 / 优化 Title-Meta / 内链 / 意图承接」类 SEO 结构动作；
 *   - 不触碰商业事实字段（价格/MOQ/交期/认证/供应链能力）；
 *   - 不产生对外承诺、不删页、不改价、不发件；
 *   - PASS 只标 verified（排队等待执行授权），绝不自动写回生产内容。
 */
export const AUTO_PASS_WHITELIST: ReadonlySet<string> = new Set<string>([
  "page1_candidate:B",
  "low_ctr:B",
  "content_gap:B",
  "query_page_mismatch:B",
]);

/**
 * 必须 BLOCK 的 (opp_type, exec_level)（owner-only / 商业字段 / 不可自动判断）。
 * BLOCK = 留在异常队列，不自动裁决，不伪装成 PASS。
 */
export const BLOCK_LIST: ReadonlySet<string> = new Set<string>([
  // shopping C 级 = brand/GTIN 等业务字段，owner 提供，AI 不得自填
  "shopping:C",
]);

// ---- 业务真实性红线检测（复用 FACT_REGISTRY，不重复维护红线文案）--------------

const RL = FACT_REGISTRY.redLines;
const RL2_NO_FABRICATION = RL[1] || "#2 绝不编造数字";
const RL3_VERIFIABLE = RL[2] || "#3 认证/文件须可出证";
const RL4_NO_LEAK = RL[3] || "#4 不泄露供应链";

/** Aromiso 自持认证（可第一人称声明）+ 合作工厂持有认证（须带合作工厂措辞）。 */
const SELF_CERTS = new Set(
  (FACT_REGISTRY.aromisoSelfHeld?.certifications || []).map((c) => c.toUpperCase()),
);
const PARTNER_CERTS = (FACT_REGISTRY.partnerFactoryHeld?.certifications || []).map((c) =>
  c.toUpperCase(),
);
const PARTNER_WORDING = (FACT_REGISTRY.partnerFactoryHeld?.requiredWording || []).map((w) =>
  w.toLowerCase(),
);

/**
 * 认证「标记」类关键词（IFRA / ISO / BSCI / FSC / CE / GMP）——
 * 这些是「声称持有即须可出证」的认证标志，命中后须核验归属与措辞。
 * 刻意排除文件/检测报告类（MSDS/SDS/EPR/SGS/CNAS/CMA/GC-MS，见
 * fact-registry.partnerFactoryHeld.documents）：它们是合规/物流内容正当讨论的
 * 对象，裸提及不构成红线（实证：#218 的用户搜索词「msds sds requirements」
 * 曾被误判为自持认证）。仅「每批标配 GC-MS」类过度声明才拦（见 OVERCLAIM_RE）。
 */
const CERT_MARK_RE = /\b(IFRA|BSCI|FSC|CE|ISO\s*9001|ISO\s*22716|ISO\s*14001|ISO\s*45001|GMP)\b/i;

/** 认证「声明」语境：第一人称/所有格 + 持有/认证 断言（裸关键词或搜索词不算声明）。 */
const CERT_CLAIM_CTX_RE =
  /(我们|我司|本公司|aromiso|we|our|us|自持|持有|拥有|已通过|通过|获得|取得|具备|hold|holds|held|have|has|obtained|certified|certificate|accredited|compliant)\b[^.\n]{0,40}|\b[^.\n]{0,40}(证书|认证|certificat\w*|certified|accreditation)/i;

/**
 * fact-registry.unverifiableClaims 明列的过度声明：
 * 「every lot / every shipment 标配 GC-MS」「每批/每货标配检测」——证据范围扩张反模式。
 */
const OVERCLAIM_RE =
  /(every\s+(?:lot|shipment|batch)|每批|每货|标配|100%\s*tested)\s*[^.\n]{0,30}(GC-MS|检测|test\w*|report\w*)|(GC-MS|检测|test\w*)\s*[^.\n]{0,30}(every\s+(?:lot|shipment|batch)|每批|每货|标配)/i;

/** 合作工厂措辞（出现即视为已正确归属，不算红线命中）。 */
function hasPartnerWording(text: string): boolean {
  const lower = text.toLowerCase();
  return PARTNER_WORDING.some((w) => lower.includes(w)) || /合作工厂|源头工厂|供应链/.test(lower);
}

/** 编造数字类：评分/评价条数/销量/客户数/好评率（红线 #2）。 */
const FABRICATED_STATS_RE =
  /\b\d[\d,.]*\s*(?:ratings?|reviews?|customers?|clients?|sales|units?|orders?|好评率|评价|销量|客户数)\b/i;

/** 具体产地声明（红线 #2：未经业务确认）。 */
const ORIGIN_CLAIM_RE = /\b(?:Provence|Yunnan|Grasse)\s+(?:single\s+)?origin\b/i;

/** 具体成分含量百分比（红线 #2：未经业务确认）。 */
const COMPOSITION_RE = /\b\d+(?:\.\d+)?\s*%\s*(?:cineole|purity|concentration|成分|纯度)\b/i;

/** 供应链泄露：1688 链接 / 成本价 / 工厂主体名（红线 #4）。 */
const SUPPLY_LEAK_RE = /\b(?:1688\.com|成本价|cost price|工厂主体|factory name)\b/i;

/**
 * 剥离 growth-engine 嵌入的【用户搜索词】与【URL/路径/slug】片段——这些是用户输入
 * 或页面标识，不是 Aromiso 自有声明文案，扫它们会产生假阳性。
 * 实证假阳性：
 *   - #218：suggested_action「（顶词：...msds sds requirements）」被误判自持认证；
 *   - #179：reason「canonical（/en/blog/ifra-certificate-explained）...」中的博客 slug
 *           含 ifra+certificate，被误判认证声明（实为纯技术 canonical 修复机会）。
 * 剥离模式：顶词列表、意图词「」、含路径分隔符的括号段、http(s) URL、多段小写路径、
 * .md/.html 文件 token。刻意保留「 / 」列表分隔符（如 MOQ / OEM / 样品），不误删。
 */
function stripEmbeddedQueries(text: string): string {
  return (text || "")
    .replace(/（顶词：[^）]*）/g, "")
    .replace(/\(顶词：[^)]*\)/g, "")
    .replace(/(?:信息|采购|交易|导航)?意图词「[^」]*」/g, "")
    .replace(/「[^」]*」/g, "") // 其余「」引用片段（引擎用于包裹用户查询词）
    .replace(/（[^）]*\/[^）]*）/g, "") // 含路径分隔符的括号段（如（/en/blog/slug））
    .replace(/\([^)]*\/[^)]*\)/g, "")
    .replace(/https?:\/\/\S+/gi, "") // 完整 URL
    .replace(/\S+\.(?:md|html?|php|aspx?)\b/gi, "") // 文件 token（slug.en.md 等）
    .replace(/(?:\/[a-z0-9-]+){2,}/gi, ""); // 多段小写路径 /en/blog/slug
}

export interface RedLineHit {
  violated_rule: string;
  detected_problem: string;
  suggested_fix: string;
  prevention_rule: string;
}

/**
 * 扫描 opportunity 的 reason + suggested_action 是否命中业务真实性红线。
 * 纯函数、零 IO。命中即返回结构化原因（用于 REJECT 审计 + prevention 学习）。
 *
 * 关键设计（实证修正 2026-09-13）：
 *   - 先剥离嵌入的用户搜索词片段（顶词/意图词），只对 Aromiso 自有文案做红线扫描；
 *   - 认证「标记」须同时具备【声明语境】才判红线（裸关键词/搜索词/正当话题不拦）；
 *   - 文件/检测报告类（MSDS/SDS/GC-MS/SGS…）裸提及不拦，仅「每批标配」过度声明才拦。
 *
 * 当前 growth-engine 的建议文案是静态模板 + 嵌入用户查询词，正常不会命中红线；
 * 本检测是防御性纵深——未来引擎文案变更或 prompt 注入夹带商业事实时在此闸挡下。
 */
export function checkAuthenticityRedLines(o: OpportunityRow): RedLineHit | null {
  // 仅扫描 Aromiso 自有文案（剥离用户搜索词片段后）
  const text = stripEmbeddedQueries(`${o.reason || ""}\n${o.suggested_action || ""}`);

  // 红线 #2：编造数字（评分/评价/销量/客户数）
  if (FABRICATED_STATS_RE.test(text)) {
    return {
      violated_rule: RL2_NO_FABRICATION,
      detected_problem: "建议文案含具体评分/评价/销量/客户数等不可核实数字",
      suggested_fix: "移除所有未经业务确认的数字声明；如需社会证明，须 owner 提供可核实来源",
      prevention_rule:
        "生成阶段前置校验：任何进入 Decision Layer 的 suggested_action 不得含 ratings/reviews/sales/customers 数字模式",
    };
  }

  // 红线 #2：具体产地 / 成分含量
  if (ORIGIN_CLAIM_RE.test(text) || COMPOSITION_RE.test(text)) {
    return {
      violated_rule: RL2_NO_FABRICATION,
      detected_problem: "建议文案含具体产地声明或成分含量百分比（未经业务确认）",
      suggested_fix: "移除产地/成分含量具体声明，改用可核实的品类通用描述",
      prevention_rule:
        "生成阶段前置校验：origin/composition 具体声明须先过 fact-registry.verifiableNumbers 核验",
    };
  }

  // 红线 #3（过度声明）：every lot / 每批标配 GC-MS 类证据范围扩张
  if (OVERCLAIM_RE.test(text)) {
    return {
      violated_rule: RL3_VERIFIABLE,
      detected_problem:
        "建议文案含「每批/每货标配检测（GC-MS 等）」过度声明（fact-registry.unverifiableClaims 明列）",
      suggested_fix: "改为「可提供/曾做过」等限定表述，删除 every lot/每批标配 类全称声明",
      prevention_rule:
        "生成阶段前置校验：检测报告类表述禁止 every lot/every shipment/每批/标配 全称量词，须限定为个案可提供",
    };
  }

  // 红线 #3（认证声明）：认证标记 + 声明语境 + 非自持 + 无合作工厂措辞 → 不可出证
  const certMatch = text.match(CERT_MARK_RE);
  if (certMatch && CERT_CLAIM_CTX_RE.test(text)) {
    const cert = certMatch[0].toUpperCase().replace(/\s+/g, " ");
    const selfHeld = [...SELF_CERTS].some((c) => cert.includes(c.replace(/\s+/g, " ")));
    const partnerHeld = PARTNER_CERTS.some((c) => cert.includes(c.replace(/\s+/g, " ")));
    if (!selfHeld && !(partnerHeld && hasPartnerWording(text))) {
      return {
        violated_rule: RL3_VERIFIABLE,
        detected_problem: `建议文案以声明语境提及认证「${certMatch[0]}」，但不在 fact-registry 可出证清单，或缺少合作工厂归属措辞`,
        suggested_fix:
          "移除该认证声明；如确为合作工厂持有，须改用「partner factory / 合作工厂」措辞并确保可出证",
        prevention_rule:
          "生成阶段前置校验：认证标记须先比对 fact-registry.aromisoSelfHeld / partnerFactoryHeld，且合作工厂认证强制带归属措辞",
      };
    }
  }

  // 红线 #4：供应链泄露
  if (SUPPLY_LEAK_RE.test(text)) {
    return {
      violated_rule: RL4_NO_LEAK,
      detected_problem: "建议文案含 1688 链接 / 成本价 / 工厂主体名等供应链泄露信息",
      suggested_fix: "移除所有供应链主体/成本/链接信息",
      prevention_rule:
        "生成阶段前置校验：suggested_action 不得含 1688/cost price/factory name 模式",
    };
  }

  return null;
}

// ---- 指纹（跨周稳定去重键）----------------------------------------------------

/** 归一化 page：去协议/域名/尾斜杠/查询串，小写。 */
function normalizePage(page: string): string {
  return (page || "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .toLowerCase()
    .trim();
}

/** 归一化 query：小写、压缩空白、去尾标点。 */
function normalizeQuery(query: string): string {
  return (query || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/, "")
    .trim();
}

/**
 * 业务机会指纹 = opp_type | 归一化 page | 归一化 query。
 * 刻意不含 week / priority / metrics → 同一业务机会跨周产生相同指纹，
 * 保证「相同业务机会不会反复产生新的决策」（owner 指令 §八）。
 */
export function fingerprintOpportunity(
  o: Pick<OpportunityRow, "opp_type" | "page" | "query">,
): string {
  return `${o.opp_type}|${normalizePage(o.page)}|${normalizeQuery(o.query)}`;
}

// ---- 单条裁决（纯函数，可单测穷举）--------------------------------------------

/**
 * 对单条 opportunity 做政策裁决。纯函数、零 IO、零副作用。
 *
 * 判定顺序（优先级从高到低）：
 *   1) 业务真实性红线 → REJECT（结构化原因 + prevention rule）
 *   2) BLOCK 名单 / owner-only 措辞 / 未知类型 / payload 损坏 → BLOCK
 *   3) 白名单命中 → PASS
 *   4) 兜底 → BLOCK（不认识就不自动跑，与 permissions.enforceMode 同哲学）
 */
export function evaluateOpportunity(o: OpportunityRow): DecisionResult {
  const fingerprint = fingerprintOpportunity(o);
  const key = `${o.opp_type}:${o.exec_level}`;

  // ① 业务真实性红线（最高优先级——任何白名单都不能绕过红线）
  const redLine = checkAuthenticityRedLines(o);
  if (redLine) {
    return {
      decision: "REJECT",
      status: "skipped",
      reason: `命中业务真实性红线：${redLine.detected_problem}`,
      violated_rule: redLine.violated_rule,
      detected_problem: redLine.detected_problem,
      suggested_fix: redLine.suggested_fix,
      prevention_rule: redLine.prevention_rule,
      fingerprint,
    };
  }

  // ② BLOCK：owner-only 措辞（"owner 提供" / "AI 不得自填"）
  const actionText = `${o.suggested_action || ""} ${o.reason || ""}`;
  if (/owner\s*提供|AI\s*不得自填|须\s*owner|人工补录/i.test(actionText)) {
    return {
      decision: "BLOCK",
      status: null,
      reason: "建议动作明确要求 owner 提供 / AI 不得自填 → 超出自动裁决范围",
      violated_rule: "Owner-Only Boundary（商业字段须 owner 权威源）",
      detected_problem: `opportunity ${key} 的 suggested_action 含 owner-only 措辞`,
      suggested_fix: "等待 owner 提供权威字段后由人工或受控动作处理；Decision Layer 不代填",
      prevention_rule:
        "growth-engine 产出 owner-only 机会时应直接标 exec_level=C 并附 owner_required 标记，避免进入自动裁决扫描",
      fingerprint,
    };
  }

  // ③ BLOCK：显式 BLOCK 名单
  if (BLOCK_LIST.has(key)) {
    return {
      decision: "BLOCK",
      status: null,
      reason: `${key} 在 BLOCK 名单（owner-only / 商业字段 / 不可自动判断）`,
      violated_rule: "Decision Policy BLOCK_LIST",
      detected_problem: `${key} 属商业字段或须 owner 确认的机会类型`,
      suggested_fix: "保留在异常队列，由 owner 或受控人工动作处理",
      prevention_rule:
        "新增 opportunity 类型时须显式登记 AUTO_PASS_WHITELIST 或 BLOCK_LIST，未登记默认 BLOCK",
      fingerprint,
    };
  }

  // ④ BLOCK：payload 损坏（score_json / metrics_json 不可解析）
  if (!isParseableJson(o.score_json) || !isParseableJson(o.metrics_json)) {
    return {
      decision: "BLOCK",
      status: null,
      reason: "payload 损坏：score_json 或 metrics_json 不可解析，无法安全判断",
      violated_rule: "Data Integrity Gate（不确定时宁可 BLOCK）",
      detected_problem: `opportunity #${o.id} 的 JSON 字段损坏`,
      suggested_fix: "修复上游 growth-engine 产出；本条留异常队列待人工核查",
      prevention_rule: "growth-sync 落库前校验 JSON 字段可解析性，损坏行不入库",
      fingerprint,
    };
  }

  // ⑤ PASS：白名单命中
  if (AUTO_PASS_WHITELIST.has(key)) {
    return {
      decision: "PASS",
      status: "verified",
      reason: `${key} 在白名单：SEO 结构类机会（评估/Title-Meta/内链/意图承接），不触碰商业事实字段，AI 确认有效`,
      violated_rule: "",
      detected_problem: "",
      suggested_fix: "",
      prevention_rule: "",
      fingerprint,
    };
  }

  // ⑥ 兜底 BLOCK：未登记的 (opp_type, exec_level) 一律不自动跑
  return {
    decision: "BLOCK",
    status: null,
    reason: `${key} 未登记于 AUTO_PASS_WHITELIST → 默认 BLOCK（不认识就不自动跑）`,
    violated_rule: "Default-Deny Policy（与 permissions.enforceMode 同哲学）",
    detected_problem: `未知或未授权的机会类型组合 ${key}`,
    suggested_fix: "如确应自动处理，须在 decision-layer.ts 显式登记白名单并补测试",
    prevention_rule: "新增 opportunity 类型时强制走白名单登记 + 单测，杜绝隐式放行",
    fingerprint,
  };
}

function isParseableJson(s: string | null | undefined): boolean {
  if (!s) return true; // 空串视为「无 payload」，不算损坏（DEFAULT '{}'）
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

// ---- 运行时批量裁决（D1 安全：批量 / LIMIT / CAS / 指纹去重）------------------

export interface RunDecisionLayerOptions {
  /** 单轮批量上限，默认 DECISION_BATCH_LIMIT。 */
  batchLimit?: number;
  /** 只扫描+裁决，不写库（用于生产只读验证）。 */
  dryRun?: boolean;
  /** 覆盖「当前时间」（秒级 unix），便于测试。 */
  now?: number;
}

/**
 * 批量裁决 growth_opportunities 中 status='new' AND exec_level IN ('B','C') 的机会。
 *
 * D1 操作预算（每轮，batchLimit=50）：
 *   1× SELECT 扫描（走 idx_growth_opp_status_exec，LIMIT 收敛）
 *   1× SELECT 指纹批量去重（IN(...) 单条，杜绝 N+1）
 *   1× db.batch INSERT OR IGNORE decisions（指纹 UNIQUE 仲裁并发）
 *   1× db.batch CAS UPDATE growth_opportunities（WHERE status='new' 仲裁并发）
 *   1× db.batch UPDATE tasks 关闭 linked task（仅 PASS/REJECT）
 *   = 最多 5 次网络往返，与队列长度无关（无 N+1）。
 *
 * 并发安全：
 *   - fingerprint UNIQUE 部分索引 + INSERT OR IGNORE → 重复决策零写入。
 *   - CAS UPDATE WHERE status='new' → 并发裁决最多一个命中（输家 changes=0）。
 *   - 去重（跨周/跨批/批内）：指纹已裁决 → 不新建 decision 行；原决策 PASS/REJECT
 *     → 重复行标 'skipped'（杜绝下游重复执行）；原决策 BLOCK → 重复行保持 'new'
 *     （异常队列对 owner 持续可见，不静默吞掉）。
 *
 * 失败语义：
 *   - 无内部 retry 循环。任何 D1 异常 → 记入 errors，本轮如实返回。
 *   - 下一轮 Automation Tick / cron-pull 自然重试（扫描 WHERE status='new' 仍会捞到）。
 *   - 严禁「失败 → 无限重试 → D1 暴涨」。
 */
export async function runDecisionLayer(
  db: D1Database,
  opts: RunDecisionLayerOptions = {},
): Promise<DecisionLayerStats> {
  const batchLimit = Math.max(1, Math.min(500, opts.batchLimit ?? DECISION_BATCH_LIMIT));
  const dryRun = !!opts.dryRun;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const stats: DecisionLayerStats = {
    scanned: 0,
    passed: 0,
    rejected: 0,
    blocked: 0,
    duplicates: 0,
    casLost: 0,
    errors: [],
    truncated: false,
    dryRun,
  };

  // ① 扫描：单条 SELECT，走复合索引，LIMIT 收敛。多取 1 行判断是否 truncated。
  let rows: OpportunityRow[];
  try {
    const res = await db
      .prepare(
        `SELECT id, week, opp_type, page, query, priority, exec_level, reason,
                suggested_action, metrics_json, intent, score_json, status, task_id, created_at
         FROM growth_opportunities
         WHERE status = 'new' AND exec_level IN ('B', 'C')
         ORDER BY created_at ASC, id ASC
         LIMIT ?`,
      )
      .bind(batchLimit + 1)
      .all();
    const all = (res.results as D1Row[]) || [];
    if (all.length > batchLimit) {
      stats.truncated = true;
      rows = all.slice(0, batchLimit).map(mapRow);
    } else {
      rows = all.map(mapRow);
    }
  } catch (e) {
    stats.errors.push(`scan failed: ${e instanceof Error ? e.message : String(e)}`);
    return stats;
  }
  stats.scanned = rows.length;
  if (rows.length === 0) return stats; // 空队列：仅 1 次 SELECT，立即返回

  // ② 指纹批量去重：分块 IN(...) 查询既有决策，杜绝 N+1 + 规避 D1 绑定变量上限。
  const fingerprints = rows.map((r) => fingerprintOpportunity(r));
  const existingByFingerprint = new Map<string, { decision: string; status: string; id: number }>();
  try {
    const dedupeRows = await chunkedFingerprintQuery<D1Row>(
      db,
      null,
      fingerprints,
      "id, fingerprint, decision, status",
    );
    for (const r of dedupeRows) {
      const fp = String(r.fingerprint || "");
      if (fp && !existingByFingerprint.has(fp)) {
        existingByFingerprint.set(fp, {
          id: Number(r.id),
          decision: String(r.decision || ""),
          status: String(r.status || ""),
        });
      }
    }
  } catch (e) {
    // 去重查询失败 → fail-safe：本轮不裁决（宁可漏跑，不可重复决策）
    stats.errors.push(`dedupe lookup failed: ${e instanceof Error ? e.message : String(e)}`);
    return stats;
  }

  // ③ 逐条裁决（纯内存，零 D1）+ 收集写入语句
  const decisionInserts: D1PreparedStatement[] = [];
  const oppUpdates: D1PreparedStatement[] = [];
  const taskUpdates: D1PreparedStatement[] = [];

  // 指纹 → 已做出的决策（PASS/REJECT/BLOCK）。同时承载两类去重：
  //   (A) 跨批/跨周：种子来自既有 decisions 行（existingByFingerprint）；
  //   (B) 批内：循环中先到先得，后续同指纹行判为重复。
  // 保证「相同业务机会不会反复产生新的决策」（owner 指令 §八），
  // 且同一批内不会出现两条 verified 行导致下游重复执行。
  const seen = new Map<string, { decision: string; id: number | null }>();
  for (const [fp, ex] of existingByFingerprint) seen.set(fp, { decision: ex.decision, id: ex.id });

  for (const o of rows) {
    const fp = fingerprintOpportunity(o);
    const prior = seen.get(fp);

    if (prior) {
      // 重复机会（跨周/跨批/批内）→ 不新建 decision 行。
      stats.duplicates++;
      if (dryRun) continue;
      // 终态语义：
      //   - 原决策 BLOCK → 当前行保持 'new'（异常队列须对 owner 持续可见，不静默吞掉）；
      //   - 原决策 PASS/REJECT → 当前行标 'skipped'（去重终态，杜绝下游重复执行）。
      if (prior.decision === "BLOCK") continue;
      if (o.status === "new") {
        oppUpdates.push(
          db
            .prepare(`UPDATE growth_opportunities SET status = ? WHERE id = ? AND status = 'new'`)
            .bind("skipped", o.id),
        );
        if (o.task_id) {
          taskUpdates.push(
            db
              .prepare(
                `UPDATE tasks SET status = 'closed',
                    result = ?
                  WHERE id = ? AND status = 'pending'`,
              )
              .bind(
                `[AI Decision Layer] 重复机会去重（原决策 ${prior.decision}${prior.id ? ` #${prior.id}` : ""}）：指纹 ${fp} 已裁决，本行标 skipped，不重复处理`,
                o.task_id,
              ),
          );
        }
      }
      continue;
    }

    // 新鲜裁决
    const result = evaluateOpportunity(o);
    seen.set(fp, { decision: result.decision, id: null });
    if (result.decision === "PASS") stats.passed++;
    else if (result.decision === "REJECT") stats.rejected++;
    else stats.blocked++; // BLOCK / FIX_THEN_PASS（当前 FIX 不产出，归 blocked 计数外）

    if (dryRun) continue;

    // BLOCK 不改 opportunity 状态（留异常队列），但仍记录决策审计（fingerprint 唯一 → 幂等）。
    const decisionStatus = result.status ?? "adopted"; // BLOCK 无 opp 终态，decisions.status 用 'adopted' 占位
    decisionInserts.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO decisions
             (suggestion, status, reason, task_id, rejection_reason, created_at,
              opp_id, decision, fingerprint, violated_rule, prevention_rule,
              detected_problem, suggested_fix, source, payload_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          `${o.opp_type} ${o.page}${o.query ? ` [${o.query}]` : ""}`.slice(0, 500),
          decisionStatus,
          result.reason.slice(0, 1000),
          o.task_id,
          result.decision === "REJECT" ? result.violated_rule : "",
          now,
          o.id,
          result.decision,
          result.fingerprint,
          result.violated_rule,
          result.prevention_rule,
          result.detected_problem,
          result.suggested_fix,
          "decision-layer",
          JSON.stringify({
            opp_id: o.id,
            week: o.week,
            opp_type: o.opp_type,
            exec_level: o.exec_level,
            priority: o.priority,
            intent: o.intent,
            fingerprint: result.fingerprint,
            decision: result.decision,
            reason: result.reason,
            violated_rule: result.violated_rule,
            detected_problem: result.detected_problem,
            suggested_fix: result.suggested_fix,
            prevention_rule: result.prevention_rule,
            decided_at: now,
          }),
        ),
    );

    // PASS/REJECT → CAS 更新 opportunity 终态（WHERE status='new' 仲裁并发）
    if (result.status) {
      oppUpdates.push(
        db
          .prepare(`UPDATE growth_opportunities SET status = ? WHERE id = ? AND status = 'new'`)
          .bind(result.status, o.id),
      );
    }

    // PASS/REJECT → 关闭 linked growth_review 任务（使其退出 NEEDS-YOU 计数）。
    // BLOCK → 不动 task（留异常队列，owner 可见）。
    if (result.status && o.task_id) {
      taskUpdates.push(
        db
          .prepare(
            `UPDATE tasks SET status = 'closed',
                result = ?
              WHERE id = ? AND status = 'pending'`,
          )
          .bind(
            `[AI Decision Layer] ${result.decision}：${result.reason}`.slice(0, 500),
            o.task_id,
          ),
      );
    }
  }

  if (dryRun) return stats;

  // ④ 原子批写入（db.batch 单次往返执行多条语句）
  try {
    if (decisionInserts.length > 0) await db.batch(decisionInserts);
  } catch (e) {
    stats.errors.push(
      `decisions insert batch failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  try {
    if (oppUpdates.length > 0) {
      const results = (await db.batch(oppUpdates)) as { meta?: { changes?: number } }[];
      for (const r of results || []) {
        if (Number(r?.meta?.changes ?? 1) === 0) stats.casLost++;
      }
    }
  } catch (e) {
    stats.errors.push(
      `opportunity CAS batch failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  try {
    if (taskUpdates.length > 0) await db.batch(taskUpdates);
  } catch (e) {
    stats.errors.push(`task close batch failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return stats;
}

function mapRow(r: D1Row): OpportunityRow {
  return {
    id: Number(r.id),
    week: String(r.week || ""),
    opp_type: String(r.opp_type || ""),
    page: String(r.page || ""),
    query: String(r.query || ""),
    priority: String(r.priority || ""),
    exec_level: String(r.exec_level || ""),
    reason: String(r.reason || ""),
    suggested_action: String(r.suggested_action || ""),
    metrics_json: String(r.metrics_json || "{}"),
    intent: String(r.intent || ""),
    score_json: String(r.score_json || "{}"),
    status: String(r.status || "new"),
    task_id: r.task_id == null ? null : Number(r.task_id),
    created_at: Number(r.created_at || 0),
  };
}

// ===========================================================================
//  V5.71 — 全局统一 AI Decision Layer（Unified Decision Layer）
//
//  owner 2026-09-13 指令：把 Growth 专用层升级为【一个】统一决策层，覆盖所有
//  正常人工审核/批准/拒绝/裁决/Triage/冲突处理入口。各业务模块只提供
//  candidate / context / evidence，统一层负责 Decide（§二）。
//
//  统一语义（§三/§六）：PASS / FIX / REJECT / BLOCK / EXCEPTION
//    PASS      低风险、规则明确、证据充分 → 自动通过（写终态，退出人工队列）
//    FIX       可安全修复 → 本轮不产出（修复发生在执行侧，受既有闸门约束）
//    REJECT    明确违反规则（真实性红线等）→ 自动拒绝 + 结构化原因
//    BLOCK     高风险/不可逆/商业事实/证据不足/无法安全判断 → 留异常队列
//    EXCEPTION 真正须 Owner 最终业务决策（owner-only / 对外发布 / 硬禁止）
//
//  铁律：
//    - default-deny：未登记 policy 的 entity_type/subtype 一律 BLOCK（绝不隐式放行）。
//    - 消灭人工审核 ≠ 取消安全闸门：复用 FACT_REGISTRY/truthfulness/permissions。
//    - PASS ≠ 执行/发布：只把「人工评审」这一步自动化；内容写回/发布仍受
//      TASK_EXECUTOR_LIVE / Action Budget / 人工 CMS 发布 等既有闸门约束（绝不解锁）。
//    - BLOCK/EXCEPTION 是少量真正异常兜底，不得演变成新的常规人工队列。
//
//  D1/成本安全（§十二/§十四）：
//    - 每 family 批量上限 FAMILY_BATCH_LIMIT；全局候选预算 GLOBAL_CANDIDATE_BUDGET，
//      达到即停本轮（checkpoint：未处理项留待下轮，靠 status 游标天然续跑）。
//    - 每 family 扫描走各自索引 + LIMIT；指纹去重单条 IN(...)；写入 db.batch。
//    - loop 防护（§十五）：PASS/REJECT 写终态（退出扫描）；BLOCK/EXCEPTION 写
//      fingerprint 决策行 → 下轮去重跳过，不重复裁决、不 decision→task→decision 循环。
// ===========================================================================

export type UnifiedDecisionType = "PASS" | "FIX" | "REJECT" | "BLOCK" | "EXCEPTION";
export type RiskLevel = "low" | "medium" | "high" | "owner_only";
export const POLICY_VERSION = "v5.71-unified-1";

/** 每 family 单轮扫描上限。 */
export const FAMILY_BATCH_LIMIT = 50;
/** 全局单轮候选预算（跨所有 family），达到即停，杜绝接管更多任务导致 D1 指数增长。 */
export const GLOBAL_CANDIDATE_BUDGET = 200;

/** 统一候选（各模块提供 candidate/context/evidence）。 */
export interface DecisionCandidate {
  entity_type: string;
  entity_id: string;
  task_id: number | null;
  source: string;
  fingerprint: string;
  evidence: Record<string, unknown>;
}

/** 统一决策结果（§六 schema）。 */
export interface UnifiedDecision {
  decision: UnifiedDecisionType;
  risk_level: RiskLevel;
  reason: string;
  violated_rule: string;
  detected_problem: string;
  suggested_fix: string;
  prevention_rule: string;
  /** 写入实体的终态状态（null = 不改状态，留异常队列，仅靠 fingerprint 去重）。 */
  entity_status: string | null;
  /** 写入 linked task 的终态（task family 用；其他 family 为 null）。 */
  task_status: string | null;
}

function ud(
  decision: UnifiedDecisionType,
  risk_level: RiskLevel,
  reason: string,
  entity_status: string | null,
  task_status: string | null = null,
  extra: Partial<UnifiedDecision> = {},
): UnifiedDecision {
  return {
    decision,
    risk_level,
    reason,
    violated_rule: "",
    detected_problem: "",
    suggested_fix: "",
    prevention_rule: "",
    entity_status,
    task_status,
    ...extra,
  };
}

// ---- task family：可自动批准评审的 SEO/技术类机会（🟢AUTO，非商业事实、非发布）----
const TASK_AUTO_PASS_OPP_TYPES = new Set<string>([
  // B 级 SEO 结构类（与 growth 白名单一致）
  "page1_candidate",
  "low_ctr",
  "content_gap",
  "query_page_mismatch",
  // A 级技术修补（autonomy 模型 🟢AUTO：SEO metadata / alt / 内链 / schema / index）
  "meta_fix",
  "internal_link",
  "alt_text_fill",
  "index_issue",
  "translate_fill",
  "schema_fill",
  "sitemap_ping",
]);

/** owner-only 措辞（商业字段须 owner 权威源，AI 不得自填）。 */
function isOwnerOnlyText(text: string): boolean {
  return /owner\s*提供|AI\s*不得自填|须\s*owner|人工补录|owner-only/i.test(text || "");
}

/**
 * task family 政策：裁决 tasks 表中 status='pending' AND execution_mode IN('L2','L4')
 * 的人工评审任务（当前真实队列：growth_review 63 + content_generate 6 + MANUAL 10）。
 *
 * 证据全部来自 task 行自身（payload/title/roi_score），无需额外 D1 读。
 * PASS 只把「人工评审」自动化（task→done），绝不触发内容写回/发布。
 */
export function decideTask(c: DecisionCandidate): UnifiedDecision {
  const ev = c.evidence as {
    task_type?: string;
    execution_mode?: string;
    payload?: string;
    title?: string;
    roi_score?: number;
  };
  const tt = String(ev.task_type || "").trim();

  // ① 硬禁止 / MANUAL / 未登记任务类型 → EXCEPTION（owner_only，AI 永不自动裁决）
  const enforced = enforceMode(tt);
  if (enforced === "MANUAL") {
    return ud(
      "EXCEPTION",
      "owner_only",
      `任务类型「${tt || "(空)"}」经 enforceMode 裁定为 MANUAL（删页/改价/支付/报价/资质/发布/发件等硬禁止或未登记）→ 须 Owner 亲自决策，AI 不自动裁决`,
      "blocked",
      null,
      {
        violated_rule: "Permission Red Line（permissions.FORBIDDEN_TASK_TYPES / default-MANUAL）",
        detected_problem: `task_type=${tt || "(空)"} 属 MANUAL 权限级`,
        suggested_fix:
          "保留在异常队列由 Owner 处理；如需自动化须先在 permissions.TASK_TYPE_POLICY 显式登记并补测试",
        prevention_rule:
          "新增任务类型强制走 permissions 白名单登记 + 单测，未登记默认 MANUAL，杜绝隐式自动执行",
      },
    );
  }

  // ② 解析 payload（损坏 → BLOCK，证据不足不裁决）
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(ev.payload || "{}") as Record<string, unknown>;
  } catch {
    return ud("BLOCK", "medium", "payload 不可解析，证据不足，无法安全裁决", "blocked", null, {
      violated_rule: "Data Integrity Gate（不确定宁可 BLOCK）",
      detected_problem: `task #${c.entity_id} payload 损坏`,
      suggested_fix: "修复上游任务产出的 payload JSON；本条留异常队列",
      prevention_rule: "任务创建前校验 payload 可解析性",
    });
  }

  // ③ growth_review：payload 内嵌完整 opportunity（{opp_id, opp_type, exec_level, ...}）
  if (tt === "growth_review") {
    const oppType = String(payload.opp_type || "");
    const execLevel = String(payload.exec_level || "");
    const actionText = `${String(payload.suggested_action || "")} ${String(payload.reason || "")}`;
    if (!oppType) {
      return ud("BLOCK", "medium", "growth_review payload 缺 opp_type，证据不足", "blocked", null, {
        violated_rule: "Missing Evidence Gate",
        detected_problem: `task #${c.entity_id} payload 无 opp_type`,
        suggested_fix: "确认 growth-sync 落任务时写入完整 opportunity 快照",
        prevention_rule: "growth_review 任务 payload 强制含 opp_type/exec_level",
      });
    }
    // 真实性红线（复用 growth 同一闸，扫描 payload 内 Aromiso 文案）
    const redline = checkAuthenticityRedLines({
      reason: String(payload.reason || ""),
      suggested_action: String(payload.suggested_action || ""),
    } as OpportunityRow);
    if (redline) {
      return ud(
        "REJECT",
        "high",
        `命中业务真实性红线：${redline.detected_problem}`,
        "closed",
        null,
        {
          violated_rule: redline.violated_rule,
          detected_problem: redline.detected_problem,
          suggested_fix: redline.suggested_fix,
          prevention_rule: redline.prevention_rule,
        },
      );
    }
    // owner-only / 商业字段（shopping C 级等）→ BLOCK
    if (execLevel === "C" || isOwnerOnlyText(actionText)) {
      return ud(
        "BLOCK",
        "owner_only",
        `growth_review 机会 ${oppType}:${execLevel} 属 owner-only/商业字段（须 owner 权威源）→ 不自动批准`,
        "blocked",
        null,
        {
          violated_rule: "Owner-Only Boundary（商业事实不接受 AI 自填）",
          detected_problem: `${oppType}:${execLevel} 需 owner 提供权威字段`,
          suggested_fix: "等待 owner 提供后人工/受控动作处理",
          prevention_rule:
            "growth-engine 产出 owner-only 机会应直接标 exec_level=C + owner_required 标记",
        },
      );
    }
    // 白名单 SEO/技术类 → PASS（评审通过；执行仍受 TASK_EXECUTOR_LIVE/Budget 闸，未解锁）
    if (TASK_AUTO_PASS_OPP_TYPES.has(oppType)) {
      return ud(
        "PASS",
        "low",
        `growth_review 机会 ${oppType}:${execLevel} 属 SEO/技术结构类（🟢AUTO，非商业事实、非发布）→ AI 批准评审；实际执行仍受 TASK_EXECUTOR_LIVE/Action Budget 闸约束，未解锁 SEO 写回`,
        "done",
        null,
      );
    }
    // 未登记机会类型 → BLOCK（default-deny）
    return ud(
      "BLOCK",
      "medium",
      `growth_review 机会类型「${oppType}」未登记自动批准白名单 → default-deny`,
      "blocked",
      null,
      {
        violated_rule: "Default-Deny Policy",
        detected_problem: `未知机会类型 ${oppType}`,
        suggested_fix: "如确应自动批准，须在 TASK_AUTO_PASS_OPP_TYPES 显式登记并补测试",
        prevention_rule: "新增机会类型强制走白名单登记 + 单测",
      },
    );
  }

  // ④ content_generate：草稿在【创建时】已过 content-generate.ts 的真实性+质量双闸
  //    （代码级不变量：命中红线的草稿根本不会建任务，见 content-generate 测试）。
  //    payload 可能携带 truthfulness_report（新任务）或为空（legacy 任务）；
  //    roi_score = 质量分。PASS 仅批准【编辑评审】，草稿仍 draft:true，
  //    发布是独立人工 CMS 动作（save.ts ghPut）——PASS 绝不触发发布。
  if (tt === "content_generate") {
    const tr = payload.truthfulness_report as
      { pass?: boolean; blocked?: unknown[]; warnings?: unknown[] } | undefined;
    const quality = Number(ev.roi_score ?? (payload.quality as { score?: number })?.score ?? 0);
    // 显式真实性未过 → REJECT（有明确反证）
    if (tr && tr.pass === false) {
      return ud(
        "REJECT",
        "high",
        "content_generate 草稿真实性闸未过（blocked 红线）→ 拒绝",
        "closed",
        null,
        {
          violated_rule: RL3_VERIFIABLE,
          detected_problem: `草稿命中 ${Array.isArray(tr.blocked) ? tr.blocked.length : "若干"} 项真实性红线`,
          suggested_fix: "按 truthfulness_report.blocked 逐项移除不可出证声明后重新生成",
          prevention_rule: "生成阶段前置消费 decisions.prevention_rule，减少同类红线草稿",
        },
      );
    }
    // 质量分不足 → BLOCK（留人工编辑）
    if (!(quality >= 60)) {
      return ud(
        "BLOCK",
        "medium",
        `content_generate 草稿质量分 ${quality} < 60，未达自动批准阈值 → 留人工`,
        "blocked",
        null,
        {
          violated_rule: "Quality Gate（质量不足不自动批准）",
          detected_problem: `质量分 ${quality} 低于阈值 60`,
          suggested_fix: "提升草稿质量分后重审；或人工编辑签发",
          prevention_rule: "生成阶段提高质量门槛，减少低分草稿进入评审队列",
        },
      );
    }
    // 质量达标 + 无显式反证 → PASS（依据创建时已过双闸的代码级不变量；PASS≠发布）
    return ud(
      "PASS",
      "low",
      `content_generate 草稿质量分 ${quality}≥60 且无真实性反证 → AI 批准编辑评审。依据：content-generate.ts 仅对已过真实性+质量双闸的草稿建任务（红线草稿不建任务）；PASS 仅批准评审，草稿仍 draft:true，发布是独立人工 CMS 动作（未自动发布）`,
      "done",
      null,
    );
  }

  // ⑤ 其他 L2/L4 任务（meta_rewrite/content_refresh/faq_append 等内容改写/发布类）
  //    → EXCEPTION：须 Owner 编辑签发（autonomy 模型 🟡APPROVAL：AI 起草 + owner 批准）
  return ud(
    "EXCEPTION",
    "owner_only",
    `任务类型「${tt}」属内容改写/发布类（L2/L4），须 Owner 编辑签发（🟡APPROVAL）→ AI 不自动批准，留异常队列`,
    "blocked",
    null,
    {
      violated_rule: "Approval Boundary（对外内容须 owner 签发）",
      detected_problem: `task_type=${tt} 为内容改写/发布类`,
      suggested_fix: "Owner 一键批准或退回；AI 仅起草不签发",
      prevention_rule: "内容发布类任务保持 🟡APPROVAL，不纳入自动 PASS 白名单",
    },
  );
}

/**
 * knowledge_v2 family 政策：status='review' 的知识条目 → 过【真实性 + 质量(confidence)】
 * 双闸后晋升 active。统一收敛到 knowledge_v2 现有合法生命周期终态（draft/review/active/
 * deprecated，复用 knowledge-service.ts:352 既有 deprecated 动作，不新建第二套生命周期）：
 *   PASS（真实性过 + confidence≥70）→ active（成为可信 AI 上下文）
 *   REJECT（真实性红线）           → deprecated（拒绝晋升）
 *   BLOCK（低质/空内容/闸门异常）   → deprecated（退休，不晋升为可信上下文）
 *
 * 收口语义（owner 2026-09-13 §一）：被判定 BLOCK 且无后续人工审批意义的知识项必须进入
 * 生命周期终态，不得停留在 status='review' 冒充人工 backlog。deprecated 被所有
 * NEEDS-YOU/inbox 聚合排除（它们只数 status='review'），且被 ai.ts 排除（只读 active），
 * 故收口后：① 退出 review scan ② Automation Tick 不再反复处理 ③ 不产生新人工负载。
 * BLOCK 与 REJECT 终态同为 deprecated，但 decision 审计（decision/violated_rule/reason）
 * 区分二者，绝不伪造为 PASS、绝不改成 active。
 *
 * 实证修正 2026-09-13：生产 342 条 review 中 308 条 confidence<60（L0 原始碎片，
 * 如「office, retail, residential」）。仅过真实性闸会把低质碎片晋升为可信上下文 →
 * 故加 confidence≥70 质量闸：truthfulness≠quality，两闸都过才 PASS。
 */
export function decideKnowledge(c: DecisionCandidate): UnifiedDecision {
  const ev = c.evidence as { content?: string; title?: string; confidence?: number };
  const content = String(ev.content || "");
  const confidence = Number(ev.confidence || 0);
  if (!content.trim()) {
    return ud(
      "BLOCK",
      "medium",
      "knowledge_v2 内容为空，证据不足 → 退休 deprecated（不晋升、不冒充人工 backlog）",
      "deprecated",
      null,
      {
        violated_rule: "Missing Evidence Gate",
        detected_problem: `knowledge_v2 #${c.entity_id} content 为空`,
        suggested_fix: "如确有内容，补全后重新提交知识（新条目走 review→active）",
        prevention_rule: "知识写回前校验 content 非空",
      },
    );
  }
  let gate: { pass: boolean; blocked: { rule: string; note: string }[] };
  try {
    gate = checkClaims(`${String(ev.title || "")}\n${content}`);
  } catch (e) {
    return ud(
      "BLOCK",
      "medium",
      `真实性闸自身异常 → fail-safe 退休 deprecated（不可核验内容绝不晋升 active）：${String(e).slice(0, 120)}`,
      "deprecated",
      null,
      {
        violated_rule: "Fail-safe（闸门异常宁可 BLOCK，不可核验不晋升）",
        detected_problem: "checkClaims 抛错",
        suggested_fix: "修复真实性闸异常后，如需保留请重新提交知识",
        prevention_rule: "闸门异常不得静默放行，亦不得晋升为可信上下文",
      },
    );
  }
  if (!gate.pass) {
    return ud(
      "REJECT",
      "high",
      `knowledge_v2 命中真实性红线 → 拒绝晋升：${gate.blocked.map((b) => b.rule).join(",")}`,
      "deprecated",
      null,
      {
        violated_rule: gate.blocked[0]?.rule || RL3_VERIFIABLE,
        detected_problem: gate.blocked
          .map((b) => b.note)
          .join("；")
          .slice(0, 300),
        suggested_fix: "移除不可出证声明后重新提交知识",
        prevention_rule: "知识写回前置消费 prevention_rule，减少同类红线",
      },
    );
  }
  // 质量闸：confidence < 70 的低质碎片不晋升为可信上下文 → 退休 deprecated（收口，不留 review）
  if (!(confidence >= 70)) {
    return ud(
      "BLOCK",
      "medium",
      `knowledge_v2 过真实性闸但 confidence ${confidence} < 70（低质/原始碎片）→ 不晋升 active，退休 deprecated（无后续人工审批意义，收口避免虚假 backlog）`,
      "deprecated",
      null,
      {
        violated_rule: "Quality Gate（truthfulness≠quality，低置信不晋升可信上下文）",
        detected_problem: `confidence ${confidence} 低于阈值 70（L0 原始碎片）`,
        suggested_fix: "如需保留，提炼为高置信知识后重新提交（新条目走 review→active）",
        prevention_rule: "知识抽取阶段提高 confidence 门槛，减少低质碎片进入 review 队列",
      },
    );
  }
  return ud(
    "PASS",
    "low",
    `knowledge_v2 过真实性闸（${gate.blocked.length === 0 ? "无红线" : "仅警告"}）+ confidence ${confidence}≥70 → 晋升 active 成为可信 AI 上下文`,
    "active",
    null,
  );
}

/**
 * video_asset family 政策：editorial_status='review' 的视频 → 对外发布属高可见度动作，
 * autonomy 模型 🔴MANUAL/🟡APPROVAL → EXCEPTION（owner 编辑签发），不改状态、留异常队列。
 */
export function decideVideo(c: DecisionCandidate): UnifiedDecision {
  return ud(
    "EXCEPTION",
    "owner_only",
    `video_asset #${c.entity_id} 处于 editorial review：视频对外发布属高可见度动作（🔴MANUAL/🟡APPROVAL）→ 须 Owner 编辑签发，AI 不自动批准`,
    null,
    null,
    {
      violated_rule: "Publish Boundary（对外发布须 owner 签发）",
      detected_problem: "视频编辑评审属对外发布前置",
      suggested_fix: "Owner 在 Video Center 签发/退回",
      prevention_rule: "视频发布保持人工签发，不纳入自动 PASS",
    },
  );
}

/**
 * ai_mission family 政策：human_approval_needed=1 的 mission → 按定义即须 Owner 批准
 * → EXCEPTION（owner_only），不改状态、留异常队列。
 */
export function decideMission(c: DecisionCandidate): UnifiedDecision {
  return ud(
    "EXCEPTION",
    "owner_only",
    `ai_mission #${c.entity_id} 被标记 human_approval_needed=1 → 按设计须 Owner 最终批准，AI 不自动裁决`,
    null,
    null,
    {
      violated_rule: "Owner Approval Required（mission 显式请求人工批准）",
      detected_problem: "human_approval_needed=1 且 human_approved_by IS NULL",
      suggested_fix: "Owner 在 Command Center 批准/拒绝该 mission",
      prevention_rule: "mission 仅在真正须 owner 决策时置 human_approval_needed，避免滥用",
    },
  );
}

/** growth_opportunity family 政策：复用上一轮 evaluateOpportunity（B/C 机会）。 */
export function decideGrowthOpportunity(c: DecisionCandidate): UnifiedDecision {
  const o = c.evidence as unknown as OpportunityRow;
  const r = evaluateOpportunity(o);
  const map: Record<Decision, UnifiedDecisionType> = {
    PASS: "PASS",
    FIX_THEN_PASS: "FIX",
    REJECT: "REJECT",
    BLOCK: "BLOCK",
  };
  return ud(
    map[r.decision],
    r.decision === "BLOCK" ? "owner_only" : r.decision === "REJECT" ? "high" : "low",
    r.reason,
    r.status,
    null,
    {
      violated_rule: r.violated_rule,
      detected_problem: r.detected_problem,
      suggested_fix: r.suggested_fix,
      prevention_rule: r.prevention_rule,
    },
  );
}

// ---- Family 适配器注册表（§二：一个统一层，各模块只提供 candidate/evidence）----

export interface FamilyAdapter {
  entity_type: string;
  decide: (c: DecisionCandidate) => UnifiedDecision;
  /** 扫描本 family 的待人工队列（走索引 + LIMIT），映射为候选（含 evidence）。 */
  scan: (db: D1Database, limit: number) => Promise<DecisionCandidate[]>;
  /** CAS 写实体终态（WHERE 带旧状态仲裁并发）；entity_status 为 null 时不写。 */
  casEntity: (db: D1Database, c: DecisionCandidate, status: string) => D1PreparedStatement | null;
}

/** task family：扫描 pending L2/L4 任务（走 idx_tasks_status_mode）。 */
const taskAdapter: FamilyAdapter = {
  entity_type: "task",
  decide: decideTask,
  async scan(db, limit) {
    const res = await db
      .prepare(
        `SELECT id, task_type, execution_mode, status, payload, title, roi_score, idempotency_key
         FROM tasks WHERE status = 'pending' AND execution_mode IN ('L2','L4')
         ORDER BY created_at ASC, id ASC LIMIT ?`,
      )
      .bind(limit)
      .all();
    return ((res.results as D1Row[]) || []).map((r) => {
      const tt = String(r.task_type || "");
      const idem = String(r.idempotency_key || "");
      return {
        entity_type: "task",
        entity_id: String(r.id),
        task_id: Number(r.id),
        source: "tasks",
        // 指纹：task 以 idempotency_key 去重（无则用 id）；每个任务只裁决一次
        fingerprint: `task|${tt}|${idem || `id:${r.id}`}`,
        evidence: {
          task_type: tt,
          execution_mode: String(r.execution_mode || ""),
          payload: String(r.payload || "{}"),
          title: String(r.title || ""),
          roi_score: Number(r.roi_score || 0),
        },
      } as DecisionCandidate;
    });
  },
  casEntity(db, c, status) {
    // CAS：仅当仍 pending 才改（防并发/防回写）；done/closed 落 completed_at
    const terminal = status === "done" || status === "closed";
    return db
      .prepare(
        `UPDATE tasks SET status = ?, result = ?, completed_at = ? WHERE id = ? AND status = 'pending'`,
      )
      .bind(
        status,
        `[AI Decision Layer ${POLICY_VERSION}] ${status}`,
        terminal ? Math.floor(Date.now() / 1000) : null,
        Number(c.entity_id),
      );
  },
};

/** growth_opportunity family：扫描 B/C new（走 idx_growth_opp_status_exec）。 */
const growthAdapter: FamilyAdapter = {
  entity_type: "growth_opportunity",
  decide: decideGrowthOpportunity,
  async scan(db, limit) {
    const res = await db
      .prepare(
        `SELECT id, week, opp_type, page, query, priority, exec_level, reason,
                suggested_action, metrics_json, intent, score_json, status, task_id, created_at
         FROM growth_opportunities
         WHERE status = 'new' AND exec_level IN ('B','C')
         ORDER BY created_at ASC, id ASC LIMIT ?`,
      )
      .bind(limit)
      .all();
    return ((res.results as D1Row[]) || []).map((r) => {
      const o = mapRow(r);
      return {
        entity_type: "growth_opportunity",
        entity_id: String(o.id),
        task_id: o.task_id,
        source: "growth_opportunities",
        fingerprint: fingerprintOpportunity(o),
        evidence: o as unknown as Record<string, unknown>,
      } as DecisionCandidate;
    });
  },
  casEntity(db, c, status) {
    return db
      .prepare(`UPDATE growth_opportunities SET status = ? WHERE id = ? AND status = 'new'`)
      .bind(status, Number(c.entity_id));
  },
};

/** knowledge_v2 family：扫描 review（走 idx_kb_v2_status）。 */
const knowledgeAdapter: FamilyAdapter = {
  entity_type: "knowledge_v2",
  decide: decideKnowledge,
  async scan(db, limit) {
    // decided-exclusion：BLOCK 决策不改 knowledge_v2 状态（留 review），故用
    // NOT IN(已决策 entity_id) 排除，避免低质 BLOCK 项每轮被重复扫描而堵塞批量/饿死新项。
    // 子查询走 idx_decisions_entity(entity_type, entity_id)。
    const res = await db
      .prepare(
        `SELECT id, title, content, confidence, category, layer FROM knowledge_v2
         WHERE status = 'review'
           AND id NOT IN (SELECT entity_id FROM decisions WHERE entity_type = 'knowledge_v2')
         ORDER BY updated_at ASC LIMIT ?`,
      )
      .bind(limit)
      .all();
    return ((res.results as D1Row[]) || []).map(
      (r) =>
        ({
          entity_type: "knowledge_v2",
          entity_id: String(r.id),
          task_id: null,
          source: "knowledge_v2",
          fingerprint: `knowledge_v2|${r.id}`,
          evidence: {
            title: String(r.title || ""),
            content: String(r.content || ""),
            confidence: Number(r.confidence || 0),
          },
        }) as DecisionCandidate,
    );
  },
  casEntity(db, c, status) {
    return db
      .prepare(
        `UPDATE knowledge_v2 SET status = ?, verified_by = ?, updated_at = ? WHERE id = ? AND status = 'review'`,
      )
      .bind(status, "ai-decision-layer", new Date().toISOString(), c.entity_id);
  },
};

/** video_asset family：扫描 editorial review（走 idx_video_assets_editorial_status）。 */
const videoAdapter: FamilyAdapter = {
  entity_type: "video_asset",
  decide: decideVideo,
  async scan(db, limit) {
    const res = await db
      .prepare(
        `SELECT id, title, editorial_status FROM video_assets
         WHERE editorial_status = 'review' ORDER BY id ASC LIMIT ?`,
      )
      .bind(limit)
      .all();
    return ((res.results as D1Row[]) || []).map(
      (r) =>
        ({
          entity_type: "video_asset",
          entity_id: String(r.id),
          task_id: null,
          source: "video_assets",
          fingerprint: `video_asset|${r.id}`,
          evidence: {
            title: String(r.title || ""),
            editorial_status: String(r.editorial_status || ""),
          },
        }) as DecisionCandidate,
    );
  },
  // EXCEPTION：不改状态（留异常队列，owner 可见），仅靠 fingerprint 去重
  casEntity() {
    return null;
  },
};

/** ai_mission family：扫描 human_approval_needed=1 且未批准。 */
const missionAdapter: FamilyAdapter = {
  entity_type: "ai_mission",
  decide: decideMission,
  async scan(db, limit) {
    const res = await db
      .prepare(
        `SELECT id, mission_type, agent_name FROM ai_missions
         WHERE human_approval_needed = 1 AND human_approved_by IS NULL
         ORDER BY id ASC LIMIT ?`,
      )
      .bind(limit)
      .all();
    return ((res.results as D1Row[]) || []).map(
      (r) =>
        ({
          entity_type: "ai_mission",
          entity_id: String(r.id),
          task_id: null,
          source: "ai_missions",
          fingerprint: `ai_mission|${r.id}`,
          evidence: {
            mission_type: String(r.mission_type || ""),
            agent_name: String(r.agent_name || ""),
          },
        }) as DecisionCandidate,
    );
  },
  casEntity() {
    return null; // EXCEPTION：不改状态
  },
};

/** 全部已登记 family（统一调度入口按此顺序处理，受全局预算约束）。 */
export const FAMILY_ADAPTERS: FamilyAdapter[] = [
  taskAdapter,
  growthAdapter,
  knowledgeAdapter,
  videoAdapter,
  missionAdapter,
];

// ---- 统一运行结果 ----

export interface FamilyStats {
  scanned: number;
  passed: number;
  fixed: number;
  rejected: number;
  blocked: number;
  exception: number;
  duplicates: number;
  casLost: number;
  truncated: boolean;
  errors: string[];
}
export interface UnifiedRunStats {
  policy_version: string;
  dryRun: boolean;
  budgetHit: boolean;
  totalScanned: number;
  totalDecided: number;
  totalDuplicates: number;
  families: Record<string, FamilyStats>;
  errors: string[];
}

export interface RunUnifiedOptions {
  families?: string[]; // 缺省=全部已登记
  familyBatchLimit?: number;
  globalBudget?: number;
  dryRun?: boolean;
  now?: number;
}

function emptyFamilyStats(): FamilyStats {
  return {
    scanned: 0,
    passed: 0,
    fixed: 0,
    rejected: 0,
    blocked: 0,
    exception: 0,
    duplicates: 0,
    casLost: 0,
    truncated: false,
    errors: [],
  };
}

/**
 * 全局统一 Decision Layer 运行入口（§十三 Decision Processing Pipeline）。
 * 复用既有 Automation Tick / cron-pull 调度，不新增 scheduler。
 *
 * 每 family：扫描（索引+LIMIT）→ 指纹批量去重（单条 IN）→ 逐条 policy 裁决（纯内存）
 * → 统一审计 INSERT OR IGNORE（fingerprint UNIQUE）→ CAS 写实体终态。
 * 全局候选预算达到即停（checkpoint：未处理项下轮续跑）。
 */
export async function runUnifiedDecisionLayer(
  db: D1Database,
  opts: RunUnifiedOptions = {},
): Promise<UnifiedRunStats> {
  const familyBatchLimit = Math.max(1, Math.min(500, opts.familyBatchLimit ?? FAMILY_BATCH_LIMIT));
  const globalBudget = Math.max(1, opts.globalBudget ?? GLOBAL_CANDIDATE_BUDGET);
  const dryRun = !!opts.dryRun;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const wantFamilies = opts.families && opts.families.length > 0 ? new Set(opts.families) : null;

  const out: UnifiedRunStats = {
    policy_version: POLICY_VERSION,
    dryRun,
    budgetHit: false,
    totalScanned: 0,
    totalDecided: 0,
    totalDuplicates: 0,
    families: {},
    errors: [],
  };

  let globalProcessed = 0;

  for (const adapter of FAMILY_ADAPTERS) {
    if (wantFamilies && !wantFamilies.has(adapter.entity_type)) continue;
    const fs = emptyFamilyStats();
    out.families[adapter.entity_type] = fs;
    if (globalProcessed >= globalBudget) {
      out.budgetHit = true;
      continue; // 全局预算耗尽：本 family 留待下轮（checkpoint）
    }
    const limit = Math.min(familyBatchLimit, globalBudget - globalProcessed);

    // ① 扫描（索引 + LIMIT）
    let candidates: DecisionCandidate[];
    try {
      candidates = await adapter.scan(db, limit + 1);
    } catch (e) {
      fs.errors.push(`scan failed: ${e instanceof Error ? e.message : String(e)}`);
      out.errors.push(`${adapter.entity_type}: scan failed`);
      continue;
    }
    if (candidates.length > limit) {
      fs.truncated = true;
      candidates = candidates.slice(0, limit);
    }
    fs.scanned = candidates.length;
    globalProcessed += candidates.length;
    out.totalScanned += candidates.length;
    if (candidates.length === 0) continue;

    // ② 指纹批量去重（分块 IN，杜绝 N+1 + 规避 D1 绑定变量上限）
    const fps = candidates.map((c) => c.fingerprint);
    const decidedFp = new Set<string>();
    try {
      const rows = await chunkedFingerprintQuery<{ fingerprint: string }>(
        db,
        adapter.entity_type,
        fps,
        "fingerprint",
      );
      for (const r of rows) {
        const fp = String(r.fingerprint || "");
        if (fp) decidedFp.add(fp);
      }
    } catch (e) {
      fs.errors.push(`dedupe failed: ${e instanceof Error ? e.message : String(e)}`);
      out.errors.push(`${adapter.entity_type}: dedupe failed`);
      continue; // fail-safe：去重不可用则本轮不裁决该 family（宁可漏跑不可重复决策）
    }

    // ③ 逐条裁决（纯内存）+ 收集写入
    const auditInserts: D1PreparedStatement[] = [];
    const entityUpdates: D1PreparedStatement[] = [];
    const seenBatch = new Set<string>();

    for (const c of candidates) {
      // 去重：已裁决（跨轮）或批内重复 → 跳过，不新建决策
      if (decidedFp.has(c.fingerprint) || seenBatch.has(c.fingerprint)) {
        fs.duplicates++;
        out.totalDuplicates++;
        continue;
      }
      seenBatch.add(c.fingerprint);

      let d: UnifiedDecision;
      try {
        d = adapter.decide(c);
      } catch (e) {
        // policy 自身异常 → 保守 BLOCK，绝不误 PASS
        d = ud(
          "BLOCK",
          "high",
          `policy 异常 → 保守 BLOCK：${String(e).slice(0, 160)}`,
          null,
          null,
          {
            violated_rule: "Fail-safe（policy 异常宁可 BLOCK）",
            detected_problem: "decide() 抛错",
            suggested_fix: "修复 policy 异常后重审",
            prevention_rule: "policy 异常不得静默放行",
          },
        );
      }
      if (d.decision === "PASS") fs.passed++;
      else if (d.decision === "FIX") fs.fixed++;
      else if (d.decision === "REJECT") fs.rejected++;
      else if (d.decision === "BLOCK") fs.blocked++;
      else fs.exception++;
      out.totalDecided++;

      if (dryRun) continue;

      // 统一审计（fingerprint UNIQUE + INSERT OR IGNORE → 幂等/并发安全）
      const decisionStatus =
        d.decision === "PASS" || d.decision === "FIX"
          ? "adopted"
          : d.decision === "REJECT"
            ? "rejected"
            : "blocked";
      auditInserts.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO decisions
               (suggestion, status, reason, task_id, rejection_reason, created_at,
                opp_id, decision, fingerprint, violated_rule, prevention_rule,
                detected_problem, suggested_fix, source, payload_json,
                entity_type, entity_id, risk_level, evidence, policy_version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            `${c.entity_type}#${c.entity_id}`.slice(0, 500),
            decisionStatus,
            d.reason.slice(0, 1000),
            c.task_id,
            d.decision === "REJECT" ? d.violated_rule : "",
            now,
            c.entity_type === "growth_opportunity" ? Number(c.entity_id) : null,
            d.decision,
            c.fingerprint,
            d.violated_rule,
            d.prevention_rule,
            d.detected_problem,
            d.suggested_fix,
            c.source,
            JSON.stringify({ decision: d.decision, risk_level: d.risk_level, reason: d.reason }),
            c.entity_type,
            c.entity_id,
            d.risk_level,
            JSON.stringify(c.evidence).slice(0, 4000),
            POLICY_VERSION,
          ),
      );

      // CAS 写实体终态（PASS/REJECT/BLOCK 有终态；EXCEPTION/无终态 → 仅审计 + 去重）
      if (d.entity_status) {
        const stmt = adapter.casEntity(db, c, d.entity_status);
        if (stmt) entityUpdates.push(stmt);
      }
    }

    if (dryRun) continue;

    // ④ 原子批写入
    try {
      if (auditInserts.length > 0) await db.batch(auditInserts);
    } catch (e) {
      fs.errors.push(`audit insert failed: ${e instanceof Error ? e.message : String(e)}`);
      out.errors.push(`${adapter.entity_type}: audit insert failed`);
    }
    try {
      if (entityUpdates.length > 0) {
        const results = (await db.batch(entityUpdates)) as { meta?: { changes?: number } }[];
        for (const r of results || []) if (Number(r?.meta?.changes ?? 1) === 0) fs.casLost++;
      }
    } catch (e) {
      fs.errors.push(`entity CAS failed: ${e instanceof Error ? e.message : String(e)}`);
      out.errors.push(`${adapter.entity_type}: entity CAS failed`);
    }

    if (globalProcessed >= globalBudget) out.budgetHit = true;
  }

  return out;
}
