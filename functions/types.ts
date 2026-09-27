/// <reference types="@cloudflare/workers-types" />
// ---------------------------------------------------------------------------
//  Aromiso — Cloudflare Pages Functions shared types
//
//  Single source of truth for environment bindings & secrets. Every Pages
//  Function handler must be typed as `PagesFunction<Env>` (destructure
//  `{ request, env }` from the context) — no `any`.
//
//  Bindings live in wrangler.toml (DRAFTS / DB); secrets & vars live in the
//  Cloudflare dashboard (Settings → Variables and Secrets).
// ---------------------------------------------------------------------------

export interface Env {
  // ---- Bindings (wrangler.toml) ----
  /** KV namespace: CMS drafts + rate limiting + inquiry fallback storage. */
  DRAFTS?: KVNamespace;
  /** D1 database: inquiries + subscribers. */
  DB?: D1Database;
  /** R2 bucket: commerce product images. */
  IMAGES?: R2Bucket;
  /** R2 bucket: unified AI knowledge base (aromiso-kb, V5.30). */
  KB?: R2Bucket;

  // ---- Secrets / plain vars (Cloudflare dashboard) ----
  RESEND_API_KEY?: string;
  RESEND_TO?: string;
  RESEND_FROM?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_GITHUB_TOKEN?: string;
  ADMIN_GITHUB_REPO?: string;
  /** Cloudflare Turnstile secret key (server-side verification). Optional — when absent, Turnstile fails open. */
  TURNSTILE_SECRET_KEY?: string;

  // ---- V4: Google API (GSC + GA4 data pull) ----
  /** Service Account email for JWT auth (e.g. xxx@aromiso-dashboard.iam.gserviceaccount.com) */
  GSC_CLIENT_EMAIL?: string;
  /** Service Account private key (PEM, RS256). Store as Cloudflare Secret. */
  GSC_PRIVATE_KEY?: string;
  /** GSC property URL, e.g. sc-domain:aromiso.com */
  GSC_SITE_URL?: string;
  /** GA4 numeric Property ID (e.g. 511595717) */
  GA_PROPERTY_ID?: string;
  /** Shared secret for authenticating the cron-pull endpoint (GitHub Actions → Worker). */
  CRON_SECRET?: string;

  // ---- V4.2: DeepSeek AI ----
  /** DeepSeek API key for AI-powered recommendations and content assistance. */
  DEEPSEEK_API_KEY?: string;

  // ---- V5.1: SiliconFlow AI gateway ----
  /** SiliconFlow API key (OpenAI-compatible). Preferred provider when set. */
  SILICONFLOW_API_KEY?: string;

  // ---- V5.20: Task Engine ----
  /**
   * 内容修改型执行器（meta_fix / internal_link / translate_fill 等）的实弹开关。
   * 未设或非 "on" 时，这些执行器只做前后指标快照与意图记录、**不产生任何 GitHub
   * 写操作**（outcome=NO_EFFECT）。Phase 1 试点期默认关闭，与 AUTO_PUBLISH OFF
   * 纪律一致；观察达标后由运营在 CF 仪表板置 "on" 即可开闸，零代码改动。
   * 只读分析类（L1）不受此开关约束，始终可执行。
   */
  TASK_EXECUTOR_LIVE?: string;

  // ---- V5.21: Content Factory（内容工厂 · 两级自动化）----
  /**
   * 内容工厂「每日自动生成」的调度开关（auto-generate 的定时触发）。
   * 与 auto-publish 无关：生成器**只写 KV 草稿 + 建 L2 REVIEW 任务，绝不 ghPut**，
   * 因此草稿本身零风险。此开关只控制「是否让 cron 每天自动调用生成器」：
   *   未设或非 "on" → 生成器只能人工/管理端手动触发（观察期默认态，避免无人值守的每日 AI 消耗）；
   *   置 "on"       → 允许 os-pipeline 定时档每天生成草稿。
   * 无论开关如何，发布（上线到 aromiso.com）永远是人工在 CMS 点发布（save.ts ghPut），
   * 本开关不解锁任何发布能力。月度 AI 预算硬顶 MONTHLY_CAP_CNY(¥30) 仍然生效。
   */
  CONTENT_FACTORY_LIVE?: string;
  /**
   * V5.69 无人值守自动发布总开关（"on" 启用）。也可用 site_settings
   * content_auto_publish=on 开启（无需动环境变量）。仅当 Fact/Quality/Safety 闸
   * 全过 + Governance Reviewer approve + 当日额度未满时才真发布；否则回落人工队列。
   * 受 AUTO_APPROVE_SCOPE 代码白名单与每日成功发布上限(10)约束。
   */
  CONTENT_AUTO_PUBLISH?: string;
}

// ---- GitHub Contents API ---------------------------------------------------
// Subset of the response fields we actually consume.
export interface GhContentItem {
  name: string;
  path: string;
  sha: string;
  type: string;
  /** Base64 file content (present on single-file GETs). */
  content?: string;
  encoding?: string;
}

// ---- Request bodies --------------------------------------------------------
/** Parsed JSON body whose shape is validated field-by-field at runtime. */
export type JsonBody = Record<string, unknown>;
