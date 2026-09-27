// ---------------------------------------------------------------------------
//  Aromiso OS 2.0 — Task Engine 权限四级闸门（Phase 1 / V5.20）
//
//  文档 §4.2：AI 产出的任务分四级权限 + 一类硬禁止：
//    L1 分析    → 全自动（只读，无副作用）
//    L2 生成    → 须人工审核后才可执行（REVIEW）
//    L3 执行    → 低风险自动（meta/内链/翻译补填等可逆内容修补）
//    L4 发布    → 受限自动（仅白名单执行器）
//    MANUAL     → AI 永不执行（删页/改价/支付/对外报价/资质声明）——只能建议，人工手动做
//
//  ⚠️ 安全铁律：execution_mode 是 AI 写进 tasks 的字段，可能被 prompt 注入篡改
//  （例如把删页任务标成 "L3" 企图让执行器自动跑）。因此执行器**绝不信任** AI
//  写的 mode，而是用本文件的 `enforceMode()` 依据 task_type **在代码层重新裁定**
//  真实权限等级。禁止清单硬编码，注入无法绕过。
// ---------------------------------------------------------------------------

export type ExecutionMode = "L1" | "L2" | "L3" | "L4" | "MANUAL";

/**
 * 硬禁止任务类型 — AI 只能建议，任何情况下都不允许自动执行。
 * 这些动作要么不可逆、要么直接触及金钱/法律/对外承诺，必须人工亲自操作。
 * 命中即强制降级为 MANUAL，且 MANUAL 不可被「批准」为自动执行（见 canAutoExecute）。
 */
export const FORBIDDEN_TASK_TYPES = new Set<string>([
  "delete_page", // 删除页面 / 路由
  "delete_content", // 删除文章 / 商品 / 案例
  "delete_product", // 删除商品
  "price_change", // 改价 / 调价
  "payment", // 支付 / 退款 / 结算
  "external_quote", // 对外报价 / 报盘
  "compliance_claim", // 资质 / 认证 / 合规声明
  "publish_content", // 对外发布新内容（Phase 2 内容工厂才解锁，且须人工 approve）
  "send_email", // 对外发件
  "contract", // 合同 / 条款变更
]);

/**
 * 任务类型 → 允许的最高权限等级（代码层策略，AI 不可覆盖）。
 * 未登记的 task_type 一律按最保守的 MANUAL 处理（不认识就不自动跑）。
 */
export const TASK_TYPE_POLICY: Record<string, ExecutionMode> = {
  // L1 只读分析（无副作用）
  analysis: "L1",
  audit: "L1",
  monitor: "L1",
  report: "L1",
  // ── 自动化闭环登记（2026-09-02 成型阶段，owner 指令）──
  // draft_reply：为新询盘生成回复草稿——只生成文本并记录到任务快照，绝不发送
  // （发信永远是 MANUAL）；enrich_product：视觉分析商品图——只读分析，
  // 结果仅记录到任务快照，任何字段写回都是另外的受控动作。
  draft_reply: "L1",
  enrich_product: "L1",
  // L2 生成类（须人工审核）
  content_refresh: "L2", // 旧文焕新（改动大，人工把关）
  faq_append: "L2", // 追加 FAQ（面向用户可见文案）
  meta_rewrite: "L2", // 重写 title/description（影响 SERP 展示）
  content_generate: "L2", // 内容工厂产出的新草稿（V5.21）：只是「待人工审核」的评审队列项，
  //                         审批后仍不自动发布（发布=人工在 CMS 点发布 save.ts ghPut）
  growth_review: "L2", // 增长看板机会评审（V5.34）：Opportunity Analyst 产出的机会只进任务队列，
  //                       自动修复层（config:growth_autofix_enabled）默认关闭，一切动作须人工确认
  // L3 低风险可逆内容修补（可自动）
  meta_fix: "L3", // 补全缺失的 meta（不覆盖已有）
  internal_link: "L3", // 内链注入
  translate_fill: "L3", // 补填缺失译文
  alt_text_fill: "L3", // 补图片 alt
  // ── 治理冻结 2026-09-02 登记（owner 批准，见 .workbuddy ACTION-POLICY-MATRIX.md §2）──
  // schema_fill：仅允许写「明确允许的结构化字段」（用既有事实补全 JSON-LD），
  // 绝不创造新事实；执行前须过真实性闸 + 快照（R2）。
  schema_fill: "L3",
  // write_visual_fact：Vision 高置信视觉事实写回。L3 的前提是执行方逐条核验
  // validateVisualFactWrite 四条件（置信度≥0.90 / 非商业字段 / source=visual / 可回滚），
  // 任一不满足必须降级 L2（人工批准）或拒绝。
  write_visual_fact: "L3",
  // L4 受限发布（仅白名单执行器可自动）
  sitemap_ping: "L4", // 通知搜索引擎重抓
};

/**
 * 商业/事实红线字段（.workbuddy DATA-TRUST-MODEL.md §2，owner 2026-09-02 冻结）：
 * 视觉来源（visual）永远不能成为这些字段的事实依据；这些字段的事实只能来自
 * owner_confirmed / catalog 权威源。
 */
export const COMMERCIAL_FACT_FIELDS = new Set<string>([
  "moq",
  "price",
  "lead_time",
  "certification",
  "compliance",
  "material_spec",
  "supplier_capability",
  "payment_terms",
]);

/**
 * 视觉事实自动写回四条件闸（2026-09-02 冻结）：
 *   confidence >= 0.90 AND field ∉ commercial_fields AND source = visual AND 可回滚快照
 * 任一不满足 → allowed:false（调用方必须降级 L2 人工批准，不得自动写回）。
 */
export function validateVisualFactWrite(opts: {
  field?: string | null;
  confidence?: number | null;
  source?: string | null;
  hasSnapshot?: boolean;
}): { allowed: boolean; reason: string } {
  const field = (opts.field || "").toLowerCase().trim();
  if (!field) return { allowed: false, reason: "缺少目标字段" };
  if (COMMERCIAL_FACT_FIELDS.has(field)) {
    return {
      allowed: false,
      reason: `字段「${field}」属商业/事实红线，视觉来源永不接受（须 owner_confirmed/catalog 权威源）`,
    };
  }
  if ((opts.source || "") !== "visual") {
    return { allowed: false, reason: `source 必须为 visual（实际：${opts.source || "空"}）` };
  }
  if (!(Number(opts.confidence) >= 0.9)) {
    return {
      allowed: false,
      reason: `confidence ${opts.confidence ?? "空"} < 0.90，不满足自动写回阈值`,
    };
  }
  if (!opts.hasSnapshot) {
    return { allowed: false, reason: "无可回滚快照（R2 义务未满足）" };
  }
  return { allowed: true, reason: "四条件全部通过" };
}

/**
 * L4 受限自动的执行器白名单。即便任务被裁定为 L4，也只有执行器 id 在此
 * 名单内才允许自动执行；否则退回人工审核。
 */
export const L4_EXECUTOR_ALLOWLIST = new Set<string>(["sitemap_ping"]);

export interface TaskLike {
  task_type?: string | null;
  executor?: string | null;
  execution_mode?: string | null;
}

/**
 * 依据 task_type 在代码层**重新裁定**真实权限等级，忽略 AI 自报的 mode。
 * 这是防提权注入的核心：AI 把 task_type="delete_page" 标成 mode="L3" 也没用，
 * 这里一律返回 MANUAL。
 */
export function enforceMode(taskType: string | null | undefined): ExecutionMode {
  const t = (taskType || "").trim();
  if (!t) return "MANUAL";
  if (FORBIDDEN_TASK_TYPES.has(t)) return "MANUAL";
  return TASK_TYPE_POLICY[t] ?? "MANUAL";
}

export interface PermissionDecision {
  /** 是否允许「现在自动执行」。 */
  allowed: boolean;
  /** 代码层裁定的真实权限等级（可能与 AI 自报的不同）。 */
  enforcedMode: ExecutionMode;
  /** 是否属于「须人工审核后才能执行」（L2）——UI 显示批准按钮。 */
  requiresReview: boolean;
  /** 是否属于硬禁止（MANUAL）——UI 显示「仅建议·人工执行」且无批准按钮。 */
  forbidden: boolean;
  /** 人类可读的裁定理由。 */
  reason: string;
}

/**
 * 判定一个任务当前是否可以自动执行。
 *
 * @param task 任务（读 task_type / executor）
 * @param opts.reviewApproved 该 L2 任务是否已被人工批准（Task Center 点了「批准执行」）
 */
export function canAutoExecute(
  task: TaskLike,
  opts: { reviewApproved?: boolean } = {},
): PermissionDecision {
  const taskType = (task.task_type || "").trim();
  const enforced = enforceMode(taskType);

  // 硬禁止：MANUAL 永不自动执行，且不可通过「批准」提权。
  if (enforced === "MANUAL") {
    const isForbidden = FORBIDDEN_TASK_TYPES.has(taskType);
    return {
      allowed: false,
      enforcedMode: "MANUAL",
      requiresReview: false,
      forbidden: true,
      reason: isForbidden
        ? `任务类型「${taskType || "(空)"}」属硬禁止类（删页/改价/支付/报价/资质/发布等），AI 只能建议，须人工手动执行`
        : `未知或未授权的任务类型「${taskType || "(空)"}」，默认按 MANUAL 处理，须人工执行`,
    };
  }

  // L1 只读分析：无副作用，直接放行。
  if (enforced === "L1") {
    return {
      allowed: true,
      enforcedMode: "L1",
      requiresReview: false,
      forbidden: false,
      reason: "L1 只读分析任务，无副作用，允许自动执行",
    };
  }

  // L2 生成：必须人工审核后才能执行。
  if (enforced === "L2") {
    return {
      allowed: !!opts.reviewApproved,
      enforcedMode: "L2",
      requiresReview: true,
      forbidden: false,
      reason: opts.reviewApproved
        ? "L2 生成任务已人工批准，允许执行"
        : "L2 生成任务须人工审核批准后才能执行",
    };
  }

  // L3 低风险可逆修补：允许自动执行。
  if (enforced === "L3") {
    return {
      allowed: true,
      enforcedMode: "L3",
      requiresReview: false,
      forbidden: false,
      reason: "L3 低风险可逆内容修补，允许自动执行",
    };
  }

  // L4 受限发布：仅白名单执行器可自动，否则退回人工审核。
  const executor = (task.executor || "").trim();
  if (L4_EXECUTOR_ALLOWLIST.has(executor)) {
    return {
      allowed: true,
      enforcedMode: "L4",
      requiresReview: false,
      forbidden: false,
      reason: `L4 发布任务，执行器「${executor}」在受限白名单内，允许自动执行`,
    };
  }
  return {
    allowed: !!opts.reviewApproved,
    enforcedMode: "L4",
    requiresReview: true,
    forbidden: false,
    reason: opts.reviewApproved
      ? "L4 发布任务已人工批准，允许执行"
      : `L4 发布任务执行器「${executor || "(空)"}」不在白名单，须人工审核批准`,
  };
}
