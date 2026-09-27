// ---------------------------------------------------------------------------
//  Aromiso V5.35 — Organic Growth Agent Phase 2 · Technical Audit
//
//  线上技术体检（owner 设计稿「Safe Technical Auto-Fix」+「Internal Link
//  Optimization」的**检测层**）：抓 sitemap + 抽样页面，检查
//  canonical / hreflang / title / meta / h1 / JSON-LD / alt / 死链 / 孤页 /
//  sitemap 收录，产出与 Opportunity 同构的 findings 进增长看板。
//
//  边界（docs/ORGANIC_GROWTH_AGENT_PHASE2.md 横幅）：
//   - 本版只「检测 + 路由」，不做生产自动写；
//   - findings 默认全部走 growth_review（L2 人工审核）；仅当 KV
//     config:growth_autofix_enabled === "on" 时，internal_link /
//     alt_text_fill / meta_fix 三类才路由到已注册的 L3 任务类型
//     （复用权限闸门 + 真实性闸，无新自动写入器）；
//   - 预算守护：页面抽样 ≤ maxPages，死链复查 ≤ maxLinkChecks，全程超时保护；
//   - 绝不触碰 Google（不提交 Indexing API、不 ping），只读自己的站。
// ---------------------------------------------------------------------------

import type { ExecLevel, Priority } from "./growth-engine";

export interface AuditFinding {
  opp_type: "index_issue" | "meta_fix" | "internal_link" | "alt_text_fill";
  page: string;
  query: "";
  priority: Priority;
  exec_level: ExecLevel;
  reason: string;
  suggested_action: string;
  /** 开关开启时路由到的已注册任务类型；"growth_review" = 永远人工审核。 */
  fix_type: string;
  metrics: Record<string, number | string>;
}

export interface AuditOptions {
  baseUrl?: string;
  /** 优先抽样的 URL（如 GSC 高曝光页），其余从 sitemap 补齐。 */
  priorityUrls?: string[];
  maxPages?: number;
  maxLinkChecks?: number;
  timeoutMs?: number;
  /** V5.361：页面/死链抓取的有界并发数（默认 6）。 */
  fetchConcurrency?: number;
}

export interface AuditResult {
  findings: AuditFinding[];
  pagesChecked: number;
  linksChecked: number;
  sitemapUrls: number;
  notes: string[];
}

const DEFAULT_BASE = "https://aromiso.com";
const UA = "AromisoGrowthAudit/1.0 (+https://aromiso.com)";
const ASSET_RE =
  /\.(png|jpe?g|svg|webp|gif|ico|css|js|mjs|json|xml|mp4|webm|zip|woff2?|ttf)([?#].*)?$/i;

// ---- 纯函数检查器（可单测） -------------------------------------------------

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? m[1] : null;
}

/** <title> 存在性与长度（Google 展示约 60 字符上限，留 70 容差）。 */
export function checkTitle(html: string): { ok: boolean; reason: string } {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const t = (m?.[1] || "").replace(/\s+/g, " ").trim();
  if (!t) return { ok: false, reason: "缺少 <title>" };
  if (t.length < 10) return { ok: false, reason: `title 过短（${t.length} 字符）` };
  if (t.length > 70) return { ok: false, reason: `title 过长（${t.length} 字符，建议 ≤60）` };
  return { ok: true, reason: "" };
}

/** meta description 存在性与长度。 */
export function checkMetaDescription(html: string): { ok: boolean; reason: string } {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find((t) => /name\s*=\s*["']description["']/i.test(t));
  if (!tag) return { ok: false, reason: "缺少 meta description" };
  const c = (attr(tag, "content") || "").trim();
  if (!c) return { ok: false, reason: "meta description 为空" };
  if (c.length > 170) return { ok: false, reason: `meta description 过长（${c.length} 字符）` };
  return { ok: true, reason: "" };
}

function normPath(u: string): string {
  try {
    const url = new URL(u);
    return url.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return u;
  }
}

/** canonical 必须存在且自指（多语言页各指自己，不得跨语言互指）。 */
export function checkCanonical(html: string, pageUrl: string): { ok: boolean; reason: string } {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  const tag = tags.find((t) => /rel\s*=\s*["']canonical["']/i.test(t));
  if (!tag) return { ok: false, reason: "缺少 canonical" };
  const href = attr(tag, "href");
  if (!href) return { ok: false, reason: "canonical 无 href" };
  try {
    const c = new URL(href, pageUrl);
    const p = new URL(pageUrl);
    if (c.origin !== p.origin) {
      return { ok: false, reason: `canonical 指向其他域名（${c.origin}）` };
    }
    if (normPath(c.href) !== normPath(p.href)) {
      return {
        ok: false,
        reason: `canonical（${normPath(c.href)}）与页面自身（${normPath(p.href)}）不一致`,
      };
    }
  } catch {
    return { ok: false, reason: `canonical 无法解析（${href.slice(0, 80)}）` };
  }
  return { ok: true, reason: "" };
}

/** 带语言前缀的页面必须声明 en/es/de hreflang（x-default 建议）。 */
export function checkHreflang(html: string, pageUrl: string): { ok: boolean; reason: string } {
  let path: string;
  try {
    path = new URL(pageUrl).pathname;
  } catch {
    return { ok: true, reason: "" };
  }
  const m = path.match(/^\/(en|es|de)(\/|$)/);
  if (!m) return { ok: true, reason: "" }; // 非语言前缀页不检查
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  const langs = new Set<string>();
  for (const t of tags) {
    if (!/rel\s*=\s*["']alternate["']/i.test(t)) continue;
    const hl = attr(t, "hreflang");
    if (hl) langs.add(hl.toLowerCase());
  }
  if (langs.size === 0) return { ok: false, reason: "多语言页缺少 hreflang 声明" };
  const missing = ["en", "es", "de"].filter((l) => !langs.has(l));
  if (missing.length > 0) {
    return { ok: false, reason: `hreflang 缺少 ${missing.join(" / ")}` };
  }
  return { ok: true, reason: "" };
}

/** 恰好一个 H1。 */
export function checkH1(html: string): { ok: boolean; reason: string } {
  const n = (html.match(/<h1[\s>]/gi) || []).length;
  if (n === 0) return { ok: false, reason: "缺少 H1" };
  if (n > 1) return { ok: false, reason: `存在 ${n} 个 H1（应唯一）` };
  return { ok: true, reason: "" };
}

/** 全部 JSON-LD 块必须可解析（结构化数据坏掉 = 富结果全丢）。 */
export function checkJsonLd(html: string): { ok: boolean; reason: string } {
  const blocks = html.match(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  if (!blocks || blocks.length === 0) return { ok: true, reason: "" }; // 无 JSON-LD 不算错
  let bad = 0;
  for (const b of blocks) {
    const inner = b.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "");
    try {
      JSON.parse(inner);
    } catch {
      bad++;
    }
  }
  if (bad > 0) return { ok: false, reason: `${bad} 个 JSON-LD 块解析失败` };
  return { ok: true, reason: "" };
}

/** 缺 alt 的 <img> 数量（空 alt="" 视为装饰图，合规）。 */
export function countMissingAlt(html: string): number {
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  return imgs.filter((t) => !/\balt\s*=/i.test(t)).length;
}

/** 抽取同站内链（归一化、去资产/接口/非 http）。 */
export function extractInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const hrefs = html.match(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["']/gi) || [];
  const out = new Set<string>();
  for (const tag of hrefs) {
    const raw = attr(tag, "href");
    if (!raw) continue;
    if (/^(mailto:|tel:|javascript:|data:)/i.test(raw)) continue;
    let u: URL;
    try {
      u = new URL(raw, baseUrl);
    } catch {
      continue;
    }
    if (u.origin !== base.origin) continue;
    if (ASSET_RE.test(u.pathname)) continue;
    if (u.pathname.startsWith("/api/") || u.pathname.startsWith("/admin")) continue;
    u.hash = "";
    u.search = "";
    out.add(u.toString());
  }
  return [...out];
}

// ---- 抓取与审计主体 ---------------------------------------------------------

async function fetchText(
  url: string,
  timeoutMs: number,
): Promise<{ status: number; text: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    const text = res.ok ? await res.text() : "";
    return { status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * V5.361：限并发映射。顺序抓取 45+ 页面会把 wall-clock 堆过 CF 边缘 100s
 * 响应超时（growth 阶段被 524 掐断的根因），用有界并发压缩到安全窗口内。
 */
export async function pMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const n = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** 找 sitemap 全集：优先 sitemap-index.xml → 子表；回退 sitemap.xml。 */
async function collectSitemapUrls(
  baseUrl: string,
  timeoutMs: number,
  notes: string[],
): Promise<string[]> {
  const urls = new Set<string>();
  const parseLocs = (xml: string) =>
    [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
  try {
    const idx = await fetchText(`${baseUrl}/sitemap-index.xml`, timeoutMs);
    if (idx.status === 200 && /<sitemapindex/i.test(idx.text)) {
      const children = parseLocs(idx.text).slice(0, 5);
      // V5.361：子表并发抓取（最多 5 个）
      const childResults = await Promise.all(
        children.map(async (c) => {
          try {
            return await fetchText(c, timeoutMs);
          } catch {
            return null;
          }
        }),
      );
      for (const r of childResults) {
        if (r && r.status === 200) for (const u of parseLocs(r.text)) urls.add(u);
      }
    } else {
      const direct = await fetchText(`${baseUrl}/sitemap.xml`, timeoutMs);
      if (direct.status === 200) for (const u of parseLocs(direct.text)) urls.add(u);
    }
  } catch (e) {
    notes.push(`sitemap fetch failed: ${e instanceof Error ? e.message : e}`);
  }
  return [...urls].filter((u) => {
    try {
      const p = new URL(u);
      return p.origin === new URL(baseUrl).origin && !ASSET_RE.test(p.pathname);
    } catch {
      return false;
    }
  });
}

/**
 * V5.35 Technical Audit 主流程（检测层，不做任何写操作）。
 * 页面抽样顺序：priorityUrls（GSC 高曝光页）→ sitemap 补齐。
 */
export async function runTechnicalAudit(opts: AuditOptions = {}): Promise<AuditResult> {
  const baseUrl = (opts.baseUrl || DEFAULT_BASE).replace(/\/+$/, "");
  // CF Free 计划每次调用仅 50 个子请求。预算：sitemap ~6 + 页 10 + 死链 15
  // + 上层 Inspection 12 = 43 ≤ 50。调大前先确认 Workers 计划已升级。
  const maxPages = opts.maxPages ?? 10;
  const maxLinkChecks = opts.maxLinkChecks ?? 15;
  const timeoutMs = opts.timeoutMs ?? 6000;
  const notes: string[] = [];
  const findings: AuditFinding[] = [];

  const sitemapUrls = await collectSitemapUrls(baseUrl, timeoutMs, notes);
  if (sitemapUrls.length === 0) notes.push("sitemap empty or unreachable — audit degraded");
  const sitemapSet = new Set(sitemapUrls.map((u) => normPath(u)));

  // 抽样清单：GSC 优先页在前，sitemap 补齐
  const wanted: string[] = [];
  const seen = new Set<string>();
  const push = (u: string) => {
    try {
      const p = new URL(u);
      const key = normPath(p.href);
      if (seen.has(key) || ASSET_RE.test(p.pathname)) return;
      if (p.pathname.startsWith("/admin")) return;
      seen.add(key);
      wanted.push(p.toString());
    } catch {
      /* skip */
    }
  };
  for (const u of opts.priorityUrls || []) push(u);
  for (const u of sitemapUrls) push(u);
  const targets = wanted.slice(0, maxPages);

  const fetchedStatus = new Map<string, number>(); // normPath → status
  const inbound = new Set<string>(); // 被内链指向的 normPath
  const crawled = new Set<string>();

  // V5.361：先限并发批量抓取全部目标页，再顺序分析。
  // 顺序逐页 fetch 会把 wall-clock 堆过 CF 边缘 100s 超时（growth 524 根因）。
  const pageHtml = new Map<string, { status: number; text: string }>();
  await pMap(
    targets,
    async (url) => {
      try {
        pageHtml.set(url, await fetchText(url, timeoutMs));
      } catch (e) {
        notes.push(`fetch failed: ${normPath(url)} (${e instanceof Error ? e.message : e})`);
      }
    },
    opts.fetchConcurrency ?? 6,
  );

  for (const url of targets) {
    const res = pageHtml.get(url);
    if (!res) continue; // 抓取失败已在 notes 记录
    fetchedStatus.set(normPath(url), res.status);
    crawled.add(normPath(url));
    if (res.status < 200 || res.status >= 300) {
      findings.push({
        opp_type: "index_issue",
        page: url,
        query: "",
        priority: "P0",
        exec_level: "A",
        reason: `抽样抓取返回 HTTP ${res.status}`,
        suggested_action: "检查页面是否应 301 到最近似页（_redirects 人工推送）或恢复页面",
        fix_type: "growth_review",
        metrics: { http_status: res.status },
      });
      continue;
    }
    const html = res.text;
    const addFinding = (
      check: { ok: boolean; reason: string },
      mk: () => Omit<AuditFinding, "page" | "query" | "metrics"> & {
        metrics?: Record<string, number | string>;
      },
    ) => {
      if (check.ok) return;
      const f = mk();
      findings.push({ page: url, query: "", metrics: {}, ...f });
    };

    addFinding(checkTitle(html), () => ({
      opp_type: "meta_fix",
      priority: "P1",
      exec_level: "A",
      reason: checkTitle(html).reason,
      suggested_action: "补写/调整 title（≤60 字符，含核心采购词），文案须过真实性闸",
      fix_type: "meta_fix",
    }));
    addFinding(checkMetaDescription(html), () => ({
      opp_type: "meta_fix",
      priority: "P1",
      exec_level: "A",
      reason: checkMetaDescription(html).reason,
      suggested_action: "补写 meta description（50–160 字符，突出 B2B 决策点）",
      fix_type: "meta_fix",
    }));
    addFinding(checkCanonical(html, url), () => ({
      opp_type: "index_issue",
      priority: "P1",
      exec_level: "A",
      reason: checkCanonical(html, url).reason,
      suggested_action: "修正 canonical 为自指（多语言页各指自己 + hreflang 配套）",
      fix_type: "growth_review", // 模板层改动，须人工
    }));
    addFinding(checkHreflang(html, url), () => ({
      opp_type: "index_issue",
      priority: "P1",
      exec_level: "A",
      reason: checkHreflang(html, url).reason,
      suggested_action: "补齐 en/es/de hreflang alternate 声明（i18n 模板层）",
      fix_type: "growth_review",
    }));
    addFinding(checkH1(html), () => ({
      opp_type: "meta_fix",
      priority: "P2",
      exec_level: "A",
      reason: checkH1(html).reason,
      suggested_action: "保证页面恰好一个 H1 且包含主题词",
      fix_type: "meta_fix",
    }));
    addFinding(checkJsonLd(html), () => ({
      opp_type: "index_issue",
      priority: "P1",
      exec_level: "A",
      reason: checkJsonLd(html).reason,
      suggested_action: "修复结构化数据语法错误（富结果丢失风险）",
      fix_type: "growth_review",
    }));
    const missingAlt = countMissingAlt(html);
    if (missingAlt > 0) {
      findings.push({
        opp_type: "alt_text_fill",
        page: url,
        query: "",
        priority: "P2",
        exec_level: "A",
        reason: `${missingAlt} 张图片缺少 alt 属性`,
        suggested_action: "为缺 alt 的图片补描述性 alt（产品名 + 关键属性，不堆关键词）",
        fix_type: "alt_text_fill",
        metrics: { missing_alt: missingAlt },
      });
    }
    if (!sitemapSet.has(normPath(url))) {
      findings.push({
        opp_type: "index_issue",
        page: url,
        query: "",
        priority: "P2",
        exec_level: "A",
        reason: "页面不在 sitemap 中（可抓取性受损）",
        suggested_action: "确认构建时 sitemap 包含该页（Astro sitemap 集成配置）",
        fix_type: "growth_review",
        metrics: {},
      });
    }
    for (const link of extractInternalLinks(html, baseUrl)) inbound.add(normPath(link));
  }

  // 死链复查：被指向但未抓取过的内链（预算内）
  const linkTargets = [...inbound].filter((p) => !fetchedStatus.has(p)).slice(0, maxLinkChecks);
  let linksChecked = 0;
  // V5.361：死链复查也限并发批量抓取。
  // 目录型 URL（无扩展名）直接拼尾斜杠，避免 308 重定向跳——每一跳都额外计一个子请求，
  // 会把 CF Free 50 子请求预算吃光。
  const withSlash = (p: string) => (/\.[a-z0-9]{1,5}$/i.test(p) ? p : p.replace(/\/?$/, "/"));
  const linkStatus = new Map<string, number>();
  await pMap(
    linkTargets,
    async (path) => {
      try {
        const r = await fetchText(`${baseUrl}${withSlash(path)}`, timeoutMs);
        linkStatus.set(path, r.status);
      } catch (e) {
        notes.push(`link check failed: ${path} (${e instanceof Error ? e.message : e})`);
      }
    },
    opts.fetchConcurrency ?? 6,
  );
  for (const path of linkTargets) {
    const status = linkStatus.get(path);
    if (status === undefined) continue;
    linksChecked++;
    fetchedStatus.set(path, status);
    if (status === 404 || status === 410) {
      findings.push({
        opp_type: "index_issue",
        page: `${baseUrl}${path}`,
        query: "",
        priority: "P0",
        exec_level: "A",
        reason: `站内死链（HTTP ${status}）：${path}`,
        suggested_action: "修复链接指向或加 301（_redirects 人工推送）；死链会浪费爬取预算",
        fix_type: "growth_review",
        metrics: { http_status: status },
      });
    }
  }

  // 孤页检测（抽样口径，低置信度提示）：sitemap 内、未被抽样抓取、也无任何入链
  const orphans = sitemapUrls
    .filter((u) => {
      const p = normPath(u);
      return !crawled.has(p) && !inbound.has(p);
    })
    .slice(0, 10);
  for (const u of orphans) {
    findings.push({
      opp_type: "internal_link",
      page: u,
      query: "",
      priority: "P2",
      exec_level: "A",
      reason: "疑似孤页：抽样爬取范围内未发现任何站内入链（Sitemap 直达）",
      suggested_action:
        "从相关分类/指南/案例页补 1–2 条语境内链（须人工审核锚文本与落点）；确属冗余页则评估 noindex/301",
      fix_type: "internal_link",
      metrics: {},
    });
  }

  return {
    findings,
    pagesChecked: targets.length,
    linksChecked,
    sitemapUrls: sitemapUrls.length,
    notes,
  };
}
