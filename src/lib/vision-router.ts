// ---------------------------------------------------------------------------
// Jewelry Vision Router — 统一视觉模型入口（0 成本 + 自动切换 + 不影响网站）
//
// 所有提供商均为 OpenAI 兼容 chat-completions + image_url 格式。
// 顺序：Qwen-VL(阿里云新加坡) → Groq → OpenRouter(free) → Gemini。
// 任一失败自动切下一个；全部失败返回 null（调用方降级，不阻断业务）。
//
// 配置（CF env / .dev.vars）：DASHSCOPE_API_KEY / GROQ_API_KEY /
//   OPENROUTER_API_KEY / GEMINI_API_KEY。未配置则跳过该提供商。
// ---------------------------------------------------------------------------

interface VisionProvider {
  name: string;
  base: string;
  key: string;
  model: string;
}

import { getBudgetLevel, trackUsage } from "@/lib/ai";
import type { D1Database } from "@cloudflare/workers-types";

export function visionProviders(env: Record<string, string | undefined>): VisionProvider[] {
  const list: VisionProvider[] = [];
  if (env.DASHSCOPE_API_KEY)
    list.push({
      name: "qwen",
      base: env.DASHSCOPE_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      key: env.DASHSCOPE_API_KEY,
      model: "qwen-vl-plus",
    });
  if (env.GROQ_API_KEY)
    list.push({
      name: "groq",
      base: "https://api.groq.com/openai/v1",
      key: env.GROQ_API_KEY,
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
    });
  if (env.OPENROUTER_API_KEY)
    list.push({
      name: "openrouter",
      base: "https://openrouter.ai/api/v1",
      key: env.OPENROUTER_API_KEY,
      model: "openrouter/free",
    });
  if (env.GEMINI_API_KEY)
    list.push({
      name: "gemini",
      base: "https://generativelanguage.googleapis.com/v1beta/openai",
      key: env.GEMINI_API_KEY,
      model: "gemini-2.0-flash",
    });
  return list;
}

const DEFAULTS: Record<string, { base: string; model: string }> = {
  qwen: { base: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", model: "qwen-vl-plus" },
  groq: {
    base: "https://api.groq.com/openai/v1",
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
  },
  openrouter: { base: "https://openrouter.ai/api/v1", model: "openrouter/free" },
  gemini: {
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
  },
};

// Merge env providers with D1 vision_keys (enabled=1). DB wins; env fills gaps.
interface VisionKeyRow {
  provider: string;
  api_key: string;
  base_url: string | null;
  model: string | null;
}
interface DbLike {
  prepare(sql: string): { all(): Promise<{ results: VisionKeyRow[] }> };
}

export async function loadVisionProviders(env: unknown): Promise<VisionProvider[]> {
  const e = (env ?? {}) as Record<string, unknown>;
  const byName = new Map<string, VisionProvider>();
  for (const p of visionProviders(e as Record<string, string | undefined>)) byName.set(p.name, p);
  const db = e.DB as DbLike | undefined;
  if (db) {
    try {
      const rows =
        (
          await db
            .prepare(`SELECT provider, api_key, base_url, model FROM vision_keys WHERE enabled = 1`)
            .all()
        ).results || [];
      for (const r of rows) {
        const d = DEFAULTS[r.provider] || { base: "", model: "" };
        byName.set(r.provider, {
          name: r.provider,
          base: r.base_url || d.base,
          key: r.api_key,
          model: r.model || d.model,
        });
      }
    } catch {
      /* table may not exist yet */
    }
  }
  const order = ["gemini", "openrouter", "groq", "qwen"];
  return order.map((n) => byName.get(n)).filter((p): p is VisionProvider => !!p && !!p.key);
}

// 三层视觉契约（治理冻结 2026-09-02，owner 批准）：
//   Layer 1 Visual Observation（只描述可见现象）→ Layer 2 Structured Visual Fact
//   （带 confidence/source/unknown_fields/commercial_risk）→ Layer 3 Business Fact
//   （MOQ/价格/认证/交期/材质规格/供应商能力：视觉永不确认，必须 unknown）。
// 传统键名保持向后兼容（gen-product-articles 等既有消费方不破坏）。
export const VISION_PROMPT =
  "You are extracting structured product data from a product photo for a B2B aroma/fragrance wholesale site, " +
  "following a three-layer visual contract. " +
  "LAYER 1 (visual observations only): color, shape, material appearance, visible components, scene, packaging appearance. " +
  "LAYER 2 (structured visual facts): Return STRICT JSON with keys: product_type, material, color, style, target_market, " +
  "use_cases(array), key_features(array), seo_title(<=60 chars), meta_description(50-160 chars), alt_text, keywords(array), PLUS: " +
  '"confidence" (object mapping each reported fact to a 0-1 score), "source" (always "visual"), ' +
  '"unknown_fields" (array of facts you cannot reliably determine), ' +
  '"commercial_risk" (array of any fields whose wording might imply MOQ/price/certification/lead time/material specification — flag, never assert). ' +
  "LAYER 3 (business facts are OFF LIMITS): never guess MOQ, price, lead time, certification, compliance, material specification, or supplier capability. " +
  'If visual information cannot reliably determine a fact, output "unknown" for it in unknown_fields instead of guessing — especially forbidden to guess: ' +
  "MOQ, price, certifications, material specifications, lead time, supplier capability. " +
  "Do not invent certifications, numbers, capacities or statistics. Facts with confidence below 0.5 must be omitted and listed in unknown_fields.";

async function callOne(
  p: VisionProvider,
  imageUrl: string,
  prompt: string,
): Promise<{ text: string; tokensIn: number; tokensOut: number } | { aborted: true } | null> {
  // V5.65：单次尝试 45s 硬超时。CF 边缘调部分提供商（如 SiliconFlow）会 hang，
  // 无超时时单任务可拖满数分钟，拖垮 worker 批次与 Studio 客户端读超时。
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${p.base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: p.model,
        max_tokens: 900,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = j?.choices?.[0]?.message?.content;
    return typeof text === "string" && text
      ? {
          text,
          tokensIn: Number(j.usage?.prompt_tokens || 0),
          tokensOut: Number(j.usage?.completion_tokens || 0),
        }
      : null;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return { aborted: true };
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Try providers in order; return {provider, text} or null.
export async function callVision(
  env: unknown,
  imageUrl: string,
  prompt: string = VISION_PROMPT,
  usageRole = "internal",
): Promise<{ provider: string; model: string; text: string } | null> {
  if (!imageUrl) return null;
  const db = (env as { DB?: D1Database } | null | undefined)?.DB;
  if (db && (await getBudgetLevel(db)) >= 3) return null;
  // V5.65：hang 过的提供商 10 分钟内跳过（KV 冷却表），避免批次被重复拖满超时。
  const kv = (
    env as
      | {
          DRAFTS?: {
            get: (k: string, o?: unknown) => Promise<unknown>;
            put: (k: string, v: string, o?: unknown) => Promise<unknown>;
          };
        }
      | null
      | undefined
  )?.DRAFTS;
  const COOLDOWN_KEY = "vision:cooldowns";
  const COOLDOWN_MS = 10 * 60_000;
  const now = Date.now();
  let cooldowns: Record<string, number>;
  try {
    cooldowns = ((await kv?.get(COOLDOWN_KEY, "json")) as Record<string, number> | null) || {};
  } catch {
    cooldowns = {};
  }
  for (const p of await loadVisionProviders(env)) {
    if ((cooldowns[p.name] || 0) > now) continue;
    const result = await callOne(p, imageUrl, prompt);
    if (result && "aborted" in result) {
      cooldowns[p.name] = now + COOLDOWN_MS;
      try {
        await kv?.put(COOLDOWN_KEY, JSON.stringify(cooldowns), { expirationTtl: 1200 });
      } catch {
        /* KV 写失败不阻塞 */
      }
      continue;
    }
    if (result) {
      // Vision calls must be visible in the AI ledger even when the selected
      // provider is free-tier. The pricing table treats vision models as ¥0,
      // so this records call/token volume without inventing a cost.
      if (db)
        await trackUsage(
          db,
          `vision:${usageRole}:${p.name}`,
          p.model,
          result.tokensIn,
          result.tokensOut,
        );
      return { provider: p.name, model: p.model, text: result.text };
    }
  }
  return null;
}

// Parse a vision JSON string leniently (strip code fences).
export function parseVisionJson(text: string): Record<string, unknown> | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}
