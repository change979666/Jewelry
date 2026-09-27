// ---------------------------------------------------------------------------
//  Aromiso V4.3 — POST /api/admin/ai-assist
//
//  AI content assistant for the CMS editor. Accepts a task type and content,
//  calls DeepSeek to generate SEO-optimized suggestions, returns JSON.
//
//  Tasks:
//    - optimize_title:  Improve blog/guide title for SEO
//    - optimize_desc:   Generate meta description
//    - optimize_body:   Suggest content improvements
//    - suggest_links:   Recommend internal linking opportunities
//    - full_audit:      Comprehensive SEO audit of a piece of content
//
//  Auth: admin cookie (same as other /api/admin/* endpoints)
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { readCookie, verifySession } from "./shared";
import { deepseekJson, loadKnowledgeContext, extractAndSaveInsights } from "./deepseek";

interface AiAssistBody {
  task: string;
  title?: string;
  description?: string;
  body?: string;
  collection?: string;
  related_products?: string[];
}

interface AiResult {
  suggestion: string;
  alternatives?: string[];
  reasoning?: string;
}

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

  let body: AiAssistBody;
  try {
    body = (await request.json()) as AiAssistBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { task, title, description, body: content, collection, related_products } = body;
  if (!task) {
    return Response.json({ error: "Missing task" }, { status: 400 });
  }

  const siteCtx = `Aromiso.com 是一个 B2B 香氛采购平台，主营精油、香薰蜡烛、藤条香薰、OEM/ODM 定制。目标客户是海外批发商、品牌方、零售商。网站支持英语/西班牙语/德语。`;

  // Load knowledge base context for all AI tasks (V4.3)
  const kbContext = env.DB ? await loadKnowledgeContext(env.DB, 10) : "";

  // eslint-disable-next-line no-useless-assignment
  let result: AiResult | null = null;

  switch (task) {
    // ---- Optimize title ----
    case "optimize_title": {
      if (!title) return Response.json({ error: "Missing title" }, { status: 400 });
      result = await deepseekJson<AiResult>(
        env,
        [
          {
            role: "system",
            content: `${siteCtx}\n\n你是 SEO 标题优化专家。优化后的标题需要：
- 包含核心关键词，适合 B2B 采购商搜索
- 长度 50-70 字符（英文）或 20-35 字（中文）
- 有吸引力，突出价值主张
- 返回 JSON: {"suggestion": "优化后标题", "alternatives": ["备选1", "备选2"], "reasoning": "优化理由"}`,
          },
          {
            role: "user",
            content: `优化以下标题：\n\n当前标题：${title}\n内容类型：${collection || "blog"}\n相关标签：${(related_products || []).join(", ") || "无"}`,
          },
        ],
        { temperature: 0.7, max_tokens: 500, knowledge_context: kbContext },
      );
      break;
    }

    // ---- Generate meta description ----
    case "optimize_desc": {
      if (!title && !content)
        return Response.json({ error: "Missing title or content" }, { status: 400 });
      result = await deepseekJson<AiResult>(
        env,
        [
          {
            role: "system",
            content: `${siteCtx}\n\n你是 Meta Description 生成专家。要求：
- 长度 140-160 字符（英文）或 70-100 字（中文）
- 包含行动号召（CTA）
- 突出独特价值，吸引点击
- 包含核心关键词
- 返回 JSON: {"suggestion": "生成的描述", "alternatives": ["备选1", "备选2"], "reasoning": "创作思路"}`,
          },
          {
            role: "user",
            content: `为以下内容生成 Meta Description：\n\n标题：${title || "无"}\n当前描述：${description || "无"}\n内容摘要：${(content || "").slice(0, 500)}`,
          },
        ],
        { temperature: 0.7, max_tokens: 400, knowledge_context: kbContext },
      );
      break;
    }

    // ---- Content improvement suggestions ----
    case "optimize_body": {
      if (!content) return Response.json({ error: "Missing body content" }, { status: 400 });
      result = await deepseekJson<AiResult>(
        env,
        [
          {
            role: "system",
            content: `${siteCtx}\n\n你是 B2B 内容优化顾问。分析文章内容并给出改进建议：
- SEO 方面：关键词密度、标题层级、内链机会
- 转化方面：CTA 位置、询盘引导、信任元素
- 内容质量：深度、实用性、数据支撑
- 返回 JSON: {"suggestion": "主要建议（200字内）", "alternatives": ["具体改进点1", "具体改进点2", "具体改进点3"], "reasoning": "分析依据"}`,
          },
          {
            role: "user",
            content: `标题：${title || "无"}\n\n正文（Markdown）：\n${content.slice(0, 2000)}`,
          },
        ],
        { temperature: 0.6, max_tokens: 800, knowledge_context: kbContext },
      );
      break;
    }

    // ---- Internal link suggestions ----
    case "suggest_links": {
      result = await deepseekJson<AiResult>(
        env,
        [
          {
            role: "system",
            content: `${siteCtx}\n\n你是内链架构专家。根据内容推荐适合插入内部链接的位置和锚文本。
Aromiso 网站结构：
- /products/<slug> — 82 款产品（精油、蜡烛、藤条、包装等）
- /resources/<slug> — 43 篇采购指南
- /solutions/<slug> — 8 个行业方案
- /blog/<slug> — 20 篇博客
- /compare/<slug> — 4 组产品对比

返回 JSON: {"suggestion": "内链策略概述", "alternatives": ["锚文本1 → 目标URL", "锚文本2 → 目标URL", "锚文本3 → 目标URL"], "reasoning": "内链逻辑说明"}`,
          },
          {
            role: "user",
            content: `标题：${title || "无"}\n内容类型：${collection || "blog"}\n相关产品：${(related_products || []).join(", ") || "无"}\n\n正文摘要：\n${(content || "").slice(0, 1500)}`,
          },
        ],
        { temperature: 0.6, max_tokens: 600, knowledge_context: kbContext },
      );
      break;
    }

    // ---- Full SEO audit ----
    case "full_audit": {
      if (!title) return Response.json({ error: "Missing title" }, { status: 400 });
      result = await deepseekJson<AiResult>(
        env,
        [
          {
            role: "system",
            content: `${siteCtx}\n\n你是全面的 SEO 审计师。对给定内容进行全方位评估：
- 标题优化度（1-10分）
- Meta Description 质量（1-10分）
- 关键词覆盖（1-10分）
- 内链潜力（1-10分）
- 转化引导力（1-10分）
- 内容深度（1-10分）

返回 JSON: {"suggestion": "综合评分和总结（100字内）", "alternatives": ["最优先改进项1", "最优先改进项2", "最优先改进项3", "最优先改进项4", "最优先改进项5"], "reasoning": "详细分析（200字内）"}`,
          },
          {
            role: "user",
            content: `标题：${title}\n描述：${description || "无"}\n内容类型：${collection || "blog"}\n相关产品：${(related_products || []).join(", ") || "无"}\n\n正文：\n${(content || "").slice(0, 2000)}`,
          },
        ],
        {
          thinking: true,
          reasoning_effort: "high",
          max_tokens: 1000,
          knowledge_context: kbContext,
        },
      );
      break;
    }

    default:
      return Response.json({ error: `Unknown task: ${task}` }, { status: 400 });
  }

  if (!result) {
    return Response.json({ error: "AI 未能生成回复，请重试" }, { status: 502 });
  }

  // V4.3: If thinking mode was used, the reasoning trace is in _reasoning
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = result as any;
  if (raw._reasoning) {
    result.reasoning = raw._reasoning;
    delete raw._reasoning;
  }

  // V4.3: Extract and save insights to knowledge base (fire-and-forget)
  const summaryParts = [
    `task=${task}`,
    title ? `title=${title}` : "",
    `collection=${collection || "blog"}`,
  ].filter(Boolean);
  extractAndSaveInsights(
    env,
    env.DB!,
    summaryParts.join(", "),
    result.suggestion + (result.reasoning ? "\n" + result.reasoning : ""),
  ).catch(() => {});

  return Response.json({ ok: true, task, ...result });
};
