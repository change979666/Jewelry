// Phase 7 — AI Action Standard
// Standard interface for AI actions across business objects.
// Each business module registers its available AI actions here.
// The AI Panel component reads this registry to render action buttons.

import type { ExecutionMode } from "../../permissions";

export interface AIActionDef {
  /** Unique action key, e.g. "translate", "seo_optimize" */
  key: string;
  /** Display label */
  label: string;
  /** Icon (emoji or class) */
  icon: string;
  /** Execution mode — code-enforced, not user-selectable */
  mode: ExecutionMode;
  /** Which entity types this action applies to */
  entityTypes: string[];
  /** Short description shown in UI */
  description: string;
  /** Whether this action produces a diff view */
  hasDiff: boolean;
  /** Whether this action requires before-snapshot for rollback */
  needsSnapshot: boolean;
}

/** Registry of all available AI actions. */
export const AI_ACTIONS: AIActionDef[] = [
  {
    key: "translate",
    label: "AI 翻译",
    icon: "🌐",
    mode: "L3",
    entityTypes: ["product", "content", "customer"],
    description: "自动翻译内容到目标语言",
    hasDiff: true,
    needsSnapshot: true,
  },
  {
    key: "seo_optimize",
    label: "SEO 优化",
    icon: "🔍",
    mode: "L2",
    entityTypes: ["product", "content"],
    description: "优化标题、描述和关键词以提升搜索排名",
    hasDiff: true,
    needsSnapshot: true,
  },
  {
    key: "meta_generate",
    label: "Meta 生成",
    icon: "📝",
    mode: "L2",
    entityTypes: ["product", "content"],
    description: "生成或优化 Meta Title / Description",
    hasDiff: true,
    needsSnapshot: true,
  },
  {
    key: "content_rewrite",
    label: "内容改写",
    icon: "✏️",
    mode: "L2",
    entityTypes: ["product", "content"],
    description: "改写内容使其更专业或更适合目标市场",
    hasDiff: true,
    needsSnapshot: true,
  },
  {
    key: "quality_audit",
    label: "质量审计",
    icon: "✅",
    mode: "L1",
    entityTypes: ["product", "content", "customer", "oem"],
    description: "分析数据质量并给出改进建议",
    hasDiff: false,
    needsSnapshot: false,
  },
  {
    key: "lead_score",
    label: "线索评分",
    icon: "⭐",
    mode: "L1",
    entityTypes: ["customer", "inquiry"],
    description: "AI 评估客户线索质量和转化概率",
    hasDiff: false,
    needsSnapshot: false,
  },
  {
    key: "price_suggest",
    label: "定价建议",
    icon: "💰",
    mode: "L1",
    entityTypes: ["product"],
    description: "基于市场数据建议定价策略",
    hasDiff: false,
    needsSnapshot: false,
  },
  {
    key: "faq_generate",
    label: "FAQ 生成",
    icon: "❓",
    mode: "L2",
    entityTypes: ["product", "content"],
    description: "基于产品信息自动生成常见问题",
    hasDiff: true,
    needsSnapshot: true,
  },
  {
    key: "alt_text_fill",
    label: "图片 Alt 补填",
    icon: "🖼️",
    mode: "L3",
    entityTypes: ["product", "content"],
    description: "为缺失 Alt Text 的图片自动生成描述",
    hasDiff: true,
    needsSnapshot: true,
  },
  {
    key: "summary_generate",
    label: "摘要生成",
    icon: "📋",
    mode: "L2",
    entityTypes: ["product", "content", "oem"],
    description: "生成简短摘要或 TLDR",
    hasDiff: true,
    needsSnapshot: true,
  },
];

/** Get available actions for an entity type. */
export function getActionsForEntity(entityType: string): AIActionDef[] {
  return AI_ACTIONS.filter((a) => a.entityTypes.includes(entityType));
}

/** Get a single action by key. */
export function getAction(key: string): AIActionDef | undefined {
  return AI_ACTIONS.find((a) => a.key === key);
}

/** Build the prompt for an AI action. Business logic for prompt construction. */
export function buildActionPrompt(
  action: AIActionDef,
  entityData: Record<string, unknown>,
  targetLang?: string,
): string {
  const entityJson = JSON.stringify(entityData, null, 2);

  switch (action.key) {
    case "translate":
      return `Translate the following product/content data to ${targetLang || "English"}. Keep all JSON keys in English, only translate string values. Maintain the exact JSON structure.\n\nData:\n${entityJson}`;
    case "seo_optimize":
      return `Analyze and optimize the SEO metadata for this entity. Return a JSON object with optimized "meta_title", "meta_description", "keywords" (array), and "seo_score" (0-100).\n\nCurrent data:\n${entityJson}`;
    case "meta_generate":
      return `Generate optimized meta title (max60 chars) and meta description (max160 chars) for this entity. Return JSON with "meta_title" and "meta_description".\n\nData:\n${entityJson}`;
    case "content_rewrite":
      return `Rewrite the content to be more professional and suitable for international B2B buyers. Preserve factual accuracy. Return JSON with "rewritten_content" field.\n\nOriginal:\n${entityJson}`;
    case "quality_audit":
      return `Audit the data quality of this entity. Check for missing fields, incomplete data, formatting issues. Return JSON with "score" (0-100), "issues" (array of {field, severity, message}), and "suggestions" (array).\n\nData:\n${entityJson}`;
    case "lead_score":
      return `Score this customer/inquiry lead quality from0 to100. Consider company size, inquiry specificity, engagement level. Return JSON with "score", "confidence" (low/medium/high), "reasoning", and "recommended_action".\n\nData:\n${entityJson}`;
    case "price_suggest":
      return `Suggest pricing for this product based on market positioning. Return JSON with "suggested_price", "price_range" {min, max}, "reasoning", and "market_position" (budget/mid/premium).\n\nData:\n${entityJson}`;
    case "faq_generate":
      return `Generate3-5 relevant FAQs for this product/content. Return JSON with "faqs" array of {question, answer}.\n\nData:\n${entityJson}`;
    case "alt_text_fill":
      return `Generate descriptive alt text for images in this entity that are missing alt text. Return JSON with "alt_texts" array of {image_url, alt_text}. Be specific and descriptive for accessibility.\n\nData:\n${entityJson}`;
    case "summary_generate":
      return `Generate a concise summary (2-3 sentences) for this entity. Return JSON with "summary" field.\n\nData:\n${entityJson}`;
    default:
      return `Process the following data for action "${action.key}". Return JSON result.\n\nData:\n${entityJson}`;
  }
}
