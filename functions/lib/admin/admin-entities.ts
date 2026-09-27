// Phase 2 admin_entities sync — syncAdminEntity()
// INV-1: admin_entities is Search Index, NOT Domain Model. 5 fields only.
// Called by V2 API handlers after write operations.
// Never throws — sync failure must not block business operations.

import type { AdminEnv } from "../../api/admin/shared";

export interface EntityRef {
  entity_type: string; // 'blog' | 'product_content' | 'commerce_product' | 'customer' | 'inquiry' | 'oem_project' | 'video' | 'copy_asset'
  entity_id: string; // primary key in the source table
  title?: string; // searchable title
  status?: string; // sync'd from source table status
}

/** Insert or update an entity in the admin_entities search index. Idempotent (INSERT OR REPLACE). */
export async function syncAdminEntity(env: AdminEnv, ref: EntityRef): Promise<void> {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO admin_entities (entity_type, entity_id, title, status, updated_at)
       VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)`,
    )
      .bind(ref.entity_type, ref.entity_id, ref.title ?? "", ref.status ?? "")
      .run();
  } catch (_) {
    console.error("admin-entities: syncAdminEntity failed", _);
  }
}

/** Remove an entity from the search index (called on permanent delete). */
export async function removeAdminEntity(
  env: AdminEnv,
  entity_type: string,
  entity_id: string,
): Promise<void> {
  if (!env.DB) return;
  try {
    await env.DB.prepare("DELETE FROM admin_entities WHERE entity_type = ? AND entity_id = ?")
      .bind(entity_type, entity_id)
      .run();
  } catch (_) {
    console.error("admin-entities: removeAdminEntity failed", _);
  }
}
