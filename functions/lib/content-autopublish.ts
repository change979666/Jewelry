// ---------------------------------------------------------------------------
//  Aromiso Content Auto-Publish pipeline（V5.69 无人值守：Creator→Gates→Reviewer→
//  AutoPublisher→Verifier）。Owner 决策：安全闸门优先于数量；每日**成功自动发布**
//  上限 MAX_AUTO_PUBLISH_PER_DAY=10；Verify 失败不计入成功；全程审计；禁止 silent。
//
//  本模块只做「发布 + 审计 + 额度 + 验证 + 状态」，不重做 Gate：
//    Fact   = lib/truthfulness.checkContentDraft（调用方已跑）
//    Quality= lib/content-quality.scoreDraft（调用方已跑）
//    Safety = 本模块 safetyGateDraft（禁宣称扫描）+ 调用方的 live/预算/额度闸
//    Review = lib/governance-reviewer（第二层 AI 审核 + 代码白名单边界）
//
//  审计（复用 audit_logs，不新建表）：
//    resource_type='content_factory'
//      change_summary='content_factory:published'      → 自动发布成功（verify=pending）
//      change_summary='content_factory:verified'       → Verify 通过（计入成功发布）
//      change_summary='content_factory:verify_failed'  → Verify 失败（不计入成功）
//    after_snippet = 全字段 JSON（topic/generated/fact/quality/safety/publish/verify/
//                    failure_reason/published_at/content_id/url/gh_path）
// ---------------------------------------------------------------------------

import type { D1Database } from "@cloudflare/workers-types";
import type { Env } from "../types";
import { ghPut, ghGetChecked } from "../api/admin/shared";
import type { ContentDraft } from "./content-quality";

/** 每日成功自动发布上限（Owner 决策）。10 = 成功发布上限，非生成上限。 */
export const MAX_AUTO_PUBLISH_PER_DAY = 10;

export const FACTORY_AUDIT_TYPE = "content_factory";
const SUM_PUBLISHED = "content_factory:published";
// 注：verified / verify_failed 的 change_summary 字面量由 content-generate 的 Verify
// pass 直接写入（"content_factory:verified" / "content_factory:verify_failed"），
// 监控端点 factory-status 按同字面量聚合；此处不重复定义以免漂移。

export interface FactoryRecord {
  content_id: string; // `${collection}:${key}:${locale}`
  topic: string;
  collection: string;
  key: string;
  locale: string;
  generated_at: string;
  fact_result: string; // pass | blocked:<rules>
  quality_result: string; // pass:<score> | fail:<score>
  safety_result: string; // pass | blocked:<reasons>
  review_decision: string; // approve | reject | escalate
  publish_result: string; // ok | failed
  verify_result: string; // pending | pass | fail
  failure_reason: string;
  published_at: string;
  url: string;
  gh_path: string;
}

// ---- YAML / Markdown（与 content-generate buildMarkdown 同格式，draft:false）----
function yamlVal(v: unknown): string {
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return "[" + v.map(yamlVal).join(", ") + "]";
  if (v !== null && typeof v === "object") {
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

export function buildPublishMarkdown(
  key: string,
  locale: string,
  fm: Record<string, unknown>,
  body: string,
): string {
  const lines = ["---", `key: ${key}`, `locale: ${locale}`];
  for (const [k, v] of Object.entries(fm)) {
    if (k === "key" || k === "locale") continue;
    if (v === "" || v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    lines.push(`${k}: ${yamlVal(v)}`);
  }
  lines.push("---");
  return `${lines.join("\n")}\n\n${body}\n`;
}

// ---- Safety gate（独立于 Fact/Quality 的内容安全扫描）----
/** 禁宣称模式：医疗疗效/法律建议/金融保证/绝对化保证 → 宁可 escalate 也不自动发布。 */
const PROHIBITED_PATTERNS: { re: RegExp; label: string }[] = [
  {
    re: /\b(cures?|curing|heals?|healing|treats?|treating)\b.{0,40}\b(cancer|diabetes|anxiety|depression|insomnia|asthma|eczema)\b/i,
    label: "medical-efficacy-claim",
  },
  {
    re: /\b(guarantee(s|d)?|guaranteed)\b.{0,30}\b(results?|sales?|revenue|rank(ing)? #?1|top ?rank)\b/i,
    label: "guaranteed-outcome-claim",
  },
  { re: /\b(legal advice|legally binding|court|lawsuit)\b/i, label: "legal-advice" },
  { re: /\b(investment advice|financial advice|guaranteed return)\b/i, label: "financial-advice" },
];

export function safetyGateDraft(draft: ContentDraft): { pass: boolean; reasons: string[] } {
  const text = `${draft.title || ""} ${draft.excerpt || ""} ${draft.seoDescription || ""} ${draft.body || ""}`;
  const reasons: string[] = [];
  for (const p of PROHIBITED_PATTERNS) {
    if (p.re.test(text)) reasons.push(p.label);
  }
  return { pass: reasons.length === 0, reasons };
}

// ---- 发布 ----
export function contentPath(collection: string, key: string, locale: string): string {
  return `src/content/${collection}/${key}.${locale}.md`;
}
export function contentUrl(locale: string, collection: string, key: string): string {
  const seg = collection === "guides" ? "guides" : "blog";
  return `https://aromiso.com/${locale}/${seg}/${key}/`;
}

/**
 * 自动发布：ghPut 写 draft:false 的 markdown 到 GitHub（Pages 重建后上线）。
 * 返回 publish ok/fail；失败原因由调用方记录。绝不伪造成功。
 */
export async function autoPublishContent(
  env: Env,
  args: {
    collection: string;
    key: string;
    locale: string;
    fm: Record<string, unknown>;
    body: string;
  },
): Promise<boolean> {
  const md = buildPublishMarkdown(args.key, args.locale, { ...args.fm, draft: false }, args.body);
  // UTF-8 → base64（TextEncoder，避免已废弃的 unescape/encodeURIComponent 技巧）
  let b64: string;
  try {
    const bytes = new TextEncoder().encode(md);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    b64 = btoa(bin);
  } catch {
    return false;
  }
  if (!b64) return false;
  const path = contentPath(args.collection, args.key, args.locale);
  return ghPut(
    path,
    b64,
    `content-factory: auto-publish ${args.key} (${args.locale}) [gated]`,
    env,
  );
}

// ---- 审计 ----
export async function recordFactoryEvent(
  db: D1Database | undefined,
  summary: string,
  rec: { content_id: string } & Record<string, unknown>,
): Promise<void> {
  if (!db) return;
  try {
    await db
      .prepare(
        `INSERT INTO audit_logs
           (id, actor_type, user_id, username, action, resource_type, resource_id,
            resource_title, change_summary, after_snippet, request_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      )
      .bind(
        crypto.randomUUID(),
        "ai",
        null,
        "content_factory",
        summary === SUM_PUBLISHED ? "publish" : "update",
        FACTORY_AUDIT_TYPE,
        rec.content_id.slice(0, 80),
        String(rec.topic || rec.key || "").slice(0, 200),
        summary,
        JSON.stringify({ ...rec, at: new Date().toISOString() }),
        null,
      )
      .run();
  } catch (e) {
    console.error("[content-autopublish] audit write failed (non-blocking):", e);
  }
}

/** 今日已自动发布（provisional）数量 → 额度控制。 */
export async function publishedTodayCount(db: D1Database): Promise<number> {
  try {
    const r = await db
      .prepare(
        `SELECT COUNT(*) AS c FROM audit_logs
         WHERE resource_type = ? AND change_summary = ? AND date(created_at) = date('now')`,
      )
      .bind(FACTORY_AUDIT_TYPE, SUM_PUBLISHED)
      .first<{ c: number }>();
    return Number(r?.c || 0);
  } catch {
    // 额度查询失败 → 保守返回上限（宁可不发，也不超发）。
    return MAX_AUTO_PUBLISH_PER_DAY;
  }
}

// ---- Verify ----
export interface VerifyOutcome {
  result: "pass" | "fail" | "pending";
  detail: string;
}

/**
 * 验证一篇已发布内容：① GitHub 文件存在且 draft:false；② 前台 URL 200；
 * ③ sitemap 收录该 URL。全过才 pass。Pages 重建未完成 → pending（跨 run 重试）。
 */
export async function verifyPublishedContent(
  env: Env,
  rec: { gh_path: string; url: string; collection: string },
): Promise<VerifyOutcome> {
  // ① 文件存在 + draft:false
  const gh = await ghGetChecked(rec.gh_path, env);
  if (gh.state === "error") return { result: "pending", detail: `gh read error: ${gh.error}` };
  if (gh.state === "missing" || !gh.item?.content)
    return { result: "fail", detail: "published file missing in GitHub" };
  let decoded: string;
  try {
    // base64 → UTF-8（TextDecoder，避免已废弃的 escape/unescape）
    const bin = atob(gh.item.content);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    decoded = new TextDecoder().decode(bytes);
  } catch {
    return { result: "pending", detail: "cannot decode file content yet" };
  }
  if (/^draft:\s*true/m.test(decoded)) return { result: "fail", detail: "file still draft:true" };

  // ② 前台 URL 200（Pages 未重建完 → 404 → pending 重试）
  let status: number;
  try {
    const res = await fetch(rec.url, { method: "GET", redirect: "follow" });
    status = res.status;
  } catch (e) {
    return {
      result: "pending",
      detail: `front fetch error: ${e instanceof Error ? e.message : e}`,
    };
  }
  if (status === 404) return { result: "pending", detail: "front URL 404 (Pages rebuild pending)" };
  if (status !== 200) return { result: "fail", detail: `front URL status ${status}` };

  // ③ sitemap 收录
  try {
    const sm = await fetch(
      `https://aromiso.com/sitemap-${rec.collection === "guides" ? "guides" : "blog"}.xml`,
    );
    if (sm.ok) {
      const txt = await sm.text();
      const needle = rec.url.replace("https://aromiso.com", "");
      if (!txt.includes(needle)) return { result: "pending", detail: "not in sitemap yet" };
    }
  } catch {
    /* sitemap 读取失败不阻断（②已过），保守 pending→下次再验 */
    return { result: "pending", detail: "sitemap read error" };
  }
  return { result: "pass", detail: "file+url200+sitemap ok" };
}

// ---- 业务状态机 ----
export type FactoryStatus =
  "SUCCESS" | "PARTIAL" | "STARVED" | "REJECTED" | "FAILED" | "VERIFY_FAILED";

export function computeFactoryStatus(c: {
  published: number;
  verified: number;
  verifyFailed: number;
  rejected: number;
  failed: number;
  generated: number;
  queued: number;
  starved: boolean;
}): FactoryStatus {
  if (c.failed > 0 && c.published === 0 && c.verified === 0) return "FAILED";
  if (c.verifyFailed > 0 && c.verified === 0 && c.published === 0) return "VERIFY_FAILED";
  if (c.starved && c.published === 0) return "STARVED";
  if (c.rejected > 0 && c.published === 0 && c.queued === 0) return "REJECTED";
  if (c.verified > 0 && (c.verifyFailed > 0 || c.failed > 0 || c.rejected > 0)) return "PARTIAL";
  if (c.verified > 0) return "SUCCESS";
  if (c.published > 0) return "PARTIAL"; // 已发布待 Verify / Verify 未全过
  if (c.queued > 0) return "PARTIAL"; // 全部 escalate 回落人工队列，无自动发布
  if (c.starved) return "STARVED";
  if (c.rejected > 0) return "REJECTED";
  return c.generated === 0 ? "STARVED" : "FAILED";
}
