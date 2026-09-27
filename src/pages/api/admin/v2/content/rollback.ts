// Phase 4 — V2 Content Rollback
// POST: Rollback content to a specific version

import { authenticateRequest, requirePermission } from "@/lib/admin/rbac";
import { rollbackContent, type EntityEntityType } from "@/lib/admin/content-publisher";
import { parseJsonBody } from "@/lib/safe";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

async function handlerAll(context: PagesCtx): Promise<Response> {
  const { request, env } = context;
  if (request.method !== "POST") return fail("METHOD_NOT_ALLOWED", "Use POST", 405);

  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  const permErr = requirePermission(user, "content", "publish");
  if (permErr) return permErr;

  const parsed = await parseJsonBody<{
    entity_type?: string;
    entity_key?: string;
    locale?: string;
    target_version_id?: string;
  }>(request);
  if (!parsed.ok) {
    const message =
      parsed.code === "EMPTY_BODY"
        ? "Request body is empty"
        : parsed.code === "INVALID_JSON"
          ? "Invalid JSON body"
          : "Failed to read request body";
    return fail(parsed.code, message, 400);
  }
  const body = parsed.body;

  const { entity_type, entity_key, locale = "en", target_version_id } = body;
  if (!entity_type || !entity_key || !target_version_id) {
    return fail("VALIDATION_ERROR", "entity_type, entity_key, and target_version_id required", 422);
  }
  if (!["blog", "product_content", "guide", "case_study", "category_faqs"].includes(entity_type)) {
    return fail("VALIDATION_ERROR", "Invalid entity_type", 422);
  }

  const result = await rollbackContent(
    env,
    entity_type as EntityEntityType,
    entity_key,
    locale,
    target_version_id,
    user.username,
  );

  if (!result.success) {
    return fail("ROLLBACK_FAILED", result.error ?? "Rollback failed", 502);
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        publish_id: result.publish_id,
        status: result.status,
        github_commit_sha: result.github_commit_sha,
      },
      error: null,
      meta: null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const ALL = endpoint(handlerAll);
