// ---------------------------------------------------------------------------
//  Aromiso OS 2.0 — Content Factory 质量闸（V5.21 / Phase 2）
//
//  文档 docs/CONTENT_SCHEMA.md §9 的落地：把「一篇 AI 生成的博客草稿」按七个维度
//  打成 0–100 分。这是内容工厂**不可省略的闸门**——低于阈值的草稿绝不进入
//  REVIEW 队列，宁可这一轮不产出，也不让半成品占用人工评审注意力。
//
//  纯函数、零副作用、零外部依赖 → 便于单测穷举。评分只看「结构完整度 + 显示层
//  干净度 + 正文体量 + 内链 + 溯源」这些可机检的客观信号；内容的事实性/说服力
//  由后续人工评审兜底（本闸门是必要条件，不是充分条件）。
//
//  绝不因为"想凑分"而奖励编造：不检查也不奖励任何统计数字/评分/评价（AGENTS.md
//  红线）。分数只反映契约字段是否齐全、是否符合显示层与 SEO 层分离原则。
// ---------------------------------------------------------------------------

/** 一篇待评分的博客草稿（对齐 src/content/config.ts 的 blog 字段 + 溯源 _meta）。 */
export interface ContentDraft {
  /** 显示层标题（H1），≤60，干净不堆砌。 */
  title?: string;
  /** 列表卡片摘要，≤160。 */
  excerpt?: string;
  /** 站内分类。 */
  category?: string;
  /** Markdown 正文。 */
  body?: string;
  /** 标签，≤6。 */
  tags?: string[];
  /** SEO 关键词数组。 */
  keywords?: string[];
  /** SEO 层标题（<title>），≤60，可含关键词。 */
  seoTitle?: string;
  /** meta description，120–160。 */
  seoDescription?: string;
  /** 溯源六要素。 */
  _meta?: {
    agent?: string;
    model?: string;
    generated_at?: string | number;
    idempotency_key?: string;
    [k: string]: unknown;
  };
}

export interface QualityDimension {
  key: string;
  label: string; // 中文在前，便于后台评审
  score: number;
  max: number;
  ok: boolean;
  note: string;
}

export interface QualityResult {
  score: number;
  max: number;
  pass: boolean;
  dimensions: QualityDimension[];
  /** 未达标维度的可读原因，供 REVIEW 队列展示。 */
  reasons: string[];
}

/** 达标阈值：≥80 分才允许进 REVIEW 队列。 */
export const QUALITY_PASS_THRESHOLD = 80;

// ---- 工具 ------------------------------------------------------------------

/** 去掉 markdown 标记后估算正文词数（按空白切分，中英通用近似）。 */
function wordCount(md: string): number {
  const text = md
    .replace(/```[\s\S]*?```/g, " ") // 代码块
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 链接保留锚文本
    .replace(/[#>*_`~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(" ").filter(Boolean).length;
}

/** 提取 markdown 里的所有链接目标。 */
function extractLinkHrefs(md: string): string[] {
  const out: string[] = [];
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) out.push(m[1].trim());
  return out;
}

/** 是否内链（站内相对路径或 aromiso.com 绝对链接）。 */
function isInternalHref(href: string): boolean {
  if (!href) return false;
  if (href.startsWith("/")) return true;
  return /(^https?:\/\/)?(www\.)?aromiso\.com\//i.test(href);
}

/** 显示层堆砌检测：任一去符号单词（≥3 字母）重复出现 ≥3 次即判堆砌。 */
function hasKeywordStuffing(title: string): boolean {
  const words = title
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length >= 3);
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  for (const c of counts.values()) if (c >= 3) return true;
  return false;
}

/** 正文是否泄漏了非文章内容（JSON/代码围栏/脚本标签/裸 frontmatter）。 */
function hasMarkdownLeakage(md: string): boolean {
  const s = md.trim();
  if (!s) return false;
  if (s.startsWith("{") || s.startsWith("```json")) return true;
  if (/<\s*script/i.test(s)) return true;
  if (/^---\s*$/m.test(s.split("\n")[0] || "")) return true; // 正文顶部又出现 frontmatter 分隔
  return false;
}

// ---- 评分主函数 ------------------------------------------------------------

/**
 * 对一篇博客草稿打分（0–100）。纯函数：同一输入永远同一输出。
 */
export function scoreDraft(draft: ContentDraft): QualityResult {
  const dims: QualityDimension[] = [];
  const title = (draft.title || "").trim();
  const excerpt = (draft.excerpt || "").trim();
  const body = draft.body || "";
  const seoTitle = (draft.seoTitle || "").trim();
  const seoDesc = (draft.seoDescription || "").trim();

  // 1) meta 完整 (20)
  {
    let s = 0;
    const notes: string[] = [];
    if (seoTitle && seoTitle.length <= 60) s += 10;
    else notes.push(seoTitle ? "seoTitle 超 60 字符" : "缺 seoTitle");
    if (seoDesc.length >= 120 && seoDesc.length <= 160) s += 10;
    else
      notes.push(
        seoDesc ? `seoDescription 长度 ${seoDesc.length}（需 120–160）` : "缺 seoDescription",
      );
    dims.push({
      key: "meta",
      label: "meta 完整（SEO 层）",
      score: s,
      max: 20,
      ok: s === 20,
      note: notes.join("；") || "seoTitle/seoDescription 达标",
    });
  }

  // 2) 显示层干净 (15)
  {
    let s = 0;
    const notes: string[] = [];
    if (title) s += 5;
    else notes.push("缺 title（H1 显示层）");
    if (title && title.length <= 60) s += 5;
    else if (title) notes.push(`title 超 60 字符（${title.length}）`);
    if (title && !hasKeywordStuffing(title)) s += 5;
    else if (title) notes.push("title 存在关键词堆砌");
    dims.push({
      key: "display",
      label: "显示层干净（H1 不堆砌）",
      score: s,
      max: 15,
      ok: s === 15,
      note: notes.join("；") || "title 干净、长度达标",
    });
  }

  // 3) 正文质量 (30)：词数 + 无泄漏 + 结构化小标题
  {
    let s = 0;
    const notes: string[] = [];
    const wc = wordCount(body);
    if (wc >= 800 && wc <= 2500) s += 18;
    else if (wc >= 600 && wc < 800) {
      s += 12;
      notes.push(`正文偏短（${wc} 词，建议 800–2500）`);
    } else if (wc > 2500 && wc <= 3200) {
      s += 12;
      notes.push(`正文偏长（${wc} 词）`);
    } else {
      s += Math.max(0, Math.min(6, Math.floor(wc / 100)));
      notes.push(`正文词数不达标（${wc} 词）`);
    }
    if (!hasMarkdownLeakage(body)) s += 6;
    else notes.push("正文疑似泄漏 JSON/脚本/frontmatter");
    const h2Count = (body.match(/^##\s+/gm) || []).length;
    if (h2Count >= 2) s += 6;
    else notes.push(`小标题不足（${h2Count} 个 h2，需 ≥2）`);
    dims.push({
      key: "body",
      label: "正文质量（体量/结构/无泄漏）",
      score: s,
      max: 30,
      ok: s === 30,
      note: notes.join("；") || `正文 ${wc} 词、${h2Count} 个小标题`,
    });
  }

  // 4) 内链 (15)：≥2 个站内链接
  {
    const internal = extractLinkHrefs(body).filter(isInternalHref);
    let s = 0;
    if (internal.length >= 2) s = 15;
    else if (internal.length === 1) s = 7;
    dims.push({
      key: "internal_link",
      label: "内链（≥2 个站内链接）",
      score: s,
      max: 15,
      ok: s === 15,
      note: `站内链接 ${internal.length} 个`,
    });
  }

  // 5) 结构就绪 (10)：excerpt + category（面包屑/FAQ 由模板生成）
  {
    let s = 0;
    const notes: string[] = [];
    if (excerpt && excerpt.length <= 160) s += 5;
    else notes.push(excerpt ? `excerpt 超 160（${excerpt.length}）` : "缺 excerpt");
    if ((draft.category || "").trim()) s += 5;
    else notes.push("缺 category");
    dims.push({
      key: "structure",
      label: "结构就绪（摘要/分类）",
      score: s,
      max: 10,
      ok: s === 10,
      note: notes.join("；") || "excerpt/category 达标",
    });
  }

  // 6) 图片可访问 (5)：有图必须带 alt；无图不扣分
  {
    const imgs = body.match(/!\[([^\]]*)\]\([^)]*\)/g) || [];
    const missingAlt = imgs.filter((tag) => {
      const m = tag.match(/!\[([^\]]*)\]/);
      return !m || m[1].trim().length === 0;
    });
    const s = missingAlt.length === 0 ? 5 : 0;
    dims.push({
      key: "image_alt",
      label: "图片可访问（alt 齐全）",
      score: s,
      max: 5,
      ok: s === 5,
      note: imgs.length === 0 ? "无内嵌图片" : `${imgs.length} 张图，${missingAlt.length} 张缺 alt`,
    });
  }

  // 7) 溯源 (5)：_meta 关键要素齐全
  {
    const m = draft._meta || {};
    const have = ["agent", "model", "generated_at", "idempotency_key"].filter(
      (k) => m[k] !== undefined && String(m[k]).trim() !== "",
    );
    const s = have.length === 4 ? 5 : 0;
    dims.push({
      key: "provenance",
      label: "溯源（_meta 要素齐全）",
      score: s,
      max: 5,
      ok: s === 5,
      note: s === 5 ? "agent/model/时间/幂等键齐全" : `_meta 缺 ${4 - have.length} 项`,
    });
  }

  const score = dims.reduce((a, d) => a + d.score, 0);
  const max = dims.reduce((a, d) => a + d.max, 0);
  const reasons = dims.filter((d) => !d.ok).map((d) => `${d.label}: ${d.note}`);

  return { score, max, pass: score >= QUALITY_PASS_THRESHOLD, dimensions: dims, reasons };
}
