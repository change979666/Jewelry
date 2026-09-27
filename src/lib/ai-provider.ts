// ---------------------------------------------------------------------------
//  Jewelry V5.1 — AI Provider Abstraction
//
//  functions/lib/ai-provider.ts
//
//  Routes every AI call through the active provider:
//    - "siliconflow" (DEFAULT): OpenAI-compatible gateway, DeepSeek-V3.2
//    - "deepseek"             : official DeepSeek endpoint (legacy fallback)
//
//  Resolution order (first match wins):
//    1. KV config key `config:ai_provider` (set via /api/admin/ai-provider)
//    2. If unset → siliconflow when SILICONFLOW_API_KEY present, else deepseek
//    3. If the chosen provider has no key → fall back to whichever has one
//
//  Internal model names ("deepseek-v4-flash"/"deepseek-v4-pro") stay stable
//  for budget tracking; they are mapped to provider wire names only at the
//  moment the HTTP request is built.
// ---------------------------------------------------------------------------

import type { Env } from "@/lib/env";

export type ProviderId = "siliconflow" | "deepseek";

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  siliconflow: "硅基流动 SiliconFlow",
  deepseek: "DeepSeek 官方",
};

export const KV_PROVIDER_KEY = "config:ai_provider";

interface ProviderDef {
  id: ProviderId;
  label: string;
  baseUrl: string;
  /** Map an internal model name to the provider's wire model id. */
  modelMap: Record<string, string>;
  /** Read the API key for this provider out of env. */
  key: (env: Env) => string | undefined;
}

const PROVIDERS: Record<ProviderId, ProviderDef> = {
  siliconflow: {
    id: "siliconflow",
    label: PROVIDER_LABELS.siliconflow,
    baseUrl: "https://api.siliconflow.cn/v1/chat/completions",
    modelMap: {
      "deepseek-v4-flash": "deepseek-ai/DeepSeek-V3.1-Terminus",
      "deepseek-v4-pro": "deepseek-ai/DeepSeek-V3.2",
    },
    key: (env) => env.SILICONFLOW_API_KEY,
  },
  deepseek: {
    id: "deepseek",
    label: PROVIDER_LABELS.deepseek,
    baseUrl: "https://api.deepseek.com/chat/completions",
    modelMap: {}, // internal names are already DeepSeek wire names
    key: (env) => env.DEEPSEEK_API_KEY,
  },
};

export interface ResolvedProvider {
  id: ProviderId;
  label: string;
  apiKey: string;
  baseUrl: string;
  /** Translate an internal model name to the provider wire name. */
  wireModel: (internal: string) => string;
  /**
   * Provider-specific thinking/reasoning fields to merge into the request
   * body. `thinking=false` must disable reasoning for providers that default on.
   */
  thinkingParams: (thinking: boolean, reasoningEffort?: string) => Record<string, unknown>;
}

function buildResolved(id: ProviderId, apiKey: string): ResolvedProvider {
  const def = PROVIDERS[id];
  return {
    id,
    label: def.label,
    apiKey,
    baseUrl: def.baseUrl,
    wireModel: (internal) => def.modelMap[internal] || internal,
    thinkingParams: (thinking, reasoningEffort) =>
      buildThinkingParams(id, thinking, reasoningEffort),
  };
}

/**
 * Resolve the active provider + credentials from env.
 * Never throws; returns null only when no provider has an API key.
 */
export async function resolveProvider(env: Env): Promise<ResolvedProvider | null> {
  let configured: ProviderId | null = null;
  try {
    const raw = await env.DRAFTS?.get(KV_PROVIDER_KEY);
    if (raw === "siliconflow" || raw === "deepseek") configured = raw;
  } catch {
    // KV unavailable — fall through to default resolution
  }

  const preferred: ProviderId = configured
    ? configured
    : env.SILICONFLOW_API_KEY
      ? "siliconflow"
      : "deepseek";

  const order: ProviderId[] =
    preferred === "siliconflow" ? ["siliconflow", "deepseek"] : ["deepseek", "siliconflow"];

  for (const id of order) {
    const apiKey = PROVIDERS[id].key(env);
    if (!apiKey) continue;
    return buildResolved(id, apiKey);
  }
  return null;
}

/**
 * Return the first provider that has an API key, excluding `excludeId`.
 * Used for runtime failover (e.g. SiliconFlow returns 402 when the voucher
 * balance runs out — retry the call against DeepSeek official).
 */
export async function resolveFallbackProvider(
  env: Env,
  excludeId: ProviderId,
): Promise<ResolvedProvider | null> {
  for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
    if (id === excludeId) continue;
    const apiKey = PROVIDERS[id].key(env);
    if (apiKey) return buildResolved(id, apiKey);
  }
  return null;
}

/** True when at least one provider has an API key configured. */
export async function hasAiKey(env: Env): Promise<boolean> {
  return (await resolveProvider(env)) !== null;
}

function buildThinkingParams(
  id: ProviderId,
  thinking: boolean,
  reasoningEffort?: string,
): Record<string, unknown> {
  if (id === "siliconflow") {
    // DeepSeek-V4-* on SiliconFlow toggles reasoning via enable_thinking.
    // It defaults ON, so we must send false explicitly for non-thinking calls.
    return { enable_thinking: thinking };
  }
  // Official DeepSeek endpoint keeps the legacy shape.
  if (thinking) {
    return { extra_body: { reasoning_effort: reasoningEffort || "high" } };
  }
  return {};
}
