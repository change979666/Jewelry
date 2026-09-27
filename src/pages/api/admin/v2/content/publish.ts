// Phase 4 — V2 Content Publish (Five-State Machine)
// POST: Publish content (committing → building → deployed/build_failed)
// GET: Poll build status for a publish record

import { ghGetChecked, b64decode, getDraft } from "@/pages/api/admin/_shared";
import { parseJsonBody } from "@/lib/safe";
import { authenticateRequest, requirePermission } from "@/lib/admin/rbac";
import {
  publishContent,
  pollBuildStatus,
  type EntityEntityType,
} from "@/lib/admin/content-publisher";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

function collectionPath(entityType: string): string {
  switch (entityType) {
    case "blog":
      return "blog";
    case "product_content":
      return "products";
    case "guide":
      return "guides";
    case "case_study":
      return "caseStudies";
    default:
      return entityType;
  }
}

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
  const { request, env } = context;
  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  // ---- GET: Poll build status ----------------------------------------------
  if (request.method === "GET") {
    const permErr = requirePermission(user, "content", "view");
    if (permErr) return permErr;

    const url = new URL(request.url);
    const publishId = url.searchParams.get("id");
    if (!publishId) return fail("VALIDATION_ERROR", "id required", 422);

    const status = await pollBuildStatus(env, publishId);

    const record = await env.DB.prepare(`SELECT * FROM content_publishments WHERE id = ?`)
      .bind(publishId)
      .first();
    return new Response(
      JSON.stringify({
        success: true,
        data: { id: publishId, status, record },
        error: null,
        meta: null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // ---- POST: Publish content -----------------------------------------------
  if (request.method === "POST") {
    const permErr = requirePermission(user, "content", "publish");
    if (permErr) return permErr;

    const parsedBody = await parseJsonBody<{
      entity_type?: string;
      entity_key?: string;
      locale?: string;
      frontmatter?: Record<string, unknown>;
      body?: string;
    }>(request);
    if (!parsedBody.ok) {
      return fail(
        "INVALID_JSON",
        parsedBody.code === "EMPTY_BODY" ? "Request body is empty" : "Invalid JSON body",
        400,
      );
    }
    const body = parsedBody.body;

    const { entity_type, entity_key, locale = "en", frontmatter, body: contentBody } = body;
    if (!entity_type || !entity_key)
      return fail("VALIDATION_ERROR", "entity_type and entity_key required", 422);
    if (
      !["blog", "product_content", "guide", "case_study", "category_faqs"].includes(entity_type)
    ) {
      return fail("VALIDATION_ERROR", "Invalid entity_type", 422);
    }

    // Get content to publish
    let fm = frontmatter ?? {};
    let mdBody = contentBody ?? "";

    // If no content provided, try to read from draft or GitHub
    if (!frontmatter && !contentBody) {
      const collection = collectionPath(entity_type);
      let raw = "";

      // Try draft first
      const draft = await getDraft(env, collection, entity_key, locale);
      if (draft) {
        raw = draft;
      } else {
        // Read from GitHub — S05：区分「文件不存在(missing)」与「GitHub 读取失败(error)」。
        let filePath: string;
        if (entity_type === "category_faqs") {
          filePath = "src/data/category-faqs.json";
        } else {
          filePath = `src/content/${collection}/${entity_key}.${locale}.md`;
        }
        const got = await ghGetChecked(filePath, env);
        if (got.state === "error") {
          // 读取失败绝不能当成「无内容」→ 否则用户会拿空白覆盖线上文件。
          return fail(
            "UPSTREAM_READ_ERROR",
            `Failed to read content from GitHub: ${got.error ?? "unknown"}`,
            502,
          );
        }
        if (got.state === "found" && got.item?.content) raw = b64decode(got.item.content);
      }

      if (!raw) return fail("NOT_FOUND", "No content found to publish", 404);

      const parsed = parseFrontmatter(raw);
      fm = parsed.fm;
      mdBody = parsed.body;
    }

    // ---- S04 数据完整性闸门（发布前最后一道）--------------------------------
    // 绝不允许空 body / 空 frontmatter 覆盖线上 .md 成空壳。
    if (!mdBody || !mdBody.trim()) {
      return fail(
        "VALIDATION_ERROR",
        "Refusing to publish empty body (would overwrite live file with an empty shell)",
        422,
      );
    }
    // markdown 内容类型必须有标题；category_faqs 是 JSON 数据文件，跳过标题校验。
    if (entity_type !== "category_faqs") {
      const title = String(fm.title ?? "").trim();
      if (!title) {
        return fail("VALIDATION_ERROR", "Refusing to publish: frontmatter.title is required", 422);
      }
    }

    // Ensure key and locale in frontmatter
    fm.key = entity_key;
    fm.locale = locale;

    const result = await publishContent(env, {
      entity_type: entity_type as EntityEntityType,
      entity_key,
      locale,
      frontmatter: fm,
      body: mdBody,
      username: user.username,
    });

    if (!result.success) {
      const status = result.error?.includes("正在发布") ? 409 : 502;
      return fail(
        result.error?.includes("正在发布") ? "CONFLICT" : "PUBLISH_FAILED",
        result.error ?? "Publish failed",
        status,
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          publish_id: result.publish_id,
          status: result.status,
          github_commit_sha: result.github_commit_sha,
          ...(result.warning ? { warning: result.warning } : {}),
        },
        error: null,
        meta: null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  return fail("METHOD_NOT_ALLOWED", "Use GET or POST", 405);
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const ALL = endpoint(handlerAll);
