// ---------------------------------------------------------------------------
//  Buyer Decision Skill — 输出纪律机检（V5.33 Skill 固化）
//  docs/skills/buyer-decision/validators.ts
//
//  纯函数、零依赖：validateAuditOutput(report) 检查一份 L1 审查报告是否遵守
//  BUYER_DECISION_FRAMEWORK 的输出纪律（§四/§七/§八/§十一）：
//    - 禁止数字评分（评分游戏反模式）；
//    - 覆盖/风险只做三态判定（covered / partial / missing）；
//    - 每个 partial/missing 必须有路由归属（note + gapType + routeTo）；
//    - 最小改动建议必须有事实依据，否则状态只能是 pending-business-confirmation。
//  观察期内供人工/AI 审查产出后自检；未来若升级 L2，同一函数可直接复用为闸门。
// ---------------------------------------------------------------------------

export type AuditVerdict = "covered" | "partial" | "missing";

export interface AuditCoverageItem {
  item?: string;
  layer?: string;
  verdict?: string;
  note?: string;
  gapType?: string;
  routeTo?: string;
}

export interface AuditMinimumChange {
  problem?: string;
  suggestion?: string;
  evidenceSource?: string;
  status?: string;
}

export interface AuditReportShape {
  subject?: string;
  buyerConcerns?: string[];
  coverage?: AuditCoverageItem[];
  ironTriangle?: {
    customer?: string;
    demand?: string;
    value?: string;
    primaryRisk?: string;
  };
  missingDecisionInfo?: string[];
  verifiedFacts?: string[];
  missingEvidence?: { claim?: string; status?: string; note?: string }[];
  minimumChanges?: AuditMinimumChange[];
  suggestedContentForms?: string[];
  contentFactoryCandidate?: boolean;
  doNotChange?: string[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const VERDICTS: readonly string[] = ["covered", "partial", "missing"];
const GAP_TYPES: readonly string[] = [
  "Missing Asset",
  "Existing Asset Not Connected",
  "Existing Asset, Wrong Decision Stage",
];
const ROUTES: readonly string[] = [
  "owner-confirmation",
  "content-after-observation",
  "routing-fix",
];
const EVIDENCE_STATUSES: readonly string[] = [
  "missing-evidence",
  "attribution-needs-confirmation",
];

/** 数字评分反模式检测（Trust Score / Opportunity Score / x/100 等）。 */
const SCORE_PATTERNS: RegExp[] = [
  /\b(?:trust|opportunity|conversion|quality)\s+score\b/i,
  /\b\d{1,3}\s*\/\s*100\b/,
  /\bscored?\s*\d{1,3}\s*(?:points?)?\b/i,
];

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((v) => collectStrings(v, out));
  }
}

/**
 * 校验一份 Buyer Decision Audit 报告的输出纪律。
 * 纯函数：同一输入永远同一输出。ok=false 时报告不得作为审查结论使用。
 */
export function validateAuditOutput(report: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (report === null || typeof report !== "object" || Array.isArray(report)) {
    return { ok: false, issues: [{ path: "$", message: "报告必须是对象" }] };
  }
  const r = report as AuditReportShape;

  // ---- 反模式：全报告范围内禁止数字评分 ----
  const strings: string[] = [];
  collectStrings(report, strings);
  for (const s of strings) {
    for (const re of SCORE_PATTERNS) {
      if (re.test(s)) {
        issues.push({
          path: "$",
          message: `禁止数字评分（评分游戏反模式）：「${s.slice(0, 80)}」`,
        });
        break;
      }
    }
  }

  // ---- 必填块 ----
  const required: Array<[keyof AuditReportShape, string]> = [
    ["buyerConcerns", "买家疑虑清单"],
    ["coverage", "三层覆盖判定"],
    ["ironTriangle", "铁三角风险"],
    ["missingDecisionInfo", "缺失的采购决策信息"],
    ["verifiedFacts", "可验证事实"],
    ["missingEvidence", "Missing Evidence 清单"],
    ["minimumChanges", "最小改动建议"],
    ["doNotChange", "不要改什么清单"],
  ];
  for (const [key, label] of required) {
    const v = r[key];
    const empty = v === undefined || v === null || (Array.isArray(v) && v.length === 0);
    if (empty && key !== "verifiedFacts" && key !== "missingDecisionInfo") {
      issues.push({ path: `$.${key}`, message: `缺少${label}（必填）` });
    }
  }

  // ---- 覆盖判定：三态 + partial/missing 必须有路由归属 ----
  (r.coverage || []).forEach((c, i) => {
    const p = `$.coverage[${i}]`;
    if (!c.item) issues.push({ path: p, message: "缺判定项名（item）" });
    if (!c.verdict || !VERDICTS.includes(c.verdict)) {
      issues.push({ path: `${p}.verdict`, message: "判定必须是 covered/partial/missing 三态" });
      return;
    }
    if (c.verdict !== "covered") {
      if (!c.note || c.note.trim().length < 10) {
        issues.push({
          path: `${p}.note`,
          message: "partial/missing 必须说明：缺什么→影响→可否补→归谁",
        });
      }
      if (!c.gapType || !GAP_TYPES.includes(c.gapType)) {
        issues.push({ path: `${p}.gapType`, message: "必须标注资产缺口三分类之一" });
      }
      if (!c.routeTo || !ROUTES.includes(c.routeTo)) {
        issues.push({ path: `${p}.routeTo`, message: "必须标注处置路由（归谁）" });
      }
    }
  });

  // ---- 铁三角：三态 + 主要风险直述 ----
  const t = r.ironTriangle;
  if (t) {
    for (const corner of ["customer", "demand", "value"] as const) {
      if (!t[corner] || !VERDICTS.includes(t[corner] as string)) {
        issues.push({
          path: `$.ironTriangle.${corner}`,
          message: "铁三角各角必须是 covered/partial/missing 三态",
        });
      }
    }
    if (!t.primaryRisk || !t.primaryRisk.trim()) {
      issues.push({
        path: "$.ironTriangle.primaryRisk",
        message: "必须直述「当前主要风险：××」（不用评分）",
      });
    }
  } else {
    issues.push({ path: "$.ironTriangle", message: "缺铁三角风险标记" });
  }

  // ---- Missing Evidence：状态合法 ----
  (r.missingEvidence || []).forEach((m, i) => {
    if (!m.claim) {
      issues.push({ path: `$.missingEvidence[${i}]`, message: "缺 claim" });
    }
    if (!m.status || !EVIDENCE_STATUSES.includes(m.status)) {
      issues.push({
        path: `$.missingEvidence[${i}].status`,
        message: "状态必须是 missing-evidence 或 attribution-needs-confirmation（归属特例）",
      });
    }
  });

  // ---- 最小改动：无事实依据 → 只能待业务确认 ----
  (r.minimumChanges || []).forEach((ch, i) => {
    const p = `$.minimumChanges[${i}]`;
    if (!ch.problem || !ch.suggestion) {
      issues.push({ path: p, message: "建议必须含 problem + suggestion（具体到区块/字段）" });
    }
    const hasEvidence = !!ch.evidenceSource && ch.evidenceSource.trim().length > 0;
    const statusOk = ch.status === "actionable" || ch.status === "pending-business-confirmation";
    if (!statusOk) {
      issues.push({ path: `${p}.status`, message: "状态必须是 actionable 或 pending-business-confirmation" });
    } else if (!hasEvidence && ch.status === "actionable") {
      issues.push({
        path: `${p}.evidenceSource`,
        message: "无事实依据的建议不得 actionable，只能 pending-business-confirmation（禁止 AI 补写）",
      });
    }
  });

  return { ok: issues.length === 0, issues };
}
