// Phase 4 — V2 Content Detail (Get / Save / Quick Edit)
// Handles individual content items: read from GitHub, save draft, quick edit.

import { ghGetChecked, saveDraft, getDraft, b64decode } from "@/pages/api/admin/_shared";
import { parseJsonBody, runChecked, allChecked } from "@/lib/safe";
import { authenticateRequest, requirePermission } from "@/lib/admin/rbac";
import { logAction } from "@/lib/admin/audit";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

type EntityType = "blog" | "product_content" | "guide" | "case_study";

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

function collectionPath(entityType: EntityType): string {
  switch (entityType) {
    case "blog":
      return "blog";
    case "product_content":
      return "products";
    case "guide":
      return "guides";
    case "case_study":
      return "caseStudies";
  }
}

function entityToCollection(entityType: EntityType): string {
  switch (entityType) {
    case "blog":
      return "blog";
    case "product_content":
      return "products";
    case "guide":
      return "guides";
    case "case_study":
      return "caseStudies";
  }
}

const VALID_LOCALES = ["en", "es", "de"];

function parseFrontmatter(raw: string): { fm: Record<string, unknown>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const fm: Record<string, unknown> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { fm, body: m[2] };
}

async function handlerAll(context: PagesCtx): Promise<Response> {
  const { request, env, params } = context;
  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);

  const entityType = params.type as EntityType;
  const entityKey = params.key;
  if (!entityType || !entityKey) return fail("VALIDATION_ERROR", "type and key required", 422);
  if (!["blog", "product_content", "guide", "case_study"].includes(entityType)) {
    return fail("VALIDATION_ERROR", "Invalid entity type", 422);
  }

  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") || "en";
  if (!VALID_LOCALES.includes(locale)) return fail("VALIDATION_ERROR", "Invalid locale", 422);

  const collection = entityToCollection(entityType);
  const filePath = `src/content/${collectionPath(entityType)}/${entityKey}.${locale}.md`;

  // ---- GET: Read content ---------------------------------------------------
  if (request.method === "GET") {
    const permErr = requirePermission(user, "content", "view");
    if (permErr) return permErr;

    // Try GitHub first — S05：读取失败绝不能当成「空文档」，否则编辑器显示空白、
    // 用户一保存就用空内容覆盖线上文件。error → 502；missing → 合法的新建空文档。
    const got = await ghGetChecked(filePath, env);
    if (got.state === "error") {
      return fail(
        "UPSTREAM_READ_ERROR",
        `Failed to read content from GitHub: ${got.error ?? "unknown"}`,
        502,
      );
    }
    let content = "";
    let sha = "";
    let source = "github";
    const existsOnGithub = got.state === "found";

    if (existsOnGithub && got.item?.content) {
      content = b64decode(got.item.content);
      sha = got.item.sha;
    }

    // Check for KV draft
    const draft = await getDraft(env, collection, entityKey, locale);
    if (draft) {
      content = draft;
      source = "draft";
    }

    const { fm, body } = parseFrontmatter(content);

    // Get publish history
    const { getPublishHistory, getLatestPublishStatus } =
      await import("@/lib/admin/content-publisher");
    const publishStatus = await getLatestPublishStatus(env, entityType, entityKey, locale);
    const publishHistory = await getPublishHistory(env, entityType, entityKey, locale);

    // Get version history（查询失败不再塌缩成空数组冒充「无版本」）
    const versions = env.DB
      ? await allChecked<{ id: string }>(
          env.DB.prepare(
            `SELECT * FROM content_versions WHERE entity_type = ? AND entity_key = ? AND locale = ? ORDER BY version DESC LIMIT 20`,
          ).bind(entityType, entityKey, locale),
        )
      : { ok: false as const, error: "DB unbound", results: null, count: 0 };

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          entity_type: entityType,
          entity_key: entityKey,
          locale,
          frontmatter: fm,
          body,
          sha,
          source,
          exists_on_github: existsOnGithub,
          publish_status: publishStatus,
          publish_history: publishHistory,
          versions: versions.ok ? versions.results : [],
          ...(versions.ok ? {} : { versions_error: versions.error }),
        },
        error: null,
        meta: null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // ---- POST: Save draft or publish -----------------------------------------
  if (request.method === "POST") {
    const permErr = requirePermission(user, "content", "edit");
    if (permErr) return permErr;

    const parsedBody = await parseJsonBody<{
      frontmatter?: Record<string, unknown>;
      content?: string;
      status?: string;
      quick_edit?: boolean;
      field?: string;
      value?: unknown;
    }>(request);
    if (!parsedBody.ok) {
      return fail(
        "INVALID_JSON",
        parsedBody.code === "EMPTY_BODY" ? "Request body is empty" : "Invalid JSON body",
        400,
      );
    }
    const body = parsedBody.body;

    // Quick Edit mode
    if (body.quick_edit && body.field) {
      const got = await ghGetChecked(filePath, env);
      // S05：读取失败 ≠ 内容不存在。error → 502（绝不拿空白覆盖）；missing → 404。
      if (got.state === "error") {
        return fail(
          "UPSTREAM_READ_ERROR",
          `Failed to read content from GitHub: ${got.error ?? "unknown"}`,
          502,
        );
      }
      if (got.state !== "found" || !got.item?.content) {
        return fail("NOT_FOUND", "Content not found", 404);
      }
      const raw = b64decode(got.item.content);
      const { fm, body: mdBody } = parseFrontmatter(raw);
      fm[body.field] = body.value;

      const full = buildFullContent(fm, entityKey, locale, mdBody);
      // S22：草稿未真正写入绝不能报成功。
      const saved = await saveDraft(env, collection, entityKey, locale, full);
      if (!saved) {
        return fail(
          "DRAFT_SAVE_FAILED",
          "Quick edit NOT saved (draft storage unavailable); changes were not persisted",
          503,
        );
      }

      await logAction(env, {
        actor_type: "human",
        user_id: user.id,
        username: user.username,
        action: "update",
        resource_type: entityType,
        resource_id: entityKey,
        change_summary: `Quick edit: ${body.field}`,
      });

      return new Response(
        JSON.stringify({ success: true, data: { field: body.field }, error: null, meta: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Full save (draft)
    const fm = body.frontmatter ?? {};
    const content = body.content ?? "";

    // Validate required fields
    const errors = validateFrontmatter(entityType, fm);
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: "VALIDATION_ERROR", message: errors.join("; ") },
          meta: null,
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }

    const full = buildFullContent(fm, entityKey, locale, content);
    // S22：草稿未真正写入绝不能报成功——否则用户以为已保存，编辑被丢弃。
    const saved = await saveDraft(env, collection, entityKey, locale, full);
    if (!saved) {
      return fail(
        "DRAFT_SAVE_FAILED",
        "Draft NOT saved (draft storage unavailable). Your changes were not persisted — please retry.",
        503,
      );
    }

    await logAction(env, {
      actor_type: "human",
      user_id: user.id,
      username: user.username,
      action: "update",
      resource_type: entityType,
      resource_id: entityKey,
      change_summary: "Saved draft",
    });

    return new Response(
      JSON.stringify({ success: true, data: { status: "draft" }, error: null, meta: null }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // ---- DELETE: Soft delete --------------------------------------------------
  if (request.method === "DELETE") {
    const permErr = requirePermission(user, "content", "delete");
    if (permErr) return permErr;

    // Mark as deleted in admin_entities — S18：必须检查受影响行数。
    if (!env.DB) {
      return fail("INTERNAL_ERROR", "Database unavailable — cannot delete", 500);
    }
    const del = await runChecked(
      env.DB.prepare(
        `UPDATE admin_entities SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE entity_type = ? AND entity_id = ?`,
      ).bind(entityType, entityKey),
    );
    if (!del.ok) {
      // 数据库故障 → 明确失败，绝不报「已删除」。
      return fail("INTERNAL_ERROR", `Soft delete failed: ${del.error}`, 500);
    }

    await logAction(env, {
      actor_type: "human",
      user_id: user.id,
      username: user.username,
      action: "delete",
      resource_type: entityType,
      resource_id: entityKey,
      change_summary:
        del.changes > 0
          ? "Soft deleted"
          : "Soft delete requested (entity not tracked in admin_entities)",
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: { deleted_rows: del.changes },
        error: null,
        meta: null,
        // changes=0：实体未被 admin_entities 跟踪，软删除未实际生效——如实告知，不静默假装成功。
        ...(del.changes === 0
          ? {
              warning:
                "Entity was not tracked in admin_entities; no row was marked deleted. The GitHub content file (if any) was not removed.",
            }
          : {}),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  return fail("METHOD_NOT_ALLOWED", "Use GET, POST, or DELETE", 405);
}

// ---- Helpers --------------------------------------------------------------

function yamlVal(v: unknown): string {
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return "[" + v.map(yamlVal).join(", ") + "]";
  if (v && typeof v === "object") {
    const raw = (v as Record<string, unknown>).__rawYaml;
    if (typeof raw === "string") return raw;
  }
  const s = String(v ?? "");
  if (s === "" || /[:#[\]{}"',&*?|<>=!%@`\n]/.test(s) || /^\s|\s$/.test(s))
    return JSON.stringify(s);
  return s;
}

function buildFullContent(
  fm: Record<string, unknown>,
  key: string,
  locale: string,
  body: string,
): string {
  const lines = ["---", `key: ${key}`, `locale: ${locale}`];
  for (const [k, v] of Object.entries(fm)) {
    if (k === "key" || k === "locale") continue;
    if (v === "" || v === null || v === undefined) continue;
    lines.push(`${k}: ${yamlVal(v)}`);
  }
  lines.push("---");
  return lines.join("\n") + "\n\n" + body + "\n";
}

function validateFrontmatter(entityType: EntityType, fm: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  if (!str(fm.title)) errors.push("title is required");
  if (!str(fm.excerpt)) errors.push("excerpt is required");

  if (entityType === "product_content") {
    if (!str(fm.category)) errors.push("category is required");
    if (!str(fm.moq)) errors.push("moq is required");
    if (!str(fm.leadTime)) errors.push("leadTime is required");
    if (!str(fm.origin)) errors.push("origin is required");
  }
  if (entityType === "blog" || entityType === "guide") {
    if (!fm.pubDate) errors.push("pubDate is required");
  }
  if (entityType === "case_study") {
    if (!str(fm.country)) errors.push("country is required");
    if (!str(fm.clientType)) errors.push("clientType is required");
  }
  return errors;
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const ALL = endpoint(handlerAll);
