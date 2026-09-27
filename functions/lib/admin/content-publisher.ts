// Phase 4 — Content Publisher (Five-State Publish Machine)
// States: committing → building → deployed / build_failed
// Publishes content to GitHub, tracks in content_publishments, polls build status.
// Idempotency: KV lock + content_hash dedup + GitHub SHA optimistic lock.

import type { AdminEnv } from "../../api/admin/shared";
import { ghGetChecked, ghPut, b64encode, b64decode, repo } from "../../api/admin/shared";
import { runChecked } from "../safe";
import { logAction } from "./audit";
import { createVersion, nextVersion } from "./versioning";
import { syncAdminEntity } from "./admin-entities";

// ---- Types ----------------------------------------------------------------

export type PublishStatus = "committing" | "building" | "deployed" | "build_failed";
export type EntityEntityType =
  "blog" | "product_content" | "guide" | "case_study" | "category_faqs";

export interface PublishRecord {
  id: string;
  entity_type: EntityEntityType;
  entity_key: string;
  locale: string;
  status: PublishStatus;
  content_hash: string;
  github_commit_sha: string | null;
  build_signal: string | null;
  attempt_count: number;
  retry_of: string | null;
  error_message: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PublishInput {
  entity_type: EntityEntityType;
  entity_key: string;
  locale: string;
  frontmatter: Record<string, unknown>;
  body: string;
  username: string;
  retry_of?: string;
}

export interface PublishResult {
  success: boolean;
  publish_id?: string;
  status?: PublishStatus;
  github_commit_sha?: string;
  error?: string;
  /** V5.67：非致命但需让用户/调用方看见的降级信息（如 sha 未解析、去重不可用）。 */
  warning?: string;
}

// ---- Helpers --------------------------------------------------------------

async function sha256Hex(message: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function collectionToPath(entity_type: EntityEntityType): string {
  switch (entity_type) {
    case "blog":
      return "blog";
    case "product_content":
      return "products";
    case "guide":
      return "guides";
    case "case_study":
      return "caseStudies";
    case "category_faqs":
      return "data";
  }
}

function entityToAdminEntityType(entity_type: EntityEntityType): string {
  switch (entity_type) {
    case "blog":
      return "blog";
    case "product_content":
      return "product_content";
    case "guide":
      return "guide";
    case "case_study":
      return "case_study";
    case "category_faqs":
      return "faq";
  }
}

// ---- YAML builder ---------------------------------------------------------

function yamlVal(v: unknown): string {
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return "[" + v.map(yamlVal).join(", ") + "]";
  if (v && typeof v === "object") {
    const raw = (v as Record<string, unknown>).__rawYaml;
    if (typeof raw === "string") return raw;
    const parts = Object.entries(v as Record<string, unknown>).map(
      ([k, val]) => `${k}: ${yamlVal(val)}`,
    );
    return "{ " + parts.join(", ") + " }";
  }
  const s = String(v ?? "");
  if (s === "" || /[:#[\]{}"',&*?|<>=!%@`\n]/.test(s) || /^\s|\s$/.test(s))
    return JSON.stringify(s);
  return s;
}

export function buildFrontmatter(
  merged: Record<string, unknown>,
  key: string,
  locale: string,
): string {
  const lines = ["---", `key: ${key}`, `locale: ${locale}`];
  for (const [k, v] of Object.entries(merged)) {
    if (k === "key" || k === "locale") continue;
    if (v === "" || v === null || v === undefined) continue;
    lines.push(`${k}: ${yamlVal(v)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

// ---- KV Lock (publish lock per entity+locale) -----------------------------

function publishLockKey(entity_type: string, entity_key: string, locale: string): string {
  return `pub:lock:${entity_type}:${entity_key}:${locale}`;
}

async function acquirePublishLock(
  env: AdminEnv,
  entity_type: string,
  entity_key: string,
  locale: string,
): Promise<boolean> {
  if (!env.DRAFTS) return true; // fail-open
  const key = publishLockKey(entity_type, entity_key, locale);
  const existing = await env.DRAFTS.get(key);
  if (existing) return false;
  await env.DRAFTS.put(key, "1", { expirationTtl: 900 });
  return true;
}

async function releasePublishLock(
  env: AdminEnv,
  entity_type: string,
  entity_key: string,
  locale: string,
): Promise<void> {
  if (!env.DRAFTS) return;
  await env.DRAFTS.delete(publishLockKey(entity_type, entity_key, locale));
}

// ---- Idempotency check (content_hash dedup) -------------------------------

async function checkIdempotency(
  env: AdminEnv,
  entity_type: string,
  entity_key: string,
  locale: string,
  content_hash: string,
): Promise<{ found: boolean; record: PublishRecord | null; error?: string }> {
  if (!env.DB) return { found: false, record: null, error: "DB unbound — dedup unavailable" };
  try {
    const row = await env.DB.prepare(
      `SELECT * FROM content_publishments
       WHERE entity_type = ? AND entity_key = ? AND locale = ? AND content_hash = ?
         AND status IN ('committing', 'building', 'deployed')
         AND created_at > datetime('now', '-15 minutes')
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(entity_type, entity_key, locale, content_hash)
      .first<PublishRecord>();
    return { found: row != null, record: row ?? null };
  } catch (e) {
    // S24：去重查询失败 ≠ 「无近期发布」。返回 error 让调用方记 warning（可见），
    // 而不是把故障当成「可以安全重复发布」。
    return {
      found: false,
      record: null,
      error: `dedup query failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ---- Core: Publish --------------------------------------------------------

export async function publishContent(env: AdminEnv, input: PublishInput): Promise<PublishResult> {
  const { entity_type, entity_key, locale, frontmatter, body, username, retry_of } = input;

  // S16：发布记录必须落库；DB 未绑定时绝不用可选链静默跳过后仍报 success。
  if (!env.DB) {
    return { success: false, error: "Database unavailable — cannot track publish" };
  }
  // 防御性数据完整性闸门（覆盖 rollback 及任何其它调用方）：空 body 一律拒绝。
  if (!body || !body.trim()) {
    return { success: false, error: "Refusing to publish empty body" };
  }

  // Build the full file content
  const fullContent = `${buildFrontmatter(frontmatter, entity_key, locale)}\n\n${body}\n`;
  const content_hash = await sha256Hex(fullContent);

  // Idempotency: same content published recently → return existing
  const dedup = await checkIdempotency(env, entity_type, entity_key, locale, content_hash);
  if (dedup.found && dedup.record) {
    const existing = dedup.record;
    return {
      success: true,
      publish_id: existing.id,
      status: existing.status,
      github_commit_sha: existing.github_commit_sha ?? undefined,
    };
  }
  // 去重不可用（DB 抖动）：继续发布但把降级信息带回，避免故障被吞成「安全重复发布」。
  const dedupWarning = dedup.error ? `idempotency check unavailable (${dedup.error})` : undefined;
  if (dedupWarning) console.error("[publisher]", dedupWarning);

  // Acquire publish lock
  const locked = await acquirePublishLock(env, entity_type, entity_key, locale);
  if (!locked) {
    return { success: false, error: "该语言版本正在发布中，请稍后重试" };
  }

  const publish_id = crypto.randomUUID();

  try {
    // Create publish record (committing state) — 记录写失败则中止，绝不在无追踪下提交 GitHub。
    const insRec = await runChecked(
      env.DB.prepare(
        `INSERT INTO content_publishments (id, entity_type, entity_key, locale, status, content_hash, created_by, retry_of)
         VALUES (?, ?, ?, ?, 'committing', ?, ?, ?)`,
      ).bind(publish_id, entity_type, entity_key, locale, content_hash, username, retry_of ?? null),
    );
    if (!insRec.ok) {
      await releasePublishLock(env, entity_type, entity_key, locale);
      return {
        success: false,
        publish_id,
        error: `Failed to create publish record: ${insRec.error}`,
      };
    }

    // Get existing file SHA for optimistic lock
    let filePath: string;
    if (entity_type === "category_faqs") {
      filePath = "src/data/category-faqs.json";
    } else {
      filePath = `src/content/${collectionToPath(entity_type)}/${entity_key}.${locale}.md`;
    }
    const existingFile = await ghGetChecked(filePath, env);
    // missing → 新建（无 baseSha）；found → 用其 sha 乐观锁；error → 记 warning 后无锁提交（发布意图明确）。
    const baseSha = existingFile.state === "found" ? existingFile.item?.sha : undefined;
    if (existingFile.state === "error") {
      console.error(
        "[publisher] base sha read failed, committing without optimistic lock:",
        existingFile.error,
      );
    }

    // Commit to GitHub
    const commitMessage = retry_of
      ? `content(${entity_type}): retry ${entity_key} (${locale})`
      : `content(${entity_type}): ${entity_key} (${locale})`;

    const ok = await ghPut(filePath, b64encode(fullContent), commitMessage, env, baseSha);

    if (!ok) {
      // Commit failed → back to draft
      await runChecked(
        env.DB.prepare(
          `UPDATE content_publishments SET status = 'committing', error_message = 'GitHub commit failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ).bind(publish_id),
      );
      await releasePublishLock(env, entity_type, entity_key, locale);
      return { success: false, publish_id, error: "GitHub commit failed" };
    }

    // Get the commit SHA from GitHub — S15：解析失败不再静默当成功，标 warning（rollback 依赖它）。
    const updatedFile = await ghGetChecked(filePath, env);
    const commitSha = updatedFile.state === "found" ? (updatedFile.item?.sha ?? null) : null;
    let shaWarning: string | undefined;
    if (!commitSha) {
      shaWarning =
        updatedFile.state === "error"
          ? `commit sha unresolved (GitHub read error: ${updatedFile.error ?? "unknown"}); rollback for this version will be unavailable until resolved`
          : "commit sha unresolved (file not found after put); rollback for this version will be unavailable";
      console.error("[publisher]", shaWarning);
    }

    // Update to building state
    await runChecked(
      env.DB.prepare(
        `UPDATE content_publishments SET status = 'building', github_commit_sha = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      ).bind(commitSha, publish_id),
    );

    // Create version record
    const version = await nextVersion(
      env,
      entityToAdminEntityType(entity_type),
      entity_key,
      locale,
    );
    await createVersion(env, {
      entity_type: entityToAdminEntityType(entity_type),
      entity_key,
      locale,
      version,
      author: `human:${username}`,
      source: retry_of ? "rollback" : "publish",
      github_commit_sha: commitSha ?? undefined,
      rollback_to_version_id: retry_of ?? undefined,
    });

    // Sync admin_entities
    await syncAdminEntity(env, {
      entity_type: entityToAdminEntityType(entity_type),
      entity_id: entity_key,
      title: String(frontmatter.title ?? entity_key),
      status: "building",
    });

    // Audit
    await logAction(env, {
      actor_type: "human",
      username,
      action: "publish",
      resource_type: entity_type,
      resource_id: entity_key,
      resource_title: String(frontmatter.title ?? entity_key),
      change_summary: `Published ${entity_type}/${entity_key}/${locale} (SHA: ${commitSha?.slice(0, 8) ?? "unknown"})`,
    });

    // Delete KV draft
    const { deleteDraft } = await import("../../api/admin/shared");
    const collection = collectionToPath(entity_type);
    if (collection !== "data") {
      await deleteDraft(env, collection, entity_key, locale);
    }

    const warnings = [dedupWarning, shaWarning].filter(Boolean);
    return {
      success: true,
      publish_id,
      status: "building",
      github_commit_sha: commitSha ?? undefined,
      ...(warnings.length ? { warning: warnings.join("; ") } : {}),
    };
  } catch (err) {
    // Any error → mark as failed, release lock
    await runChecked(
      env.DB.prepare(
        `UPDATE content_publishments SET status = 'committing', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      ).bind(String(err), publish_id),
    );
    await releasePublishLock(env, entity_type, entity_key, locale);
    return { success: false, publish_id, error: String(err) };
  }
}

// ---- Build Status Polling (GitHub commit status) --------------------------

export async function pollBuildStatus(
  env: AdminEnv,
  publish_id: string,
): Promise<PublishStatus | null> {
  if (!env.DB) return null;

  const row = await env.DB.prepare(`SELECT * FROM content_publishments WHERE id = ?`)
    .bind(publish_id)
    .first<PublishRecord>();

  if (!row || row.status !== "building" || !row.github_commit_sha) return row?.status ?? null;

  // Check timeout (10 minutes)
  const updatedAt = new Date(row.updated_at).getTime();
  if (Date.now() - updatedAt > 10 * 60 * 1000) {
    await env.DB.prepare(
      `UPDATE content_publishments SET status = 'build_failed', build_signal = 'timeout', error_message = 'build_timeout', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
      .bind(publish_id)
      .run();
    await releasePublishLock(env, row.entity_type, row.entity_key, row.locale);
    return "build_failed";
  }

  // Poll GitHub commit status
  const token = env.ADMIN_GITHUB_TOKEN;
  if (!token) return row.status;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo(env)}/commits/${row.github_commit_sha}/status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "Aromiso-CMS",
        },
      },
    );

    if (!res.ok) return row.status;

    const data = (await res.json()) as {
      state?: string;
      statuses?: Array<{ context: string; state: string }>;
    };
    const cfStatus = data.statuses?.find((s) => s.context === "Cloudflare Pages");

    if (cfStatus?.state === "success" || data.state === "success") {
      await env.DB.prepare(
        `UPDATE content_publishments SET status = 'deployed', build_signal = 'success', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
        .bind(publish_id)
        .run();
      await releasePublishLock(env, row.entity_type, row.entity_key, row.locale);
      // Update admin_entities
      await syncAdminEntity(env, {
        entity_type: entityToAdminEntityType(row.entity_type as EntityEntityType),
        entity_id: row.entity_key,
        status: "deployed",
      });
      return "deployed";
    }

    if (cfStatus?.state === "failure" || cfStatus?.state === "error" || data.state === "failure") {
      await env.DB.prepare(
        `UPDATE content_publishments SET status = 'build_failed', build_signal = 'failure', error_message = 'Cloudflare Pages build failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
        .bind(publish_id)
        .run();
      await releasePublishLock(env, row.entity_type, row.entity_key, row.locale);
      return "build_failed";
    }

    return row.status; // still building
  } catch {
    return row.status;
  }
}

// ---- Get latest publish status for an entity+locale -----------------------

export async function getLatestPublishStatus(
  env: AdminEnv,
  entity_type: EntityEntityType,
  entity_key: string,
  locale: string,
): Promise<PublishRecord | null> {
  if (!env.DB) return null;
  try {
    return (
      (await env.DB.prepare(
        `SELECT * FROM content_publishments
       WHERE entity_type = ? AND entity_key = ? AND locale = ?
       ORDER BY created_at DESC LIMIT 1`,
      )
        .bind(entity_type, entity_key, locale)
        .first<PublishRecord>()) ?? null
    );
  } catch {
    return null;
  }
}

// ---- Get all publish records for an entity --------------------------------

export async function getPublishHistory(
  env: AdminEnv,
  entity_type: EntityEntityType,
  entity_key: string,
  locale?: string,
): Promise<PublishRecord[]> {
  if (!env.DB) return [];
  try {
    let query = `SELECT * FROM content_publishments WHERE entity_type = ? AND entity_key = ?`;
    const params: string[] = [entity_type, entity_key];
    if (locale) {
      query += ` AND locale = ?`;
      params.push(locale);
    }
    query += ` ORDER BY created_at DESC LIMIT 50`;
    const result = await env.DB.prepare(query)
      .bind(...params)
      .all<PublishRecord>();
    return result.results ?? [];
  } catch {
    return [];
  }
}

// ---- Rollback -------------------------------------------------------------

export async function rollbackContent(
  env: AdminEnv,
  entity_type: EntityEntityType,
  entity_key: string,
  locale: string,
  target_version_id: string,
  username: string,
): Promise<PublishResult> {
  if (!env.DB) return { success: false, error: "Database unavailable" };

  // Get the target version
  const version = await env.DB.prepare(`SELECT * FROM content_versions WHERE id = ?`)
    .bind(target_version_id)
    .first<{
      github_commit_sha: string | null;
      entity_type: string;
      entity_key: string;
      locale: string;
    }>();

  if (!version?.github_commit_sha) {
    return { success: false, error: "Target version has no GitHub SHA" };
  }

  // Read the file content at that commit
  const token = env.ADMIN_GITHUB_TOKEN;
  if (!token) return { success: false, error: "GitHub token unavailable" };

  let filePath: string;
  if (entity_type === "category_faqs") {
    filePath = "src/data/category-faqs.json";
  } else {
    filePath = `src/content/${collectionToPath(entity_type)}/${entity_key}.${locale}.md`;
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo(env)}/contents/${filePath}?ref=${version.github_commit_sha}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "Aromiso-CMS",
        },
      },
    );
    if (!res.ok) return { success: false, error: "Failed to fetch historical file from GitHub" };

    const fileData = (await res.json()) as { content: string; encoding: string };
    const content = fileData.encoding === "base64" ? b64decode(fileData.content) : fileData.content;

    // Parse frontmatter and body
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!fmMatch) return { success: false, error: "Failed to parse historical file frontmatter" };

    // Re-publish with the old content
    // We can't directly parse YAML back, so we'll use the raw content
    const fullContent = content;
    const content_hash = await sha256Hex(fullContent);

    // Acquire lock
    const locked = await acquirePublishLock(env, entity_type, entity_key, locale);
    if (!locked) return { success: false, error: "该语言版本正在发布中" };

    const publish_id = crypto.randomUUID();

    // Create publish record
    await env.DB.prepare(
      `INSERT INTO content_publishments (id, entity_type, entity_key, locale, status, content_hash, created_by, retry_of)
       VALUES (?, ?, ?, ?, 'committing', ?, ?, ?)`,
    )
      .bind(publish_id, entity_type, entity_key, locale, content_hash, username, target_version_id)
      .run();

    // Get current SHA — S23：区分 missing/error；error 时记日志后无锁提交（回滚意图明确）。
    const currentFile = await ghGetChecked(filePath, env);
    if (currentFile.state === "error") {
      console.error(
        "[publisher:rollback] base sha read failed, committing without optimistic lock:",
        currentFile.error,
      );
    }
    const baseSha = currentFile.state === "found" ? currentFile.item?.sha : undefined;

    // Commit
    const ok = await ghPut(
      filePath,
      b64encode(fullContent),
      `content(${entity_type}): rollback ${entity_key} (${locale})`,
      env,
      baseSha,
    );
    if (!ok) {
      await env.DB.prepare(
        `UPDATE content_publishments SET status = 'committing', error_message = 'GitHub commit failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
        .bind(publish_id)
        .run();
      await releasePublishLock(env, entity_type, entity_key, locale);
      return { success: false, publish_id, error: "GitHub commit failed" };
    }

    // Get new SHA — S15：解析失败标 warning（后续回滚依赖它），不静默当成功。
    const updatedFile = await ghGetChecked(filePath, env);
    const commitSha = updatedFile.state === "found" ? (updatedFile.item?.sha ?? null) : null;
    const rollbackShaWarning = commitSha
      ? undefined
      : `commit sha unresolved after rollback (${updatedFile.state}${updatedFile.error ? `: ${updatedFile.error}` : ""}); future rollback for this version will be unavailable`;
    if (rollbackShaWarning) console.error("[publisher:rollback]", rollbackShaWarning);

    // Update to building
    await env.DB.prepare(
      `UPDATE content_publishments SET status = 'building', github_commit_sha = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
      .bind(commitSha, publish_id)
      .run();

    // Create version record
    const ver = await nextVersion(env, entityToAdminEntityType(entity_type), entity_key, locale);
    await createVersion(env, {
      entity_type: entityToAdminEntityType(entity_type),
      entity_key,
      locale,
      version: ver,
      author: `human:${username}`,
      source: "rollback",
      github_commit_sha: commitSha ?? undefined,
      rollback_to_version_id: target_version_id,
    });

    // Audit
    await logAction(env, {
      actor_type: "human",
      username,
      action: "rollback",
      resource_type: entity_type,
      resource_id: entity_key,
      change_summary: `Rolled back ${entity_type}/${entity_key}/${locale} to version ${target_version_id}`,
    });

    return {
      success: true,
      publish_id,
      status: "building",
      github_commit_sha: commitSha ?? undefined,
      ...(rollbackShaWarning ? { warning: rollbackShaWarning } : {}),
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ---- Lazy build status check (called on content list load) ----------------

export async function lazyCheckBuildingRecords(env: AdminEnv): Promise<void> {
  if (!env.DB) return;
  try {
    // Find all building records updated > 60s ago
    const rows = await env.DB.prepare(
      `SELECT id FROM content_publishments WHERE status = 'building' AND updated_at < datetime('now', '-60 seconds') LIMIT 10`,
    ).all<{ id: string }>();

    for (const row of rows.results ?? []) {
      await pollBuildStatus(env, row.id);
    }
  } catch {
    /* non-critical */
  }
}
