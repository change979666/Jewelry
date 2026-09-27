// ---------------------------------------------------------------------------
//  Aromiso OS 2.0 — Model Router 预备层（V5.33 / Agent OS Phase 1）
//  functions/lib/model-router.ts
//
//  架构蓝图 §19 的落地预备：任务类型 → 模型档位路由。
//
//  设计原则（与蓝图的「先保守后放开」一致）：
//    - 默认关闭。KV `config:model_router_enabled` === "on" 才启用路由；
//      其余任何取值（含 KV 不可用）一律回落到当前默认模型，行为与升级前完全一致。
//    - 路由表只是「映射事实」，纯静态、可单测；启用与否不影响正确性，只影响成本。
//    - 高风险任务（内容写作 / Buyer Audit / 真实性复审 / 战略分析）永远 Pro；
//      只有低风险高频任务（翻译 / 分类 / 去重 / SEO 初筛 / 字段提取）可降到 Flash。
//    - 内部模型名（deepseek-v4-flash / deepseek-v4-pro）保持稳定用于预算追踪，
//      到 ai-provider 层才映射为供应商 wire 名。
// ---------------------------------------------------------------------------

import type { Env } from "../types";

/** 模型档位：Flash = 廉价快速，Pro = 深度推理。 */
export type ModelTier = "flash" | "pro";

/** 可路由的任务类型（蓝图 §19 任务分级表）。 */
export type TaskKind =
  | "translate" // 翻译
  | "classify" // 分类
  | "dedupe" // 去重
  | "seo_triage" // SEO 初筛
  | "product_field_extract" // 产品字段提取
  | "content_writer" // 内容写作（高风险）
  | "buyer_audit" // Buyer Decision Audit（高风险）
  | "strategy" // 复杂战略分析（高风险）
  | "truthfulness_review" // 真实性复审（高风险）
  | "code"; // 代码修改（高风险）

export const TIER_MODELS: Record<ModelTier, string> = {
  flash: "deepseek-v4-flash",
  pro: "deepseek-v4-pro",
};

/** 路由器关闭时的默认模型 = 升级前的既有行为。 */
export const DEFAULT_MODEL = TIER_MODELS.pro;

/**
 * 任务类型 → 档位（蓝图 §19）：
 * 低风险高频任务走 Flash；高风险任务（内容/审计/战略/真实性/代码）永远 Pro。
 */
export const TASK_MODEL_ROUTES: Record<TaskKind, ModelTier> = {
  translate: "flash",
  classify: "flash",
  dedupe: "flash",
  seo_triage: "flash",
  product_field_extract: "flash",
  content_writer: "pro",
  buyer_audit: "pro",
  strategy: "pro",
  truthfulness_review: "pro",
  code: "pro",
};

export const KV_MODEL_ROUTER_KEY = "config:model_router_enabled";

/** 纯函数：任务类型的静态路由结果（不含开关判断）。 */
export function modelForTask(kind: TaskKind): string {
  return TIER_MODELS[TASK_MODEL_ROUTES[kind]];
}

/**
 * 解析任务实际使用的模型。
 * 仅当 KV `config:model_router_enabled` === "on" 时按路由表分发；
 * 否则（含 KV 异常）一律返回 DEFAULT_MODEL，保证零行为漂移。
 */
export async function resolveModelForTask(env: Env, kind: TaskKind): Promise<string> {
  try {
    const flag = await env.DRAFTS?.get(KV_MODEL_ROUTER_KEY);
    if (flag === "on") return modelForTask(kind);
  } catch {
    // KV 不可用 → 视为关闭，落回默认模型。
  }
  return DEFAULT_MODEL;
}
