// ---------------------------------------------------------------------------
//  Aromiso Image Numbers — Admin API (V5.433)
//  GET /api/admin/image-nos?no=NNNNNN      → reverse lookup: number → url+product
//  GET /api/admin/image-nos?urls=a,b,c     → ensure/return numbers for URLs (≤200)
//  GET /api/admin/image-nos?search=&limit=50&offset=0
//                                          → flattened cover+gallery image list
//                                            with stable 6-digit numbers
//  Local Studio uses this so the owner can query image numbers without
//  paging the whole catalog client-side.
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { isAuthed, json } from "./shared";
import { ensureImageNos } from "./commerce-products";

const MAX_PRODUCTS_SCAN = 500;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Machine credential (Studio automation) OR human admin session; image-safe op only.
  const machineToken = (request.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const machineAuthed = Boolean(
    env.CRON_SECRET && machineToken && machineToken === env.CRON_SECRET,
  );
  if (!(await isAuthed(request, env)) && !machineAuthed)
    return json({ error: "Unauthorized" }, 401);
  const db = env.DB!;
  const q = new URL(request.url).searchParams;

  // ---- Mode 1: reverse lookup by 6-digit number --------------------------
  const no = (q.get("no") || "").trim();
  if (no) {
    if (!/^\d{6}$/.test(no)) return json({ error: "no must be 6 digits" }, 400);
    const row = await db
      .prepare("SELECT url FROM commerce_image_nos WHERE image_no = ?")
      .bind(Number(no))
      .first<Record<string, unknown>>();
    if (!row) return json({ ok: true, found: false });
    const url = row.url as string;
    const prod = await db
      .prepare(
        `SELECT id, slug, title, cover_image FROM commerce_products
         WHERE cover_image = ? OR instr(gallery, ?) > 0 LIMIT 1`,
      )
      .bind(url, url)
      .first<Record<string, unknown>>();
    return json({
      ok: true,
      found: true,
      image_no: Number(no),
      url,
      product_id: (prod?.id as string) || "",
      slug: (prod?.slug as string) || "",
      product_title: (prod?.title as string) || "",
      is_cover: prod ? prod.cover_image === url : false,
    });
  }

  // ---- Mode 2: ensure/return numbers for a set of URLs -------------------
  const urls = (q.get("urls") || "").trim();
  if (urls) {
    const list = urls
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);
    if (list.length === 0) return json({ error: "urls empty" }, 400);
    const nos = await ensureImageNos(db, list);
    return json({ ok: true, nos });
  }

  // ---- Mode 3: search products, flatten cover+gallery with numbers -------
  // instr() instead of LIKE: user input / URLs may contain %/_ wildcards and
  // long LIKE patterns hit "LIKE or GLOB pattern too complex" (SQLITE_ERROR).
  const search = (q.get("search") || "").trim().toLowerCase();
  const rand = (q.get("rand") || "").trim() === "1";
  const limit = Math.min(Math.max(parseInt(q.get("limit") || "50", 10) || 50, 1), 100);
  const offset = Math.max(parseInt(q.get("offset") || "0", 10) || 0, 0);
  const order = rand ? "ORDER BY RANDOM()" : "ORDER BY id";

  const rows = await db
    .prepare(
      `SELECT id, slug, title, cover_image, gallery FROM commerce_products
       WHERE (instr(lower(title), ?) > 0 OR instr(lower(slug), ?) > 0)
       ${order} LIMIT ${MAX_PRODUCTS_SCAN}`,
    )
    .bind(search, search)
    .all<Record<string, unknown>>();

  const images: {
    url: string;
    product_id: string;
    slug: string;
    title: string;
    is_cover: boolean;
  }[] = [];
  for (const p of rows.results) {
    const cover = (p.cover_image as string) || "";
    if (cover) {
      images.push({
        url: cover,
        product_id: p.id as string,
        slug: (p.slug as string) || "",
        title: (p.title as string) || "",
        is_cover: true,
      });
    }
    let gallery: unknown = [];
    try {
      gallery = JSON.parse((p.gallery as string) || "[]");
    } catch {
      // keep gallery = [] on malformed JSON
    }
    if (Array.isArray(gallery)) {
      for (const u of gallery) {
        if (typeof u === "string" && u && u !== cover) {
          images.push({
            url: u,
            product_id: p.id as string,
            slug: (p.slug as string) || "",
            title: (p.title as string) || "",
            is_cover: false,
          });
        }
      }
    }
  }

  const total = images.length;
  const page = images.slice(offset, offset + limit);
  const nos = await ensureImageNos(
    db,
    page.map((i) => i.url),
  );

  return json({
    ok: true,
    total,
    truncated: rows.results.length >= MAX_PRODUCTS_SCAN,
    offset,
    limit,
    images: page.map((i) => ({ ...i, image_no: nos[i.url] || null })),
  });
};
