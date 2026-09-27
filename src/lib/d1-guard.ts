// ============================================================================
// d1-guard.ts — 统一 D1 Resource Guard + 配额熔断器（V5.56 资源保护模式）
//
// 目标：Production D1 是受保护资源。所有自动化/聚合/验收在配额紧张时自动降级，
// 而不是继续重试把免费额度打光。状态存 KV（DRAFTS），跨请求共享。
//
// 熔断状态机：
//   NORMAL → WARNING → CRITICAL → CIRCUIT_OPEN
//   检测到 D1 配额错误（daily row read limit / 429 / quota 500）→ 立即升级。
//   熔断状态带 TTL（到下一个 UTC 0 点=配额重置）；日耗尽只靠 TTL/人工恢复，
//   瞬时限流才允许 probe 提前回 NORMAL（见 d1HealthCheck）。
//
// 优先级（越小越关键，配额紧张时先保高优先级）：
//   1 网站核心功能   2 用户访问   3 订单/商品核心业务   4 必要后台功能
//   5 自动化任务     6 统计/Dashboard/非必要聚合        7 E2E/验收/调试
//
// 原则：「宁可暂停自动化，也不能把网站数据库额度打光。」
//       「查询失败 ≠ 没有数据 → PAUSE/FAIL-SAFE，绝不 fallback=0 放行。」
// ============================================================================

import type { Env } from "@/lib/env";

export type GuardState = "NORMAL" | "WARNING" | "CRITICAL" | "CIRCUIT_OPEN";

/** 优先级：数字越小越关键。 */
export const PRIORITY = {
  SITE_CORE: 1,
  USER_ACCESS: 2,
  COMMERCE_CORE: 3,
  ADMIN_REQUIRED: 4,
  AUTOMATION: 5,
  AGGREGATION: 6,
  E2E_DEBUG: 7,
} as const;

const GUARD_KEY = "d1:guard";
const SEVERITY_RANK: Record<GuardState, number> = {
  NORMAL: 0,
  WARNING: 1,
  CRITICAL: 2,
  CIRCUIT_OPEN: 3,
};

/** 各状态下「允许执行」的最高优先级数字（>= 该值的优先级被阻止）。 */
// NORMAL: 全放行(<=7) | WARNING: 阻 6,7 | CRITICAL: 阻 5,6,7 | CIRCUIT_OPEN: 阻 5,6,7（核心 1-4 仍允许）
const ALLOWED_MAX_PRIORITY: Record<GuardState, number> = {
  NORMAL: 7,
  WARNING: 5, // 允许 1-5，阻 6,7（统计、E2E）
  CRITICAL: 4, // 允许 1-4，阻 5,6,7（自动化、统计、E2E）
  CIRCUIT_OPEN: 4, // 熔断：自动化/统计/E2E 全停，保网站核心 1-4
};

interface GuardRecord {
  state: GuardState;
  opened_at: string;
  reason: string;
  failures: number;
}

/** 判断一个错误是否为 D1 配额/限流类错误。 */
export function isQuotaError(err: unknown): boolean {
  const msg = String(err && (err as Error).message ? (err as Error).message : err || "");
  return (
    /row read limit/i.test(msg) ||
    /exceeded.*(?:free tier|daily|limit)/i.test(msg) ||
    /daily.*read.*limit/i.test(msg) ||
    /quota/i.test(msg) ||
    /rate.?limit/i.test(msg) ||
    /too many requests/i.test(msg) ||
    /429/.test(msg)
  );
}

/**
 * 判断 guard 记录的原因是否为「每日 rows-read 耗尽」。
 * 日耗尽只会在 UTC 0 点重置 → 只能靠 KV TTL 自然过期或人工 resetGuard 恢复；
 * 瞬时限流（429 等）才允许 probe 提前恢复。
 */
export function isDailyExhaustion(reason: string): boolean {
  return (
    /row read limit/i.test(reason) ||
    /free tier/i.test(reason) ||
    /daily.*read.*limit/i.test(reason)
  );
}

/** 计算到下一个 UTC 0 点（D1 免费配额重置）的秒数。 */
export function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
  );
  return Math.max(60, Math.floor((nextMidnight - now.getTime()) / 1000));
}

/** 读取当前熔断状态（缺省/过期视为 NORMAL）。 */
export async function getGuardState(env: Env): Promise<GuardRecord> {
  try {
    const raw = await env.DRAFTS?.get(GUARD_KEY, "json");
    if (raw && typeof raw === "object" && (raw as GuardRecord).state) {
      return raw as GuardRecord;
    }
  } catch {
    /* KV 不可用 → 按 NORMAL（不阻塞网站核心） */
  }
  return { state: "NORMAL", opened_at: "", reason: "", failures: 0 };
}

/** 记录一次配额失败 → 升级状态（带 TTL 到配额重置）。 */
export async function recordQuotaFailure(env: Env, reason: string): Promise<GuardState> {
  const cur = await getGuardState(env);
  const nextRank = Math.min(SEVERITY_RANK[cur.state] + 1, SEVERITY_RANK.CIRCUIT_OPEN);
  const nextState = (Object.keys(SEVERITY_RANK) as GuardState[]).find(
    (k) => SEVERITY_RANK[k] === nextRank,
  ) as GuardState;
  const rec: GuardRecord = {
    state: nextState,
    opened_at: new Date().toISOString(),
    reason: String(reason).slice(0, 200),
    failures: (cur.failures || 0) + 1,
  };
  try {
    await env.DRAFTS?.put(GUARD_KEY, JSON.stringify(rec), {
      expirationTtl: secondsUntilUtcMidnight(),
    });
  } catch {
    /* KV 写失败不阻塞 */
  }
  return nextState;
}

/** 手动/健康检查恢复：配额恢复后重置为 NORMAL。 */
export async function resetGuard(env: Env): Promise<void> {
  try {
    await env.DRAFTS?.delete(GUARD_KEY);
  } catch {
    /* noop */
  }
}

/**
 * 判断某优先级的操作当前是否允许执行。
 * 返回 { allowed, state }。调用方在 state 非 NORMAL 且不允许时应跳过/降级。
 */
export async function guardAllows(
  env: Env,
  priority: number,
): Promise<{ allowed: boolean; state: GuardState }> {
  const rec = await getGuardState(env);
  const allowed = priority <= ALLOWED_MAX_PRIORITY[rec.state];
  return { allowed, state: rec.state };
}

/**
 * 低成本健康检查：`SELECT 1`（不扫表、几乎零行读）。
 * - 成功 → 仅证明数据库可连接。
 *   · 瞬时限流类原因（429 等）→ probe 恢复 NORMAL；
 *   · 每日 rows-read 耗尽 → **不**提前复位（SELECT 1 不消耗 rows-read，成功不代表配额恢复；
 *     2026-09-05 实测：probe 反复 WARNING→NORMAL 重开闸口，导致当日二次烧穿 5M）。
 *     恢复只靠 KV TTL 到 UTC 0 点自然过期，或人工 resetGuard。
 * - 配额错误 → 升级熔断。
 * 返回 { healthy, state, quota }。绝不扫数据。
 */
export async function d1HealthCheck(env: Env): Promise<{
  healthy: boolean;
  state: GuardState;
  quota: boolean;
}> {
  if (!env.DB) return { healthy: false, state: "CIRCUIT_OPEN", quota: false };
  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    const cur = await getGuardState(env);
    if (cur.state !== "NORMAL" && !isDailyExhaustion(cur.reason)) {
      await resetGuard(env);
      return { healthy: true, state: "NORMAL", quota: true };
    }
    return { healthy: true, state: cur.state, quota: true };
  } catch (e) {
    if (isQuotaError(e)) {
      const st = await recordQuotaFailure(env, String((e as Error).message || e));
      return { healthy: false, state: st, quota: false };
    }
    return { healthy: false, state: (await getGuardState(env)).state, quota: true };
  }
}

/**
 * 指数退避辅助：返回第 attempt 次（0 起）应等待的毫秒数。
 * base 默认 2s，封顶 60s。
 */
export function backoffMs(attempt: number, baseMs = 2000, capMs = 60000): number {
  return Math.min(capMs, baseMs * Math.pow(2, Math.max(0, attempt)));
}
