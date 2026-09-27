// ---------------------------------------------------------------------------
//  Aromiso OS 2.0 — Truthfulness First Runtime Policy（V5.33 / Agent OS Phase 1）
//  functions/lib/truthfulness.ts
//
//  架构蓝图（docs/AGENT_OS_BLUEPRINT.md）§12/§13 的落地：Truthfulness First
//  从「Prompt 约束」升级为「代码级 Runtime Policy」。事实裁定的唯一入口是
//  ./fact-registry.json —— Fact Authority Layer 运行时副本，源头为
//  docs/SUPPLY_CHAIN_CAPABILITIES.md（事实宪法）。改事实必须两处同步。
//
//  与 content-quality.ts 的分工：
//    content-quality —— 结构完整度（meta/正文/内链/溯源），机检客观信号；
//    truthfulness    —— 事实性（红线命中），本文件。
//  两闸都是必要条件：质量达标 ≠ 事实达标，任一不过草稿都不得进入 REVIEW 队列。
//
//  纯函数、零副作用、零外部依赖（不碰 KV / D1 / 网络）→ 可单测穷举。
//  判定原则「宁可误拦，不可漏放」：blocked 命中一律拦下（改写/重新生成），
//  warnings 不拦草稿、但必须随 REVIEW 任务展示给人工评审。
// ---------------------------------------------------------------------------

import registryJson from "./fact-registry.json";

/** Fact Registry 结构（与 fact-registry.json 对齐）。 */
export interface FactRegistry {
  version: number;
  updated: string;
  source: string;
  purpose: string;
  aromisoSelfHeld: { certifications: string[]; note: string };
  partnerFactoryHeld: {
    requiredWording: string[];
    certifications: string[];
    fragranceHouses: string[];
    documents: string[];
    note: string;
  };
  verifiableNumbers: { [k: string]: unknown; note: string };
  unverifiableClaims: string[];
  redLines: string[];
}

/** 运行时事实权威（Fact Authority Layer）：所有 Agent/Skill 的可信事实来源。 */
export const FACT_REGISTRY = registryJson as unknown as FactRegistry;

export type ClaimSeverity = "block" | "warn";

export interface ClaimHit {
  /** 规则 id，如 ifra-claim / attribution-drift / fabricated-stats。 */
  rule: string;
  severity: ClaimSeverity;
  /** 触犯的红线（fact-registry.redLines 原文）。 */
  redLine: string;
  /** 命中的原文片段（压缩空白、截断到 140 字符）。 */
  match: string;
  /** 中文原因，供 REVIEW 队列展示。 */
  note: string;
  /** 命中所在字段（checkContentDraft 填充；checkClaims 不填）。 */
  field?: string;
}

export interface TruthfulnessResult {
  /** blocked 为空即过闸；warnings 不拦草稿，随 REVIEW 交人工。 */
  pass: boolean;
  blocked: ClaimHit[];
  warnings: ClaimHit[];
}

// ---- 红线索引（取自 FACT_REGISTRY，不在代码里重复维护红线文案） ------------

const RL = FACT_REGISTRY.redLines;
const RL1_ATTRIBUTION = RL[0] || "#1 主体归属要准确";
const RL2_NO_FABRICATION = RL[1] || "#2 绝不编造数字";
const RL3_VERIFIABLE = RL[2] || "#3 认证/文件须可出证";
const RL4_NO_LEAK = RL[3] || "#4 不泄露供应链";
const RL5_NOT_PROMISE = RL[4] || "#5 能力≠承诺";

// ---- 事实清单（全部取自 FACT_REGISTRY） ------------------------------------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 认证名 → 宽松匹配（内部空格可伸缩、忽略大小写、带词边界）。 */
function certPattern(cert: string): RegExp {
  const core = escapeRegExp(cert).replace(/\s+/g, "[\\s\\u00A0]*");
  const lead = /^\w/.test(cert) ? "\\b" : "";
  const trail = /\w$/.test(cert) ? "\\b" : "";
  return new RegExp(lead + core + trail, "i");
}

/** 合作工厂持有的认证（跳过含斜杠等无法可靠词界匹配的条目）。 */
const PARTNER_CERTS = FACT_REGISTRY.partnerFactoryHeld.certifications
  .filter((c) => !c.includes("/"))
  .map((c) => ({ cert: c, re: certPattern(c) }));

/** 国际香精屋名单。 */
const FRAGRANCE_HOUSES = FACT_REGISTRY.partnerFactoryHeld.fragranceHouses.map((h) => ({
  name: h,
  re: new RegExp("\\b" + escapeRegExp(h) + "\\b", "i"),
}));

/** 「合作工厂 / 源头工厂 / 供应链」合规措辞（命中即视为归属正确）。 */
const PARTNER_WORDING = new RegExp(
  FACT_REGISTRY.partnerFactoryHeld.requiredWording
    .map((w) => escapeRegExp(w).replace(/\s+/g, "\\s+"))
    .join("|") + "|\\bsupply\\s+chain\\b",
  "i",
);

/** CE 是产品级认证，第一人称提及降级为 warning（人工判断措辞）。 */
const CE_CERT = "CE";

// ---- 文本切分 ---------------------------------------------------------------

/** 句子/行块切分（按换行与中英文句读）。 */
const SENTENCE_RE = /[^.!?\n。！？]+[.!?。！？]*/g;

function splitSentences(text: string): string[] {
  return (text.match(SENTENCE_RE) || []).map((s) => s.trim()).filter(Boolean);
}

// ---- 归属判定 ---------------------------------------------------------------

const SELF_RE = /\b(?:we|our|us|aromiso)\b/i;
/** 强归属动词：第一人称 + 「持有/是/获认证」→ 直接判漂移。 */
const STRONG_HOLD_RE =
  /\b(?:we|our|us|aromiso)\b[^.!?\n]{0,90}?\b(?:holds?|held|owns?|maintains?|operates?|is|are|was|were|certified)\b/i;
/** 弱归属动词：第一人称 + 「有/提供/使用」→ 降级 warning。 */
const WEAK_HAVE_RE =
  /\b(?:we|our|us|aromiso)\b[^.!?\n]{0,90}?\b(?:have|has|carry|carries|possess|provides?|offers?|supplies?|uses?|used)\b/i;

/** 红线 #5 的豁免措辞：标注「视订单而定」。 */
const HEDGE_RE =
  /\b(?:depending\s+on|depends?\s+on|subject\s+to|var(?:y|ies)|negotiable|final\s+order|order\s+quantity|case[- ]by[- ]case)\b/i;

// ---- 命中构造 ----------------------------------------------------------------

function truncate(s: string): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > 140 ? flat.slice(0, 137) + "…" : flat;
}

function hit(
  rule: string,
  severity: ClaimSeverity,
  redLine: string,
  match: string,
  note: string,
): ClaimHit {
  return { rule, severity, redLine, match: truncate(match), note };
}

function dedupe(hits: ClaimHit[]): ClaimHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = h.rule + "::" + h.match.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---- 主入口：全文规则 --------------------------------------------------------
// 数字/评级类模式可能跨句读（如 "Rated 4.9/5"），在全文上扫描，但用
// [^.!?\n] 限制窗口，避免误把两个无关句子拼成一个「证据」。

function scanFullText(text: string, blocked: ClaimHit[], _warnings: ClaimHit[]): void {
  // 红线 #3：IFRA 证书 / 合规声明（IFRA 是香精屋符合性声明而非认证，站内无证书）
  if (
    /\bIFRA[\s-]+certif/i.test(text) ||
    /\bIFRA[\s-]+complian/i.test(text) ||
    /\bIFRA\s+certificates?\b/i.test(text)
  ) {
    blocked.push(
      hit(
        "ifra-claim",
        "block",
        RL3_VERIFIABLE,
        (text.match(/[^.!?\n]*IFRA[^.!?\n]*/i) || ["IFRA claim"])[0],
        "IFRA 证书/合规声明不可核实：IFRA 是香精屋符合性声明而非认证（红线 #3）",
      ),
    );
  }

  // 红线 #3：「每批标配 GC-MS」= 证据范围扩张（个别案例做过 ≠ 每批标配）
  if (
    /\bGC[- ]?MS\b[^.!?\n]{0,80}\b(?:every|each|all|any)\b[^.!?\n]{0,40}\b(?:lots?|batches|shipments?|orders?)\b/i.test(
      text,
    ) ||
    /\b(?:every|each|all|any)\s+(?:lots?|batches|shipments?|orders?)\b[^.!?\n]{0,80}\bGC[- ]?MS\b/i.test(
      text,
    )
  ) {
    blocked.push(
      hit(
        "gcms-every-lot",
        "block",
        RL3_VERIFIABLE,
        (text.match(/[^.!?\n]*GC[- ]?MS[^.!?\n]*/i) || ["GC-MS claim"])[0],
        "「每批/每单标配 GC-MS」属证据范围扩张反模式（红线 #3）",
      ),
    );
  }

  // 红线 #2：编造评分/评价/销量/客户数/好评率（历史教训：aggregateRating 险触发 GSC 人工处置）
  if (
    /aggregateRating|reviewCount|review\s+count/i.test(text) ||
    /\b(?:rated|rating|score|scored)\s*\d(?:[.,]\d+)?\s*(?:\/|out\s+of)\s*\d/i.test(text) ||
    /\b\d[\d,]*\s*\+?\s*(?:five[- ]?star|5[- ]star)\s*reviews?\b/i.test(text) ||
    /\b\d+\s*%\s*(?:customer\s+)?(?:satisfaction|positive\s+feedback|approval)\b/i.test(text) ||
    /\b(?:over|more\s+than)\s+\d[\d,]*\s+(?:happy\s+|loyal\s+)?(?:customers|clients|buyers)\b/i.test(
      text,
    ) ||
    /\b\d[\d,]+\s*\+?\s+(?:customers|clients|buyers)\b/i.test(text)
  ) {
    blocked.push(
      hit(
        "fabricated-stats",
        "block",
        RL2_NO_FABRICATION,
        (text.match(/[^.!?\n]*(?:rating|review|customers?|clients|satisfaction)[^.!?\n]*/i) || [
          "fabricated stats",
        ])[0],
        "禁止虚构评分/评价条数/销量/客户数/好评率（红线 #2）",
      ),
    );
  }

  // 红线 #2：绝对化表述不可核实，等同编造
  if (
    /\b#\s*1\b/i.test(text) ||
    /\bnumber\s+one\b/i.test(text) ||
    /\bworld(?:'|’)?s\s+best\b/i.test(text) ||
    /\bthe\s+best\s+(?:\w+[\s-]+){0,3}(?:factory|factories|suppliers?|manufacturers?|compan(?:y|ies)|sources|vendors|wholesalers?)\b/i.test(
      text,
    ) ||
    /\bthe\s+only\s+(?:factory|supplier|manufacturer|company|source)\b/i.test(text)
  ) {
    blocked.push(
      hit(
        "absolute-claim",
        "block",
        RL2_NO_FABRICATION,
        (text.match(
          /[^.!?\n]*(?:#\s*1|number one|world.{0,3}s best|the best|the only)[^.!?\n]*/i,
        ) || ["absolute claim"])[0],
        "绝对化表述（#1 / 唯一 / 世界最佳）不可核实（红线 #2）",
      ),
    );
  }

  // 红线 #3：医疗/疗效声明
  if (
    /\b(?:cure|cures|treat|treats|heal|heals|prevent|prevents|combat|combats|fights)\b[^.!?\n]{0,60}\b(?:disease|illness|infection|cancer|anxiety|depression|insomnia|asthma|diabetes|virus|bacteria|pain|inflammation)\b/i.test(
      text,
    ) ||
    /\bsleep[- ]?aid\b|\banti[- ]?anxiety\b|\bantidepressant\b/i.test(text)
  ) {
    blocked.push(
      hit(
        "medical-claim",
        "block",
        RL3_VERIFIABLE,
        (text.match(/[^.!?\n]*(?:cure|treat|heal|prevent|sleep aid|anxiety)[^.!?\n]*/i) || [
          "medical claim",
        ])[0],
        "医疗/疗效声明不可核实且有合规风险（红线 #3）",
      ),
    );
  }

  // 红线 #3：burn-test 报告 / 受控环境验证类承诺（无证据支撑）
  if (
    /\bburn[- ]?test\s+report\b/i.test(text) ||
    /\bcontrolled\s+chamber\b/i.test(text) ||
    /\bvalidated\s+in\s+(?:a|our)\s+(?:controlled|lab(?:oratory)?)\b/i.test(text)
  ) {
    blocked.push(
      hit(
        "validation-claim",
        "block",
        RL3_VERIFIABLE,
        (text.match(/[^.!?\n]*(?:burn[- ]?test|chamber|validated in)[^.!?\n]*/i) || [
          "validation claim",
        ])[0],
        "burn-test 报告 / 受控环境验证承诺无证据支撑（红线 #3）",
      ),
    );
  }

  // 红线 #3：具体产地声明（未经业务确认）
  if (
    /\bsingle[- ]?origin\b/i.test(text) ||
    /\b(?:Provence|Grasse|Yunnan)\b[^.!?\n]{0,50}\b(?:lavender|origin|sourced?|grown|harvest)\b/i.test(
      text,
    ) ||
    /\b(?:lavender|origin)[^.!?\n]{0,50}\b(?:Provence|Grasse|Yunnan)\b/i.test(text)
  ) {
    blocked.push(
      hit(
        "origin-claim",
        "block",
        RL3_VERIFIABLE,
        (text.match(/[^.!?\n]*(?:single[- ]?origin|Provence|Grasse|Yunnan)[^.!?\n]*/i) || [
          "origin claim",
        ])[0],
        "具体产地声明（single origin / 普罗旺斯 / 云南等）未经业务确认（红线 #3）",
      ),
    );
  }

  // 红线 #3 + #2：具体成分含量百分比（未经业务确认）
  if (
    /\b\d+(?:\s*[-–—~]\s*\d+)?\s*%\s*(?:cineole|linalool|limonene|geraniol|citral|eucalyptol)\b/i.test(
      text,
    )
  ) {
    blocked.push(
      hit(
        "composition-claim",
        "block",
        RL3_VERIFIABLE,
        (text.match(/[^.!?\n]*\d+\s*%[^.!?\n]*/i) || ["composition claim"])[0],
        "具体成分含量百分比未经业务确认（红线 #3 / #2）",
      ),
    );
  }

  // 红线 #3：「therapeutic grade」无行业标准、不可核实
  if (/\btherapeutic[- ]?grade\b/i.test(text)) {
    blocked.push(
      hit(
        "grade-claim",
        "block",
        RL3_VERIFIABLE,
        (text.match(/[^.!?\n]*therapeutic[- ]?grade[^.!?\n]*/i) || ["therapeutic grade"])[0],
        "「therapeutic grade」无行业标准、不可核实（红线 #3）",
      ),
    );
  }

  // 红线 #4：供应链泄露（1688 链接等）
  if (/1688\.com/i.test(text)) {
    blocked.push(
      hit(
        "supply-leak",
        "block",
        RL4_NO_LEAK,
        (text.match(/[^.!?\n]*1688\.com[^.!?\n]*/i) || ["1688 link"])[0],
        "疑似供应链信息泄露：1688 链接（红线 #4）",
      ),
    );
  }
}

// ---- 主入口：逐句规则（依赖「措辞上下文」的归属类判定） ----------------------

function scanSentence(sentence: string, blocked: ClaimHit[], warnings: ClaimHit[]): void {
  const hasPartnerWording = PARTNER_WORDING.test(sentence);

  // 红线 #1：合作工厂认证被说成 Aromiso 自持
  for (const c of PARTNER_CERTS) {
    if (!c.re.test(sentence)) continue;
    if (hasPartnerWording) continue; // 「合作工厂/供应链」措辞 → 归属正确
    const isCe = c.cert === CE_CERT;
    if (STRONG_HOLD_RE.test(sentence)) {
      const severity: ClaimSeverity = isCe ? "warn" : "block";
      (severity === "block" ? blocked : warnings).push(
        hit(
          "attribution-drift",
          severity,
          RL1_ATTRIBUTION,
          sentence,
          `「${c.cert}」为合作工厂持有，不得以 Aromiso 第一人称声明（红线 #1）`,
        ),
      );
    } else if (WEAK_HAVE_RE.test(sentence)) {
      warnings.push(
        hit(
          "attribution-soft",
          "warn",
          RL1_ATTRIBUTION,
          sentence,
          `「${c.cert}」疑似第一人称归属，请改用「合作工厂 / 供应链」措辞（红线 #1）`,
        ),
      );
    }
  }

  // 红线 #1：香精屋原料第一人称归属（「我们使用 Firmenich」→ 漂移）
  if (SELF_RE.test(sentence) && !hasPartnerWording) {
    for (const h of FRAGRANCE_HOUSES) {
      if (h.re.test(sentence)) {
        blocked.push(
          hit(
            "fragrance-house-drift",
            "block",
            RL1_ATTRIBUTION,
            sentence,
            `香精屋「${h.name}」原料只能表述为「合作工厂使用…」，第一人称归属构成漂移（红线 #1）`,
          ),
        );
      }
    }
  }

  // 红线 #1：第一人称能力声明（our perfumers / we formulate / our own blends / our factory）
  // —— 研发与生产能力属合作工厂；V5.327 生产验证中删除的正是这类表述。
  if (!hasPartnerWording) {
    const capabilityRe =
      /\b(?:our|we)\b[^.!?\n]{0,60}\b(?:perfumers?|in[- ]?house\s+(?:lab|team|perfumers?|blending)|formulat(?:es?|ing|ion)|own\s+(?:blends?|fragrances?|scents?|recipes?))\b/i;
    const ownFactoryRe = /\bour\s+(?:own\s+)?fact(?:ory|ies)\b/i;
    if (capabilityRe.test(sentence) || ownFactoryRe.test(sentence)) {
      blocked.push(
        hit(
          "capability-drift",
          "block",
          RL1_ATTRIBUTION,
          sentence,
          "第一人称能力声明（our perfumers / we formulate / our own blends / our factory）：研发生产能力属合作工厂（红线 #1）",
        ),
      );
    }
  }

  // 红线 #3：GC-MS 一般性提及 → 证据范围提醒（不拦）
  if (
    /\bGC[- ]?MS\b/i.test(sentence) &&
    !/\b(?:every|each|all|any)\b[^.!?\n]{0,40}\b(?:lots?|batches|shipments?|orders?)\b/i.test(
      sentence,
    )
  ) {
    warnings.push(
      hit(
        "gcms-mention",
        "warn",
        RL3_VERIFIABLE,
        sentence,
        "提及 GC-MS：请确认证据范围（做过一次 ≠ 标配服务），避免扩张承诺",
      ),
    );
  }

  // 软性健康声明（助眠/减压等）→ 人工确认尺度
  if (
    /\b(?:helps?|promotes?|supports?|aids?|may\s+(?:help|improve))\b[^.!?\n]{0,60}\b(?:sleep|relax(?:ation)?|calm(?:ness)?|anxiety|stress|focus|mood|well[- ]?being)\b/i.test(
      sentence,
    )
  ) {
    warnings.push(
      hit(
        "wellness-soft",
        "warn",
        RL3_VERIFIABLE,
        sentence,
        "软性健康声明（助眠/减压等）：请人工确认表述尺度",
      ),
    );
  }

  // 红线 #5：MOQ / 交期数字未标注「视订单而定」（48h 现货发货为已核实现状，豁免）
  const hasHedge = HEDGE_RE.test(sentence);
  const is48h = /\b48[\s-]?hour|\bwithin\s+48\b|\b48h\b/i.test(sentence);
  if (/\bMOQ\b|minimum\s+order/i.test(sentence) && /\d/.test(sentence) && !hasHedge) {
    warnings.push(
      hit(
        "commercial-unhedged",
        "warn",
        RL5_NOT_PROMISE,
        sentence,
        "MOQ 数字未按红线 #5 标注「视订单而定 / depending on order」",
      ),
    );
  }
  if (
    /\b(?:lead\s+time|sampling\s+time|production\s+time|turnaround\s+time|delivery\s+time)\b[^.!?\n]{0,80}\d+\s*(?:[-–—~]\s*\d+\s*)?(?:business\s+)?days?\b/i.test(
      sentence,
    ) &&
    !hasHedge &&
    !is48h
  ) {
    warnings.push(
      hit(
        "commercial-unhedged",
        "warn",
        RL5_NOT_PROMISE,
        sentence,
        "交期数字未按红线 #5 标注「视订单而定 / depending on order」",
      ),
    );
  }
}

// ---- 对外 API ----------------------------------------------------------------

/**
 * 对一段内容文本做真实性红线检查。纯函数：同一输入永远同一输出。
 * pass = blocked 为空；warnings 不拦，随 REVIEW 任务交人工复核。
 */
export function checkClaims(text: string): TruthfulnessResult {
  const blocked: ClaimHit[] = [];
  const warnings: ClaimHit[] = [];
  if (!text || !text.trim()) return { pass: true, blocked, warnings };

  scanFullText(text, blocked, warnings);
  for (const sentence of splitSentences(text)) {
    scanSentence(sentence, blocked, warnings);
  }

  const b = dedupe(blocked);
  const w = dedupe(warnings);
  return { pass: b.length === 0, blocked: b, warnings: w };
}

/** 草稿字段集合（与 content-quality 的 ContentDraft 显示/SEO 层字段对齐）。 */
export interface TruthfulnessDraftInput {
  title?: string;
  excerpt?: string;
  seoTitle?: string;
  seoDescription?: string;
  body?: string;
}

/**
 * 对一篇草稿的全部显示/SEO 层字段做真实性检查，命中带字段标注，
 * 便于 REVIEW 队列定位问题位置。
 */
export function checkContentDraft(draft: TruthfulnessDraftInput): TruthfulnessResult {
  const fields: Array<[string, string]> = [
    ["title", draft.title || ""],
    ["excerpt", draft.excerpt || ""],
    ["seoTitle", draft.seoTitle || ""],
    ["seoDescription", draft.seoDescription || ""],
    ["body", draft.body || ""],
  ];
  const blocked: ClaimHit[] = [];
  const warnings: ClaimHit[] = [];
  for (const [field, value] of fields) {
    if (!value.trim()) continue;
    const r = checkClaims(value);
    for (const h of r.blocked) blocked.push({ ...h, field });
    for (const h of r.warnings) warnings.push({ ...h, field });
  }
  const b = dedupe(blocked);
  const w = dedupe(warnings);
  return { pass: b.length === 0, blocked: b, warnings: w };
}

/** 生成给 REVIEW 队列/任务 payload 的可读报告。 */
export function formatTruthfulnessReport(r: TruthfulnessResult): string {
  if (r.pass && r.warnings.length === 0) return "真实性闸（Truthfulness Gate）：全部通过";
  const lines: string[] = [
    r.pass
      ? `真实性闸（Truthfulness Gate）：通过（${r.warnings.length} 项注意）`
      : `真实性闸（Truthfulness Gate）：拦截 ${r.blocked.length} 项红线命中`,
  ];
  for (const h of r.blocked) {
    lines.push(`[拦截${h.field ? " · " + h.field : ""}] ${h.rule}：${h.note}｜原文：${h.match}`);
  }
  for (const h of r.warnings) {
    lines.push(`[注意${h.field ? " · " + h.field : ""}] ${h.rule}：${h.note}｜原文：${h.match}`);
  }
  return lines.join("\n");
}
