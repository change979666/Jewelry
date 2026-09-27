// ---------------------------------------------------------------------------
//  Aromiso Admin — Localized Image Publish Commit (AI Production Studio V1)
//  POST /api/admin/commit-localized-image
//
//  Commerce 发布链的乐观锁提交（Studio 文档 §3.3 / §7.1）：
//    - original_cover_image 只写一次（空时快照当前 cover_image，之后不再动）
//    - cover_image 换成新 R2 URL；localization_status 置为 published（严格二态）
//    - WHERE 带 expected URL 乐观锁：manifest 下载后若线上图被人换过，
//      meta.changes = 0 → Studio 停止该商品并进异常队列
//
//  V5.435：expected 不在 cover_image 时回退 gallery 路径——
//    UPDATE … SET gallery = replace(gallery, expected, new_url)
//    WHERE id = ? AND instr(gallery, expected) > 0（精确子串守卫，命中 0 行 → 409）
//    原图对象仍在 R2（localized/ 永远新键），回滚 = 把 gallery 里的 URL 换回。
//
//  Body: { id: string, new_url: string, expected_cover_url: string }
//  Resp: { ok: true, changes: n, field: "cover_image" | "gallery" }
//        changes=0 → 409，线上图已变更或商品不存在，拒绝提交
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { isAuthed, json } from "./shared";

const R2_PUBLIC_BASE = "https://images.aromiso.com/";
const LOCALIZED_PREFIX = "https://images.aromiso.com/commerce/products/localized/";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Machine credential (Studio automation) OR human admin session; image-safe op only.
  const machineToken = (request.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const machineAuthed = Boolean(
    env.CRON_SECRET && machineToken && machineToken === env.CRON_SECRET,
  );
  if (!(await isAuthed(request, env)) && !machineAuthed)
    return json({ error: "Unauthorized" }, 401);
  if (!env.DB) return json({ error: "DB unavailable" }, 500);

  let body: { id?: string; new_url?: string; expected_cover_url?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const id = String(body.id || "").trim();
  const newUrl = String(body.new_url || "").trim();
  const expected = String(body.expected_cover_url || "").trim();
  if (!id || !newUrl || !expected) return json({ error: "Missing fields" }, 400);

  // 只接受本桶 localized/ 前缀下的新图（新 key，永不覆盖旧对象，§3.3 不变量 2）
  if (!newUrl.startsWith(LOCALIZED_PREFIX))
    return json({ error: "new_url must be a localized/ R2 object" }, 400);
  if (!expected.startsWith(R2_PUBLIC_BASE))
    return json({ error: "expected_cover_url must be an images.aromiso.com URL" }, 400);

  const res = await env.DB.prepare(
    `UPDATE commerce_products
     SET original_cover_image = CASE WHEN original_cover_image = '' THEN cover_image ELSE original_cover_image END,
         cover_image = ?1,
         localization_status = 'published'
     WHERE id = ?2 AND cover_image = ?3`,
  )
    .bind(newUrl, id, expected)
    .run();

  const changes = res.meta.changes ?? 0;
  if (changes === 1) return json({ ok: true, changes, field: "cover_image" });

  // V5.435 gallery fallback: expected 不是封面时，尝试在 gallery JSON 里精确替换。
  // replace() 为精确子串替换（URL 无通配符语义），instr 守卫保证没命中 = 0 行。
  const gres = await env.DB.prepare(
    `UPDATE commerce_products
     SET gallery = replace(gallery, ?1, ?2),
         localization_status = 'published'
     WHERE id = ?3 AND instr(gallery, ?1) > 0`,
  )
    .bind(expected, newUrl, id)
    .run();

  const gchanges = gres.meta.changes ?? 0;
  if (gchanges === 0) {
    // 乐观锁未命中：商品不存在，或下载后线上图已被他人更换（§3.3）
    return json(
      { ok: false, changes: 0, error: "image not in cover_image or gallery, or product missing" },
      409,
    );
  }
  return json({ ok: true, changes: gchanges, field: "gallery" });
};
