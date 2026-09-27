// ---------------------------------------------------------------------------
//  Aromiso Commerce — POST /api/admin/ai-product
//
//  AI 现货商品文案助手。根据商品的已有信息（标题/分类/描述/材质/卖点），
//  调用 DeepSeek 一键生成或补全营销文案字段，返回结构化 JSON 供后台自动填充。
//
//  生成字段：
//    - title             商品标题（英文，B2B 采购导向）
//    - short_description 简短描述
//    - seo_title         SEO 标题
//    - seo_description   SEO 描述
//    - key_features      核心卖点（数组）
//    - product_highlights 产品亮点（数组）
//
//  Auth: admin cookie（与其它 /api/admin/* 端点一致）
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { readCookie, verifySession } from "./shared";
import { deepseekJson, loadKnowledgeContext } from "./deepseek";
import { loadRole } from "../../lib/ai";

interface AiProductBody {
  title?: string;
  category?: string;
  short_description?: string;
  description?: string;
  materials?: string;
  moq?: number;
  key_features?: string[];
  product_highlights?: string[];
}

interface AiProductResult {
  title: string;
  short_description: string;
  seo_title: string;
  seo_description: string;
  key_features: string[];
  product_highlights: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  "essential-oils": "精油 Essential Oils",
  "fragrance-oils": "香薰油 Fragrance Oils",
  "reed-diffusers": "藤条香薰 Reed Diffusers",
  candles: "蜡烛 Scented Candles",
  "home-fragrance": "家居香氛 Home Fragrance",
  packaging: "包装 Packaging",
  "car-fragrance": "车用香氛 Car Fragrance",
  "scent-machines": "扩香机 Aroma Machines",
  "personal-care": "个护香氛 Personal Care",
  "wax-melts": "蜡块香薰 Wax Melts",
  incense: "线香熏香 Incense",
  "gift-sets": "香氛礼盒 Gift Sets",
};

// Fallback system prompt — mirrors the `product_copywriter` role in ai_roles.
// Used only when the role row is missing/disabled, so AI fill never breaks.
const FALLBACK_COPY_PROMPT = `你是资深 B2B 香氛行业文案专家，擅长为阿里巴巴国际站 / 独立站撰写高转化的英文产品文案。

生成要求：
- title：英文产品标题，60-90 字符，含核心关键词 + 卖点（如材质/香型/用途/OEM），符合 B2B 采购商搜索习惯，不要全大写。
- short_description：英文一句话卖点，120-180 字符，突出批发价值。
- seo_title：英文 SEO 标题，50-65 字符，关键词前置。
- seo_description：英文 Meta 描述，140-160 字符，含行动号召（询盘/索取样品）。
- key_features：4-6 条核心卖点，英文，每条 ≤ 60 字符，聚焦采购商关心的点（MOQ、定制、认证、交期、香型、材质）。
- product_highlights：3-5 条产品亮点，英文，每条 ≤ 70 字符，突出差异化。

严格返回 JSON（不要多余文字、不要代码块标记）：
{"title":"...","short_description":"...","seo_title":"...","seo_description":"...","key_features":["..."],"product_highlights":["..."]}

规则：所有对外文案必须使用地道、专业的英文；不编造认证、参数或统计数据；信息不足时基于已有上下文合理补全，不臆造具体数字。`;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // ---- Auth ----
  const token = readCookie(request);
  if (!(await verifySession(token, env.ADMIN_PASSWORD || ""))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!env.SILICONFLOW_API_KEY && !env.DEEPSEEK_API_KEY) {
    return Response.json(
      {
        error:
          "AI 功能未配置，请先在 Cloudflare 仪表板添加 SILICONFLOW_API_KEY 或 DEEPSEEK_API_KEY",
      },
      { status: 503 },
    );
  }

  let body: AiProductBody;
  try {
    body = (await request.json()) as AiProductBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const categoryLabel = CATEGORY_LABELS[body.category || ""] || body.category || "未分类";

  // 至少需要一点上下文，否则 AI 无从生成
  const hasContext =
    (body.title && body.title.trim()) ||
    (body.description && body.description.trim()) ||
    (body.short_description && body.short_description.trim()) ||
    (body.materials && body.materials.trim());
  if (!hasContext) {
    return Response.json(
      { error: "请先填写商品标题或描述等基础信息，AI 才能生成文案" },
      { status: 400 },
    );
  }

  const siteCtx = `Aromiso.com 是一个 B2B 香氛采购平台（精油、香薰蜡烛、藤条香薰、车用香氛、OEM/ODM 定制）。目标客户是海外批发商、品牌方、零售商。网站面向英语/西班牙语/德语市场，所有对外文案必须使用地道、专业的英文。`;

  const kbContext = env.DB ? await loadKnowledgeContext(env.DB, 8) : "";

  // Load the editable copywriter role from ai_roles (manageable in the AI Growth
  // Center → Role Center). Fall back to the built-in prompt if it is missing or
  // disabled so AI fill never breaks.
  const role = env.DB ? await loadRole(env.DB, "product_copywriter") : null;
  const copyPrompt = role && role.enabled ? role.prompt : FALLBACK_COPY_PROMPT;
  const model = (role && role.model) || "deepseek-v4-pro";

  const result = await deepseekJson<AiProductResult>(
    env,
    [
      {
        role: "system",
        content: `${siteCtx}\n\n${copyPrompt}`,
      },
      {
        role: "user",
        content: `为以下现货商品生成完整英文文案。

商品分类：${categoryLabel}
当前标题：${body.title || "（无）"}
简短描述：${body.short_description || "（无）"}
详细描述：${(body.description || "（无）").slice(0, 1200)}
材质：${body.materials || "（无）"}
MOQ：${body.moq || "（未设置）"}
已有卖点：${(body.key_features || []).join(" / ") || "（无）"}
已有亮点：${(body.product_highlights || []).join(" / ") || "（无）"}

请补全并优化所有字段。`,
      },
    ],
    { model, temperature: 0.7, max_tokens: 1200, knowledge_context: kbContext },
  );

  if (!result) {
    return Response.json({ error: "AI 未能生成文案，请稍后重试" }, { status: 502 });
  }

  // 规范化数组字段，防止模型返回字符串
  const toArray = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.map((s) => String(s).trim()).filter(Boolean)
      : typeof v === "string" && v.trim()
        ? [v.trim()]
        : [];

  const clean: AiProductResult = {
    title: String(result.title || "").trim(),
    short_description: String(result.short_description || "").trim(),
    seo_title: String(result.seo_title || "").trim(),
    seo_description: String(result.seo_description || "").trim(),
    key_features: toArray(result.key_features),
    product_highlights: toArray(result.product_highlights),
  };

  return Response.json({ ok: true, ...clean });
};
