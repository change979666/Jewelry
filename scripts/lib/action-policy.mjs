// ============================================================================
// Action Policy Gate — cron/自动化管线的统一策略闸（治理冻结 2026-09-02）
//
// 依据：.workbuddy/design-proposal/ACTION-POLICY-MATRIX.md（owner 批准）。
// 铁律：所有自动执行路径统一经过 Action Policy；未登记的动作一律兜底
//       MANUAL（不认识就不自动跑）——与 permissions.ts enforceMode 同语义。
// 本文件是本地管线的策略快照；策略本身只能由 owner 修改（⚫ BLOCKED：
// AI 不得自改 Policy）。
// ============================================================================

/** 商业/事实红线字段：任何自动路径都不得写入（仅 owner_confirmed/catalog 权威源可写）。 */
export const COMMERCIAL_FIELDS = new Set([
  "price",
  "moq",
  "lead_time",
  "certification",
  "compliance",
  "material_spec",
  "supplier_capability",
  "payment_terms",
]);

/**
 * 冻结的动作策略快照（逐条来自 owner 2026-09-02 执行门批准）：
 *  - auto: true           → 允许自动执行
 *  - auto: false          → 禁止自动执行（降级处理由调用方决定）
 *  - auto: "conditional"  → 仅当 evidence 满足 requires 全部条件时允许
 */
export const POLICY_SNAPSHOT = {
  // owner 明确：content_generate 保持 L2/Draft，本阶段不批准自动发布
  content_generate: {
    level: "L2",
    auto: false,
    reason: "owner 裁定：content_generate 保持 L2/Draft，未经完整闭环验证不批准自动发布",
    downgrade: "draft",
  },
  // 受限自动：仅当 明确允许的字段 + 快照 + R2 + 可完整回滚
  content_refresh: {
    level: "L3",
    auto: "conditional",
    requires: ["allowed_fields", "snapshot", "rollback"],
  },
  // 标题优化（meta_rewrite 家族）：同 content_refresh 条件
  title_optimize: {
    level: "L3",
    auto: "conditional",
    requires: ["allowed_fields", "snapshot", "rollback"],
  },
  // L1 只读分析（评分不改变任何对外状态）
  lead_score: {
    level: "L1",
    auto: true,
    reason: "L1 只读分析，无副作用",
  },
  // 登记动作（2026-09-02 批准）：仅允许明确的结构化字段
  schema_fill: {
    level: "L3",
    auto: "conditional",
    requires: ["allowed_fields", "snapshot", "rollback"],
  },
  // 登记动作（2026-09-02 批准）：confidence>=0.90 ∧ 非商业字段 ∧ visual ∧ 可回滚
  write_visual_fact: {
    level: "L3",
    auto: "conditional",
    requires: ["confidence_90", "non_commercial", "snapshot", "rollback"],
  },
};

/**
 * 检查一个动作当前是否允许自动执行。
 * @param {string} actionId 动作标识（必须在 POLICY_SNAPSHOT 中登记）
 * @param {object} evidence 条件证据：
 *   { allowed_fields?: boolean, snapshot?: boolean, rollback?: boolean,
 *     confidence?: number, non_commercial?: boolean }
 * @returns {{allowed:boolean, level:string, reason:string}}
 */
export function checkAction(actionId, evidence = {}) {
  const policy = POLICY_SNAPSHOT[actionId];
  if (!policy) {
    return {
      allowed: false,
      level: "MANUAL",
      reason: `动作「${actionId}」未在 Action Policy 登记，兜底 MANUAL（须人工执行）`,
    };
  }
  if (policy.auto === true) {
    return { allowed: true, level: policy.level, reason: policy.reason || "策略允许自动执行" };
  }
  if (policy.auto === false) {
    return {
      allowed: false,
      level: policy.level,
      reason: policy.reason,
      downgrade: policy.downgrade,
    };
  }
  // conditional：逐条核验证据
  const missing = [];
  for (const req of policy.requires || []) {
    const ok =
      req === "confidence_90"
        ? Number(evidence.confidence ?? 0) >= 0.9
        : req === "non_commercial"
          ? evidence.non_commercial === true
          : evidence[req] === true;
    if (!ok) missing.push(req);
  }
  if (missing.length === 0) {
    return { allowed: true, level: policy.level, reason: "条件门全部通过（" + policy.requires.join("+") + "）" };
  }
  return {
    allowed: false,
    level: "L2",
    reason: `条件缺失（${missing.join(", ")}），降级 L2 待人工批准`,
    downgrade: "approval",
  };
}

/** 字段是否商业红线（供 Vision/写回路径使用）。 */
export function isCommercialField(field) {
  return COMMERCIAL_FIELDS.has(String(field || "").toLowerCase().trim());
}
