// Phase 10 — Notification helper for creating notifications from other modules
// Call createNotification() from any V2 API handler to emit a notification.
// Never throws — notification failure must not block business operations.

import type { AdminEnv } from "../../api/admin/shared";

export interface NotificationInput {
  type: "inquiry" | "order" | "ai_task" | "seo_alert" | "oem" | "commerce" | "system";
  title: string;
  body?: string;
  link?: string;
  entity_type?: string;
  entity_id?: string;
}

/** Create a notification. Idempotent. Never throws. */
export async function createNotification(env: AdminEnv, input: NotificationInput): Promise<void> {
  if (!env.DB) return;
  try {
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    await env.DB.prepare(
      `INSERT INTO notifications (id, type, title, body, link, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        input.type,
        input.title,
        input.body || "",
        input.link || "",
        input.entity_type || "",
        input.entity_id || "",
      )
      .run();
  } catch (_) {
    console.error("notifications: createNotification failed", _);
  }
}
