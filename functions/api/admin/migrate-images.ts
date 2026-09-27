/**
 * Image Migration: alicdn → R2
 *
 * POST /api/admin/migrate-images  { batch?: number }
 *
 * Reads products/variants with alicdn image URLs, downloads them,
 * uploads to R2, and updates D1 records to point to R2 URLs.
 *
 * Processes in batches of `batch` (default 10) per call.
 * Returns { ok, processed, skipped, errors, done }.
 */

import type { Env } from "../../types";
import { isAuthed } from "./shared";

const R2_BASE = "https://images.aromiso.com";
const ALICDN_RE = /alicdn\.com|cbu01\.alicdn|img\.alicdn/i;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function getExt(url: string): string {
  const m = url.match(/\.(jpe?g|png|webp|gif|bmp)(\?|$)/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
  };
  return map[ext] || "image/jpeg";
}

async function downloadImage(url: string): Promise<{ data: Uint8Array; mime: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://detail.1688.com/",
      },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    // V5.13: 空 body / 极小 body 防护——阿里防盗链对 CF 边缘 IP 会返回 200 + 0 字节，
    // 此前只校验 res.ok 导致空图被写进 R2。这里直接判失败，让调用方记录 error 而非存烂图。
    if (!buf || buf.byteLength === 0) throw new Error("empty body");
    if (buf.byteLength < 100) throw new Error("suspiciously small body");
    const ext = getExt(url);
    return { data: new Uint8Array(buf), mime: mimeFromExt(ext) };
  } catch {
    return null;
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);
  const db = env.DB;
  if (!db || !env.IMAGES) return json({ error: "DB or R2 unavailable" }, 500);

  let body: { batch?: number } = {};
  try {
    body = await request.json();
  } catch {
    /* use defaults */
  }
  const batchSize = Math.min(body.batch || 10, 30);

  const processed: string[] = [];
  const skipped: string[] = [];
  const errors: { id: string; url: string; error: string }[] = [];

  // ---- Step 1: Products with alicdn cover_image ----
  const prodRows = await db
    .prepare(
      `SELECT id, slug, cover_image FROM commerce_products
       WHERE cover_image LIKE '%alicdn%' LIMIT ?`,
    )
    .bind(batchSize)
    .all<{ id: string; slug: string; cover_image: string }>();

  for (const row of prodRows.results) {
    if (!ALICDN_RE.test(row.cover_image)) {
      skipped.push(row.id);
      continue;
    }
    const ext = getExt(row.cover_image);
    const r2Key = `commerce/products/${row.slug}/main/cover.${ext}`;
    const r2Url = `${R2_BASE}/${r2Key}`;

    const img = await downloadImage(row.cover_image);
    if (!img) {
      errors.push({ id: row.id, url: row.cover_image, error: "Download failed" });
      continue;
    }

    try {
      await env.IMAGES.put(r2Key, img.data, { httpMetadata: { contentType: img.mime } });
      await db
        .prepare(`UPDATE commerce_products SET cover_image = ? WHERE id = ?`)
        .bind(r2Url, row.id)
        .run();
      processed.push(row.id);
    } catch (e) {
      errors.push({ id: row.id, url: row.cover_image, error: String(e) });
    }
  }

  // ---- Step 2: Products with alicdn gallery JSON array ----
  const galleryRows = await db
    .prepare(
      `SELECT id, slug, gallery FROM commerce_products
       WHERE gallery LIKE '%alicdn%' LIMIT ?`,
    )
    .bind(batchSize)
    .all<{ id: string; slug: string; gallery: string }>();

  for (const row of galleryRows.results) {
    let urls: string[];
    try {
      urls = JSON.parse(row.gallery || "[]");
    } catch {
      skipped.push(row.id);
      continue;
    }
    let changed = false;
    for (let i = 0; i < urls.length; i++) {
      if (!ALICDN_RE.test(urls[i])) continue;
      const ext = getExt(urls[i]);
      const r2Key = `commerce/products/${row.slug}/main/gallery_${String(i + 1).padStart(2, "0")}.${ext}`;
      const r2Url = `${R2_BASE}/${r2Key}`;

      const img = await downloadImage(urls[i]);
      if (!img) {
        errors.push({ id: row.id, url: urls[i], error: "Download failed" });
        continue;
      }
      try {
        await env.IMAGES.put(r2Key, img.data, { httpMetadata: { contentType: img.mime } });
        urls[i] = r2Url;
        changed = true;
        processed.push(`${row.id}:gallery[${i}]`);
      } catch (e) {
        errors.push({ id: row.id, url: urls[i], error: String(e) });
      }
    }
    if (changed) {
      await db
        .prepare(`UPDATE commerce_products SET gallery = ? WHERE id = ?`)
        .bind(JSON.stringify(urls), row.id)
        .run();
    }
  }

  // ---- Step 3: Variants with alicdn image ----
  const varRows = await db
    .prepare(
      `SELECT v.id, v.product_id, v.image, p.slug
       FROM commerce_product_variants v
       JOIN commerce_products p ON p.id = v.product_id
       WHERE v.image LIKE '%alicdn%' LIMIT ?`,
    )
    .bind(batchSize)
    .all<{ id: string; product_id: string; image: string; slug: string }>();

  for (const row of varRows.results) {
    if (!ALICDN_RE.test(row.image)) {
      skipped.push(row.id);
      continue;
    }
    const ext = getExt(row.image);
    const r2Key = `commerce/products/${row.slug}/sku/${row.id}.${ext}`;
    const r2Url = `${R2_BASE}/${r2Key}`;

    const img = await downloadImage(row.image);
    if (!img) {
      errors.push({ id: row.id, url: row.image, error: "Download failed" });
      continue;
    }
    try {
      await env.IMAGES.put(r2Key, img.data, { httpMetadata: { contentType: img.mime } });
      await db
        .prepare(`UPDATE commerce_product_variants SET image = ? WHERE id = ?`)
        .bind(r2Url, row.id)
        .run();
      processed.push(row.id);
    } catch (e) {
      errors.push({ id: row.id, url: row.image, error: String(e) });
    }
  }

  // ---- Check if more work remains ----
  const remaining = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM commerce_products WHERE cover_image LIKE '%alicdn%')
        + (SELECT COUNT(*) FROM commerce_products WHERE gallery LIKE '%alicdn%')
        + (SELECT COUNT(*) FROM commerce_product_variants v WHERE v.image LIKE '%alicdn%') AS cnt`,
    )
    .first<{ cnt: number }>();

  return json({
    ok: true,
    processed: processed.length,
    skipped: skipped.length,
    errors: errors.length,
    errorDetails: errors.slice(0, 10),
    remaining: remaining?.cnt ?? 0,
    done: (remaining?.cnt ?? 0) === 0,
  });
};

// GET: show count of remaining alicdn URLs
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);
  const db = env.DB;
  if (!db) return json({ error: "DB unavailable" }, 500);

  const coverCount = await db
    .prepare(`SELECT COUNT(*) AS c FROM commerce_products WHERE cover_image LIKE '%alicdn%'`)
    .first<{ c: number }>();
  const galleryCount = await db
    .prepare(`SELECT COUNT(*) AS c FROM commerce_products WHERE gallery LIKE '%alicdn%'`)
    .first<{ c: number }>();
  const variantCount = await db
    .prepare(`SELECT COUNT(*) AS c FROM commerce_product_variants WHERE image LIKE '%alicdn%'`)
    .first<{ c: number }>();

  return json({
    ok: true,
    alicdnRemaining: {
      coverImages: coverCount?.c ?? 0,
      galleryImages: galleryCount?.c ?? 0,
      variantImages: variantCount?.c ?? 0,
      total: (coverCount?.c ?? 0) + (galleryCount?.c ?? 0) + (variantCount?.c ?? 0),
    },
  });
};
