// ---------------------------------------------------------------------------
//  Aromiso Admin — Localized Product Image Upload (AI Production Studio V1)
//  POST /api/admin/upload-image  → store a localized product image in R2,
//  return its public URL. Template copied from upload-video.ts (§15：抄模板，
//  不改原文件)；变更点：ALLOWED_EXT 加图片格式、key 路径 = localized/。
//
//  宪法约束（Studio 文档 §3.3）：新图永远写新 R2 key，绝不覆盖旧对象；
//  回滚 = 把 commerce_products.cover_image 改回 original_cover_image。
//
//  Body: { name?: string, mime?: string, contentB64: string, folder?: 'localized'|'review' }
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { isAuthed, json } from "./shared";

const R2_PUBLIC_BASE = "https://images.aromiso.com";
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB decoded（现成 base64 通道，F3）
const ALLOWED_EXT = /\.(jpe?g|png|webp|json)$/i;
const FOLDERS = new Set(["localized", "review"]);

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".json": "application/json",
};

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Machine credential (Studio automation) OR human admin session. Scoped to this
  // image-safe endpoint so machine image processing never depends on browser cookie TTL.
  const machineToken = (request.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const machineAuthed = Boolean(
    env.CRON_SECRET && machineToken && machineToken === env.CRON_SECRET,
  );
  if (!(await isAuthed(request, env)) && !machineAuthed)
    return json({ error: "Unauthorized" }, 401);
  if (!env.IMAGES) return json({ error: "R2 unavailable" }, 500);

  let body: { name?: string; mime?: string; contentB64?: string; folder?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const { name, mime, contentB64 } = body;
  const folder = FOLDERS.has(body.folder || "") ? (body.folder as string) : "localized";
  if (!contentB64 || typeof contentB64 !== "string")
    return json({ error: "Missing contentB64" }, 400);

  const clean = (name || "image.jpg")
    .toLowerCase()
    .replace(/[, ]+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!ALLOWED_EXT.test(clean)) return json({ error: "File type not allowed" }, 400);

  let bytes: Uint8Array;
  try {
    bytes = b64ToBytes(contentB64);
  } catch {
    return json({ error: "Invalid base64" }, 400);
  }
  if (bytes.length === 0) return json({ error: "Empty file" }, 400);
  if (bytes.length > MAX_BYTES) return json({ error: "File too large (max 50MB)" }, 413);

  const ext = clean.slice(clean.lastIndexOf("."));
  const key = `commerce/products/${folder}/${Date.now()}-${clean || `image${ext}`}`;
  await env.IMAGES.put(key, bytes, {
    httpMetadata: { contentType: mime || MIME_BY_EXT[ext] || "image/jpeg" },
  });

  return json({ ok: true, url: `${R2_PUBLIC_BASE}/${key}`, key });
};
