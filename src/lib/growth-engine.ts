// ---------------------------------------------------------------------------
//  Jewelry V5.34→V5.35 — Organic Growth Intelligence · Opportunity Engine
//
//  纯函数机会引擎：GSC 数据 → SEO Growth Action Board（机会清单）。
//  规则源：docs/ORGANIC_GROWTH_DESIGN.md（V5.34）+
//         docs/ORGANIC_GROWTH_AGENT_PHASE2.md（V5.35 owner 设计稿）。
//  设计原则：
//   - 纯函数、无 IO，可单测；阈值命名常量，便于观察期后调参。
//   - SEO Change Risk Management：排名好的页面先标 protect（NO ACTION），
//     且 protect 页面不再产出其他改动类机会——「憋得住」原则代码化。
//   - 执行三级：A 技术项 / B 进审核 / C owner 确认（商业字段绝不 AI 填）。
//   - 不批量造页：content_gap 的动作永远是「先判现有页面能否吃掉」。
//  V5.35 新增：
//   - Query Intent Mapping（classifyIntent）：四类意图 + 双向落地页错配检测。
//   - Opportunity Impact Ranking（scoreOpportunity）：Growth Score 给「动作」
//     排序（Impact × Confidence ÷ Effort，Risk 衰减）——Opportunity Economics。
// ---------------------------------------------------------------------------

export interface QueryPageAgg {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface PageAgg {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface IndexEntry {
  url: string;
  status: string; // indexed / crawled_not_indexed / discovered_not_indexed / duplicate / not_found / unknown
}

export interface ShoppingProduct {
  slug: string;
  title: string;
  featured: boolean;
  missingTech: string[]; // 图片/描述/价格阶梯等技术字段
  missingBiz: string[]; // brand/GTIN 等业务字段（owner 提供）
}

export interface EngineInput {
  queryPages: QueryPageAgg[];
  pages: PageAgg[];
  indexStatuses: IndexEntry[];
  shopping: ShoppingProduct[];
}

export type OppType =
  | "page1_candidate"
  | "protect"
  | "low_ctr"
  | "content_gap"
  | "query_page_mismatch"
  | "index_issue"
  | "shopping"
  // V5.35 Technical Audit 产出类型（growth-audit.ts）
  | "meta_fix"
  | "internal_link"
  | "alt_text_fill";

export type Priority = "P0" | "P1" | "P2";
export type ExecLevel = "A" | "B" | "C";

/** V5.35 Query Intent Mapping：搜索意图四分类。 */
export type QueryIntent = "commercial" | "transactional" | "informational" | "navigational";

/** V5.35 Opportunity Impact Ranking：Growth Score 五元组（给「动作」排序）。 */
export interface GrowthScore {
  impact: number; // 0-100：商业价值潜力（曝光 × 意图 × 机会类型）
  effort: number; // 1-10：执行成本（技术修补低、新建内容高）
  confidence: number; // 0-1：数据置信度（样本量 / 确定性审计）
  risk: number; // 0-1：执行风险（A 低 / B 中 / C 高）
  score: number; // impact × confidence ÷ effort × (1 − risk/2)，保留一位
}

export interface Opportunity {
  opp_type: OppType;
  page: string;
  query: string;
  priority: Priority;
  exec_level: ExecLevel;
  reason: string;
  suggested_action: string;
  metrics: Record<string, number | string>;
  /** V5.35：query 意图标注（无 query 的机会为 null）。 */
  intent?: QueryIntent | null;
  /** V5.35：Growth Score（protect 恒为 0 分沉底）。 */
  score?: GrowthScore;
  /** V5.35：审计项对应的已注册任务类型（autofix 开关开启时按此路由 L3）。 */
  fix_type?: string;
}

// ---- 阈值（观察期后可调，只调常量不改逻辑） ---------------------------------
const PAGE1_MIN_IMPR = 100; // 机会 A：曝光下限
const PAGE1_POS_MIN = 10; // 未进第一页
const PAGE1_POS_MAX = 30; // 超出 30 视为无有效竞争（走 content_gap）
const PAGE1_P0_IMPR = 500; // 曝光 ≥500 升 P0
const PROTECT_POS_MAX = 10; // Top 10 保护线
const PROTECT_MIN_CLICKS = 5; // 28 天点击下限（有真实流量才保护）
const LOWCTR_POS_MAX = 10;
const LOWCTR_MIN_IMPR = 50;
const LOWCTR_CTR_MAX = 0.02; // 排名好但 CTR <2% → 重写 Title/Meta
const GAP_MIN_IMPR = 200;
const GAP_CTR_MAX = 0.01;
const GAP_POS_MIN = 20;
const MISMATCH_MIN_IMPR = 100;
const MISMATCH_POS_MAX = 30;

/** 信息意图词特征（guide/how/what…）——落到产品页即为 query→page 错配。 */
const INFO_INTENT_RE =
  /\b(how|what|why|where|guide|tips?|ideas?|vs\.?|versus|checklist|meaning|benefits?|examples?)\b/i;

/** V5.35：商业调研意图（B2B 找供应商 / OEM / 批发）。 */
const COMMERCIAL_INTENT_RE =
  /\b(manufactur\w*|supplier\w*|wholesal\w*|distribut\w*|factor(?:y|ies)|oem|odm|private\s+label|white\s+label|bulk|vendor\w*|exporter\w*|trader\w*|sourcing|moq|b2b)\b/i;

/** V5.35：交易意图（询价 / 下单 / 价格）。 */
const TRANSACTIONAL_INTENT_RE =
  /\b(buy|purchase|order|price\w*|pricing|cost|quot\w*|for\s+sale|shop|cheap|discount)\b/i;

/** V5.35：导航意图（品牌词）。TBC: brand terms pending final brand name. */
const NAVIGATIONAL_RE = /\bjewelry\b/i;

/**
 * V5.35 Query Intent Mapping：搜索意图四分类。
 * 判定优先级：品牌词 > 商业调研（B2B 采购）> 交易（询价/下单）> 信息（学习内容）；
 * 都不命中的裸产品词默认 transactional（找产品）。
 */
export function classifyIntent(query: string): QueryIntent {
  const q = (query || "").trim();
  if (!q) return "informational";
  if (NAVIGATIONAL_RE.test(q)) return "navigational";
  if (COMMERCIAL_INTENT_RE.test(q)) return "commercial";
  if (TRANSACTIONAL_INTENT_RE.test(q)) return "transactional";
  if (INFO_INTENT_RE.test(q)) return "informational";
  return "transactional";
}

// ---- V5.35 Opportunity Impact Ranking（给「动作」排序，Opportunity Economics）----

/** 机会类型 → 商业价值权重（同条件下：技术修补 > 改写 > 新建）。 */
const TYPE_IMPACT_WEIGHT: Record<OppType, number> = {
  page1_candidate: 1.0,
  low_ctr: 1.0,
  query_page_mismatch: 0.9,
  index_issue: 0.85,
  meta_fix: 0.8,
  internal_link: 0.8,
  alt_text_fill: 0.6,
  content_gap: 0.7,
  shopping: 0.65,
  protect: 0,
};

/** 机会类型 → 基础执行成本（1-10；越接近「新建」越贵）。 */
const TYPE_EFFORT: Record<OppType, number> = {
  index_issue: 2,
  meta_fix: 2,
  internal_link: 2,
  alt_text_fill: 2,
  low_ctr: 3, // 重写 Title/Meta
  page1_candidate: 4, // Meta + 内链微调
  shopping: 4, // 字段补录（业务字段须 owner）
  query_page_mismatch: 5, // 内链 + 章节重组评估
  content_gap: 7, // 先评估「现有页面能否吃掉」，可能新建
  protect: 10, // 不动
};

const EXEC_RISK: Record<ExecLevel, number> = { A: 0.1, B: 0.4, C: 0.8 };

/** 确定性审计类机会的置信度地板（不依赖 GSC 样本量）。 */
const DETERMINISTIC_CONFIDENCE: Partial<Record<OppType, number>> = {
  shopping: 0.95,
  meta_fix: 0.95,
  internal_link: 0.95,
  alt_text_fill: 0.95,
  index_issue: 0.7,
};

/**
 * V5.35 Growth Score：给「动作」排序而非给页面打分。
 * score = impact × confidence ÷ effort × (1 − risk/2)；protect 恒 0 分。
 */
export function scoreOpportunity(o: Opportunity): GrowthScore {
  if (o.opp_type === "protect") {
    return { impact: 0, effort: 10, confidence: 1, risk: 1, score: 0 };
  }
  const impr = num(o.metrics.impressions);
  const pos = num(o.metrics.position);
  // impact：曝光基数（1000 次=满分）+ 临近首页加成 + 商业意图加成
  let impact = Math.min(100, impr / 10);
  if (pos > 0 && pos <= 12) impact = Math.min(100, impact + 15);
  if (o.intent === "commercial") impact = Math.min(100, impact * 1.25);
  else if (o.intent === "transactional") impact = Math.min(100, impact * 1.1);
  impact = Math.round(impact * (TYPE_IMPACT_WEIGHT[o.opp_type] ?? 0.7));
  // 确定性技术审计即使没有 GSC 曝光也有基础价值
  if (impr === 0 && impact < 25 && (TYPE_EFFORT[o.opp_type] ?? 10) <= 2) impact = 25;
  const effort = TYPE_EFFORT[o.opp_type] ?? 5;
  let confidence =
    impr >= 500 ? 0.9 : impr >= 200 ? 0.7 : impr >= 100 ? 0.55 : impr >= 50 ? 0.4 : 0.25;
  confidence = Math.max(confidence, DETERMINISTIC_CONFIDENCE[o.opp_type] ?? 0);
  const risk = EXEC_RISK[o.exec_level] ?? 0.5;
  const score = Math.round(((impact * confidence) / effort) * (1 - risk / 2) * 10) / 10;
  return { impact, effort, confidence, risk, score };
}

/** 去掉域名，board 展示更短。 */
export function shortPage(page: string): string {
  return page.replace(/^https?:\/\/[^/]+/, "") || page;
}

// ---- Engine -----------------------------------------------------------------

export function runGrowthEngine(input: EngineInput): Opportunity[] {
  const opps: Opportunity[] = [];
  const protectedPages = new Set<string>();

  // ① protect 先行（SEO Change Risk Management）：排名好 + 有点击 → NO ACTION
  for (const p of input.pages) {
    if (p.position > 0 && p.position <= PROTECT_POS_MAX && p.clicks >= PROTECT_MIN_CLICKS) {
      protectedPages.add(p.page);
      opps.push({
        opp_type: "protect",
        page: p.page,
        query: "",
        priority: "P2",
        exec_level: "A",
        reason: `排名 ${p.position.toFixed(1)}（Top ${Math.round(p.position)}）且 28 天 ${p.clicks} 次点击——保护当前状态`,
        suggested_action: "NO ACTION —— 不做结构性修改；如需改动须先记录 Growth Memory 基线",
        metrics: { impressions: p.impressions, clicks: p.clicks, position: round1(p.position) },
      });
    }
  }

  // ② 页面级机会（protect 页面跳过——憋得住）
  for (const p of input.pages) {
    if (protectedPages.has(p.page)) continue;
    const topQueries = input.queryPages
      .filter((qp) => qp.page === p.page)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 3)
      .map((q) => q.query);

    if (
      p.impressions >= PAGE1_MIN_IMPR &&
      p.position >= PAGE1_POS_MIN &&
      p.position <= PAGE1_POS_MAX
    ) {
      // 机会 A：高曝光、接近第一页
      opps.push({
        opp_type: "page1_candidate",
        page: p.page,
        query: topQueries[0] || "",
        priority: p.impressions >= PAGE1_P0_IMPR ? "P0" : "P1",
        exec_level: "B",
        reason: `${p.impressions} 次曝光、排名 ${p.position.toFixed(1)}，接近第一页但未进入`,
        suggested_action: `优化 Title/Meta 与搜索意图匹配（顶词：${topQueries.join(" / ") || "见 board"}）+ 相关页内链加强；不动正文结构`,
        metrics: {
          impressions: p.impressions,
          clicks: p.clicks,
          ctr: round4(p.ctr),
          position: round1(p.position),
        },
      });
    } else if (
      p.position > 0 &&
      p.position < LOWCTR_POS_MAX &&
      p.impressions >= LOWCTR_MIN_IMPR &&
      p.ctr < LOWCTR_CTR_MAX
    ) {
      // 机会 B：排名好但 CTR 低
      opps.push({
        opp_type: "low_ctr",
        page: p.page,
        query: topQueries[0] || "",
        priority: "P1",
        exec_level: "B",
        reason: `排名 ${p.position.toFixed(1)} 但 CTR 仅 ${(p.ctr * 100).toFixed(1)}%——SERP 展示不吸引人`,
        suggested_action:
          "重写 Title/Meta 突出 B2B 决策点（MOQ / OEM / 样品 / 交期），文案须过真实性闸",
        metrics: {
          impressions: p.impressions,
          clicks: p.clicks,
          ctr: round4(p.ctr),
          position: round1(p.position),
        },
      });
    } else if (p.impressions >= GAP_MIN_IMPR && p.ctr < GAP_CTR_MAX && p.position >= GAP_POS_MIN) {
      // 机会 C：有需求但页面在有效竞争区外
      opps.push({
        opp_type: "content_gap",
        page: p.page,
        query: topQueries[0] || "",
        priority: "P1",
        exec_level: "B",
        reason: `${p.impressions} 次曝光、排名 ${p.position.toFixed(1)}，页面尚未进入有效竞争区间`,
        suggested_action:
          "先判断现有页面能否通过内链/内容调整吃掉这些词（人工审核）；仅当评估通过才考虑新建 supporting content，禁止批量造页",
        metrics: {
          impressions: p.impressions,
          clicks: p.clicks,
          ctr: round4(p.ctr),
          position: round1(p.position),
        },
      });
    }
  }

  // ③ Query→Page 映射（V5.35 双向意图错配检测）：
  //    信息意图词落产品/商城页 = 错配；商业/交易意图词落博客/指南页 = 错配
  for (const qp of input.queryPages) {
    if (qp.impressions < MISMATCH_MIN_IMPR || qp.position > MISMATCH_POS_MAX) continue;
    const intent = classifyIntent(qp.query);
    const onProduct = /\/(products?|shop)\//.test(qp.page);
    const onContent = /\/(blog|resources?|guides?)\//.test(qp.page);
    if (intent === "informational" && onProduct) {
      opps.push({
        opp_type: "query_page_mismatch",
        page: qp.page,
        query: qp.query,
        priority: "P1",
        exec_level: "B",
        intent,
        reason: `信息意图词「${qp.query}」当前落地产品页（${shortPage(qp.page)}），意图不匹配`,
        suggested_action:
          "评估用现有 guide/blog 承接（现有页加内链 + 对应章节）；没有合适现有页才进入新建评估（人工）",
        metrics: { impressions: qp.impressions, clicks: qp.clicks, position: round1(qp.position) },
      });
    } else if ((intent === "commercial" || intent === "transactional") && onContent) {
      opps.push({
        opp_type: "query_page_mismatch",
        page: qp.page,
        query: qp.query,
        priority: "P1",
        exec_level: "B",
        intent,
        reason: `采购意图词「${qp.query}」（${intent}）落在内容页（${shortPage(qp.page)}），商业流量未被转化路径承接`,
        suggested_action:
          "在该内容页补产品/OEM/询盘深链（内链注入，须人工审核）；评估是否需要专门的产品/OEM 落地页承接",
        metrics: { impressions: qp.impressions, clicks: qp.clicks, position: round1(qp.position) },
      });
    }
  }

  // ④ Index 问题
  for (const ix of input.indexStatuses) {
    if (ix.status === "indexed") continue;
    const impr = input.pages.find((p) => p.page === ix.url)?.impressions ?? 0;
    if (ix.status === "not_found") {
      opps.push({
        opp_type: "index_issue",
        page: ix.url,
        query: "",
        priority: "P0",
        exec_level: "A",
        reason: "URL 返回 404 或不存在",
        suggested_action: "301 到最近似现有页（_redirects 需人工推送）或从 sitemap 移除",
        metrics: { impressions: impr },
      });
    } else if (ix.status === "duplicate") {
      opps.push({
        opp_type: "index_issue",
        page: ix.url,
        query: "",
        priority: "P1",
        exec_level: "A",
        reason: "Google 判定重复页",
        suggested_action: "检查 canonical 是否指向规范版本（多语言页须 hreflang + canonical 一致）",
        metrics: { impressions: impr },
      });
    } else if (ix.status === "crawled_not_indexed" || ix.status === "discovered_not_indexed") {
      opps.push({
        opp_type: "index_issue",
        page: ix.url,
        query: "",
        priority: impr > 100 ? "P0" : "P1",
        exec_level: "A",
        reason: ix.status === "crawled_not_indexed" ? "已抓取但未收录" : "已发现但未抓取",
        suggested_action:
          "检查 canonical/noindex/robots；从相关分类/指南页补内链入口；确认在 sitemap 且非孤岛页",
        metrics: { impressions: impr },
      });
    } else {
      opps.push({
        opp_type: "index_issue",
        page: ix.url,
        query: "",
        priority: "P2",
        exec_level: "A",
        reason: "索引状态未知，需复查",
        suggested_action: "下次同步复查 URL Inspection",
        metrics: { impressions: impr },
      });
    }
  }

  // ⑤ Shopping 齐备度（Google Merchant Center 上架前置审计）
  for (const s of input.shopping) {
    if (s.missingTech.length === 0 && s.missingBiz.length === 0) continue;
    const hasBiz = s.missingBiz.length > 0;
    opps.push({
      opp_type: "shopping",
      page: `/en/product/${s.slug}`,
      query: "",
      priority: s.featured ? "P1" : "P2",
      exec_level: hasBiz ? "C" : "A",
      reason: `Shopping 字段不齐：${[...s.missingTech, ...s.missingBiz].join(" / ")}`,
      suggested_action: hasBiz
        ? "brand / GTIN 等业务字段须 owner 提供后人工补录，AI 不得自填"
        : "补全技术字段（主图 / 描述 / 价格阶梯）",
      metrics: {
        featured: s.featured ? 1 : 0,
        missing: s.missingTech.length + s.missingBiz.length,
      },
    });
  }

  // V5.35：意图标注 + Growth Score，然后按得分给「动作」排序（protect 恒沉底）
  for (const o of opps) {
    if (!o.intent) o.intent = o.query ? classifyIntent(o.query) : null;
    o.score = scoreOpportunity(o);
  }
  opps.sort(
    (a, b) =>
      (a.opp_type === "protect" ? 1 : 0) - (b.opp_type === "protect" ? 1 : 0) ||
      (b.score?.score ?? 0) - (a.score?.score ?? 0) ||
      num(b.metrics.impressions) - num(a.metrics.impressions),
  );
  return opps;
}

function num(v: number | string | undefined): number {
  return typeof v === "number" ? v : 0;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
