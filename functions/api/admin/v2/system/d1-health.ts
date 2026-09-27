// ============================================================================
// GET /api/admin/v2/system/d1-health — 统一低成本 D1 健康检查（V5.56 资源保护）
//
// 目的：用极低成本判断 D1 是否可用 / 配额是否正常 / 是否应暂停自动化 / 是否恢复。
// 绝不扫描数据。
//
// 两种模式：
//   默认       → 只读 KV 中的熔断状态（零 D1 访问）
//   ?probe=1   → 额外跑一次 `SELECT 1`（不扫表，几乎零行读），并据此更新熔断状态：
//                成功→恢复 NORMAL；配额错误→升级熔断。
//
// 鉴权：人审会话或 CRON_SECRET。
// ============================================================================

import type { AdminEnv } from "../../shared";
import {
  authenticateRequest,
  checkPermission,
  cronSecretAuthorized,
} from "../../../../lib/admin/rbac";
import { getGuardState, d1HealthCheck, secondsUntilUtcMidnight } from "../../../../lib/d1-guard";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: status < 400, data, error: null, meta: null }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;
  if (request.method !== "GET") return fail("METHOD_NOT_ALLOWED", "Use GET", 405);
  const user = await authenticateRequest(request, env);
  const isCron = cronSecretAuthorized(request, env);
  if (!user && !isCron) return fail("UNAUTHORIZED", "Login required", 401);
  if (user && !checkPermission(user, "system", "view"))
    return fail("FORBIDDEN", "Missing permission: system:view", 403);

  const url = new URL(request.url);
  const probe = url.searchParams.get("probe") === "1";

  try {
    if (probe) {
      const h = await d1HealthCheck(env);
      return json({
        healthy: h.healthy,
        quota_ok: h.quota,
        state: h.state,
        seconds_until_quota_reset: secondsUntilUtcMidnight(),
        probe: true,
      });
    }
    // 默认：只读 KV 熔断状态（零 D1 访问）
    const rec = await getGuardState(env);
    return json({
      healthy: rec.state === "NORMAL" || rec.state === "WARNING",
      quota_ok: rec.state !== "CIRCUIT_OPEN",
      state: rec.state,
      opened_at: rec.opened_at,
      reason: rec.reason,
      failures: rec.failures,
      seconds_until_quota_reset: secondsUntilUtcMidnight(),
      probe: false,
    });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : String(e), 500);
  }
}
