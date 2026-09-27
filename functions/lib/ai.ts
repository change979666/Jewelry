// ---------------------------------------------------------------------------
//  Aromiso OS 1.0 — Unified AI Call Layer
//
//  functions/lib/ai.ts
//
//  Features:
//    - Multi-provider routing via ai-provider.ts (V5.1):
//      SiliconFlow gateway (default, DeepSeek-V4-Pro) or DeepSeek official
//    - Model switching (deepseek-v4-flash / deepseek-v4-pro internal names)
//    - Per-call usage tracking → ai_usage table
//    - Monthly budget hard cap (¥100 default) with auto-degradation
//    - Seven-segment prompt loading from ai_roles table
//    - JSON output mode + thinking mode
//    - Knowledge context injection (top-K by importance, respects expiry)
//    - Global constraints appended to every prompt
//
//  All functions return null on failure so callers can degrade gracefully.
// ---------------------------------------------------------------------------

import type { Env } from "../types";
import { resolveProvider, resolveFallbackProvider, type ResolvedProvider } from "./ai-provider";
import { kbUpsert } from "./kb-store";
import { getTrustedFacts } from "./knowledge-service";
import {
  logKnowledgeConsumption,
  type ConsumerContext,
  type ConsumedKnowledge,
} from "./knowledge-consumption";

const DEFAULT_TIMEOUT_MS = 120_000;

// Pricing per million tokens (CNY) — keyed by INTERNAL model name so cost
// tracking stays stable across providers (SiliconFlow mirrors official rates).
const PRICING: Record<string, { input: number; output: number }> = {
  "deepseek-v4-flash": { input: 1, output: 2 },
  "deepseek-v4-pro": { input: 3, output: 6 },
  // Vision providers currently used through the free-tier router. Keep their
  // call/token volume in ai_usage while recording a conservative ¥0 cost.
  "qwen-vl-plus": { input: 0, output: 0 },
  "meta-llama/llama-4-scout-17b-16e-instruct": { input: 0, output: 0 },
  "openrouter/free": { input: 0, output: 0 },
  "gemini-2.0-flash": { input: 0, output: 0 },
};

// Budget protection. V5.1 曾 30→100；V5.19（OS 2.0 阶段 0）收紧回 30：
// 成本已全链路可见（trackUsage 入账），数据积累期以低预算稳健运行。
export const MONTHLY_CAP_CNY = 30;
const ALERT_THRESHOLD = 0.8;

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCallOpts {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  timeout_ms?: number;
  json_mode?: boolean;
  thinking?: boolean;
  reasoning_effort?: "low" | "medium" | "high";
  /** Role name for usage tracking */
  role?: string;
  /** Knowledge context to inject into system prompt */
  knowledge_context?: string;
}

export interface AiCallResult {
  content: string;
  reasoning?: string;
  tokens_in: number;
  tokens_out: number;
  model: string;
  /** Human-readable provider label, e.g. "硅基流动 SiliconFlow". */
  provider?: string;
  /** Upstream finish_reason; "length" means the output hit max_tokens. */
  finish_reason?: string;
}

// ---------------------------------------------------------------------------
//  Budget Check
// ---------------------------------------------------------------------------

/**
 * Get current month's total AI spend in CNY.
 */
export async function getMonthlySpend(db: D1Database): Promise<number> {
  return (await getMonthlySpendChecked(db)).spend;
}

/**
 * V5.56 资源保护：可区分「查询失败」与「真实 ¥0」。
 * 查询失败 ≠ 没有消费 —— 调用方必须 fail-safe，不得把失败当成 0 放行。
 */
export async function getMonthlySpendChecked(
  db: D1Database,
): Promise<{ ok: boolean; spend: number }> {
  const d = new Date();
  const startOfMonth = Math.floor(new Date(d.getFullYear(), d.getMonth(), 1).getTime() / 1000);
  try {
    const res = await db
      .prepare(`SELECT COALESCE(SUM(cost_cny), 0) as total FROM ai_usage WHERE created_at >= ?`)
      .bind(startOfMonth)
      .first<{ total: number }>();
    return { ok: true, spend: res?.total ?? 0 };
  } catch {
    return { ok: false, spend: 0 };
  }
}

/**
 * Check if budget allows another call. Returns degradation level:
 * 0 = normal, 1 = force flash, 2 = skip non-critical, 3 = block all AI
 * V5.56: 查询失败时 fail-closed 返回 3（阻断所有 AI），绝不把失败当成 0 放行。
 */
export async function getBudgetLevel(db: D1Database): Promise<number> {
  return (await getBudgetLevelChecked(db)).level;
}

/** V5.56：预算等级 + 是否读取成功。ok=false 时 level=3（fail-closed）。 */
export async function getBudgetLevelChecked(
  db: D1Database,
): Promise<{ ok: boolean; level: number }> {
  const { ok, spend } = await getMonthlySpendChecked(db);
  if (!ok) return { ok: false, level: 3 }; // 无法确认预算 → 阻断，宁可停也不超支
  if (spend >= MONTHLY_CAP_CNY) return { ok: true, level: 3 };
  if (spend >= MONTHLY_CAP_CNY * ALERT_THRESHOLD) return { ok: true, level: 2 };
  if (spend >= MONTHLY_CAP_CNY * 0.5) return { ok: true, level: 1 };
  return { ok: true, level: 0 };
}

// ---------------------------------------------------------------------------
//  Usage Tracking
// ---------------------------------------------------------------------------

export async function trackUsage(
  db: D1Database,
  role: string,
  model: string,
  tokensIn: number,
  tokensOut: number,
): Promise<void> {
  const pricing = PRICING[model] || PRICING["deepseek-v4-flash"];
  const cost = (tokensIn / 1_000_000) * pricing.input + (tokensOut / 1_000_000) * pricing.output;
  try {
    await db
      .prepare(
        `INSERT INTO ai_usage (role, model, tokens_in, tokens_out, cost_cny, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        role,
        model,
        tokensIn,
        tokensOut,
        Math.round(cost * 10000) / 10000,
        Math.floor(Date.now() / 1000),
      )
      .run();
  } catch {
    // Non-critical; don't block the main flow
  }
}

// ---------------------------------------------------------------------------
//  Knowledge Context
// ---------------------------------------------------------------------------

/**
 * Load top-K active, non-expired knowledge entries as context string.
 * V5.54: 统一走 Knowledge SSOT（knowledge_v2，仅 status=active 且未过期的可信
 * 事实），旧表 knowledge 仅作回填兜底；两个来源都尊重 importance/置信度排序。
 *
 * V5.69（知识消费追踪）：真正被注入 prompt 的 knowledge_v2 条目会记一条消费事件
 * （复用 audit_logs，见 lib/knowledge-consumption.ts），使 active 库存变成
 * knowledge → consumer → action → outcome 的可追溯链路。埋点为旁路观测，
 * 失败绝不阻断本次 AI 调用。`consumer` 携带角色/mission/prompt 以标注消费方与结果。
 */
export async function loadKnowledgeContext(
  db: D1Database,
  limit = 20,
  categories?: string[],
  consumer?: ConsumerContext,
): Promise<string> {
  const lines: string[] = [];
  const seen = new Set<string>();
  // 真正被注入 prompt 的 knowledge_v2 条目（仅 SSOT 计入消费；旧表兜底无 v2 id）。
  const consumed: ConsumedKnowledge[] = [];

  // 1) SSOT: knowledge_v2 可信事实（active + 未过期）
  try {
    const trusted = await getTrustedFacts(db, { limit });
    for (const k of trusted) {
      const cat = String(k.category ?? "general");
      if (categories && categories.length && !categories.includes(cat)) continue;
      const title = String(k.title ?? "");
      const content = String(k.content ?? "")
        .replace(/\s+/g, " ")
        .slice(0, 200);
      const key = `${cat}|${title}`;
      if (!title || seen.has(key)) continue;
      seen.add(key);
      const conf = Number(k.confidence ?? 0) < 60 ? " [低置信]" : "";
      lines.push(`[${String(k.layer ?? "L0")}/${cat}] ${title}: ${content}${conf}`);
      if (k.id) consumed.push({ id: String(k.id), title });
      if (lines.length >= limit) {
        await logKnowledgeConsumption(db, consumed, consumer);
        return lines.join("\n");
      }
    }
  } catch {
    /* knowledge_v2 不可用 → 只走旧表兜底 */
  }

  // 记录本批 SSOT 消费（提前 return 的情况已在上面处理）。
  if (consumed.length) await logKnowledgeConsumption(db, consumed, consumer);

  // 2) 兜底：旧表 knowledge（迁移期保留，SSOT 填满后自然退场）
  try {
    const now = Math.floor(Date.now() / 1000);
    let sql = `SELECT level, category, summary, evidence, confidence, importance
               FROM knowledge
               WHERE status = 'active' AND (expire_at IS NULL OR expire_at > ?)`;
    const params: (string | number)[] = [now];

    if (categories && categories.length > 0) {
      sql += ` AND category IN (${categories.map(() => "?").join(",")})`;
      params.push(...categories);
    }
    sql += ` ORDER BY importance DESC, confidence DESC LIMIT ?`;
    params.push(limit);

    const res = await db
      .prepare(sql)
      .bind(...params)
      .all();
    const rows = res.results as {
      level: string;
      category: string;
      summary: string;
      evidence: string;
      confidence: number;
      importance: number;
    }[];
    for (const r of rows) {
      if (lines.length >= limit) break;
      const key = `${r.category}|${r.summary}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const conf = r.confidence < 60 ? " [低置信]" : "";
      lines.push(`[${r.level}/${r.category}] ${r.summary}${conf}`);
    }
  } catch {
    /* ignore */
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
//  Global Constraints (appended to every system prompt)
// ---------------------------------------------------------------------------

const GLOBAL_CONSTRAINTS = `

--- Global Constraints ---
Never fabricate data.
Always cite evidence.
Every conclusion must reference GSC / GA4 / Behavior / Inquiry / Knowledge / Case Study.
If confidence < 60%, mark as low-confidence instead of asserting.
--- End Constraints ---`;

// ---------------------------------------------------------------------------
//  Core AI Call
// ---------------------------------------------------------------------------

/**
 * Unified AI call with provider routing, budget protection, usage tracking,
 * knowledge injection, and global constraints.
 *
 * Returns null when: no provider has an API key, budget exhausted, or API failure.
 */
export async function aiCall(
  env: Env | undefined,
  db: D1Database | undefined,
  messages: AiMessage[],
  opts: AiCallOpts = {},
): Promise<AiCallResult | null> {
  if (!env) return null;
  const provider = await resolveProvider(env);
  if (!provider) return null;

  // Budget check
  if (db) {
    const level = await getBudgetLevel(db);
    if (level >= 3) {
      console.warn("[ai] Budget exhausted, blocking AI call");
      return null;
    }
    // Level 1+: force flash
    if (level >= 1 && opts.model === "deepseek-v4-pro") {
      opts = { ...opts, model: "deepseek-v4-flash" };
    }
  }

  const model = opts.model || "deepseek-v4-pro";

  // Inject knowledge context into first system message
  if (opts.knowledge_context) {
    const kbBlock = `\n\n--- 业务知识库（按重要度排序，供参考）---\n${opts.knowledge_context}\n--- 知识库结束 ---`;
    messages = messages.map((m, i) =>
      i === 0 && m.role === "system" ? { ...m, content: m.content + kbBlock } : m,
    );
  }

  // Append global constraints to system message
  messages = messages.map((m, i) =>
    i === 0 && m.role === "system" ? { ...m, content: m.content + GLOBAL_CONSTRAINTS } : m,
  );

  /** One HTTP attempt against a given provider. */
  const attempt = async (
    p: ResolvedProvider,
  ): Promise<{ result: AiCallResult | null; status?: number }> => {
    // Build request body (wire model + provider-specific thinking params)
    const body: Record<string, unknown> = {
      model: p.wireModel(model),
      messages,
      stream: false,
      ...p.thinkingParams(!!opts.thinking, opts.reasoning_effort),
    };

    if (!opts.thinking && opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.max_tokens !== undefined) body.max_tokens = opts.max_tokens;
    if (opts.json_mode) body.response_format = { type: "json_object" };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeout_ms || DEFAULT_TIMEOUT_MS);

    try {
      const res = await fetch(p.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${p.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[ai:${p.id}] API error ${res.status}: ${errText.slice(0, 300)}`);
        return { result: null, status: res.status };
      }

      const json = (await res.json()) as {
        choices?: {
          message?: { content?: string; reasoning_content?: string };
          finish_reason?: string;
        }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const msg = json.choices?.[0]?.message;
      if (!msg?.content) return { result: null, status: res.status };

      const tokensIn = json.usage?.prompt_tokens ?? 0;
      const tokensOut = json.usage?.completion_tokens ?? 0;

      // Track usage (internal model name keeps pricing stable across providers)
      if (db) {
        await trackUsage(db, opts.role || "unknown", model, tokensIn, tokensOut);
      }

      return {
        result: {
          content: msg.content,
          reasoning: msg.reasoning_content || undefined,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          model: p.wireModel(model),
          provider: p.label,
          finish_reason: json.choices?.[0]?.finish_reason || undefined,
        },
      };
    } catch (e) {
      console.error(`[ai:${p.id}] fetch failed:`, e instanceof Error ? e.message : String(e));
      return { result: null };
    } finally {
      clearTimeout(timeout);
    }
  };

  let out = await attempt(provider);

  // Provider failover: SiliconFlow returns 402 when the voucher balance is
  // exhausted (only discoverable at call time). On auth/balance errors retry
  // once against the other provider so the pipeline keeps running.
  if (!out.result && (out.status === 401 || out.status === 402 || out.status === 403)) {
    const fallback = await resolveFallbackProvider(env, provider.id);
    if (fallback) {
      console.warn(`[ai] ${provider.id} returned ${out.status}, failing over to ${fallback.id}`);
      out = await attempt(fallback);
    }
  }

  return out.result;
}

// ---------------------------------------------------------------------------
//  JSON Convenience
// ---------------------------------------------------------------------------

/**
 * Call AI and parse response as JSON. Attaches _reasoning for thinking mode.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function aiJson<T = Record<string, any>>(
  env: Env | undefined,
  db: D1Database | undefined,
  messages: AiMessage[],
  opts: AiCallOpts = {},
): Promise<T | null> {
  const resp = await aiCall(env, db, messages, { ...opts, json_mode: true });
  if (!resp) return null;
  if (resp.finish_reason === "length") {
    console.warn(
      `[ai] JSON output truncated at ${resp.tokens_out} tokens (role=${opts.role || "?"}) — raise max_tokens`,
    );
  }

  let parsed: T | null = null;
  try {
    parsed = JSON.parse(resp.content) as T;
  } catch {
    const match = resp.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        parsed = JSON.parse(match[1].trim()) as T;
      } catch {
        /* fall through */
      }
    }
    if (!parsed) {
      console.error("[ai] JSON parse failed, raw:", resp.content.slice(0, 200));
      return null;
    }
  }

  if (resp.reasoning && parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    (parsed as Record<string, unknown>)._reasoning = resp.reasoning;
  }
  return parsed;
}

// ---------------------------------------------------------------------------
//  Role-Based Call (loads prompt from ai_roles table)
// ---------------------------------------------------------------------------

export interface RoleConfig {
  name: string;
  prompt: string;
  model: string;
  reasoning_effort: string;
  inputs: string;
  outputs: string;
  enabled: number;
}

/**
 * S30：角色查询的三态结果。过去 loadRole 把「查询抛错」「角色不存在」「角色被禁用」
 * 全部塌缩成 null，调用方无法区分「配置/DB 故障」与「没有这个角色」，导致
 * os-audit 静默换用兜底 prompt、商品翻译静默保持中文仍报 ok。
 * loadRoleChecked 返回 { role, state, error? }：
 *   ok        → 命中且启用
 *   not_found → 表里没有该角色（合法的「无此角色」）
 *   disabled  → 角色存在但 enabled=0（配置层面被关闭）
 *   error     → 查询抛错（DB 故障/表缺失，属 misconfiguration，必须可见）
 */
export type RoleLoadState = "ok" | "not_found" | "disabled" | "error";
export interface RoleLoadResult {
  role: RoleConfig | null;
  state: RoleLoadState;
  error?: string;
}

export async function loadRoleChecked(db: D1Database, roleName: string): Promise<RoleLoadResult> {
  try {
    const row = await db
      .prepare(
        `SELECT name, prompt, model, reasoning_effort, inputs, outputs, enabled FROM ai_roles WHERE name = ?`,
      )
      .bind(roleName)
      .first<RoleConfig>();
    if (!row) return { role: null, state: "not_found" };
    if (!row.enabled) return { role: row, state: "disabled" };
    return { role: row, state: "ok" };
  } catch (e) {
    return { role: null, state: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Load a role's configuration from the ai_roles table.
 * 兼容旧契约（RoleConfig | null，禁用角色仍返回行）；新代码应改用 loadRoleChecked
 * 以区分「故障」与「缺失」。
 */
export async function loadRole(db: D1Database, roleName: string): Promise<RoleConfig | null> {
  return (await loadRoleChecked(db, roleName)).role;
}

/**
 * Execute an AI call using a role's stored prompt configuration.
 * Automatically loads knowledge context and applies budget protection.
 */
export async function aiRoleCall(
  env: Env | undefined,
  db: D1Database | undefined,
  roleName: string,
  userContent: string,
  extraOpts?: Partial<AiCallOpts>,
): Promise<AiCallResult | null> {
  if (!env || !db) return null;

  // S30：区分「角色查询故障 / 不存在 / 被禁用」，故障必须可见（log），不再与「无此角色」
  // 同形静默返回 null。返回契约保持 AiCallResult | null（不影响既有调用方）。
  const loaded = await loadRoleChecked(db, roleName);
  if (loaded.state === "error") {
    console.error(
      `[ai] loadRole("${roleName}") failed (DB error, NOT "no such role"): ${loaded.error}`,
    );
    return null;
  }
  if (loaded.state === "not_found") {
    console.warn(`[ai] role "${roleName}" not found in ai_roles — skipping role-based call`);
    return null;
  }
  const role = loaded.role;
  if (!role || !role.enabled) {
    if (loaded.state === "disabled")
      console.warn(`[ai] role "${roleName}" is disabled — skipping role-based call`);
    return null;
  }

  // Load knowledge context (V5.69：记录本次被注入的知识由哪个角色消费)
  const kbContext = await loadKnowledgeContext(db, 20, undefined, {
    role: roleName,
    prompt: "aiRoleCall",
  });

  const messages: AiMessage[] = [
    { role: "system", content: role.prompt },
    { role: "user", content: userContent },
  ];

  return aiCall(env, db, messages, {
    model: role.model,
    reasoning_effort: role.reasoning_effort as AiCallOpts["reasoning_effort"],
    thinking: role.reasoning_effort === "high",
    role: roleName,
    knowledge_context: kbContext || undefined,
    json_mode: true,
    max_tokens: 4000,
    ...extraOpts,
  });
}

// ---------------------------------------------------------------------------
//  Knowledge Helpers (upgraded from V4.3)
// ---------------------------------------------------------------------------

export interface KnowledgeEntry {
  level: string;
  category: string;
  summary: string;
  evidence?: string;
  confidence?: number;
  importance?: number;
  source?: string;
  decay_rate?: number;
  expire_at?: number | null;
  tags?: string;
  related_products?: string;
  related_countries?: string;
}

/**
 * Save a knowledge entry to the new knowledge table.
 * When an R2 KB bucket is passed (V5.30), the entry is also mirrored into
 * the unified knowledge base (best-effort; D1 stays the runtime store).
 */
export async function saveKnowledge(
  db: D1Database,
  entry: KnowledgeEntry,
  bucket?: R2Bucket | null,
): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const res = await db
      .prepare(
        `INSERT INTO knowledge (level, category, summary, evidence, confidence, importance, source, decay_rate, expire_at, tags, related_products, related_countries, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        entry.level || "observation",
        entry.category || "operation",
        entry.summary,
        entry.evidence || "[]",
        entry.confidence ?? 50,
        entry.importance ?? 50,
        entry.source || "ai",
        entry.decay_rate ?? 1.0,
        entry.expire_at ?? null,
        entry.tags || "",
        entry.related_products || "",
        entry.related_countries || "",
        now,
        now,
      )
      .run();

    if (bucket) {
      const rowId = res?.meta?.last_row_id;
      if (rowId) {
        await kbUpsert(bucket, {
          id: `os-${rowId}`,
          category: entry.category || "operation",
          title: entry.summary,
          detail: entry.evidence || "",
          source: entry.source || "ai",
          importance: entry.importance ?? 50,
          level: entry.level || "observation",
          confidence: entry.confidence ?? 50,
          created_at: now,
        });
      }
    }
  } catch (e) {
    console.error("[knowledge] save failed:", e instanceof Error ? e.message : String(e));
  }
}

/**
 * Record a decision (adopted/rejected) to prevent duplicate suggestions.
 * Optional rejection_reason is persisted so the Strategist can learn the
 * operator's business style from WHY suggestions were rejected.
 */
export async function recordDecision(
  db: D1Database,
  suggestion: string,
  status: "adopted" | "rejected" | "done",
  reason = "",
  taskId?: number,
  rejectionReason?: string,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO decisions (suggestion, status, reason, task_id, rejection_reason, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        suggestion,
        status,
        reason,
        taskId ?? null,
        rejectionReason ?? "",
        Math.floor(Date.now() / 1000),
      )
      .run();
  } catch {
    // Non-critical
  }
}

/**
 * Check if a suggestion has been rejected recently (within 30 days).
 * S31：过去查询抛错时 catch→false（=「未被拒绝」），使「读不到决策历史」与「确实没被拒过」
 * 同形，导致 Strategist 重提 owner 已明确拒绝的建议。现返回 { rejected, checked }：
 *   checked=false → 无法确认（查询故障）；调用方必须走安全/可见路径，绝不默认「未拒绝」。
 */
export interface SuggestionRejectedResult {
  rejected: boolean;
  checked: boolean;
  error?: string;
}
export async function isSuggestionRejected(
  db: D1Database,
  suggestion: string,
): Promise<SuggestionRejectedResult> {
  try {
    const cutoff = Math.floor(Date.now() / 1000) - 30 * 86400;
    const res = await db
      .prepare(
        `SELECT id FROM decisions WHERE status = 'rejected' AND created_at > ? AND suggestion LIKE ?`,
      )
      .bind(cutoff, `%${suggestion.slice(0, 50)}%`)
      .first();
    return { rejected: !!res, checked: true };
  } catch (e) {
    return { rejected: false, checked: false, error: e instanceof Error ? e.message : String(e) };
  }
}
