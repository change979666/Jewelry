// ---------------------------------------------------------------------------
//  Aromiso AI Governance Reviewer — 第二层决策角色（V5.69 无人值守治理）
//
//  定位：Content Creator → Gates → 【Governance Reviewer】→ Auto Publisher → Verifier
//  它不是最高权限管理员：最高权限 = Owner 的系统规则（宪法）+ Owner 本人。
//  它是「第二层决策」：对 AI/自动化提出的**具体动作提案**给 approve / reject / escalate。
//
//  ★ 最重要的边界（代码强制，AI 绝不可改）★
//   1. AUTO_APPROVE_SCOPE：Owner 级「允许 AI 自治批准」的动作类型白名单（代码常量）。
//      Reviewer 的 approve 只在该白名单内生效；白名单外即便 AI 说 approve，也被代码
//      强制改写为 escalate（进人工队列）。Reviewer 无法扩展白名单、无法改本文件、
//      无法改宪法/权限矩阵——「什么事情自己可以决定」永远由 Owner/代码决定。
//   2. fail-closed：AI 审查抛错/超时/返回非法决策 → 一律 escalate，绝不自动 approve。
//   3. Reviewer 只读提案 + 只输出决策；所有副作用（发布/改数据）由 Executor 在
//      既有 enforceMode/预算/幂等闸之后执行，Reviewer 不直接执行任何写操作。
//
//  集成（不另起平行逻辑）：
//   - 角色提示词优先读 ai_roles['governance_reviewer']（Owner 可在 Role Center 调整
//     措辞），缺失/禁用回退内联默认提示（loadRoleChecked 三态）。
//   - 每次审查写 audit_logs（resource_type='governance_review'），可审计、可回溯。
//   - escalate 的提案由调用方回落到既有人工待审队列（tasks L2），异常才找 Owner。
// ---------------------------------------------------------------------------

import type { D1Database } from "@cloudflare/workers-types";
import { aiJson, loadRoleChecked } from "./ai";
import type { Env } from "../types";

export type GovernanceDecision = "approve" | "reject" | "escalate";

export interface GovernanceProposal {
  /** 动作类型，必须在 AUTO_APPROVE_SCOPE 内才可能被自治批准。 */
  action_type: string;
  /** 动作对象标识（topic key / product id / knowledge id …）。 */
  subject: string;
  /** 一句话提案摘要。 */
  summary: string;
  /** 佐证（各 Gate 结果、分数、warnings 等），供 Reviewer 判断。 */
  evidence?: Record<string, unknown>;
}

export interface GovernanceReview {
  decision: GovernanceDecision;
  reasons: string[];
  confidence: number;
  model: string;
  /** 该 action_type 是否在自治批准白名单内。 */
  scope_allowed: boolean;
  /** true = 决策被代码边界改写（如白名单外 approve→escalate）。 */
  forced: boolean;
}

/**
 * Owner 级「允许 AI 自治批准」白名单（代码常量 = 宪法边界的一部分）。
 * Reviewer 无权修改；扩展需 Owner 改代码/配置并走审计。
 * 目前仅开放内容自动发布；商品上下架/价格/邮件/数据修正等一律不在内（→escalate）。
 */
export const AUTO_APPROVE_SCOPE: readonly string[] = ["content_auto_publish"];

const ROLE_NAME = "governance_reviewer";

const DEFAULT_REVIEWER_PROMPT = `You are the Aromiso AI Governance Reviewer — the second-layer decision role between AI production and autonomous execution. You are NOT a top admin; the Owner's constitution and the code-enforced permission boundary outrank you.

You review ONE concrete action proposal (JSON) and return ONLY JSON:
{"decision":"approve|reject|escalate","reasons":["..."],"confidence":0-100}

Decision rules:
- approve: only when the proposal's evidence shows ALL governance gates passed (fact/truthfulness blocked=0, quality score >= threshold, safety/budget ok), the content makes no fabricated certifications/ratings/statistics/guarantees, and the action is low-risk & reversible-or-verifiable.
- reject: when evidence shows a gate failure, fabricated or unverifiable sensitive claims, policy violation, or duplicate/harmful content. Give concrete reasons.
- escalate: when you are uncertain, evidence is missing/incomplete, the claim is commercial/supply-chain/legal/medical in nature, or the action is outside your autonomous scope. Uncertainty must ALWAYS escalate, never approve.
- You must never approve to "hit a quota". Prefer escalate/reject over a risky approve.
- reasons must cite the specific evidence field or rule, not vague praise.`;

/**
 * 对提案做第二层治理审查。fail-closed + 代码白名单边界 + 全量审计。
 * 绝不抛错给调用方（审查基础设施故障 → escalate，由调用方回落人工）。
 */
export async function reviewGovernance(
  env: Env,
  db: D1Database | undefined,
  proposal: GovernanceProposal,
): Promise<GovernanceReview> {
  const scopeAllowed = AUTO_APPROVE_SCOPE.includes(proposal.action_type);

  // 声明不初始化：try 与 catch 两条路径都会赋值（fail-closed），避免无用初始赋值。
  let decision: GovernanceDecision;
  let reasons: string[];
  let confidence = 0;
  let model = ROLE_NAME;

  try {
    // 提示词：Owner 可在 ai_roles 调整；缺失/禁用/查询故障回退内联默认（三态可见）。
    let prompt = DEFAULT_REVIEWER_PROMPT;
    if (db) {
      const loaded = await loadRoleChecked(db, ROLE_NAME);
      if (loaded.state === "ok" && loaded.role?.enabled && loaded.role?.prompt?.trim()) {
        prompt = loaded.role.prompt;
      }
      // state==='error' → 保持默认提示（保守），不阻断审查本身。
    }
    const isValid = (x: string) => x === "approve" || x === "reject" || x === "escalate";
    // 显式指定可靠模型（deepseek-v4-flash）：默认 pro 在本环境对短 JSON 任务不稳定，
    // 曾导致 aiJson 连续返回 null → fail-closed escalate（auto-publish 永不触发）。
    const REVIEW_MODEL = "deepseek-v4-flash";
    let res = await aiJson<{ decision?: string; reasons?: string[]; confidence?: number }>(
      env,
      db,
      [
        {
          role: "system",
          content:
            prompt +
            '\n\nOUTPUT RULE: Respond with ONLY one JSON object, e.g. {"decision":"approve","reasons":["gates pass"],"confidence":80}. reasons: max 3 short bullets.',
        },
        { role: "user", content: JSON.stringify(proposal) },
      ],
      { role: ROLE_NAME, model: REVIEW_MODEL, max_tokens: 1200, temperature: 0 },
    );
    // 一次严格格式重试：模型若回散文/围栏/截断导致解析失败，用「仅单行 JSON」强约束再试一次。
    // 仍失败 → fail-closed escalate（绝不因解析问题自动 approve）。
    if (!res || !isValid(String(res.decision || "").toLowerCase())) {
      res = await aiJson<{ decision?: string; reasons?: string[]; confidence?: number }>(
        env,
        db,
        [
          {
            role: "system",
            content:
              prompt +
              '\n\nCRITICAL OUTPUT RULE: Respond with ONLY one JSON object on a single line, e.g. {"decision":"approve","reasons":["gates pass"],"confidence":80}. No prose, no markdown, no code fences. reasons: max 3 bullets, <15 words each.',
          },
          { role: "user", content: JSON.stringify(proposal) },
        ],
        { role: ROLE_NAME, model: REVIEW_MODEL, max_tokens: 800, temperature: 0 },
      );
    }
    const d = String(res?.decision || "").toLowerCase();
    if (isValid(d)) {
      decision = d as GovernanceDecision;
      reasons = Array.isArray(res?.reasons) ? res!.reasons!.map((x) => String(x)).slice(0, 8) : [];
      confidence = Math.max(0, Math.min(100, Number(res?.confidence || 0)));
    } else {
      decision = "escalate";
      reasons = [
        "reviewer returned unparseable decision after strict retry (fail-closed → escalate)",
      ];
    }
    model = ROLE_NAME;
  } catch (e) {
    decision = "escalate";
    reasons = [
      `reviewer error (fail-closed → escalate): ${e instanceof Error ? e.message : String(e)}`,
    ];
  }

  // ★ 代码硬边界：白名单外绝不允许自治 approve（Reviewer 无权扩权）。★
  let forced = false;
  if (decision === "approve" && !scopeAllowed) {
    decision = "escalate";
    forced = true;
    reasons = [
      ...reasons,
      `action_type "${proposal.action_type}" outside AUTO_APPROVE_SCOPE → forced escalate by code boundary`,
    ];
  }

  await auditReview(db, proposal, decision, reasons, confidence, scopeAllowed, forced);

  return { decision, reasons, confidence, model, scope_allowed: scopeAllowed, forced };
}

/** 审查全量审计（旁路，失败不阻断决策返回——决策本身已 fail-closed 保守）。 */
async function auditReview(
  db: D1Database | undefined,
  p: GovernanceProposal,
  decision: GovernanceDecision,
  reasons: string[],
  confidence: number,
  scopeAllowed: boolean,
  forced: boolean,
): Promise<void> {
  if (!db) return;
  try {
    await db
      .prepare(
        `INSERT INTO audit_logs
           (id, actor_type, user_id, username, action, resource_type, resource_id,
            resource_title, change_summary, after_snippet, request_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      )
      .bind(
        crypto.randomUUID(),
        "ai",
        null,
        ROLE_NAME,
        decision === "approve" ? "approve_ai" : decision === "reject" ? "reject_ai" : "update",
        "governance_review",
        `${p.action_type}:${p.subject}`.slice(0, 80),
        p.summary.slice(0, 200),
        `governance_review:${decision}${forced ? ":forced_by_code_boundary" : ""}`,
        JSON.stringify({
          action_type: p.action_type,
          subject: p.subject,
          decision,
          reasons,
          confidence,
          scope_allowed: scopeAllowed,
          forced,
          at: new Date().toISOString(),
        }),
        null,
      )
      .run();
  } catch (e) {
    console.error("[governance-reviewer] audit write failed (non-blocking):", e);
  }
}
