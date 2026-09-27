// ---------------------------------------------------------------------------
//  Aromiso — Shared abuse-protection helpers (Guard layer)
//
//  P0 scope (this file): Turnstile server verification, KV blacklist,
//  content-hash / same-email de-duplication, and a Resend daily budget
//  circuit breaker. These are the "email risk gate" primitives that decouple
//  "receive request" from "spend money (email/AI)".
//
//  Design rules (from docs/ANTI_ABUSE_ARCHITECTURE.md):
//   - Rules first, AI never the first line of defense.
//   - Always write to D1 first; email/AI are gated, skippable steps.
//   - Fingerprint/email > IP as identity (IP is only a risk signal).
//   - Fail OPEN on infra errors (never block a real buyer because KV hiccuped),
//     but fail CLOSED (no email) when abuse signals trip.
//   - Attack data is never deleted — high-risk hits land in abuse_log (P1).
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { sendAlert } from "../../lib/notify";

/** Result of the P1 unified guard middleware (forward-declared for reuse). */
export interface GuardResult {
  pass: boolean;
  action: "allow" | "challenge" | "silent-drop" | "block";
  reason?: string;
  riskScore: number;
}

/** What the email risk gate decided for a given submission. */
export interface MailGateDecision {
  /** A previous submission with the same email/content was seen recently. */
  duplicate: boolean;
  /** Email/name matched the KV blacklist. */
  blacklisted: boolean;
  /** Send the site-owner notification email. */
  sendOwner: boolean;
  /** Send the customer auto-reply email. */
  sendAutoReply: boolean;
  /** Human-readable reason for logging / abuse_log. */
  reason: string;
  /**
   * V5.67（M6/S26–S29）：闸门在「无法确认」下做了降级决策（如黑名单/预算不可读、
   * 去重写入失败）。degraded=true 必须让调用方可见（记录/响应），不得当成正常放行。
   */
  degraded?: boolean;
  degradedReasons?: string[];
}

// ---- Turnstile ------------------------------------------------------------

export interface TurnstileCheck {
  /** 是否判定为通过（允许继续）。 */
  verified: boolean;
  /** 无法真正确认（缺 secret / 网络失败）——此时 verified 是 fail-open 的降级结果。 */
  degraded: boolean;
  reason: string;
}

/**
 * Verify a Cloudflare Turnstile token server-side (structured).
 *
 * S-05（fail-CLOSED on infrastructure failure）：缺失 secret 或 siteverify 网络/解析
 * 异常时，不再 fail-open 放行——机器人防护形同 0 却静默通过是不可接受的。改为
 * verified=false（拒绝该次询盘）+ degraded=true + 通过 notify.sendAlert 发可观测告警
 * （critical，6h 冷却去重，永不抛错），让运营方立即知道「Turnstile 基础设施故障，
 * 询盘正在被拒绝」，而不是被静默放行或被静默拦截。
 *
 * 真正的令牌校验失败（success!=true）与客户端未带令牌仍按原样拒绝，但不告警
 * （属正常机器人流量，非基础设施故障）。生产环境 TURNSTILE_SECRET_KEY 已配置，
 * 合法买家的令牌会正常 success:true 通过，本改动不影响正常询盘转化。
 */
export async function turnstileCheck(env: Env, token: string, ip: string): Promise<TurnstileCheck> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error(
      "[guard] TURNSTILE_SECRET_KEY not set — rejecting inquiry (fail closed, degraded).",
    );
    await alertTurnstileInfraFailure(env, "turnstile-secret-missing");
    return { verified: false, degraded: true, reason: "turnstile-secret-missing" };
  }
  if (!token) return { verified: false, degraded: false, reason: "turnstile-token-missing" };
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(ip)}`,
    });
    const data = (await res.json()) as { success?: boolean };
    if (data.success === true) return { verified: true, degraded: false, reason: "ok" };
    return { verified: false, degraded: false, reason: "turnstile-rejected" };
  } catch (e) {
    // Network / parse failure to Turnstile — fail CLOSED (reject) + degraded + alert.
    console.error("[guard] Turnstile verify error (fail closed, degraded):", e);
    await alertTurnstileInfraFailure(env, "turnstile-verify-error");
    return { verified: false, degraded: true, reason: "turnstile-verify-error" };
  }
}

/**
 * S-05：Turnstile 基础设施故障告警（复用 notify.ts 现有系统邮件体系，不新造渠道）。
 * sendAlert 自带冷却去重（critical 6h）且永不抛错；此处再包一层 try/catch 兜底，
 * 确保告警失败绝不影响「拒绝该次请求」的安全语义。
 */
async function alertTurnstileInfraFailure(env: Env, reason: string): Promise<void> {
  try {
    await sendAlert(env, {
      level: "critical",
      code: "turnstile_infra_failure",
      title: "Turnstile 校验基础设施故障，询盘正被拒绝",
      lines: [
        `原因（reason）：${reason}`,
        "影响（impact）：Turnstile 无法确认，公开询盘表单已按 fail-closed 拒绝提交，避免机器人防护形同虚设。",
        "处置（action）：检查 TURNSTILE_SECRET_KEY 是否配置正确、Cloudflare siteverify 是否可达；恢复后合法询盘会自动放行。",
      ],
      needHuman: true,
    });
  } catch (e) {
    console.error("[guard] turnstile infra alert failed:", e);
  }
}

/**
 * Backwards-compatible boolean decision wrapper. Keeps existing callers/tests
 * (`if (!(await turnstileOk(...)))`) working; degradation is logged inside
 * turnstileCheck so it is never fully silent.
 */
export async function turnstileOk(env: Env, token: string, ip: string): Promise<boolean> {
  const r = await turnstileCheck(env, token, ip);
  return r.verified;
}

// ---- Blacklist (KV) -------------------------------------------------------

export interface BlacklistCheck {
  blacklisted: boolean;
  /** false = KV 未绑定/抛错，无法确认（不得当成「确定不在黑名单」）。 */
  checked: boolean;
}

/**
 * Check the KV blacklist (structured). Keys: `bl:email:<lc>` / `bl:name:<lc>`.
 * checked=false 表示无法确认——调用方对「发邮件给提交者」这类花钱/骚扰风险应 fail-closed。
 */
export async function isBlacklistedChecked(
  env: Env,
  email: string,
  name: string,
): Promise<BlacklistCheck> {
  const kv = env.DRAFTS;
  if (!kv) return { blacklisted: false, checked: false };
  try {
    const e = (email || "").toLowerCase().trim();
    const n = (name || "").toLowerCase().trim();
    if (e && (await kv.get(`bl:email:${e}`))) return { blacklisted: true, checked: true };
    if (n && (await kv.get(`bl:name:${n}`))) return { blacklisted: true, checked: true };
    return { blacklisted: false, checked: true };
  } catch {
    return { blacklisted: false, checked: false };
  }
}

/**
 * Backwards-compatible boolean wrapper (fail-open on infra error, as before).
 * New code should prefer isBlacklistedChecked to distinguish "not listed" from
 * "could not check".
 */
export async function isBlacklisted(env: Env, email: string, name: string): Promise<boolean> {
  return (await isBlacklistedChecked(env, email, name)).blacklisted;
}

// ---- Hashing / normalization ----------------------------------------------

/** Normalize free-text for stable hashing: lowercase, strip punctuation, squeeze whitespace. */
export function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** SHA-256 hex digest (Workers runtime provides Web Crypto). */
export async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- Resend daily budget circuit breaker ----------------------------------

export type MailBudgetLevel = "normal" | "owner-only" | "none";

const BUDGET_OWNER_ONLY_AT = 80; // >= 80 sent today: stop customer auto-replies (anti-backscatter)
const BUDGET_NONE_AT = 95; // >= 95 sent today: stop all outbound mail

/** Read today's outbound mail count (UTC day key) — structured. */
export async function getMailBudgetUsedChecked(env: Env): Promise<{ used: number; ok: boolean }> {
  const kv = env.DRAFTS;
  if (!kv) return { used: 0, ok: false };
  const dayKey = `mail:budget:${new Date().toISOString().slice(0, 10)}`;
  try {
    return { used: Number((await kv.get(dayKey)) || "0"), ok: true };
  } catch {
    return { used: 0, ok: false };
  }
}

/** Read today's outbound mail count (UTC day key). */
export async function getMailBudgetUsed(env: Env): Promise<number> {
  return (await getMailBudgetUsedChecked(env)).used;
}

/** Decide which mails may go out given the current daily count. */
export function mailBudgetLevel(used: number): MailBudgetLevel {
  if (used >= BUDGET_NONE_AT) return "none";
  if (used >= BUDGET_OWNER_ONLY_AT) return "owner-only";
  return "normal";
}

/** Increment today's mail counter by `n` (call once per successfully accepted email). */
export async function bumpMailBudget(env: Env, n = 1): Promise<void> {
  const kv = env.DRAFTS;
  if (!kv) return;
  const dayKey = `mail:budget:${new Date().toISOString().slice(0, 10)}`;
  try {
    const used = Number((await kv.get(dayKey)) || "0");
    // TTL ~ 2 days so the key survives a UTC midnight boundary then expires.
    await kv.put(dayKey, String(used + n), { expirationTtl: 172800 });
  } catch {
    /* non-fatal */
  }
}

// ---- Email risk gate (de-dup + blacklist + budget) ------------------------

/**
 * Run the full email risk gate for a submission. Always returns a decision;
 * the caller still writes to D1 first, then obeys sendOwner/sendAutoReply.
 *
 * Order of checks:
 *   1. blacklist  → silent drop (no mail)
 *   2. same-email within 10 min → duplicate (no mail)
 *   3. same content hash within 24 h → duplicate (no mail)
 *   4. daily budget breaker → downgrade owner/auto-reply
 */
export async function evaluateMailGate(
  env: Env,
  input: { name: string; email: string; message: string },
): Promise<MailGateDecision> {
  const kv = env.DRAFTS;
  const email = (input.email || "").toLowerCase().trim();
  const degradedReasons: string[] = [];
  const base: MailGateDecision = {
    duplicate: false,
    blacklisted: false,
    sendOwner: true,
    sendAutoReply: true,
    reason: "ok",
  };

  // 1) Blacklist — checked（区分「确定不在名单」与「无法确认」）
  const bl = await isBlacklistedChecked(env, email, input.name);
  if (bl.blacklisted) {
    return {
      ...base,
      blacklisted: true,
      sendOwner: false,
      sendAutoReply: false,
      reason: "blacklist",
    };
  }
  if (!bl.checked) {
    // S27：无法确认黑名单 → 对「发给提交者」的自动回复 fail-closed（防 backscatter/骚扰）；
    // owner 通知发往固定内部地址、无 backscatter 风险，予以保留。标 degraded 让上层可见。
    degradedReasons.push("blacklist-check-unavailable");
  }

  if (kv) {
    try {
      // 2) Same-email de-dup (10 min)
      const dupKey = `dedup:email:${email}`;
      if (email && (await kv.get(dupKey))) {
        return {
          ...base,
          duplicate: true,
          sendOwner: false,
          sendAutoReply: false,
          reason: "dup-email",
        };
      }

      // 3) Content-hash de-dup (24 h)
      const hash = await sha256(normalize(input.name + " " + email + " " + input.message));
      const hashKey = `dedup:hash:${hash}`;
      if (await kv.get(hashKey)) {
        return {
          ...base,
          duplicate: true,
          sendOwner: false,
          sendAutoReply: false,
          reason: "dup-hash",
        };
      }

      // Mark as seen (only when not a duplicate).
      if (email) await kv.put(dupKey, "1", { expirationTtl: 600 });
      await kv.put(hashKey, "1", { expirationTtl: 86400 });
    } catch (e) {
      // S29：去重读/写失败 → 不能保证去重，标 degraded（可见），不再静默假装已去重。
      degradedReasons.push("dedup-unavailable");
      console.error(
        "[guard] dedup KV failed (degraded):",
        e instanceof Error ? e.message : String(e),
      );
    }
  } else {
    degradedReasons.push("dedup-kv-unbound");
  }

  // 4) Daily budget breaker — checked
  const budget = await getMailBudgetUsedChecked(env);
  if (!budget.ok) {
    // S26：无法确认已用量 → 花钱路径 fail-closed：降级 owner-only（停发客户自动回复），
    // 而不是把故障当成「用量=0，可无上限发送」。
    degradedReasons.push("mail-budget-unavailable");
    return {
      ...base,
      sendAutoReply: false,
      reason: "budget-unavailable-owner-only",
      degraded: true,
      degradedReasons,
    };
  }
  const level = mailBudgetLevel(budget.used);
  if (level === "none") {
    return {
      ...base,
      sendOwner: false,
      sendAutoReply: false,
      reason: "budget-exhausted",
      ...(degradedReasons.length ? { degraded: true, degradedReasons } : {}),
    };
  }
  if (level === "owner-only") {
    return {
      ...base,
      sendAutoReply: false,
      reason: "budget-owner-only",
      ...(degradedReasons.length ? { degraded: true, degradedReasons } : {}),
    };
  }

  // normal：若黑名单无法确认，则不发自动回复给提交者（fail-closed on send-to-submitter）。
  const sendAutoReply = bl.checked;
  const out: MailGateDecision = {
    ...base,
    sendAutoReply,
    reason: sendAutoReply ? "ok" : "blacklist-check-unavailable-no-autoreply",
  };
  if (degradedReasons.length) {
    out.degraded = true;
    out.degradedReasons = degradedReasons;
  }
  return out;
}
