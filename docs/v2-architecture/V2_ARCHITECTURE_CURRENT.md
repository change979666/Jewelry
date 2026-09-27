# V2 P0-1: 当前系统架构
## Current System Architecture

> 基于 CMS_AUDIT_MASTER.md / CMS_AUDIT_ADMIN_SPA.md / wrangler.toml / package.json / astro.config.mjs
> 日期：2026-08-24

---

## 1. 技术栈全景

```
┌─────────────────────────────────────────────────────────────┐
│                      用户浏览器                               │
│  aromiso.com  /  aromiso.com/admin  /  aromiso.com/admin/*   │
└───────────────┬─────────────────────────────────────────────┘
                │  HTTPS
                ▼
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare Pages (Edge)                     │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────────┐             │
│  │  Static Assets    │  │  Functions (Workers)  │             │
│  │  (Astro SSG)      │  │  /api/*               │             │
│  │  - HTML/CSS/JS    │  │  /functions/api/*     │             │
│  │  - Astro islands  │  │                        │             │
│  │  - R2 CDN images  │  │                        │             │
│  └──────────────────┘  └──────────┬─────────────┘             │
│                                    │                          │
└────────────────────────────────────┼──────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│  Cloudflare D1  │  │  Cloudflare KV  │  │  Cloudflare R2      │
│  (aromiso-db)   │  │  (aromiso-      │  │  (IMAGES bucket)    │
│  52 tables      │  │   drafts)       │  │  (KB bucket)        │
│  SQLite-compat  │  │  Content drafts │  │  Object storage     │
│  WAL mode       │  │  + GSC cache    │  │  Images/files/PDFs  │
└─────────────────┘  └─────────────────┘  └─────────────────────┘

              ┌──────────────────────┬──────────────────────────┐
              │                      │                          │
              ▼                      ▼                          ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│  GitHub API     │  │  DeepSeek API   │  │  External APIs       │
│  (Contents API) │  │  (Chat Comp.)   │  │  - GSC API           │
│  Content MD     │  │  AI generation  │  │  - GA4 API           │
│  files as       │  │  + translation  │  │  - Resend (email)    │
│  source-of-truth│  │  + analysis     │  │  - Google Shopping   │
└─────────────────┘  └─────────────────┘  └─────────────────────┘
```

---

## 2. 运行时拓扑

```
User Browser
    │
    │ HTTPS (aromiso.com)
    ▼
Cloudflare Edge
    │
    ├── Static route (/*)
    │   └── _astro/ + _image/ + HTML + JS bundles
    │       Served from CF Pages asset manifest
    │
    └── Function route (/api/*, /functions/*)
        │
        ├── /api/admin/* ─── Functions (Node.js compat)
        │   │                 running on CF Workers runtime
        │   │                 (10s execution limit, 128MB memory)
        │   │
        │   ├── D1 binding: DB (aromiso-db)
        │   │   └── SQLite-compat queries via D1 client
        │   │
        │   ├── KV binding: AROMISO_DRAFTS (aromiso-drafts)
        │   │   └── Key-value read/write/list
        │   │
        │   ├── R2 binding: IMAGES, KB
        │   │   └── Object put/get/delete
        │   │
        │   ├── fetch() ─── GitHub API (api.github.com)
        │   │   └── Contents API: read/write MD files
        │   │       Auth: ADMIN_GITHUB_TOKEN (PAT)
        │   │
        │   ├── fetch() ─── DeepSeek API (api.deepseek.com)
        │   │   └── Chat completions for AI roles
        │   │       Auth: DEEPSEEK_API_KEY
        │   │
        │   ├── fetch() ─── GSC API (searchconsole.googleapis.com)
        │   │   └── Search analytics data
        │   │
        │   ├── fetch() ─── GA4 API (analyticsdata.googleapis.com)
        │   │   └── Analytics data
        │   │
        │   └── fetch() ─── Resend API (api.resend.com)
        │       └── Email sending
        │
        └── /api/public/* ─── Public endpoints (inquiries, etc.)
            │
            ├── Turnstile verification
            ├── KV blacklist check
            ├── Rate limiting
            └── D1 write (inquiries, subscriptions)
```

---

## 3. 数据流图

### 3.1 内容流（Content Flow）

```
┌──────────────────────────────────────────────────────────┐
│                     CONTENT LIFECYCLE                      │
│                                                            │
│  1. CREATE/EDIT                                             │
│     Browser ──POST──▶ /api/admin/save                      │
│                         │                                   │
│                         ├─ Validate YAML frontmatter        │
│                         ├─ Write KV draft (aromiso-drafts)  │
│                         └─ Return preview                   │
│                                                            │
│  2. PUBLISH                                                 │
│     Browser ──POST──▶ /api/admin/save (with publish flag)  │
│                         │                                   │
│                         ├─ Generate MD (frontmatter+body)   │
│                         ├─ GitHub API: PUT file to repo     │
│                         │   path: src/content/<collection>/ │
│                         ├─ Delete KV draft                  │
│                         └─ Return commit SHA               │
│                              │                              │
│  3. BUILD & DEPLOY                                          │
│     GitHub push ──▶ CF Pages auto-deploy hook              │
│                      │                                      │
│                      ├─ Astro build (SSG)                   │
│                      ├─ Content Collections re-indexed      │
│                      ├─ New static pages generated          │
│                      └─ Deploy to CF Edge (~1-2 min)        │
│                                                            │
│  4. READ (live site)                                        │
│     Browser ──GET──▶ CF Pages static HTML                  │
│                      (Astro Content Collections)            │
│                                                            │
│  5. READ (admin preview)                                    │
│     Browser ──GET──▶ /api/admin/load?collection=&key=      │
│                      ├─ Read KV draft (if exists)           │
│                      └─ Read GitHub MD (if published)        │
└──────────────────────────────────────────────────────────┘
```

### 3.2 商品流（Commerce Flow）

```
┌──────────────────────────────────────────────────────────┐
│                   COMMERCE LIFECYCLE                       │
│                                                            │
│  1. IMPORT (1688)                                           │
│     Browser ──POST──▶ /api/admin/commerce/import           │
│                         ├─ Parse ZIP (images + data)        │
│                         ├─ Upload images to R2 IMAGES       │
│                         ├─ Write D1: commerce_products      │
│                         └─ Return report                    │
│                                                            │
│  2. MANAGE                                                  │
│     Browser ──GET──▶  /api/admin/commerce/products         │
│                      └─ Read D1: commerce_products          │
│               ──PUT──▶ /api/admin/commerce/products/:id    │
│                      └─ Write D1: commerce_products         │
│                                                            │
│  3. ORDERS                                                  │
│     Public ──POST──▶ /api/public/order                     │
│                      └─ Write D1: commerce_orders           │
│     Admin  ──GET──▶  /api/admin/commerce/orders            │
│                      └─ Read D1: commerce_orders            │
│                                                            │
│  4. DISPLAY (public)                                        │
│     Browser ──GET──▶ CF Pages static HTML                  │
│                      (Astro fetches during build:           │
│                       D1 → generate product pages)          │
└──────────────────────────────────────────────────────────┘
```

### 3.3 视频流（Video Flow）

```
┌──────────────────────────────────────────────────────────┐
│                    VIDEO PIPELINE                          │
│  (5-step workflow, best-designed module in current CMS)    │
│                                                            │
│  Step 1: MEDIA                                              │
│     Upload video → R2 KB                                  │
│     Store metadata → D1: video_media                       │
│                                                            │
│  Step 2: CONTENT                                            │
│     Edit title/description/tags                           │
│     Store → D1: video_content                             │
│                                                            │
│  Step 3: LANGUAGE                                           │
│     AI translate → EN/ES/DE versions                      │
│     Store → D1: video_translations                        │
│                                                            │
│  Step 4: AI DRAFT                                           │
│     AI generates SEO content/tags                         │
│     Store → D1: video_ai_drafts                           │
│     Human review required → editorial gate                │
│                                                            │
│  Step 5: PUBLISH                                            │
│     Per-language publish toggle                           │
│     Store → D1: video_publish_status                      │
│     Output to site via Astro build                         │
│                                                            │
│  DB Tables involved:                                        │
│     video_media, video_content, video_translations,         │
│     video_ai_drafts, video_publish_status,                  │
│     video_products (关联商品), video_seo                    │
└──────────────────────────────────────────────────────────┘
```

### 3.4 AI 流（AI Flow）

```
┌──────────────────────────────────────────────────────────┐
│                     AI EXECUTION FLOW                      │
│                                                            │
│  1. TRIGGER                                                 │
│     ├─ User button click (admin UI)                       │
│     ├─ API call (programmatic)                            │
│     ├─ Cron trigger (scheduled, via cron-pull.ts)         │
│     └─ Automated rule (future)                             │
│                                                            │
│  2. GATE (permissions.ts)                                   │
│     ├─ L0: Internal only (system prompts, routing)        │
│     ├─ L1: Read/analyze/monitor (auto)                    │
│     ├─ L2: Generate → human approval required             │
│     ├─ L3: Low-risk auto-fix (meta/alt/translation)       │
│     ├─ L4: Whitelist auto-publish                         │
│     └─ MANUAL: Delete/price/quote/email/contract          │
│                                                            │
│  3. TRUTH CHECK (truthfulness.ts)                           │
│     ├─ Red line 1: Unverified certification claims        │
│     ├─ Red line 2: Factory capability attribution drift   │
│     ├─ Red line 3: Regulatory number anomalies            │
│     ├─ Red line 4: Pricing claims without basis           │
│     └─ Red line 5: Fabricated statistics/ratings          │
│                                                            │
│  4. BUDGET CHECK (action-budget.ts)                         │
│     ├─ Layer 1: Daily total cap                           │
│     ├─ Layer 2: Per-action-type daily cap                 │
│     └─ Layer 3: Per-object daily cap                      │
│                                                            │
│  5. EXECUTION                                               │
│     ├─ Select AI Role (system prompt)                     │
│     ├─ Build prompt with context                          │
│     ├─ Call DeepSeek API                                  │
│     ├─ Parse response                                     │
│     └─ Log to mission-log.ts                              │
│                                                            │
│  6. RESULT                                                  │
│     ├─ L1: Return analysis to caller                      │
│     ├─ L2: Store draft → await approval                  │
│     ├─ L3: Auto-apply (save old version first)            │
│     └─ L4: Auto-publish                                   │
│                                                            │
│  7. LOGGING (mission-log.ts)                                │
│     ├─ mission_id, action_id                              │
│     ├─ role, model, tokens, cost                          │
│     ├─ input snapshot, output snapshot                    │
│     ├─ permission_level, budget_consumed                  │
│     ├─ truthfulness_checks_passed/failed                  │
│     ├─ status, error (if any)                             │
│     └─ replay_id (for retry tracking)                     │
└──────────────────────────────────────────────────────────┘
```

### 3.5 增长流（Growth Flow）

```
┌──────────────────────────────────────────────────────────┐
│                   GROWTH DATA FLOW                         │
│                                                            │
│  1. DATA COLLECTION (cron-pull.ts)                          │
│     ├─ GSC: query × page × device × country              │
│     │   → D1: gsc_queries, gsc_query_page                │
│     ├─ GA4: page views, events, conversions              │
│     │   → D1: ga4_data                                    │
│     └─ Scheduled: periodic pulls                          │
│                                                            │
│  2. ANALYSIS                                                │
│     Browser ──GET──▶ /api/admin/gsc/*                     │
│                      └─ Read D1 growth tables              │
│     AI ──analyze──▶ GSC/GA4 data                          │
│                      └─ Generate opportunities             │
│                                                            │
│  3. OPPORTUNITY                                             │
│     AI identifies:                                         │
│     ├─ page1_candidate (position 4-10)                    │
│     ├─ low_ctr (high impressions, low clicks)             │
│     ├─ content_gap (competitor has, we don't)             │
│     ├─ query_page_mismatch                                │
│     └─ index_issue                                        │
│     → D1: growth_opportunities                            │
│                                                            │
│  4. ACTION (when enabled)                                   │
│     ├─ internal_link fix (L3 auto)                        │
│     ├─ alt_text_fill (L3 auto)                            │
│     ├─ meta_fix (L3 auto)                                 │
│     └─ content_update (L2 human approval)                 │
│     → D1: growth_actions                                  │
│                                                            │
│  5. VERIFY (T+14)                                           │
│     Compare before_metrics vs after_metrics                │
│     → Outcome: positive / no_effect / negative            │
│     → D1: growth_experiments                               │
└──────────────────────────────────────────────────────────┘
```

---

## 4. 构建与部署管线

```
Developer (git-bash)
    │
    │ node scripts/push-now.mjs (Git Data API, port 443 blocked)
    ▼
GitHub (aromiso/aromiso)
    │
    │ push to main branch
    ▼
Cloudflare Pages Build
    │
    ├─ 1. Clone repo
    ├─ 2. npm install
    ├─ 3. astro build
    │      ├─ Content Collections: src/content/*.md → Zod validate
    │      ├─ SSR/SSG: Astro pages → static HTML
    │      ├─ Islands: hydrate React/Svelte client components
    │      └─ Assets: bundle + hash + _astro/ directory
    ├─ 4. Functions: bundle /functions/* → Workers
    └─ 5. Deploy to CF Edge network
         │
         └─ Live: ~1-2 minutes after push
              Edge propagation: +10-30 seconds
```

**关键约束**：
- 本机 443 端口被封 → 使用 Git Data API (`scripts/push-now.mjs`) 替代标准 `git push`
- `origin/main` 永久陈旧（远程被 squash）→ 不可 `diff origin/main..HEAD`
- 空 commit 不会触发推送（smart-push 只做内容 diff）
- 部署后添加的环境变量不注入运行中 Functions → 需再推一次有改动的 commit

---

## 5. 安全边界

```
┌──────────────────────────────────────────────────────────┐
│                    SECURITY BOUNDARIES                     │
│                                                            │
│  1. ADMIN AUTHENTICATION                                    │
│     ├─ Mechanism: HMAC-signed cookie (aromiso_admin)      │
│     ├─ Algorithm: SHA-256 HMAC with secret key            │
│     ├─ Expiry: 7 days                                     │
│     ├─ Verification: functions/api/admin/shared.ts        │
│     │   └─ verifyAuth(request): parses cookie,             │
│     │       re-computes HMAC, checks expiry                │
│     ├─ Login: POST /api/admin/login                       │
│     │   └─ Password check → set cookie                    │
│     └─ Current: SINGLE password, SINGLE user              │
│                                                            │
│  2. PUBLIC ANTI-ABUSE                                       │
│     ├─ Turnstile: Cloudflare Turnstile widget              │
│     │   └─ functions/api/_lib/guard.ts: verifyTurnstile() │
│     ├─ KV Blacklist: IP-based rate limiting               │
│     │   └─ guard.ts: checkBlacklist()                     │
│     ├─ Mail Budget: Resend daily send cap                 │
│     │   └─ guard.ts: checkMailBudget()                    │
│     └─ De-duplication: prevent double submissions         │
│         └─ guard.ts: checkDuplicate()                     │
│                                                            │
│  3. AI SAFETY NET                                           │
│     ├─ permissions.ts: L0-L4 + MANUAL gate                │
│     ├─ truthfulness.ts: 5 red-line checks                 │
│     ├─ action-budget.ts: 3-layer budget cap               │
│     └─ mission-log.ts: full audit trail                   │
│                                                            │
│  4. SECRETS MANAGEMENT                                      │
│     ├─ .dev.vars: local secrets (gitignored)              │
│     ├─ CF Pages Secrets: production secrets               │
│     │   (added via CF Dashboard, NOT in code)             │
│     └─ Secrets include: ADMIN_PASSWORD,                    │
│         ADMIN_GITHUB_TOKEN, DEEPSEEK_API_KEY,              │
│         RESEND_API_KEY, CLOUDFLARE_API_TOKEN, etc.        │
│                                                            │
│  5. DEPLOYMENT SECURITY                                     │
│     ├─ CF Pages: auto-deploy on push to main              │
│     ├─ No manual deploy gate (push = deploy)              │
│     └─ Build-time env vars from CF Dashboard              │
└──────────────────────────────────────────────────────────┘
```

---

## 6. 关键技术决策记录（ADR）

### ADR-1: 为什么 GitHub 是内容 source-of-truth 而非 D1

- **决策**：内容（博客/产品资料/指南/案例/FAQ）存储在 GitHub 仓库的 `src/content/*.md`，通过 GitHub Contents API 读写
- **原因**：
  - Astro Content Collections 需要 MD 文件在构建时存在
  - GitHub 提供 commit history（天然版本）
  - 不需要额外的数据库同步
  - CF Pages 从 GitHub 读取构建，需内容在 repo 中
- **代价**：
  - GitHub API rate limit（5000 req/hour）
  - 发布延迟（push → build → deploy，1-2 分钟）
  - 无实时预览（KV drafts 做暂存）
- **V2 影响**：保留此架构，叠加 content_versions 表做更细粒度的版本管理

### ADR-2: 为什么是 Astro 而不是 Next.js/Remix

- **决策**：Astro (SSG mode) + CF Pages Functions
- **原因**：
  - 内容站天然适合 SSG（内容不频繁变化）
  - CF Pages 原生支持 Astro，零配置
  - 零 JS 默认，按需 hydration（islands architecture）
  - 2025 年迁移时 Astro 生态成熟
- **V2 影响**：保留，不改。V2 后台可选 React/Svelte islands 做交互组件

### ADR-3: 为什么是单文件 SPA（历史原因，V2 要改）

- **决策**：`admin/index.astro` 10,381 行，包含所有后台视图
- **原因**：
  - 快速原型时的一个文件搞定
  - 避免 Astro 多页面路由的复杂性
  - 前端零框架依赖
- **代价**：
  - 不可维护（10,000+ 行）
  - 零组件复用
  - 所有视图加载全部 JS
- **V2 影响**：V2 Phase 1 拆分为 AdminShell + 独立模块页面

### ADR-4: 为什么不使用 ORM

- **决策**：直接使用 D1 client (`db.prepare().bind().run()`)
- **原因**：
  - D1 是 CF 原生服务，无第三方 ORM 适配
  - Drizzle/Kysely 早期对 D1 支持不完善
  - 减少依赖和构建复杂度
- **V2 影响**：持续此模式，但封装 `src/lib/admin/api/` 统一数据访问层

### ADR-5: 为什么 AI 不直接操作数据库

- **决策**：AI 生成内容 → 存入 draft 表 → 人工确认 → 应用
- **原因**：
  - AI 幻觉风险（truthfulness 闸）
  - 不可逆操作难以恢复
  - AGENTS.md: AI owns information preparation, Human owns commercial relationship
- **V2 影响**：保留并强化（每个 AI 操作走 Action/Approval/Rollback 管线）

---

## 7. 当前系统架构评分

| 维度 | 评分 | 评语 |
|------|------|------|
| 内容管理 | B+ | GitHub 管线稳定，但无版本/软删除/批量 |
| 商品管理 | B | D1+R2 可行，但 66 列宽表需规范化 |
| 视频管理 | A- | 五步流水线设计优秀，V2 最佳参考 |
| AI 安全 | A | 四级闸+五红线+三层预算，行业领先 |
| 权限 | D | 单密码，无 RBAC，无审计日志 |
| 前端 | D | 10,381 行 SPA，零组件复用 |
| SEO/增长 | B | GSC/GA4 数据采集就位，闭环待验证 |
| 客户/业务 | C- | 询盘有基础，OEM/客户 360 为零 |
| 部署 | B+ | 自动部署稳定，唯一痛点是 push 方式 |
| 数据 | B | 52 表覆盖广，但 FK 缺口 + 物理删除 |
| **总评** | **B-** | 功能覆盖面广，但架构债重，V2 必要 |

---

## 8. V2 架构改进要点（连接 P0-7）

基于以上分析，V2 必须在以下方面改进：

1. **Shell 拆分**：`admin/index.astro` → AdminShell + 模块页面
2. **RBAC**：单密码 → 多用户多角色权限矩阵
3. **软删除**：物理删除 → `deleted_at` + 回收站
4. **版本**：GitHub history → `content_versions` 表明确版本
5. **审计**：无 → `audit_logs` 全部写操作
6. **API 兼容**：`/api/admin/` 保留 → `/api/admin/v2/` 新格式
7. **组件化**：0 复用 → 46 个统一组件
8. **业务闭环**：缺失 OEM/Customer360/文案资产 → 新模块
9. **AI 融入**：AI 独占页面 → 每个业务对象内嵌 AI Panel
10. **异步任务**：同步批量 → AI Task Queue

---

*本文基于实际代码和配置文件，未做任何猜测。不确定项已注明。*