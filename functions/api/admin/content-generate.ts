// ---------------------------------------------------------------------------
//  Aromiso OS 2.0 — Content Factory 生成器（V5.33 / Phase 2 · 双闸）
//  POST /api/admin/content-generate
//
//  两级自动化的「第一级：auto-generate」。本端点做且只做四件事：
//    1. 用 content_writer 角色生成一篇符合 docs/CONTENT_SCHEMA.md 的博客草稿
//       （模型经 Model Router 解析，默认关 → 仍为 deepseek-v4-pro，零行为漂移）；
//    2. 过 100 分质量闸（functions/lib/content-quality.ts）——结构不达标绝不入队；
//    3. 过真实性闸（functions/lib/truthfulness.ts，Fact Authority Layer）——
//       红线命中（编造认证/评分、归属漂移、不可核实声明）绝不入队，warnings
//       随 REVIEW 任务交人工；质量达标 ≠ 事实达标，两闸都是必要条件；
//    4. 达标草稿写入 KV（draft:blog:{key}:{locale}）+ 建一条 L2 REVIEW 任务。
//
//  ⚠️ 第二级「auto-publish」在本端点里**完全不存在**：
//     - 绝无任何 ghPut / GitHub 写；草稿只在 KV，物理上到不了 aromiso.com。
//     - 建的任务是 content_generate（enforceMode 裁为 L2），只是「待人工评审」的
//       队列项；即便有人批准执行它，task-execute 的内容执行器仍受 TASK_EXECUTOR_LIVE
//       约束返回 NO_EFFECT，不会发布。真正发布永远是人工在 CMS 点发布（save.ts ghPut）。
//     - 草稿 frontmatter 强制 draft:true，误发布也不会在前台展示。
//
//  触发权限：
//     - 人工（管理员 cookie）：随时可手动触发（观察期用它产 2–3 篇验收）。
//     - cron（Bearer CRON_SECRET）：仅当 env.CONTENT_FACTORY_LIVE === "on" 才执行，
//       否则空转（skipped）——避免无人值守的每日 AI 消耗，由运营在验收后一键开闸。
//     - 月度预算硬顶 MONTHLY_CAP_CNY(¥30) 始终生效（aiCall 内建）。
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { isAuthed, json, saveDraft, getDraft, ghGetChecked } from "./shared";
import { aiJson, getBudgetLevel } from "../../lib/ai";
import { enforceMode } from "../../lib/permissions";
import { beginRun, finishRun } from "../../lib/idempotency";
import { scoreDraft, type ContentDraft, type QualityResult } from "../../lib/content-quality";
import { checkContentDraft, formatTruthfulnessReport } from "../../lib/truthfulness";
import { resolveModelForTask } from "../../lib/model-router";
import { sendAlert } from "../../lib/notify";
import { reviewGovernance } from "../../lib/governance-reviewer";
import {
  MAX_AUTO_PUBLISH_PER_DAY,
  autoPublishContent,
  contentPath,
  contentUrl,
  computeFactoryStatus,
  publishedTodayCount,
  recordFactoryEvent,
  safetyGateDraft,
  verifyPublishedContent,
  type FactoryStatus,
} from "../../lib/content-autopublish";

type Locale = "en" | "es" | "de";

interface PilotTopic {
  key: string; // slug（^[a-z0-9-]+$）
  keyword: string; // 目标关键词
  category: string; // 站内分类
  angle: string; // 写作切入角度（喂给 AI）
  collection?: "blog" | "guides"; // 目标内容集合（默认 blog）
}

// D4 试点选题种子（可扩）。全部围绕 B2B 香氛/精油工厂买家真实痛点，
// 服务唯一北极星「询盘转化」。AI 从中取「尚无草稿/未发布」的下一个来写。
const PILOT_TOPICS: PilotTopic[] = [
  {
    key: "how-to-verify-a-fragrance-oil-factory-in-china",
    keyword: "verify fragrance oil factory China",
    category: "sourcing",
    angle:
      "帮国际买家判断一家中国香精工厂是否可靠：看哪些资质、怎么验厂、样品与量产一致性、避坑清单。",
  },
  {
    key: "reed-diffuser-private-label-moq-and-cost-breakdown",
    keyword: "reed diffuser private label MOQ cost",
    category: "cost-breakdown",
    angle:
      "藤条扩香 OEM 自有品牌的起订量与成本构成拆解：瓶型/香液/包装/印刷/物流各占多少，如何压成本不牺牲品质。",
  },
  {
    key: "essential-oil-import-compliance-usa-eu",
    keyword: "essential oil import compliance USA EU",
    category: "compliance",
    angle:
      "精油出口到美国与欧盟的合规要点：MSDS/SDS、IFRA、REACH、标签与运输分类，买家备货前要向工厂要哪些文件。",
  },
  {
    key: "scented-candle-oem-lead-time-and-packaging",
    keyword: "scented candle OEM lead time packaging",
    category: "product-knowledge",
    angle: "香薰蜡烛 OEM 的交期与包装决策：蜡种/容器/礼盒/整柜装箱，如何在旺季前排产避免延误。",
  },
  {
    key: "china-sourcing-consolidation-for-home-fragrance",
    keyword: "China sourcing consolidation home fragrance",
    category: "sourcing",
    angle: "家居香氛一站式集运：多工厂拼柜、质检、贴标、报关如何统一，降低小批量买家的门槛。",
  },
  // ── Guide 试点（evergreen，写入 guides 集合）─────────────────────────────
  {
    key: "essential-oil-grades-explained-for-buyers",
    keyword: "essential oil grades wholesale buyers",
    category: "Essential Oils",
    collection: "guides",
    angle:
      "精油等级科普给采购看：食品级/香薰级/治疗级的真实区别、GC-MS 报告怎么读、向工厂要哪些质检文件避坑。",
  },
  {
    key: "reed-diffuser-base-and-fragrance-load-guide",
    keyword: "reed diffuser base fragrance load",
    category: "Diffusers",
    collection: "guides",
    angle:
      "藤条扩香配方指南：无醇/含醇基底差异、香精负载比例、藤条数量与挥发速度，帮买家定制稳定不堵藤的产品。",
  },
  {
    key: "candle-wax-comparison-soy-coconut-paraffin",
    keyword: "candle wax comparison soy coconut paraffin",
    category: "Candles",
    collection: "guides",
    angle:
      "蜡种横向对比：大豆蜡/椰子蜡/石蜡/混合蜡的燃烧表现、香味释放、成本与卖点，帮买家按目标市场选蜡。",
  },
  {
    key: "fragrance-packaging-design-checklist-for-brands",
    keyword: "fragrance packaging design checklist",
    category: "Packaging & Design",
    collection: "guides",
    angle:
      "香氛包装设计清单：瓶型/材质/印刷工艺/合规标签/整柜装箱，自有品牌下单前要和工厂确认的每一项。",
  },
  {
    key: "fragrance-oil-vs-essential-oil-for-products",
    keyword: "fragrance oil vs essential oil products",
    category: "Fragrance Oils",
    collection: "guides",
    angle:
      "香精油 vs 精油：成分/稳定性/成本/合规/适用场景的区别，帮买家为蜡烛、扩香、洗护选对原料。",
  },
  // ── V5.69 补池：原 10 题已全部有草稿/已发布，工厂每日空转产 0。以下 12 题均为
  //    流程/科普/横向对比类（不碰认证/评分/统计数字宣称红线），供质量闸+真实性闸+人工评审
  //    继续把关；仍只生成草稿，发布永远人工。
  {
    key: "hotel-amenity-fragrance-sourcing-guide",
    keyword: "hotel amenity fragrance supplier",
    category: "sourcing",
    angle:
      "酒店/SPA 客用品香氛采购指南：香型一致性、小批量定制、补货周期、与洗护线配套，帮酒店集团选稳定供应商。",
  },
  {
    key: "spa-retail-private-label-fragrance-line",
    keyword: "spa private label fragrance line",
    category: "sourcing",
    angle:
      "SPA/零售自有品牌香氛线从 0 到 1：选品结构、起订量梯度、包装与标签、上市节奏的决策顺序。",
  },
  {
    key: "fragrance-oil-stability-and-shelf-life-testing",
    keyword: "fragrance oil stability shelf life testing",
    category: "product-knowledge",
    angle:
      "香精/精油稳定性与保质期：加速老化、光照与温度影响、如何向工厂索取稳定性数据与留样记录。",
  },
  {
    key: "oem-sample-to-mass-production-consistency",
    keyword: "OEM sample mass production consistency",
    category: "product-knowledge",
    angle: "从样品到量产的一致性控制：批次色差/香差、QC 节点、留样与复检，买家如何验收不踩坑。",
  },
  {
    key: "fragrance-tds-coa-documents-buyers-should-request",
    keyword: "fragrance TDS COA documents request",
    category: "compliance",
    angle:
      "采购前应向工厂索取的技术文件清单：TDS/COA/MSDS/IFRA 声明/过敏原清单各自的作用与核对方法。",
  },
  {
    key: "home-fragrance-market-entry-small-batch-cost",
    keyword: "home fragrance market entry small batch cost",
    category: "cost-breakdown",
    angle: "小批量试水家居香氛市场的成本结构：首批 MOQ、包装摊薄、物流与关税，如何控制试错成本。",
  },
  {
    key: "candle-fragrance-load-cold-hot-throw",
    keyword: "candle fragrance load cold hot throw",
    category: "Candles",
    collection: "guides",
    angle: "蜡烛加香比例与冷/热香表现：负载上限、蜡种匹配、燃烧测试怎么看，帮买家定稳定配方。",
  },
  {
    key: "reed-diffuser-oil-viscosity-and-reed-count",
    keyword: "reed diffuser oil viscosity reed count",
    category: "Diffusers",
    collection: "guides",
    angle: "扩香液粘度与藤条数量匹配：挥发速度、堵藤成因、翻转维护，按空间大小定制组合。",
  },
  {
    key: "essential-oil-storage-and-handling-for-buyers",
    keyword: "essential oil storage handling wholesale",
    category: "Essential Oils",
    collection: "guides",
    angle: "精油仓储与运输注意事项：避光/温控/密封/分批，到货验收与留样，降低损耗与变质风险。",
  },
  {
    key: "fragrance-allergen-labeling-basics",
    keyword: "fragrance allergen labeling requirements",
    category: "Fragrance Oils",
    collection: "guides",
    angle: "香精过敏原标识基础：EU/US 标签要求差异、过敏原清单怎么读、如何向工厂索取过敏原声明。",
  },
  {
    key: "candle-wick-selection-and-burn-testing",
    keyword: "candle wick selection burn testing",
    category: "Candles",
    collection: "guides",
    angle: "烛芯选型与燃烧测试：芯材/芯径与蜡种容器匹配、tunneling 与 soot 成因、测试记录怎么看。",
  },
  {
    key: "sustainable-fragrance-packaging-options",
    keyword: "sustainable fragrance packaging options",
    category: "Packaging & Design",
    collection: "guides",
    angle: "香氛包装的可持续选项：可回收玻璃/纸基/refill 结构的取舍与成本影响，按目标市场选方案。",
  },
];

// content_writer 角色系统提示词（内联，避免依赖 ai_roles 表已 seed）。
// 只产出 src/content/config.ts 的 blog collection 已存在字段（见 CONTENT_SCHEMA §10.4），
// 不生成模板读不到的字段，避免脏 frontmatter 构建失败。
const CONTENT_WRITER_PROMPT = `You are Aromiso's B2B content writer. Aromiso (aromiso.com) is a Chinese fragrance & essential-oil FACTORY serving international B2B buyers (hotels, spas, retailers, brand owners, wholesalers). North Star: generate more and better inquiries. Trust over feature-listing.

HARD RULES:
- NEVER fabricate statistics, ratings, reviews, certifications, or numeric claims. If you cannot substantiate a number, omit it. This is a compliance red line.
- Write for international B2B buyers in professional, plain English.
- The DISPLAY title (field "title") MUST be clean and human, <= 60 chars, NO keyword stuffing, NO repeated words.
- The "seoTitle" (<= 60 chars) and "seoDescription" (120-160 chars) MAY include the target keyword naturally.
- Body MUST be Markdown, 900-1400 words, with at least 3 "## " section headings, buyer-focused, actionable (checklists, what-to-ask-the-factory, avoid-these-pitfalls). Be concise — do NOT pad to hit a word count.
- Body MUST include AT LEAST 2 internal links using relative Markdown links to Aromiso pages, e.g. [our ready-to-ship catalog](/en/shop) or [buyer guides](/en/resources). Use only paths under /en/ (shop, resources, solutions, export). Do NOT invent product URLs.
- Provide a short "faq" of 2-4 buyer-focused Q&A. FAQ answers must NOT fabricate numbers or claims — keep them factual and general.
- "relatedProducts" / "relatedGuides" are OPTIONAL slug hints (lowercase-hyphen). The site validates them against real entries at build time and silently drops unknowns, so leaving them empty is fine — NEVER invent fake-looking keys just to fill the arrays.
- Do NOT include images. Do NOT include a code block. Do NOT include front-matter. Output ONLY the JSON object.

Return STRICT JSON with exactly these fields:
{
  "title": string,          // display H1, clean, <=60
  "excerpt": string,        // <=160, list-card summary
  "seoTitle": string,       // <=60
  "seoDescription": string, // 120-160
  "category": string,       // use the provided category
  "tags": string[],         // <=6 short tags
  "keywords": string[],     // 3-6 SEO keywords incl. the target keyword
  "faq": { "q": string, "a": string }[], // 2-4 buyer Q&A, no fabricated numbers
  "relatedProducts": string[], // 0-4 product slug hints (may be empty)
  "relatedGuides": string[],   // 0-3 guide slug hints (may be empty)
  "body": string            // Markdown article, 900-1800 words
}`;

interface WriterJson {
  title?: string;
  excerpt?: string;
  seoTitle?: string;
  seoDescription?: string;
  category?: string;
  tags?: string[];
  keywords?: string[];
  faq?: { q?: string; a?: string }[];
  relatedProducts?: string[];
  relatedGuides?: string[];
  body?: string;
}

// ---- 本地 frontmatter 序列化（对齐 save.ts 语义）--------------------------
function yamlVal(v: unknown): string {
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return "[" + v.map(yamlVal).join(", ") + "]";
  // Plain object → YAML flow mapping (e.g. faq items {q, a}). Recurse on values.
  if (v !== null && typeof v === "object") {
    const parts = Object.entries(v as Record<string, unknown>).map(
      ([k, val]) => `${k}: ${yamlVal(val)}`,
    );
    return "{ " + parts.join(", ") + " }";
  }
  const s = String(v ?? "");
  if (s === "" || /[:#[\]{}"',&*?|<>=!%@`\n]/.test(s) || /^\s|\s$/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}

function buildMarkdown(
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

const VALID_LOCALES: Locale[] = ["en", "es", "de"];

async function handle(
  env: Env,
  request: Request,
  isCron: boolean,
  preBody?: Record<string, unknown>,
): Promise<Response> {
  const db = env.DB;
  if (!db) return json({ error: "Database unavailable" }, 500);

  // cron 触发受 CONTENT_FACTORY_LIVE 约束；人工触发始终放行。
  // V5.66：也接受 site_settings 键 content_factory_live=on（owner 可在设置页开关，
  // 无需动 Cloudflare 环境变量）；环境变量为显式覆盖优先。
  let factoryLive = (env.CONTENT_FACTORY_LIVE || "").toLowerCase() === "on";
  if (!factoryLive) {
    try {
      const row = await db
        .prepare("SELECT value FROM site_settings WHERE key = 'content_factory_live'")
        .first<{ value: string }>();
      if ((row?.value || "").toLowerCase() === "on") factoryLive = true;
    } catch {
      /* 读取失败保持关闭 */
    }
  }
  if (isCron && !factoryLive) {
    return json({
      ok: true,
      skipped: true,
      reason:
        "auto-generate 定时档未开启（CONTENT_FACTORY_LIVE / 设置页开关 ≠ on）；人工可手动触发",
    });
  }

  // 预算硬闸：耗尽则不生成。
  const level = await getBudgetLevel(db);
  if (level >= 3) {
    return json({ ok: true, skipped: true, reason: "本月 AI 预算已达上限，暂停生成" });
  }

  let body: {
    topic?: PilotTopic;
    key?: string;
    locale?: string;
    limit?: number;
    dryRun?: boolean;
  } = {};
  try {
    // 异步档（waitUntil）下响应已返回、request body 流可能不可再读 → 用预解析的 preBody。
    body = (preBody ?? (await request.json())) as typeof body;
  } catch {
    body = {};
  }

  const locale = (VALID_LOCALES as string[]).includes(body.locale || "")
    ? (body.locale as Locale)
    : "en";
  const dryRun = !!body.dryRun;
  // V5.69 无人值守自动发布开关：site_settings.content_auto_publish=on（或 env 显式覆盖）。
  // 默认关 → 回落既有「草稿 + L2 人工评审」路径；Owner 验收后一键开闸，可随时关回。
  let autoPublishOn = (env.CONTENT_AUTO_PUBLISH || "").toLowerCase() === "on";
  if (!autoPublishOn) {
    try {
      const apRow = await db
        .prepare("SELECT value FROM site_settings WHERE key = 'content_auto_publish'")
        .first<{ value: string }>();
      if ((apRow?.value || "").toLowerCase() === "on") autoPublishOn = true;
    } catch {
      /* 读取失败保持关闭（保守） */
    }
  }
  // 自动发布开启时单轮上限放宽到每日额度（10=成功发布上限）；否则维持观察期 3。
  const limit = Math.max(
    1,
    Math.min(autoPublishOn ? MAX_AUTO_PUBLISH_PER_DAY : 3, Number(body.limit) || 1),
  );
  const today = new Date().toISOString().slice(0, 10);

  // 选题：优先 body.topic（自定义），否则从 PILOT_TOPICS 取「尚无草稿/未发布」的前 N 个。
  const candidates: PilotTopic[] = [];
  if (body.topic && body.topic.key && /^[a-z0-9-]+$/.test(body.topic.key)) {
    candidates.push({
      key: body.topic.key,
      keyword: body.topic.keyword || body.topic.key,
      category: body.topic.category || "Insights",
      angle: body.topic.angle || "",
      collection: body.topic.collection === "guides" ? "guides" : "blog",
    });
  } else {
    for (const t of PILOT_TOPICS) {
      if (candidates.length >= limit) break;
      const col = t.collection || "blog";
      // 跳过已发布（GitHub 有文件）或已有草稿（KV）的选题，避免覆盖。
      // V5.56：GitHub 查询失败 ≠ 未发布 —— error 时跳过该选题（fail-safe），
      // 绝不因查询失败误判为「未发布」而重新生成（防重复/覆盖）。
      const path = `src/content/${col}/${t.key}.${locale}.md`;
      const chk = await ghGetChecked(path, env);
      if (chk.state === "found") continue; // 已发布
      if (chk.state === "error") continue; // 查询失败 → 跳过（宁可漏，不重复）
      const draft = await getDraft(env, col, t.key, locale);
      if (draft) continue;
      candidates.push(t);
    }
  }

  if (candidates.length === 0) {
    // V5.69：选题池耗尽导致每日 0 产出，此前被 workflow 的 `|| echo non-fatal` 吞成
    // "success"，owner 完全看不见工厂在空转。现对 cron 档发一条 warn 告警（sendAlert
    // 自带 24h 冷却去重、永不阻断），让「空转」可见；人工手动触发不告警（避免探针噪音）。
    if (isCron) {
      await sendAlert(env, {
        level: "warn",
        code: "content_factory_starved",
        title: "内容工厂今日 0 产出：选题池已耗尽（均已有草稿/已发布）",
        lines: [
          "PILOT_TOPICS 中所有选题都已有 KV 草稿或已发布，本日无新选题可写",
          "这不是故障：鉴权/闸门/预算均正常，只是没有新选题",
          "处理：在 content-generate.ts 扩充 PILOT_TOPICS（流程/科普/对比类安全选题），或人工发布已评审草稿",
          "提醒：本自动化只生成草稿进 L2 人工评审，发布永远人工（安全红线，无 auto-publish）",
        ],
        needHuman: false,
      });
    }
    await recordFactoryEvent(db, "content_factory:run:STARVED", {
      content_id: `run:${today}:${Date.now()}`,
      topic: "run",
      status: "STARVED",
      generated: 0,
      published: 0,
      verified: 0,
      rejected: 0,
      failed: 0,
    });
    return json({
      ok: true,
      status: "STARVED" as FactoryStatus,
      auto_publish: autoPublishOn,
      generated: 0,
      queued: 0,
      published: 0,
      verified: 0,
      remaining_quota: MAX_AUTO_PUBLISH_PER_DAY - (await publishedTodayCount(db)),
      reason: "无可生成的新选题（均已有草稿/已发布）",
    });
  }

  const queued: { key: string; score: number }[] = [];
  const rejected: { key: string; score: number; reasons: string[] }[] = [];
  const failed: { key: string; reason: string }[] = [];
  // V5.69 无人值守计数（业务状态机 + 监控用）
  let publishedCount = 0;
  let gateRejected = 0;
  let failedCount = 0;
  let quotaReached = false;
  const publishedItems: { key: string; score: number }[] = [];

  // Model Router：默认关 → deepseek-v4-pro（与升级前行为一致）。
  const writerModel = await resolveModelForTask(env, "content_writer");

  for (const topic of candidates.slice(0, limit)) {
    const col = topic.collection || "blog";
    const idemKey = `content-gen:${topic.key}:${locale}:${today}`;
    const run = await beginRun(db, idemKey);
    if (run.skip) {
      failed.push({ key: topic.key, reason: "今日已生成过（幂等跳过）" });
      continue;
    }

    try {
      const userContent = `Target keyword: ${topic.keyword}
Category (use verbatim in "category"): ${topic.category}
Angle / brief: ${topic.angle}
Language: ${locale}
Write the article now as strict JSON.`;

      const raw = await aiJson<WriterJson>(
        env,
        db,
        [
          { role: "system", content: CONTENT_WRITER_PROMPT },
          { role: "user", content: userContent },
        ],
        { role: "content_writer", model: writerModel, max_tokens: 7000, temperature: 0.6 },
      );

      if (!raw || !raw.title || !raw.body) {
        await finishRun(db, idemKey, "failed", "AI 无有效产出");
        failed.push({ key: topic.key, reason: "AI 无有效产出" });
        continue;
      }

      // D4 富字段归一化：faq 只留 q/a 齐全项，related 只留合法 slug（模板构建期再校验存在性）。
      const faqItems = (Array.isArray(raw.faq) ? raw.faq : [])
        .map((f) => ({ q: String(f?.q || "").trim(), a: String(f?.a || "").trim() }))
        .filter((f) => f.q.length > 0 && f.a.length > 0)
        .slice(0, 4);
      const cleanSlugs = (arr: unknown, max: number): string[] =>
        (Array.isArray(arr) ? arr : [])
          .map((s) =>
            String(s || "")
              .trim()
              .toLowerCase(),
          )
          .filter((s) => /^[a-z0-9-]+$/.test(s))
          .slice(0, max);
      const relatedProducts = cleanSlugs(raw.relatedProducts, 4);
      const relatedGuides = cleanSlugs(raw.relatedGuides, 3);

      const draft: ContentDraft = {
        title: raw.title,
        excerpt: raw.excerpt,
        category: raw.category || topic.category,
        body: raw.body,
        tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 6) : [],
        keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
        seoTitle: raw.seoTitle,
        seoDescription: raw.seoDescription,
        _meta: {
          agent: "content_writer",
          model: writerModel,
          generated_at: today,
          idempotency_key: idemKey,
        },
      };

      const quality: QualityResult = scoreDraft(draft);

      // 质量闸：不达标绝不入队。记录一次尝试（success 幂等，当日不重试烧预算）。
      if (!quality.pass) {
        await finishRun(db, idemKey, "success", `低于质量闸 ${quality.score}/100`);
        rejected.push({ key: topic.key, score: quality.score, reasons: quality.reasons });
        continue;
      }

      // 真实性闸（Runtime Policy）：红线命中绝不入队——质量达标 ≠ 事实达标。
      // blocked 一律拦下（同样 success 幂等，不重试烧预算）；warnings 不拦，随 REVIEW 交人工。
      const truth = checkContentDraft(draft);
      if (!truth.pass) {
        await finishRun(
          db,
          idemKey,
          "success",
          `真实性闸拦截 ${truth.blocked.length} 项红线（${truth.blocked
            .map((b) => b.rule)
            .join("/")}）`,
        );
        rejected.push({
          key: topic.key,
          score: quality.score,
          reasons: truth.blocked.map((b) => `[真实性] ${b.rule}：${b.note}`),
        });
        // ---- V5.4：真实性红线 🔴 高危告警（KV 冷却去重，失败不阻断） ----
        await sendAlert(env, {
          level: "critical",
          code: "truthfulness:content_factory",
          title: "内容工厂草稿触发真实性红线",
          lines: [
            `选题：${topic.key}（${locale} / ${col}）`,
            `命中红线：${truth.blocked.map((b) => b.rule).join("、")}`,
            "该草稿已被阻止入队，生产环境安全，无需人工处理。",
          ],
          needHuman: false,
        });
        continue;
      }

      if (dryRun) {
        await finishRun(db, idemKey, "failed", "dryRun：未落库");
        queued.push({ key: topic.key, score: quality.score });
        continue;
      }

      // ---- 落库：KV 草稿（绝无 ghPut）----
      // draft:true 兜底——即便日后误发布，前台也不会展示未定稿内容。
      const fm: Record<string, unknown> = {
        title: draft.title,
        excerpt: draft.excerpt,
        category: draft.category,
        pubDate: today,
        author: "Aromiso Team",
        draft: true,
        tags: draft.tags,
        keywords: draft.keywords,
        seoTitle: draft.seoTitle,
        seoDescription: draft.seoDescription,
        // D4 富字段（可选/有默认，空数组由 buildMarkdown 跳过，不污染 frontmatter）。
        faq: faqItems,
        relatedProducts,
        relatedGuides,
      };
      if (col === "guides") {
        // guides schema 用 order 手动排序，无 featured/relatedPosts。
        fm.order = 0;
      } else {
        // blog schema 支持 relatedPosts 站内博文互链。
        fm.relatedPosts = [];
      }

      // ── V5.69 无人值守：Gates(Fact+Quality) 已过 → Safety → Governance Reviewer → AutoPublish ──
      // 仅当自动发布开关开启且非 dryRun。approve 且额度内才 ghPut(draft:false) 真发布；
      // reject→记拒绝不发布；escalate/审核不可用→回落下方既有 KV 草稿 + L2 人工队列
      // （异常才找 Owner）。安全闸门优先于数量：任何不确定宁可不发。
      if (autoPublishOn && !dryRun) {
        const safety = safetyGateDraft(draft);
        if (!safety.pass) {
          gateRejected++;
          rejected.push({
            key: topic.key,
            score: quality.score,
            reasons: safety.reasons.map((r) => `[安全闸] ${r}`),
          });
          await recordFactoryEvent(db, "content_factory:rejected", {
            content_id: `${col}:${topic.key}:${locale}`,
            topic: topic.key,
            collection: col,
            key: topic.key,
            locale,
            safety_result: `blocked:${safety.reasons.join("/")}`,
            review_decision: "not_reached",
            publish_result: "not_published",
            failure_reason: `safety gate: ${safety.reasons.join("/")}`,
          });
          await finishRun(db, idemKey, "success", `安全闸拦截：${safety.reasons.join("/")}`);
          continue;
        }
        const quotaUsed = await publishedTodayCount(db);
        if (quotaUsed >= MAX_AUTO_PUBLISH_PER_DAY) {
          quotaReached = true;
          await finishRun(
            db,
            idemKey,
            "success",
            `当日自动发布额度已满(${quotaUsed}/${MAX_AUTO_PUBLISH_PER_DAY})，停止生成`,
          );
          break; // 不再消耗预算
        }
        const review = await reviewGovernance(env, db, {
          action_type: "content_auto_publish",
          subject: `${col}:${topic.key}:${locale}`,
          summary: `自动发布${col === "guides" ? "指南" : "博客"}「${topic.key}」(${locale})`,
          evidence: {
            quality_score: quality.score,
            quality_pass: quality.pass,
            fact_pass: truth.pass,
            fact_blocked_count: truth.blocked.length,
            fact_warnings: truth.warnings.length,
            safety_pass: safety.pass,
            safety_gate: safety.pass ? "pass (code-enforced prohibited-claim scan)" : "blocked",
            budget_level: level,
            budget_ok: level < 3,
            quota_remaining: MAX_AUTO_PUBLISH_PER_DAY - quotaUsed,
            gates_note:
              "Fact/Quality/Safety are code gates already passed BEFORE this review; the reviewer is a second-layer judgment on top, not a replacement.",
          },
        });
        if (review.decision === "approve") {
          const contentId = `${col}:${topic.key}:${locale}`;
          const pubOk = await autoPublishContent(env, {
            collection: col,
            key: topic.key,
            locale,
            fm,
            body: draft.body || "",
          });
          if (pubOk) {
            publishedCount++;
            publishedItems.push({ key: topic.key, score: quality.score });
            await recordFactoryEvent(db, "content_factory:published", {
              content_id: contentId,
              topic: topic.key,
              collection: col,
              key: topic.key,
              locale,
              generated_at: today,
              fact_result: `pass(warnings=${truth.warnings.length})`,
              quality_result: `pass:${quality.score}`,
              safety_result: "pass",
              review_decision: "approve",
              publish_result: "ok",
              verify_result: "pending",
              failure_reason: "",
              published_at: new Date().toISOString(),
              url: contentUrl(locale, col, topic.key),
              gh_path: contentPath(col, topic.key, locale),
            });
            await finishRun(
              db,
              idemKey,
              "success",
              `自动发布成功(质量${quality.score}/100, review=approve)，待 Verify`,
            );
            continue; // 已发布，不再建人工评审任务
          }
          // 发布失败：绝不计入成功；记失败 + 高危告警（不静默）。
          failedCount++;
          failed.push({ key: topic.key, reason: "auto-publish ghPut not-ok" });
          await recordFactoryEvent(db, "content_factory:publish_failed", {
            content_id: contentId,
            topic: topic.key,
            collection: col,
            key: topic.key,
            locale,
            generated_at: today,
            fact_result: "pass",
            quality_result: `pass:${quality.score}`,
            safety_result: "pass",
            review_decision: "approve",
            publish_result: "failed",
            verify_result: "pending",
            failure_reason: "ghPut returned not-ok (GitHub write failed)",
            published_at: "",
            url: contentUrl(locale, col, topic.key),
            gh_path: contentPath(col, topic.key, locale),
          });
          await sendAlert(env, {
            level: "critical",
            code: "content_factory_publish_failed",
            title: `内容工厂自动发布失败：${topic.key}`,
            lines: [
              `ghPut 返回 not-ok（GitHub 写失败），未计入成功发布`,
              `选题：${topic.key}（${locale}/${col}），质量 ${quality.score}/100，review=approve`,
              `将于下次运行重试；若连续失败请检查 ADMIN_GITHUB_TOKEN / 仓库写权限`,
            ],
            needHuman: false,
          });
          await finishRun(db, idemKey, "failed", "auto-publish ghPut not-ok");
          continue;
        }
        if (review.decision === "reject") {
          gateRejected++;
          rejected.push({
            key: topic.key,
            score: quality.score,
            reasons: review.reasons.map((r) => `[治理审核] ${r}`),
          });
          await recordFactoryEvent(db, "content_factory:rejected", {
            content_id: `${col}:${topic.key}:${locale}`,
            topic: topic.key,
            collection: col,
            key: topic.key,
            locale,
            fact_result: `pass(warnings=${truth.warnings.length})`,
            quality_result: `pass:${quality.score}`,
            safety_result: "pass",
            review_decision: "reject",
            publish_result: "not_published",
            failure_reason: review.reasons.join("; ").slice(0, 300),
          });
          await finishRun(
            db,
            idemKey,
            "success",
            `治理审核 reject：${review.reasons.join(";").slice(0, 120)}`,
          );
          continue;
        }
        // escalate（含审核不可用 fail-closed）→ 不自动发布，回落下方人工队列。
      }

      const fullMd = buildMarkdown(topic.key, locale, fm, draft.body || "");
      // S22：草稿未真正写入 → 绝不能建「指向不存在草稿」的评审任务。
      // 抛错走既有 per-topic 失败路径（finishRun failed + failed[]），让失败可见。
      const draftSaved = await saveDraft(env, col, topic.key, locale, fullMd);
      if (!draftSaved) {
        throw new Error("draft save failed (KV unavailable) — review task NOT created");
      }

      // ---- 建 L2 REVIEW 任务（评审队列项，非发布动作）----
      const taskType = "content_generate";
      const enforced = enforceMode(taskType); // 代码层裁定 = L2
      const payload = JSON.stringify({
        collection: col,
        key: topic.key,
        locale,
        draft_key: `draft:${col}:${topic.key}:${locale}`,
        target_keyword: topic.keyword,
        quality_score: quality.score,
        quality_dimensions: quality.dimensions.map((d) => ({
          label: d.label,
          score: d.score,
          max: d.max,
        })),
        // 真实性闸结果：warnings 不拦草稿，但评审时必须看到（Fact Authority Layer）。
        truthfulness_pass: truth.pass,
        truthfulness_warnings: truth.warnings.map((w) => ({
          rule: w.rule,
          field: w.field || "",
          note: w.note,
          match: w.match,
        })),
        truthfulness_report: formatTruthfulnessReport(truth),
        faq_count: faqItems.length,
        related_products: relatedProducts,
        related_guides: relatedGuides,
        confidence: quality.score,
        agent: "content_writer",
        model: writerModel,
      });
      const taskIdem = `task:content_generate:${topic.key}:${locale}:${today}`.slice(0, 180);
      const colLabel = col === "guides" ? "指南" : "博客";
      await db
        .prepare(
          `INSERT INTO tasks (title, detail, roi_score, impact, difficulty, business_reason, knowledge_refs, priority, expected_result, status, created_at,
                              task_type, executor, execution_mode, idempotency_key, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          `内容草稿待审（Draft for review）：${draft.title}`,
          `内容工厂生成${colLabel}草稿「${topic.key}」(${locale})，质量分 ${quality.score}/100${truth.warnings.length ? `，真实性注意项 ${truth.warnings.length} 条（见 payload truthfulness_report）` : "，真实性闸全过"}，待人工评审后在 CMS 发布。`,
          quality.score,
          3,
          2,
          `围绕关键词「${topic.keyword}」补内容、服务询盘转化；草稿已过 ${quality.score}/100 质量闸。`,
          "[]",
          "P2",
          "人工在 CMS 评审草稿 → 满意则点发布（save.ts ghPut）上线；不满意则退回/丢弃。",
          Math.floor(Date.now() / 1000),
          taskType,
          "content_review",
          enforced,
          taskIdem,
          payload,
        )
        .run();

      await finishRun(
        db,
        idemKey,
        "success",
        `草稿入队，质量分 ${quality.score}/100，真实性注意项 ${truth.warnings.length} 条`,
      );
      queued.push({ key: topic.key, score: quality.score });
    } catch (e) {
      await finishRun(db, idemKey, "failed", String(e).slice(0, 300));
      failed.push({ key: topic.key, reason: String(e).slice(0, 200) });
    }
  }

  // ---- V5.69 Verify：对近 2 天「已发布待验」的内容跨 run 复核（Pages 重建需时间）----
  // 全过（GitHub 文件 draft:false + 前台 URL 200 + sitemap 收录）才记 verified 计入成功；
  // 明确失败或超 90min 仍不过 → verify_failed + 告警，绝不计入成功发布。
  let verifiedCount = 0;
  let verifyFailedCount = 0;
  try {
    const pend = await db
      .prepare(
        `SELECT resource_id, after_snippet, created_at FROM audit_logs
         WHERE resource_type = 'content_factory' AND change_summary = 'content_factory:published'
           AND created_at >= datetime('now', '-2 days')
         ORDER BY created_at DESC LIMIT 12`,
      )
      .all<{ resource_id: string; after_snippet: string; created_at: string }>();
    for (const row of pend.results || []) {
      const term = await db
        .prepare(
          `SELECT COUNT(*) AS c FROM audit_logs
           WHERE resource_type = 'content_factory' AND resource_id = ?
             AND change_summary IN ('content_factory:verified', 'content_factory:verify_failed')`,
        )
        .bind(row.resource_id)
        .first<{ c: number }>();
      if (Number(term?.c || 0) > 0) continue; // 已有终态，不重复验
      let rec: Record<string, unknown>;
      try {
        rec = JSON.parse(row.after_snippet || "{}") as Record<string, unknown>;
      } catch {
        continue;
      }
      const ageMin =
        (Date.now() - Date.parse(String(row.created_at || "").replace(" ", "T") + "Z")) / 60000;
      const v = await verifyPublishedContent(env, {
        gh_path: String(rec.gh_path || ""),
        url: String(rec.url || ""),
        collection: String(rec.collection || "blog"),
      });
      if (v.result === "pass") {
        verifiedCount++;
        await recordFactoryEvent(db, "content_factory:verified", {
          ...(rec as object),
          content_id: row.resource_id,
          verify_result: "pass",
          failure_reason: "",
        });
      } else if (v.result === "fail" || ageMin > 90) {
        verifyFailedCount++;
        await recordFactoryEvent(db, "content_factory:verify_failed", {
          ...(rec as object),
          content_id: row.resource_id,
          verify_result: "fail",
          failure_reason: v.detail,
        });
        await sendAlert(env, {
          level: "critical",
          code: "content_factory_verify_failed",
          title: `内容工厂 Verify 失败：${row.resource_id}`,
          lines: [
            `已 ghPut 但验证未过：${v.detail}`,
            `不计入成功发布；请检查 Pages 重建 / 文件 draft 状态 / sitemap`,
          ],
          needHuman: false,
        });
      }
      // pending（重建中）→ 不写终态，下次运行重试
    }
  } catch (e) {
    console.error("[content-generate] verify pass error (non-blocking):", e);
  }

  const status: FactoryStatus = computeFactoryStatus({
    published: publishedCount,
    verified: verifiedCount,
    verifyFailed: verifyFailedCount,
    rejected: rejected.length,
    failed: failed.length,
    generated: queued.length + rejected.length + publishedCount,
    queued: queued.length,
    starved: false, // 真 starved 已在上方提前返回 STARVED
  });

  // 连续异常告警：本轮 0 成功发布且非 starved（有候选却全失败/全拒绝）→ 提醒。
  if (isCron && publishedCount === 0 && verifiedCount === 0 && candidates.length > 0) {
    await sendAlert(env, {
      level: "warn",
      code: "content_factory_zero_publish",
      title: `内容工厂本轮 0 成功发布（status=${status}）`,
      lines: [
        `候选 ${candidates.length}，发布 ${publishedCount}，verified ${verifiedCount}，拒绝 ${rejected.length}，失败 ${failed.length}`,
        `status=${status}；escalate 项已回落人工评审队列`,
        `若连续多轮 0 发布，请检查 Governance Reviewer / 闸门 / GitHub 写权限`,
      ],
      needHuman: false,
    });
  }

  await recordFactoryEvent(db, `content_factory:run:${status}`, {
    content_id: `run:${today}:${Date.now()}`,
    topic: "run",
    status,
    generated: queued.length + rejected.length + publishedCount,
    published: publishedCount,
    verified: verifiedCount,
    rejected: rejected.length,
    failed: failed.length,
  });

  return json({
    ok: true,
    status,
    auto_publish: autoPublishOn,
    dryRun,
    generated: queued.length + rejected.length + publishedCount,
    queued: queued.length,
    queued_items: queued,
    published: publishedCount,
    published_items: publishedItems,
    verified: verifiedCount,
    verify_failed: verifyFailedCount,
    rejected,
    failed,
    quota_reached: quotaReached,
    remaining_quota: MAX_AUTO_PUBLISH_PER_DAY - (await publishedTodayCount(db)),
    note: autoPublishOn
      ? "无人值守：Gates(Fact/Quality/Safety)→Governance Reviewer→AutoPublish→Verify；每日成功发布上限10；escalate/reject 不发布并回落人工队列。"
      : "自动发布关闭：草稿入 KV + L2 REVIEW 队列，发布仍人工（site_settings.content_auto_publish=on 可开闸）。",
  });
}

export const onRequest: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // 认证：管理员 cookie（人工）或 Bearer CRON_SECRET（定时）。
  const auth = request.headers.get("Authorization") || "";
  const cronSecret = env.CRON_SECRET || "";
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  const isHuman = await isAuthed(request, env);

  if (!isCron && !isHuman) return json({ error: "Unauthorized" }, 401);

  // V5.69 异步档（?async=1，仅 cron）：整条 Creator→Gates→Reviewer→Publish→Verify 链路
  // 可能超过边缘 100s 同步超时（实测 524）。改为立即返回 ACCEPTED，把重活放进
  // waitUntil（响应返回后 worker 继续跑），由 workflow 轮询 factory-status 取最终业务状态。
  // 默认（无 async=1）保持同步，兼容人工触发与既有测试。
  const wantAsync = new URL(request.url).searchParams.get("async") === "1";
  if (wantAsync && isCron && typeof waitUntil === "function") {
    // 先解析 body（响应返回后 body 流不可再读），再交给 waitUntil 后台执行。
    let preBody: Record<string, unknown>;
    try {
      preBody = (await request.json()) as Record<string, unknown>;
    } catch {
      preBody = {};
    }
    waitUntil(
      handle(env, request, true, preBody).catch((e) => {
        console.error("[content-generate] async handle failed:", e);
      }),
    );
    return json({
      ok: true,
      status: "ACCEPTED",
      async: true,
      note: "已受理并在后台执行；最终业务状态请轮询 /api/admin/v2/content/factory-status 的 latest_run。",
    });
  }

  return handle(env, request, isCron && !isHuman);
};
