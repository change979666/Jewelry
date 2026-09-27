// Phase 2 Version Middleware — createVersion()
// Creates a metadata-only version record in content_versions.
// Body is fetched from GitHub API on rollback (ADR-11: no body_snapshot).
// github_commit_sha links to the exact GitHub commit for 1-API-call rollback.

import type { AdminEnv } from "@/pages/api/admin/_shared";

export interface VersionEntry {
  entity_type: string; // 'blog' | 'product_content' | 'guide' | 'case_study' | 'faq' | 'copy_asset'
  entity_key: string; // content key/slug
  locale?: string; // defaults to 'en'
  version: number; // auto-incremented: use MAX(version)+1 for entity
  author: string; // 'human:<username>' | 'ai:<role_name>'
  source: string; // 'manual_edit' | 'ai_generate' | 'ai_translate' | 'publish' | 'rollback'
  change_summary?: string;
  github_commit_sha?: string; // GitHub commit SHA after publish
  rollback_to_version_id?: string; // Points to the version this rollback restores
}

/** Create a version record. Returns the created version id. Never throws — version failure must not block. */
export async function createVersion(env: AdminEnv, entry: VersionEntry): Promise<string | null> {
  if (!env.DB) return null;
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT INTO content_versions (id, entity_type, entity_key, locale, version, author,
        source, change_summary, github_commit_sha, rollback_to_version_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    )
      .bind(
        id,
        entry.entity_type,
        entry.entity_key,
        entry.locale ?? "en",
        entry.version,
        entry.author,
        entry.source,
        entry.change_summary ?? null,
        entry.github_commit_sha ?? null,
        entry.rollback_to_version_id ?? null,
      )
      .run();
    return id;
  } catch (_) {
    console.error("versioning: createVersion failed", _);
    return null;
  }
}

/** Get the next version number for an entity (MAX(version) + 1, defaults to 1). */
export async function nextVersion(
  env: AdminEnv,
  entity_type: string,
  entity_key: string,
  locale: string = "en",
): Promise<number> {
  if (!env.DB) return 1;
  try {
    const row = await env.DB.prepare(
      `SELECT COALESCE(MAX(version), 0) as max_ver
       FROM content_versions
       WHERE entity_type = ? AND entity_key = ? AND locale = ?`,
    )
      .bind(entity_type, entity_key, locale)
      .first<{ max_ver: number }>();
    return (row?.max_ver ?? 0) + 1;
  } catch (_) {
    return 1;
  }
}
