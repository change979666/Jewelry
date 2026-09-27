// ---------------------------------------------------------------------------
// Aromiso Text Router — 免费文本模型统一入口
//
// 复用 vision_keys 表里已配置的提供商（Gemini / OpenRouter / Groq / Qwen），
// 用 OpenAI 兼容 chat/completions 做纯文本生成。顺序沿用 vision-router：
// gemini → openrouter(free) → groq → qwen，任一失败自动切下一个。
//
// 设计目标：0 成本优先。OpenRouter 只尝试 :free 模型；Gemini 免费额度大。
// ---------------------------------------------------------------------------

import { loadVisionProviders } from "./vision-router";
import { getBudgetLevel, trackUsage } from "./ai";
import type { D1Database } from "@cloudflare/workers-types";

interface TextProvider {
  name: string;
  base: string;
  key: string;
  model: string;
}

// OpenRouter 免费文本模型候选（按可用性排序；失效自动跳到下一个，2026-09 验证）
const OPENROUTER_FREE_TEXT_MODELS = [
  "minimax/minimax-m3:free",
  "z-ai/glm-5.2:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

// V5.57 配额保护：单个业务任务的 provider 尝试总上限。
// 防止「4 个免费模型逐个试完 × 多提供商」的放大消耗（排查报告 P0）。
const MAX_TEXT_ATTEMPTS = 6;

export interface ChatResult {
  provider: string;
  model: string;
  text: string;
  tokens_in: number;
  tokens_out: number;
}

async function callChat(
  p: TextProvider,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<ChatResult | null> {
  try {
    const res = await fetch(`${p.base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: p.model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = j?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) return null;
    return {
      provider: p.name,
      model: p.model,
      text: text.trim(),
      tokens_in: j?.usage?.prompt_tokens || 0,
      tokens_out: j?.usage?.completion_tokens || 0,
    };
  } catch {
    return null;
  }
}

/**
 * 用免费提供商生成文本。全部失败返回 null（调用方自行降级）。
 */
export async function chatText(
  env: unknown,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 900,
): Promise<ChatResult | null> {
  const db = (env as { DB?: D1Database } | null | undefined)?.DB;
  if (db && (await getBudgetLevel(db)) >= 3) return null;
  const providers = await loadVisionProviders(env);
  let attempts = 0;
  for (const p of providers) {
    if (p.name === "openrouter") {
      // openrouter/free 自动路由不保证文本质量，改为逐个尝试明确的免费模型
      for (const model of OPENROUTER_FREE_TEXT_MODELS) {
        if (attempts >= MAX_TEXT_ATTEMPTS) return null;
        attempts++;
        const r = await callChat({ ...p, model }, systemPrompt, userPrompt, maxTokens);
        if (r) {
          if (db) await trackUsage(db, "text-router", r.model, r.tokens_in, r.tokens_out);
          return r;
        }
      }
      continue;
    }
    if (attempts >= MAX_TEXT_ATTEMPTS) return null;
    attempts++;
    if (p.name === "qwen" && p.model.includes("vl")) {
      // 视觉模型换成同族文本模型
      const r = await callChat({ ...p, model: "qwen-plus" }, systemPrompt, userPrompt, maxTokens);
      if (r) return r;
      continue;
    }
    const r = await callChat(p, systemPrompt, userPrompt, maxTokens);
    if (r) {
      if (db) await trackUsage(db, "text-router", r.model, r.tokens_in, r.tokens_out);
      return r;
    }
  }
  return null;
}
