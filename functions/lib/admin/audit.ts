// Phase 2 Audit Middleware — logAction()
// Records all write operations to audit_logs.
// actor_type: 'human' | 'ai' | 'cron' | 'system'
// Never throws — audit failure must not block business operations.

import type { AdminEnv } from "../../api/admin/shared";

export interface AuditEntry {
  actor_type: "human" | "ai" | "cron" | "system";
  user_id?: string | null;
  username?: string | null;
  action:
    | "create"
    | "update"
    | "delete"
    | "publish"
    | "approve_ai"
    | "reject_ai"
    | "login"
    | "logout"
    | "rollback";
  resource_type: string;
  resource_id?: string | null;
  resource_title?: string | null;
  change_summary?: string | null;
  before_snippet?: string | null;
  after_snippet?: string | null;
  request_id?: string | null;
}

/**
 * V5.67（S32）：审计写入失败时的 KV 补偿——把丢失的审计事件暂存到 DRAFTS，
 * 并累加 audit:fail_count 指标，使「审计轨迹残缺」可追踪、可事后补录，
 * 而不是静默消失。补偿本身也绝不抛错（审计失败不得阻断业务）。
 */
async function compensateAuditFailure(
  env: AdminEnv,
  entry: AuditEntry,
  reason: string,
): Promise<void> {
  const kv = env.DRAFTS;
  if (!kv) return;
  try {
    const id = crypto.randomUUID();
    await kv.put(
      `audit:fail:${id}`,
      JSON.stringify({ ...entry, _reason: reason.slice(0, 300), _ts: new Date().toISOString() }),
      { expirationTtl: 604800 }, // 保留 7 天供补录
    );
    const n = Number((await kv.get("audit:fail_count")) || "0");
    await kv.put("audit:fail_count", String(n + 1));
  } catch (e) {
    // 最后一道：连补偿都失败，只能记日志（不再有别处可写）。
    console.error(
      "audit: compensation write also failed",
      e instanceof Error ? e.message : String(e),
    );
  }
}

/** Record an audit event. Never throws — audit failure must not block business operations. */
export async function logAction(env: AdminEnv, entry: AuditEntry): Promise<void> {
  if (!env.DB) {
    // S32：DB 未绑定不再静默返回——记日志并走 KV 补偿，保留审计事件。
    console.error(
      "audit: DB unbound, audit event diverted to KV compensation",
      entry.action,
      entry.resource_type,
    );
    await compensateAuditFailure(env, entry, "DB unbound");
    return;
  }
  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (id, actor_type, user_id, username, action, resource_type, resource_id,
        resource_title, change_summary, before_snippet, after_snippet, request_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    )
      .bind(
        crypto.randomUUID(),
        entry.actor_type,
        entry.user_id ?? null,
        entry.username ?? null,
        entry.action,
        entry.resource_type,
        entry.resource_id ?? null,
        entry.resource_title ?? null,
        entry.change_summary ?? null,
        entry.before_snippet ?? null,
        entry.after_snippet ?? null,
        entry.request_id ?? null,
      )
      .run();
  } catch (e) {
    // Audit failure is non-blocking，但必须可见 + 可补偿（S32）。
    console.error("audit: logAction failed", e instanceof Error ? e.message : String(e));
    await compensateAuditFailure(env, entry, e instanceof Error ? e.message : String(e));
  }
}
