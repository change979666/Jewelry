# Aromiso CMS Admin Backend — V2 API Map (Current / V5.48)

> **Generated**: 2026-08-18 from source at `functions/api/admin/` + `functions/api/_lib/` + `functions/lib/`.
> **Scope**: Every export handler with a route registration. Shared helpers (no `onRequest*` export) are treated as **internal dependencies**, not endpoints.

---

## 1. Overview Table

| # | Method | Path | File | Function | Auth | Input | Output | DB Read | DB Write | External Services | AI Roles | Permissions | Stability |
|---|--------|------|------|----------|------|-------|--------|---------|----------|-------------------|-----------|-------------|-----------|
| 1 | POST | `/api/admin/login` | `login.ts` | `onRequestPost` | None (self-auth) | `{password}` JSON body | `{ok}` + Set-Cookie | — | — | — | — | Rate-limit KV (`rl:login:<ip>`) | 稳定可复用 |
| 2 | POST | `/api/admin/logout` | `logout.ts` | `onRequestPost` | None | — | `{ok}` + clear Cookie | — | — | — | — | — | 稳定可复用 |
| 3 | GET | `/api/admin/load` | `load.ts` | `onRequestGet` | admin cookie | `?collection=blog\|products\|guides\|caseStudies` | `{blog:[], products:[], ...}` | admin-manifest.json (1 subreq) | — | — | — | isAuthed | 稳定可复用 |
| 4 | GET | `/api/admin/get` | `get.ts` | `onRequestGet` | admin cookie | `?path=src/content/...&draft=1` | `{content, sha?}` | GitHub API (ghGet) or KV draft | — | GitHub Contents API | — | isAuthed, path restriction | 稳定可复用 |
| 5 | POST | `/api/admin/save` | `save.ts` | `onRequestPost` | admin cookie | `{collection, key, locale, frontmatter, content, status}` | `{ok, status:"draft"\|"published"}` | GitHub API (ghGet), KV (getDraft) | GitHub API (ghPut), KV (saveDraft/deleteDraft) | GitHub Contents API | — | isAuthed, server-side validation | 稳定可复用 |
| 6 | POST | `/api/admin/delete` | `delete.ts` | `onRequestPost` | admin cookie | `{collection, key}` | `{ok, deleted}` | GitHub API (ghGet in ghDelete) | GitHub API (ghDelete), KV (deleteDraft) | GitHub Contents API | — | isAuthed | 稳定可复用 |
| 7 | POST | `/api/admin/upload` | `upload.ts` | `onRequestPost` | admin cookie | `{path, contentB64}` | `{ok, url, path}` | GitHub API (ghGet) | GitHub API (ghPut) | GitHub Contents API | — | isAuthed, path/ext restriction | 稳定可复用 |
| 8 | POST | `/api/admin/upload-image` | `upload-image.ts` | `onRequestPost` | admin cookie | `{name?, mime?, contentB64}` | `{ok, url, key}` | — | R2 (IMAGES bucket) | R2 Storage | — | isAuthed | 稳定可复用 |
| 9 | POST | `/api/admin/upload-video` | `upload-video.ts` | `onRequestPost` | admin cookie | `{name?, mime?, contentB64}` | `{ok, url, key}` | — | R2 (IMAGES bucket) | R2 Storage | — | isAuthed | 稳定可复用 |
| 10 | GET/POST | `/api/admin/settings` | `settings.ts` | `onRequest` | admin cookie | GET: — / POST: `{settings, sha?}` | `{ok, settings, sha?}` / `{ok}` | GitHub API (ghGet) | GitHub API (ghPut) | GitHub Contents API | — | isAuthed | 稳定可复用 |
| 11 | GET | `/api/admin/stats` | `stats.ts` | `onRequestGet` | admin cookie | `?type=dashboard\|seo\|ga\|behavior\|products\|inquiries\|shop\|availability&range=7d\|28d\|90d&start=&end=` | `{type, ...}` shaped per type | D1 (gsc_daily, ga_daily, behavior_events, inquiries, daily_recs, commerce_products, pull_state) | — | — | — | isAuthed (verifySession manual) | 仅UI调用 |
| 12 | GET/PUT/POST | `/api/admin/ai-roles` | `ai-roles.ts` | `onRequest` | admin cookie | GET: — / PUT: `{id, prompt?, model?, ...}` / POST: `{role, test_input?}` | `{ok, roles}` / `{ok}` / `{ok, content, ...}` | D1 (ai_roles, ai_usage) | D1 (ai_roles UPDATE) | SiliconFlow/DeepSeek API (POST test-run) | test-run uses role's own prompt | isAuthed (verifySession) | 稳定可复用 |
| 13 | GET/POST | `/api/admin/ai-provider` | `ai-provider.ts` | `onRequest` | admin cookie | GET: — / POST: `{provider:"siliconflow"\|"deepseek"}` | `{ok, configured, active, providers}` / `{ok}` | KV (DRAFTS) | KV (DRAFTS) | — | — | isAuthed | 稳定可复用 |
| 14 | GET/POST | `/api/admin/autonomy` | `autonomy.ts` | `onRequestGet/onRequestPost` | admin cookie | GET: — / POST: `{autofix:"on"\|"off"}` | `{ok, autofix_enabled, budget, ...}` / `{ok, autofix_enabled}` | D1 (ai_usage), KV (DRAFTS) | KV (DRAFTS), D1 (ai_missions via mission-log) | — | — | isAuthed (POST human-only, no cron) | 稳定可复用 |
| 15 | GET/POST | `/api/admin/faqs` | `faqs.ts` | `onRequest` | admin cookie | GET: — / POST: `{faqs:{categories:{...}}, sha?}` | `{ok, faqs, sha?}` / `{ok}` | GitHub API (ghGet) | GitHub API (ghPut) | GitHub Contents API | — | isAuthed | 稳定可复用 |
| 16 | POST | `/api/admin/ai-assist` | `ai-assist.ts` | `onRequestPost` | admin cookie | `{task, title?, description?, body?, collection?, related_products?}` | `{ok, task, suggestion, alternatives?, reasoning?}` | D1 (knowledge_base via loadKnowledgeContext) | D1 (knowledge_base via extractAndSaveInsights) | SiliconFlow/DeepSeek API (deepseekJson) | — (inline prompts per task) | isAuthed (verifySession) | 稳定可复用 |
| 17 | POST | `/api/admin/ai-product` | `ai-product.ts` | `onRequestPost` | admin cookie | `{title?, category?, description?, materials?, moq?, key_features?, product_highlights?}` | `{ok, title, short_description, seo_title, seo_description, key_features, product_highlights}` | D1 (knowledge_base, ai_roles) | — | SiliconFlow/DeepSeek API (deepseekJson) | product_copywriter (from ai_roles) | isAuthed | 稳定可复用 |
| 18 | POST | `/api/admin/ai-batch-generate` | `ai-batch-generate.ts` | `onRequestPost` | admin cookie | `{limit?, offset?, dryRun?}` | `{success, processed, failed, results, nextOffset}` | D1 (commerce_products, ai_roles) | D1 (commerce_products UPDATE) | SiliconFlow/DeepSeek API (deepseekJson) | product_copywriter | isAuthed | 需重构 |
| 19 | GET/POST | `/api/admin/ai-brief` | `ai-brief.ts` | `onRequestGet/onRequestPost` | admin cookie | GET: — / POST: — | `{ok, brief}` / `{ok, brief}` | D1 (ai_daily_briefs, inquiries, commerce_orders, commerce_products, behavior_events, ai_daily_report) | D1 (ai_daily_briefs INSERT) | SiliconFlow/DeepSeek API (aiCall) | ai_brief | isAuthed | 需重构 |
| 20 | GET/POST/DELETE | `/api/admin/commerce-products` | `commerce-products.ts` | `onRequestGet/onRequestPost/onRequestDelete` | admin cookie | GET: `?id=\|status=&category=&search=&pid=&qf=&limit=&offset=` / POST: `{id?, ...fields, variants?, prices?}` / DELETE: `?id=` | `{ok, products, total}` / `{ok, id}` / `{ok}` | D1 (commerce_products, commerce_product_variants, commerce_price_tiers, commerce_product_images, commerce_image_nos) | D1 (commerce_products INSERT/UPDATE/DELETE, variants INSERT/DELETE, price_tiers INSERT/DELETE) | — | — | isAuthed | 稳定可复用 |
| 21 | GET/POST | `/api/admin/commerce-orders` | `commerce-orders.ts` | `onRequest` | admin cookie | GET: `?id=\|status=&country=&search=&limit=&offset=` / POST: `{id, status?, shipping_cost?, admin_note?, note?}` | `{ok, orders, total}` / `{ok}` | D1 (commerce_orders, commerce_order_items, commerce_order_events) | D1 (commerce_orders UPDATE, commerce_order_events INSERT) | — | — | isAuthed | 稳定可复用 |
| 22 | GET/POST | `/api/admin/commerce-reviews` | `commerce-reviews.ts` | `onRequestGet/onRequestPost` | admin cookie | GET: `?kind=reviews\|questions&status=` / POST: `{kind:"review"\|"question", id, status?\|answer?}` | `{ok, reviews\|questions}` / `{ok}` | D1 (commerce_product_reviews, commerce_product_questions, commerce_products) | D1 (commerce_product_reviews UPDATE, commerce_product_questions UPDATE) | — | — | isAuthed | 稳定可复用 |
| 23 | GET/POST/DELETE | `/api/admin/merchandising` | `merchandising.ts` | `onRequest` | admin cookie | GET: `?type=featured\|best_seller\|...` / POST: `{product_id, placement_type?, priority?, ...}` / DELETE: `?id=` | `{ok, items}` / `{ok}` / `{ok}` | D1 (product_merchandising, commerce_products) | D1 (product_merchandising INSERT/DELETE) | — | — | isAuthed | 稳定可复用 |
| 24 | GET/POST | `/api/admin/import-1688` | `import-1688.ts` | `onRequest` | admin cookie | GET: `?id=` / POST: multipart ZIP upload or `{action:"confirm"\|"cancel"\|"delete", jobId, edits?}` | `{ok, jobs\|job, drafts}` / `{ok, jobId, products}` | D1 (commerce_import_jobs, commerce_import_errors) | D1 (commerce_import_jobs INSERT/UPDATE/DELETE, commerce_products INSERT, variants INSERT, commerce_product_images INSERT), R2 (IMAGES) | R2 Storage, SiliconFlow/DeepSeek (SKU name translation) | translator | isAuthed | 需重构 |
| 25 | GET/POST | `/api/admin/import-excel` | `import-excel.ts` | `onRequest` | admin cookie | GET: `?id=` / POST: multipart .xlsx or `{action:"confirm"\|"cancel", jobId, edits?}` | `{jobs}` / `{jobId, summary}` | D1 (commerce_import_jobs, commerce_import_errors) | D1 (commerce_import_jobs INSERT/UPDATE, commerce_products INSERT, variants INSERT, price_tiers INSERT) | SiliconFlow/DeepSeek (attribute translation) | translator | isAuthed | 需重构 |
| 26 | GET/POST | `/api/admin/translate-products` | `translate-products.ts` | `onRequestGet/onRequestPost` | admin cookie | GET: — / POST: `{batch?, import_batch?}` | `{ok, untranslated, total}` / `{ok, translated, errors, remaining, done}` | D1 (commerce_products, commerce_product_variants) | D1 (commerce_products UPDATE, commerce_product_variants UPDATE) | SiliconFlow/DeepSeek API (aiJson) | translator, translator_title | isAuthed | 需重构 |
| 27 | GET/POST | `/api/admin/migrate-images` | `migrate-images.ts` | `onRequestGet/onRequestPost` | admin cookie | GET: — / POST: `{batch?}` | `{ok, alicdnRemaining}` / `{ok, processed, skipped, errors, done}` | D1 (commerce_products, commerce_product_variants) | R2 (IMAGES), D1 (commerce_products UPDATE, commerce_product_variants UPDATE) | R2 Storage, alicdn.com (HTTP fetch) | — | isAuthed | 需替换 |
| 28 | GET/POST/DELETE | `/api/admin/inquiries` | `inquiries.ts` | `onRequest` | admin cookie | GET: `?status=&search=&export=csv` / POST: `{id, status}` / DELETE: `{id}` or `?id=` | `{ok, inquiries, total}` / CSV / `{ok}` | D1 (inquiries) or KV (DRAFTS inq:*) | D1 (inquiries UPDATE/DELETE) or KV | — | — | isAuthed | 稳定可复用 |
| 29 | GET/DELETE | `/api/admin/subscribers` | `subscribers.ts` | `onRequest` | admin cookie | GET: `?search=&export=csv` / DELETE: `{id}` or `?id=` | `{ok, subscribers, total}` / CSV / `{ok}` | D1 (subscribers) | D1 (subscribers CREATE TABLE IF NOT EXISTS, DELETE) | — | — | isAuthed | 稳定可复用 |
| 30 | GET/POST | `/api/admin/ai-lead-score` | `ai-lead-score.ts` | `onRequestGet/onRequestPost` | admin cookie | GET: `?inquiry_id=` / POST: `{inquiry_id}` | `{ok, score}` / `{ok, score, level, factors, recommended_action}` | D1 (inquiries, ai_lead_scores) | D1 (ai_lead_scores INSERT) | — | — (rule-based, not AI) | isAuthed | 稳定可复用 |
| 31 | POST | `/api/admin/email-send` | `email-send.ts` | `onRequest` | admin cookie | `{inquiry_id, to, subject, body_text}` | `{ok, message_id}` | D1 (inquiries) | D1 (email_messages INSERT, inquiries UPDATE) | Resend API | — | isAuthed | 稳定可复用 |
| 32 | GET | `/api/admin/email-thread` | `email-thread.ts` | `onRequest` | admin cookie | `?inquiry_id=` | `{inquiry, thread}` | D1 (inquiries, email_messages) | — | — | — | isAuthed | 稳定可复用 |
| 33 | GET | `/api/admin/os-data` | `os-data.ts` | `onRequestGet` | admin cookie | `?view=ceo\|knowledge\|tasks\|decisions\|usage\|taskmemory\|timeline` | Shaped per view | D1 (ai_reports, tasks, knowledge, decisions, ai_usage, audit_issues, task_runs, knowledge_base) | — | — | — | isAuthed (verifySession) | 仅UI调用 |
| 34 | PUT/POST | `/api/admin/os-tasks` | `os-tasks.ts` | `onRequest` | admin cookie | PUT: `{id, status?, result?, priority?, expected_result?, actual_result?}` / POST: `{suggestion?, status, reason?, rejection_reason?, task_id?}` | `{ok}` | D1 (tasks) | D1 (tasks UPDATE, decisions INSERT) | — | — | isAuthed (verifySession) | 稳定可复用 |
| 35 | GET/POST/PUT | `/api/admin/os-audit` | `os-audit.ts` | `onRequest` | admin cookie OR Bearer CRON_SECRET | GET: `?status=open&severity=` / POST: `{deep?}` / PUT: `{id}` | `{ok, issues, counts}` / `{ok, found, saved}` / `{ok}` | D1 (audit_issues, gsc_daily, ga_daily) | D1 (audit_issues INSERT/UPDATE) | SiliconFlow/DeepSeek (deep audit classification) | auditor | isAuthed or cron | 需重构 |
| 36 | GET/POST | `/api/admin/os-reports` | `os-reports.ts` | `onRequest` | admin cookie OR Bearer CRON_SECRET | GET: `?type=daily\|weekly\|monthly&limit=` / POST: `{type}` | `{ok, reports}` / `{ok, type, period, content}` | D1 (ai_reports, gsc_daily, ga_daily, behavior_events, inquiries, tasks, knowledge) | D1 (ai_reports INSERT) | SiliconFlow/DeepSeek API (aiCall) | report-weekly/monthly/quarterly | isAuthed or cron | 需重构 |
| 37 | POST | `/api/admin/os-daily` | `os-daily.ts` | `onRequestPost` | admin cookie OR Bearer CRON_SECRET | `{step?:"all"\|"analyst"\|"librarian"\|"strategist"\|"executor"}` + `?force=1` | `{ok, date, results}` | D1 (gsc_daily, ga_daily, behavior_events, inquiries, knowledge, tasks, decisions, ai_feedback) | D1 (knowledge INSERT, tasks INSERT, tasks UPDATE, ai_reports INSERT, ai_missions, ai_action_logs, ai_daily_report) | SiliconFlow/DeepSeek (analyst/librarian/strategist/executor), Resend (daily digest), KV (idempotency) | analyst, librarian, strategist, executor | isAuthed or cron, enforceMode, truthfulness | Cron专用 |
| 38 | GET | `/api/admin/ai-command-center` | `ai-command-center.ts` | `onRequestGet` | admin cookie | `?mission_id=MSN...` (optional) | `{ok, status, actions, cost, dailyReport, health, ...}` | D1 (ai_missions, ai_action_logs, ai_mission_plan, ai_usage, ai_daily_report, growth_opportunities, tasks, gsc_daily, ga_daily, inquiries), KV (DRAFTS) | — | — | — | isAuthed | 仅UI调用 |
| 39 | POST | `/api/admin/content-generate` | `content-generate.ts` | `onRequest` | admin cookie OR Bearer CRON_SECRET | `{topic?, key?, locale?, limit?, dryRun?}` | `{ok, generated, queued, rejected, failed, note}` | D1 (ai_usage for budget), GitHub (ghGet to check existing), KV (getDraft) | KV (saveDraft), D1 (tasks INSERT) | SiliconFlow/DeepSeek API (aiJson) | content_writer | isAuthed or cron, enforceMode, checkContentDraft (truthfulness), scoreDraft (content-quality), Model Router, CONTENT_FACTORY_LIVE gate, budget gate | 需重构 |
| 40 | GET/POST | `/api/admin/ai-opportunities` | `ai-opportunities.ts` | `onRequestGet/onRequestPost/onRequestPut` | admin cookie | GET: `?status=` / POST: — / PUT: `{id, status:"confirmed"\|"dismissed"}` | `{ok, opportunities}` / `{ok, count}` / `{ok}` | D1 (ai_opportunities, google_snapshots) | D1 (ai_opportunities INSERT/UPDATE) | — | — | isAuthed | 需重构 |
| 41 | POST | `/api/admin/growth-sync` | `growth-sync.ts` | `onRequestPost` | admin cookie OR Bearer CRON_SECRET | `{date?}` | `{ok, date, ...runGrowthSync}` | — (delegates to lib/growth-sync) | D1 (via lib/growth-sync) | GSC API, KV (via lib/growth-sync) | — (lib/growth-sync owns AI) | isAuthed or cron | Cron专用 |
| 42 | GET | `/api/admin/growth-board` | `growth-board.ts` | `onRequestGet` | admin cookie | — | `{ok, today, kpi, counts, funnel, index, opps, shopping, experiments}` | D1 (growth_opportunities, index_status, commerce_products, commerce_price_tiers, product_merchandising, gsc_daily, inquiries, tasks, growth_actions), KV (DRAFTS) | — | — | — | isAuthed | 仅UI调用 |
| 43 | POST | `/api/admin/cron-pull` | `cron-pull.ts` | `onRequestPost` | Bearer CRON_SECRET | `?force=1&phase=gsc\|ga4\|recs\|growth\|backfill\|all` | `{ok, date, phase, results, errors?}` | D1 (gsc_daily, gsc_query_page, ga_daily, daily_recs, pull_state, behavior_events) | D1 (gsc_daily UPSERT, gsc_query_page UPSERT, ga_daily UPSERT, daily_recs INSERT, pull_state UPSERT), KV (google:token) | GSC API, GA4 API, SiliconFlow/DeepSeek (recs), Resend (daily digest), growth-sync | — (inline recs prompt) | CRON_SECRET only | Cron专用 |
| 44 | POST | `/api/admin/task-execute` | `task-execute.ts` | `onRequest` | admin cookie OR Bearer CRON_SECRET | `{task_id, approve?}` | `{ok, task_id, enforced_mode, outcome, detail, before_metrics, after_metrics}` | D1 (tasks, gsc_daily) | D1 (tasks UPDATE, task_runs INSERT, ai_missions, ai_action_logs, knowledge INSERT) | — | — | isAuthed or cron, enforceMode (permissions.ts), Action Budget (action-budget.ts), Truthfulness Gate (truthfulness.ts), TASK_EXECUTOR_LIVE gate | Cron专用 |
| 45 | GET/POST | `/api/admin/video-center` | `video-center.ts` | `onRequestGet/onRequestPost` | admin cookie | GET: — / POST: `{action, id?, ...fields}` | `{ok, assets}` / `{ok}` shaped by action | D1 (video_assets, video_product_links, video_publications, video_asset_translations, video_transcripts, commerce_products) | D1 (video_assets INSERT/UPDATE/DELETE, video_product_links INSERT/DELETE, video_publications INSERT/UPDATE, video_asset_translations UPSERT, commerce_products UPDATE), R2 (delete) | SiliconFlow/DeepSeek (translate action) | video_translator | isAuthed | 稳定可复用 |
| 46 | POST | `/api/admin/video-content-package/init` | `video-content-package/init.ts` | `onRequestPost` | admin cookie | `{source:{source:"local_studio",studio_job_id}, media:{video_sha256,cover_sha256,...}, content:{internal_title,...}, schema_version:"1.0"}` | `{ok, video_id, video_code, content_package_status, upload}` | D1 (video_assets) | D1 (video_assets INSERT) | — | — | isAuthed | 稳定可复用 |
| 47 | POST | `/api/admin/video-content-package/[id]/video` | `.../[id]/video.ts` | `onRequestPost` | admin cookie | Raw video bytes (streaming upload) | `{ok}` | D1 (video_assets) | D1 (video_assets UPDATE), R2 (IMAGES) | R2 Storage | — | isAuthed | 稳定可复用 |
| 48 | POST | `/api/admin/video-content-package/[id]/cover` | `.../[id]/cover.ts` | `onRequestPost` | admin cookie | Raw image bytes (streaming upload) | `{ok}` | D1 (video_assets) | D1 (video_assets UPDATE), R2 (IMAGES) | R2 Storage | — | isAuthed | 稳定可复用 |
| 49 | POST | `/api/admin/video-content-package/[id]/transcript` | `.../[id]/transcript.ts` | `onRequestPost` | admin cookie | Raw transcript text | `{ok}` | D1 (video_assets) | D1 (video_transcripts UPSERT) | — | — | isAuthed | 稳定可复用 |
| 50 | POST | `/api/admin/video-content-package/[id]/generate` | `.../[id]/generate.ts` | `onRequestPost` | admin cookie | `{}` | `{ok, localeCount}` | D1 (video_assets, video_transcripts) | D1 (video_asset_translations UPSERT), D1 (video_assets UPDATE) | SiliconFlow/DeepSeek API (aiJson) | content_writer, translator | isAuthed | 稳定可复用 |
| 51 | GET | `/api/admin/video-content-package/[id]/status` | `.../[id]/status.ts` | `onRequestGet` | admin cookie | — | `{ok, asset, upload, translations, publications}` | D1 (video_assets, video_transcripts, video_asset_translations, video_publications) | — | — | — | isAuthed | 稳定可复用 |
| 52 | POST | `/api/admin/video-content-package/[id]/report-part` | `.../[id]/report-part.ts` | `onRequestPost` | admin cookie | `{part:"video"\|"cover"\|"transcript", state:"failed", error}` | `{ok}` | — | D1 (video_assets UPDATE package_parts_json) | — | — | isAuthed | 稳定可复用 |
| 53 | POST | `/api/admin/video-content-package/[id]/apply` | `.../[id]/apply.ts` | `onRequestPost` | admin cookie | `{locale?}` | `{ok, locale, applied, skipped}` | D1 (video_asset_translations, video_assets) | D1 (video_asset_translations UPSERT) | — | — | isAuthed | 稳定可复用 |
| 54 | GET | `/api/admin/knowledge` | `knowledge.ts` | `onRequest` | admin cookie | GET: `?category=&limit=` / POST: `{category,title,detail,importance}` or `{action:"sync"}` / DELETE: `?id=&store=r2\|os\|legacy` | `{ok, entries, categories, stats}` / `{ok}` / `{ok}` | D1 (knowledge, knowledge_base), R2 (KB bucket) | D1 (knowledge_base INSERT/DELETE, knowledge DELETE), R2 (KB via kb-store) | — | — | isAuthed | 稳定可复用 |
| 55 | GET/POST | `/api/admin/ai-feedback` | `ai-feedback.ts` | `onRequest` | admin cookie | GET: `?limit=&role=&rating=` / POST: `{role?, target_type?, target_id?, rating, comment?, ai_output?, human_edit?}` | `{ok, feedback}` / `{ok}` | D1 (ai_feedback) | D1 (ai_feedback INSERT) | — | — | isAuthed (verifySession) | 稳定可复用 |
| 56 | GET | `/api/admin/image-nos` | `image-nos.ts` | `onRequestGet` | admin cookie | `?no=NNNNNN` or `?urls=a,b,c` or `?search=&limit=&offset=` | `{ok, found, image_no, url, product_id, ...}` or `{ok, nos}` or `{ok, images}` | D1 (commerce_image_nos, commerce_products) | D1 (commerce_image_nos INSERT OR IGNORE via ensureImageNos) | — | — | isAuthed | 稳定可复用 |
| 57 | POST | `/api/admin/commit-localized-image` | `commit-localized-image.ts` | `onRequestPost` | admin cookie | `{id, new_url, expected_cover_url}` | `{ok, changes, field}` | — | D1 (commerce_products UPDATE cover_image/gallery) | — | — | isAuthed | 稳定可复用 |

---

## 2. Per-Domain Grouping

### 2.1 Identity & Session (Auth)

| Endpoint | Notes |
|----------|-------|
| `POST /api/admin/login` | HMAC-signed cookie (`aromiso_admin`), rate-limited by IP via KV (`rl:login:<ip>`, 5/15min), constant-time comparison |
| `POST /api/admin/logout` | Clears cookie, no server-side session invalidation |

**Auth mechanism**: `shared.ts` → `isAuthed()` reads `aromiso_admin` cookie, verifies HMAC-SHA256 signature against `ADMIN_PASSWORD`, 7-day expiry. Some endpoints also accept `Authorization: Bearer <CRON_SECRET>` for cron-triggered calls.

### 2.2 Content CRUD (CMS Core)

| Endpoint | Type | GitHub | KV | Validation |
|----------|------|--------|-----|------------|
| `GET /api/admin/load` | List | No (reads `/admin-manifest.json` instead) | Overlays KV drafts | — |
| `GET /api/admin/get` | Read | Yes (ghGet) | Yes (draft mode) | Path restriction (`src/content/` or `src/data/`) |
| `POST /api/admin/save` | Create/Update | Yes (ghPut for publish) | Yes (saveDraft/deleteDraft) | Server-side validation per collection (required fields, category enum, date format, key pattern) |
| `POST /api/admin/delete` | Delete | Yes (ghDelete × 3 locales) | Yes (deleteDraft × 3) | Collection + key validation |

**Key observation**: `load.ts` previously made 246 subrequests (one ghGet per file) and hit CF's 50-subrequest limit. V3 fix reads a single `/admin-manifest.json` build artifact.

### 2.3 File Upload (Assets)

| Endpoint | Target | Storage |
|----------|--------|---------|
| `POST /api/admin/upload` | Binary files (images, PDFs, docs) | GitHub repo `public/` dir |
| `POST /api/admin/upload-image` | Product images (jpg, png, webp, ≤50MB) | R2 (`commerce/products/localized/`) |
| `POST /api/admin/upload-video` | Product videos (mp4, webm, ogg, ≤50MB) | R2 (`commerce/videos/`) |

### 2.4 Settings & Configuration

| Endpoint | Target | Storage |
|----------|--------|---------|
| `GET/POST /api/admin/settings` | `src/data/settings.json` | GitHub |
| `GET/POST /api/admin/faqs` | `src/data/category-faqs.json` | GitHub |
| `GET/PUT/POST /api/admin/ai-roles` | AI role prompts/models/schedule | D1 `ai_roles` |
| `GET/POST /api/admin/ai-provider` | AI provider (SiliconFlow ⇄ DeepSeek) | KV `config:ai_provider` |
| `GET/POST /api/admin/autonomy` | Autonomy boundary controls | KV `config:growth_autofix_enabled` |

### 2.5 AI Content Assistance (CMS Editor Tools)

All call DeepSeek/SiliconFlow API via `deepseek.ts` helpers. Key difference from OS endpoints: these are **human-triggered, synchronous, single-turn** — user clicks a button, gets a suggestion back.

| Endpoint | Task | AI Role | Knowledge Context |
|----------|------|---------|-------------------|
| `POST /api/admin/ai-assist` | 5 tasks: optimize_title, optimize_desc, optimize_body, suggest_links, full_audit | Inline prompts per task | Yes (loadKnowledgeContext → knowledge_base) |
| `POST /api/admin/ai-product` | Generate product marketing copy (title, description, seo, features, highlights) | product_copywriter (from ai_roles, fallback inline) | Yes |
| `POST /api/admin/ai-batch-generate` | Batch fill missing descriptions/highlights/specs for active products | product_copywriter | Yes |

### 2.6 Commerce (Shop 2.0)

| Endpoint | Scope | Notes |
|----------|-------|-------|
| `GET/POST/DELETE /api/admin/commerce-products` | Full CRUD for commerce_products + variants + price_tiers + images | V5.44: image reference numbers; V5.0: Data Health 8-dim; completeness scoring |
| `GET/POST /api/admin/commerce-orders` | Order list/detail + status update | Status state machine (new→reviewing→quoted→paid→processing→shipped→completed/cancelled) |
| `GET/POST /api/admin/commerce-reviews` | Moderation of reviews & questions | Reviews: approve/reject; Questions: answer |
| `GET/POST/DELETE /api/admin/merchandising` | Featured products placement | Upsert by (product_id, placement_type) |

### 2.7 Import Pipelines

| Endpoint | Source | AI Usage | Image Handling |
|----------|--------|----------|----------------|
| `GET/POST /api/admin/import-1688` | ZIP bundle (image_bundle) | SKU name translation (CN→EN) via translator role | R2 upload per image type (main/sku/detail/video) |
| `GET/POST /api/admin/import-excel` | .xlsx file (excel_import) | Attribute/spec translation (CN→EN) via translator role | No image upload (uses existing alicdn URLs) |

### 2.8 Migration / Batch Operations

| Endpoint | Purpose | Storage |
|----------|---------|---------|
| `GET/POST /api/admin/translate-products` | Backfill EN for CN 1688 imports | D1 (commerce_products, commerce_product_variants) |
| `GET/POST /api/admin/migrate-images` | alicdn → R2 image migration | R2 (IMAGES), HTTP fetch from alicdn |

### 2.9 Inquiries & CRM

| Endpoint | Purpose | External Services |
|----------|---------|-------------------|
| `GET/POST/DELETE /api/admin/inquiries` | Inquiry management (list, status update, delete, CSV export) | D1 or KV fallback |
| `GET/DELETE /api/admin/subscribers` | Newsletter subscriber list | D1 |
| `GET/POST /api/admin/ai-lead-score` | Lead scoring (rule-based, NOT AI) | D1 |
| `POST /api/admin/email-send` | Send reply email to customer | Resend API |
| `GET /api/admin/email-thread` | Full conversation thread | D1 |

### 2.10 AI OS / Growth Center

| Endpoint | Auth | Notes |
|----------|------|-------|
| `GET /api/admin/os-data` | admin cookie | Unified read endpoint: ceo/knowledge/tasks/decisions/usage/taskmemory/timeline views |
| `PUT/POST /api/admin/os-tasks` | admin cookie | Task status update + decision recording |
| `GET/POST/PUT /api/admin/os-audit` | admin cookie OR cron | Code-based audit + optional AI severity classification |
| `GET/POST /api/admin/os-reports` | admin cookie OR cron | Weekly/monthly/quarterly AI-generated reports |
| `POST /api/admin/os-daily` | admin cookie OR cron | 4-step pipeline: analyst → librarian → strategist → executor; sends daily digest email |
| `GET /api/admin/ai-command-center` | admin cookie | Read-only dashboard: status, actions, plans, cost, health, approvals, budget, KPI envelopes |

### 2.11 Content Factory (Generation)

| Endpoint | Auth | Gates | Notes |
|----------|------|-------|-------|
| `POST /api/admin/content-generate` | admin cookie OR cron (with CONTENT_FACTORY_LIVE gate) | Budget gate, Quality Gate (content-quality.ts 100pt), Truthfulness Gate (truthfulness.ts), Model Router | Drafts ONLY to KV + L2 REVIEW task; NEVER publishes |

### 2.12 Growth / SEO Engine

| Endpoint | Auth | Notes |
|----------|------|-------|
| `GET/POST/PUT /api/admin/ai-opportunities` | admin cookie | GSC snapshot scan for high-impression low-CTR keywords |
| `POST /api/admin/growth-sync` | admin cookie OR cron | Full Organic Growth Intelligence sync (lib/growth-sync) |
| `GET /api/admin/growth-board` | admin cookie | Action Board: KPI ladder, opportunities, index issues, shopping readiness, experiments |

### 2.13 Cron / Data Pipeline

| Endpoint | Auth | Triggers | Notes |
|----------|------|----------|-------|
| `POST /api/admin/cron-pull` | Bearer CRON_SECRET only | GitHub Actions cron (daily) | T-2 GSC+GA4 pull, backfill, AI recs, growth sync, daily report, daily digest |
| `POST /api/admin/task-execute` | admin cookie OR cron | cron or manual | 4-gate chain: permissions → action budget → truthfulness → execute; phase 1 sandbox mode (TASK_EXECUTOR_LIVE gate) |

### 2.14 Video Content Hub (V5.43–V5.48)

| Endpoint | Notes |
|----------|-------|
| `GET/POST /api/admin/video-center` | Full asset lifecycle: create/update/translate/publish/archive/delete; AI translation ES/DE from EN |
| `POST /api/admin/video-content-package/init` | Idempotent draft creation from Local Studio |
| `POST /api/admin/video-content-package/[id]/video` | Raw video upload to R2 |
| `POST /api/admin/video-content-package/[id]/cover` | Raw cover image upload to R2 |
| `POST /api/admin/video-content-package/[id]/transcript` | Transcript text upload |
| `POST /api/admin/video-content-package/[id]/generate` | AI content generation from transcript |
| `GET /api/admin/video-content-package/[id]/status` | Package status + translations + publications |
| `POST /api/admin/video-content-package/[id]/report-part` | Per-part failure reporting |
| `POST /api/admin/video-content-package/[id]/apply` | Apply AI-generated translations |

### 2.15 Knowledge Base

| Endpoint | Storage | Notes |
|----------|---------|-------|
| `GET/POST/DELETE /api/admin/knowledge` | D1 (knowledge + knowledge_base) + R2 (KB bucket) | Unified view across 3 stores; sync action mirrors D1→R2 |

### 2.16 Analytics / Stats

| Endpoint | Views | Notes |
|----------|-------|-------|
| `GET /api/admin/stats` | dashboard, seo, ga, behavior, products, inquiries, shop, availability | Rule-based opportunity/anomaly detection; hot-score product ranking; session journey attribution; custom date range support |

### 2.17 Specialized Image Operations

| Endpoint | Notes |
|----------|-------|
| `GET /api/admin/image-nos` | Reverse lookup by 6-digit number; ensure numbers for URL sets; search+flatten with numbers |
| `POST /api/admin/commit-localized-image` | Optimistic-lock commit of localized cover_image to commerce_products |

---

## 3. External Service Call Map

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICE CALLS                            │
├────────────────────┬─────────────────────────────────────────────────────┤
│ Service            │ Called By (Endpoint / Helper)                       │
├────────────────────┼─────────────────────────────────────────────────────┤
│ GitHub Contents API│ shared.ts (ghGet/ghPut/ghDelete)                    │
│                    │ → save.ts, delete.ts, get.ts, settings.ts,         │
│                    │   faqs.ts, upload.ts, content-generate.ts           │
├────────────────────┼─────────────────────────────────────────────────────┤
│ GSC API            │ google.ts (fetchGsc, inspectUrl)                    │
│ (Search Console)   │ → cron-pull.ts (daily T-2 pull, 5 dimensions)      │
│                    │ → growth-sync.ts (via lib/growth-sync)              │
├────────────────────┼─────────────────────────────────────────────────────┤
│ GA4 Data API       │ google.ts (fetchGa4)                                │
│                    │ → cron-pull.ts (daily T-2 pull, 4 dimensions)       │
├────────────────────┼─────────────────────────────────────────────────────┤
│ Google OAuth2      │ google.ts (getAccessToken, JWT RS256 signing)       │
│ (Service Account)  │ → cron-pull.ts, growth-sync.ts                      │
├────────────────────┼─────────────────────────────────────────────────────┤
│ DeepSeek API       │ deepseek.ts (deepseekChat/deepseekJson)             │
│ (official or via   │ lib/ai.ts (aiCall/aiJson)                           │
│  SiliconFlow)      │ → ai-assist.ts, ai-product.ts, ai-batch-generate.ts│
│                    │ → ai-brief.ts, ai-roles.ts (test-run)               │
│                    │ → content-generate.ts, cron-pull.ts (recs)          │
│                    │ → import-1688.ts, import-excel.ts (translator)      │
│                    │ → translate-products.ts (translator)                │
│                    │ → os-daily.ts (analyst/librarian/strategist/executor)│
│                    │ → os-reports.ts, os-audit.ts (deep audit)           │
│                    │ → video-center.ts (translate action)                │
│                    │ → video-content-package/[id]/generate.ts            │
├────────────────────┼─────────────────────────────────────────────────────┤
│ Resend API         │ email-send.ts (transactional reply)                 │
│ (Email)            │ lib/notify.ts → os-daily.ts (daily digest)          │
│                    │ lib/notify.ts → cron-pull.ts (digest fallback)      │
│                    │ lib/notify.ts → content-generate.ts (alerts)        │
├────────────────────┼─────────────────────────────────────────────────────┤
│ R2 Storage         │ upload-image.ts, upload-video.ts                    │
│ (Cloudflare)       │ import-1688.ts (product images to R2)               │
│                    │ migrate-images.ts (alicdn→R2)                       │
│                    │ video-center.ts (delete action)                     │
│                    │ video-content-package/[id]/video.ts, cover.ts       │
├────────────────────┼─────────────────────────────────────────────────────┤
│ KV (DRAFTS)        │ shared.ts (draftKey/saveDraft/getDraft/deleteDraft) │
│                    │ guard.ts (blacklist, dedup, mail budget)            │
│                    │ login.ts (rate-limit)                               │
│                    │ google.ts (token cache)                             │
│                    │ growth-sync.ts, autonomy.ts (autofix switch)        │
│                    │ Various idempotency via lib/idempotency.ts          │
├────────────────────┼─────────────────────────────────────────────────────┤
│ KV (KB)            │ knowledge.ts, lib/kb-store.ts                       │
│                    │ deepseek.ts (saveKnowledge mirror)                  │
├────────────────────┼─────────────────────────────────────────────────────┤
│ Cloudflare         │ guard.ts (turnstileOk)                              │
│ Turnstile          │                                                     │
├────────────────────┼─────────────────────────────────────────────────────┤
│ HTTP fetch         │ load.ts (admin-manifest.json from same origin)      │
│ (same-origin)      │                                                     │
├────────────────────┼─────────────────────────────────────────────────────┤
│ alicdn.com         │ migrate-images.ts (download images for R2 migration)│
│ (HTTP fetch)       │                                                     │
└────────────────────┴─────────────────────────────────────────────────────┘
```

---

## 4. API-to-API Call Chains

### 4.1 Direct Call Chains

```
cron-pull.ts (cron)
  ├─ google.ts (getAccessToken)
  ├─ google.ts (fetchGsc → D1 gsc_daily, gsc_query_page)
  ├─ google.ts (fetchGa4 → D1 ga_daily)
  ├─ deepseek.ts (deepseekJson → D1 daily_recs)
  ├─ lib/growth-sync.ts (runGrowthSync → growth_opportunities)
  ├─ lib/mission-log.ts (generateDailyReport → ai_daily_report)
  ├─ lib/mission-log.ts (writeMissionPlans → ai_mission_plan)
  └─ lib/notify.ts (sendDailyDigest → Resend)

os-daily.ts (cron/manual)
  ├─ lib/ai.ts (loadRole, aiJson, loadKnowledgeContext)
  ├─ lib/mission-log.ts (startMission, finishMission, logAction)
  ├─ lib/mission-log.ts (generateDailyReport → ai_daily_report)
  ├─ lib/notify.ts (sendDailyDigest → Resend)
  ├─ lib/notify.ts (evaluatePipelineAlerts)
  └─ lib/idempotency.ts (beginRun, finishRun)

growth-sync.ts (cron/manual)
  └─ lib/growth-sync.ts (runGrowthSync)
       ├─ google.ts (getAccessToken, fetchGsc, inspectUrl)
       ├─ D1 reads (gsc_daily, gsc_query_page, index_status, etc.)
       └─ D1 writes (growth_opportunities, index_status, tasks)

task-execute.ts (cron/manual)
  ├─ lib/permissions.ts (canAutoExecute → enforceMode)
  ├─ lib/action-budget.ts (getActionBudgetConfig, getBudgetUsage, checkProductionWriteBudget)
  ├─ lib/truthfulness.ts (checkClaims)
  ├─ lib/mission-log.ts (startMission, finishMission, logAction, recordBlockedAction)
  └─ lib/idempotency.ts (beginRun, finishRun)

content-generate.ts
  ├─ lib/ai.ts (aiJson, getBudgetLevel)
  ├─ lib/content-quality.ts (scoreDraft)
  ├─ lib/truthfulness.ts (checkContentDraft)
  ├─ lib/model-router.ts (resolveModelForTask)
  ├─ lib/permissions.ts (enforceMode)
  ├─ shared.ts (ghGet for checking existing, saveDraft for KV write)
  └─ lib/notify.ts (sendAlert for truthfulness violations)
```

### 4.2 Indirect Dependencies (Shared Libraries)

Many endpoints depend on `shared.ts` for:
- `isAuthed()` / `verifySession()` / `readCookie()` — auth
- `ghGet()` / `ghPut()` / `ghDelete()` — GitHub API
- `saveDraft()` / `getDraft()` / `deleteDraft()` — KV drafts
- `json()` — response helper

Some endpoints use `lib/ai.ts` (higher-level AI wrapper with budget/tracking) while others use `deepseek.ts` (lower-level direct API wrapper).

---

## 5. Security Gap Analysis

### 5.1 No Auth Check (Critical Gaps)

| Endpoint | Auth Method | Issue |
|----------|-------------|-------|
| — | — | **All endpoints require auth.** No unauthenticated admin API endpoints found. |

### 5.2 Auth Implementation Discrepancies

Two auth patterns coexist:

| Pattern | Used By | Mechanism |
|---------|---------|-----------|
| `isAuthed(request, env)` | save.ts, load.ts, get.ts, delete.ts, upload.ts, upload-image.ts, upload-video.ts, settings.ts, faqs.ts, inquiries.ts, subscribers.ts, commerce-*.ts, import-*.ts, translate-products.ts, migrate-images.ts, ai-lead-score.ts, ai-opportunities.ts, ai-brief.ts, merchandising.ts, image-nos.ts, commit-localized-image.ts, video-center.ts, video-content-package/*.ts, content-generate.ts, knowledge.ts (DELETE/POST) | `shared.ts` helper wrapping `verifySession(readCookie(request), env.ADMIN_PASSWORD)` |
| `verifySession(token, env.ADMIN_PASSWORD \|\| "")` (manual) | ai-assist.ts, ai-product.ts, ai-batch-generate.ts, ai-feedback.ts, os-tasks.ts, os-data.ts, os-daily.ts, os-reports.ts, os-audit.ts, ai-roles.ts, ai-provider.ts, autonomy.ts, ai-command-center.ts, stats.ts, growth-board.ts, growth-sync.ts, task-execute.ts, cron-pull.ts, knowledge.ts (GET) | Manual cookie read + verify |

**Risk**: The manual pattern is more prone to implementation errors (e.g., forgetting `await`). The `merchandising.ts` file even has a comment noting a past auth bypass due to a missing `await`.

### 5.3 Cron Authentication

Endpoints accepting cron triggers use `Authorization: Bearer <CRON_SECRET>`. This is a shared secret pattern — if CRON_SECRET leaks, all cron-triggered endpoints are compromised.

Endpoints with cron access:
- `cron-pull.ts` (cron-only — no admin cookie fallback)
- `os-daily.ts` (cron or admin)
- `os-reports.ts` (cron or admin)
- `os-audit.ts` (cron or admin)
- `growth-sync.ts` (cron or admin)
- `task-execute.ts` (cron or admin, but cron cannot self-approve L2/L4)
- `content-generate.ts` (cron with CONTENT_FACTORY_LIVE gate)

### 5.4 Content Factory Safety

`content-generate.ts` has multiple safety gates:
1. cron only executes when `CONTENT_FACTORY_LIVE === "on"`
2. Budget hard gate (`getBudgetLevel() >= 3`)
3. Quality gate (`scoreDraft` 100pt)
4. Truthfulness gate (`checkContentDraft`)
5. Drafts go to KV only — **zero** GitHub writes
6. Drafts are marked `draft: true` in frontmatter
7. REVIEW tasks have `enforceMode = L2` (requires human approval)
8. Even if a task is approved, `TASK_EXECUTOR_LIVE` gate blocks actual execution

### 5.5 Task Executor Safety

`task-execute.ts` has a 4-gate chain:
1. **Permissions gate** (`enforceMode`) — code-level override of AI-claimed mode
2. **Action Budget gate** — per-type and total daily limits
3. **Truthfulness gate** — red-line check on payload content
4. **TASK_EXECUTOR_LIVE gate** — sandbox mode by default

### 5.6 Path Traversal Protection

| Endpoint | Protection |
|----------|------------|
| `get.ts` | Restricts to `src/content/` and `src/data/` paths only |
| `upload.ts` | Restricts to `public/images/` and `public/docs/`, rejects `..` and `//` |
| `save.ts` | Validates key as `^[a-z0-9-]+$` |
| `delete.ts` | Validates key as `^[a-z0-9-]+$` |

---

## 6. Duplicate / Similar Endpoints

### 6.1 Content CRUD Overlap

| Endpoint | Overlaps With | Issue |
|----------|---------------|-------|
| `POST /api/admin/save` | — | Single endpoint handles both draft (KV) and publish (GitHub) via `status` param. Clean design. |
| `GET /api/admin/load` + `GET /api/admin/get` | — | Clear separation: load=list (manifest), get=fetch one file. Good. |

### 6.2 AI Content Generation Overlap

| Endpoint | Purpose | Issue |
|----------|---------|-------|
| `POST /api/admin/ai-product` | Single product copy generation | Distinct from batch |
| `POST /api/admin/ai-batch-generate` | Batch product copy generation | Overlaps in AI role (both use product_copywriter). Could be unified with a `mode` param. |
| `POST /api/admin/ai-assist` (task=optimize_body) | Content improvement suggestions | Overlaps conceptually with ai-batch-generate for product descriptions. Different scopes (CMS content vs commerce products). |

### 6.3 Translation Overlap

| Endpoint | Target | AI Role |
|----------|--------|---------|
| `POST /api/admin/translate-products` | Backfill EN for imported products | translator + translator_title |
| `POST /api/admin/import-1688` (SKU translation) | SKU names during import | translator |
| `POST /api/admin/import-excel` (attribute translation) | Attribute/spec values during import | translator |
| `POST /api/admin/video-center` (translate action) | Video title/description EN→ES/DE | video_translator |

**Consolidation opportunity**: The first three all use the `translator` role with slightly different prompts. Could be unified into a single `POST /api/admin/translate` endpoint with a `target` parameter.

### 6.4 Opportunity / Growth Overlap

| Endpoint | Purpose | Issue |
|----------|---------|-------|
| `POST /api/admin/ai-opportunities` | Scan GSC snapshots for low-CTR keywords | Legacy V4 endpoint. Overlaps with growth-sync which does the same plus more (intent mapping, Growth Score, task routing). |
| `POST /api/admin/growth-sync` | Full Organic Growth Intelligence sync | V5.34+ replacement for ai-opportunities. More comprehensive. |
| `POST /api/admin/cron-pull` (phase=growth) | Calls runGrowthSync internally | Same as growth-sync endpoint but triggered from cron. Redundant endpoint. |

**Recommendation**: Deprecate `ai-opportunities` in favor of `growth-sync`/`growth-board`.

### 6.5 AI Call Helpers Overlap

Two AI call layers exist:
1. `functions/api/admin/deepseek.ts` — `deepseekChat()`, `deepseekJson()`, `loadKnowledgeContext()`, `saveKnowledge()`, `extractAndSaveInsights()`
2. `functions/lib/ai.ts` — `aiCall()`, `aiJson()`, `loadKnowledgeContext()`, `saveKnowledge()`, `loadRole()`, `trackUsage()`, etc.

The `lib/ai.ts` is the newer, more feature-complete layer (budget tracking, provider routing, role loading). The `deepseek.ts` helpers are an older wrapper that some endpoints still use directly.

**Recommendation**: Migrate all endpoints using `deepseek.ts` directly to use `lib/ai.ts` for consistent budget tracking and provider routing.

---

## 7. DB Tables Reference

### 7.1 D1 Tables Read

| Table | Read By (Endpoints) |
|-------|---------------------|
| `gsc_daily` | stats.ts, os-audit.ts, os-daily.ts, os-reports.ts, cron-pull.ts, growth-board.ts, growth-sync.ts (via lib), ai-command-center.ts, task-execute.ts (snapshot) |
| `ga_daily` | stats.ts, os-audit.ts, os-daily.ts, os-reports.ts, cron-pull.ts, growth-board.ts, ai-command-center.ts |
| `gsc_query_page` | cron-pull.ts, growth-sync.ts (via lib) |
| `behavior_events` | stats.ts, os-daily.ts, os-reports.ts, ai-brief.ts, ai-command-center.ts |
| `inquiries` | inquiries.ts, email-send.ts, email-thread.ts, ai-lead-score.ts, ai-brief.ts, stats.ts, os-daily.ts, os-reports.ts, ai-command-center.ts |
| `commerce_products` | commerce-products.ts, commerce-reviews.ts, merchandising.ts, import-1688.ts, import-excel.ts, translate-products.ts, migrate-images.ts, ai-batch-generate.ts, image-nos.ts, commit-localized-image.ts, growth-board.ts, video-center.ts |
| `commerce_product_variants` | commerce-products.ts, translate-products.ts, migrate-images.ts |
| `commerce_price_tiers` | commerce-products.ts, growth-board.ts |
| `commerce_product_images` | commerce-products.ts |
| `commerce_image_nos` | commerce-products.ts, image-nos.ts |
| `commerce_orders` | commerce-orders.ts, ai-brief.ts |
| `commerce_order_items` | commerce-orders.ts |
| `commerce_order_events` | commerce-orders.ts |
| `commerce_product_reviews` | commerce-reviews.ts |
| `commerce_product_questions` | commerce-reviews.ts |
| `commerce_import_jobs` | import-1688.ts, import-excel.ts |
| `commerce_import_errors` | import-1688.ts, import-excel.ts |
| `product_merchandising` | merchandising.ts, growth-board.ts |
| `subscribers` | subscribers.ts |
| `tasks` | os-tasks.ts, os-data.ts, os-daily.ts, os-reports.ts, task-execute.ts, growth-board.ts, ai-command-center.ts |
| `task_runs` | os-data.ts |
| `ai_roles` | ai-roles.ts, ai-product.ts, ai-batch-generate.ts, os-daily.ts (via loadRole) |
| `ai_usage` | ai-roles.ts, os-data.ts, ai-command-center.ts, autonomy.ts (via lib/ai) |
| `ai_feedback` | ai-feedback.ts, os-daily.ts |
| `ai_missions` | ai-command-center.ts, task-execute.ts (via mission-log) |
| `ai_action_logs` | ai-command-center.ts |
| `ai_mission_plan` | ai-command-center.ts |
| `ai_reports` | os-reports.ts, os-data.ts, os-daily.ts |
| `ai_daily_briefs` | ai-brief.ts, ai-command-center.ts |
| `ai_daily_report` | ai-brief.ts, ai-command-center.ts |
| `ai_opportunities` | ai-opportunities.ts |
| `ai_lead_scores` | ai-lead-score.ts |
| `knowledge` | knowledge.ts, os-daily.ts, os-reports.ts, os-data.ts, ai-command-center.ts |
| `knowledge_base` | knowledge.ts, os-data.ts, deepseek.ts (loadKnowledgeContext) |
| `decisions` | os-data.ts, os-daily.ts |
| `audit_issues` | os-audit.ts, os-data.ts |
| `daily_recs` | stats.ts, cron-pull.ts |
| `email_messages` | email-thread.ts |
| `pull_state` | cron-pull.ts, stats.ts (availability) |
| `growth_opportunities` | growth-board.ts, growth-sync.ts (via lib), ai-command-center.ts |
| `growth_actions` | growth-board.ts |
| `index_status` | growth-board.ts, growth-sync.ts (via lib) |
| `google_snapshots` | ai-opportunities.ts |
| `video_assets` | video-center.ts, video-content-package/*.ts |
| `video_product_links` | video-center.ts |
| `video_publications` | video-center.ts, video-content-package/[id]/status.ts |
| `video_asset_translations` | video-center.ts, video-content-package/*.ts |
| `video_transcripts` | video-center.ts, video-content-package/*.ts |

### 7.2 D1 Tables Written

| Table | Written By (Endpoints) |
|-------|------------------------|
| `gsc_daily` | cron-pull.ts (UPSERT) |
| `gsc_query_page` | cron-pull.ts (UPSERT) |
| `ga_daily` | cron-pull.ts (UPSERT) |
| `inquiries` | inquiries.ts (UPDATE/DELETE), email-send.ts (UPDATE) |
| `commerce_products` | commerce-products.ts (INSERT/UPDATE/DELETE), import-1688.ts (INSERT), import-excel.ts (INSERT), translate-products.ts (UPDATE), migrate-images.ts (UPDATE), ai-batch-generate.ts (UPDATE), commit-localized-image.ts (UPDATE), video-center.ts (UPDATE) |
| `commerce_product_variants` | commerce-products.ts (INSERT/DELETE), import-1688.ts (INSERT), import-excel.ts (INSERT), translate-products.ts (UPDATE), migrate-images.ts (UPDATE) |
| `commerce_price_tiers` | commerce-products.ts (INSERT/DELETE), import-excel.ts (INSERT) |
| `commerce_product_images` | commerce-products.ts (via ensureImageNos), import-1688.ts (INSERT) |
| `commerce_image_nos` | commerce-products.ts (INSERT OR IGNORE), image-nos.ts (INSERT OR IGNORE) |
| `commerce_orders` | commerce-orders.ts (UPDATE) |
| `commerce_order_events` | commerce-orders.ts (INSERT) |
| `commerce_product_reviews` | commerce-reviews.ts (UPDATE) |
| `commerce_product_questions` | commerce-reviews.ts (UPDATE) |
| `commerce_import_jobs` | import-1688.ts (INSERT/UPDATE/DELETE), import-excel.ts (INSERT/UPDATE) |
| `commerce_import_errors` | import-1688.ts (INSERT/DELETE), import-excel.ts (INSERT) |
| `product_merchandising` | merchandising.ts (INSERT/DELETE) |
| `subscribers` | subscribers.ts (CREATE TABLE, DELETE) |
| `tasks` | os-tasks.ts (UPDATE), os-daily.ts (INSERT), content-generate.ts (INSERT), task-execute.ts (UPDATE), growth-sync.ts (via lib) |
| `task_runs` | task-execute.ts (via lib/idempotency) |
| `ai_roles` | ai-roles.ts (UPDATE) |
| `ai_usage` | deepseek.ts (via trackUsage), lib/ai.ts (via trackUsage) |
| `ai_feedback` | ai-feedback.ts (INSERT), os-daily.ts (UPDATE consumed) |
| `ai_missions` | os-daily.ts (via mission-log), cron-pull.ts (via mission-log), task-execute.ts (via mission-log), autonomy.ts (via mission-log) |
| `ai_action_logs` | os-daily.ts (via mission-log), cron-pull.ts (via mission-log), task-execute.ts (via mission-log) |
| `ai_mission_plan` | cron-pull.ts (via mission-log) |
| `ai_reports` | os-reports.ts (INSERT), os-daily.ts (INSERT) |
| `ai_daily_briefs` | ai-brief.ts (INSERT) |
| `ai_daily_report` | os-daily.ts (via mission-log), cron-pull.ts (via mission-log) |
| `ai_opportunities` | ai-opportunities.ts (INSERT/UPDATE) |
| `ai_lead_scores` | ai-lead-score.ts (INSERT) |
| `knowledge` | os-daily.ts (via lib/ai saveKnowledge), knowledge.ts (DELETE), task-execute.ts (via saveKnowledge) |
| `knowledge_base` | knowledge.ts (INSERT/DELETE), deepseek.ts (saveKnowledge) |
| `decisions` | os-tasks.ts (via recordDecision), os-daily.ts (via recordDecision) |
| `audit_issues` | os-audit.ts (INSERT/UPDATE) |
| `daily_recs` | cron-pull.ts (INSERT/DELETE) |
| `email_messages` | email-send.ts (INSERT) |
| `pull_state` | cron-pull.ts (UPSERT) |
| `growth_opportunities` | growth-sync.ts (via lib) |
| `index_status` | growth-sync.ts (via lib) |
| `video_assets` | video-center.ts (INSERT/UPDATE/DELETE), video-content-package/init.ts (INSERT), video-content-package/[id]/*.ts (UPDATE) |
| `video_product_links` | video-center.ts (INSERT/DELETE) |
| `video_publications` | video-center.ts (INSERT/UPDATE) |
| `video_asset_translations` | video-center.ts (UPSERT), video-content-package/[id]/generate.ts (UPSERT), video-content-package/[id]/apply.ts (UPSERT) |
| `video_transcripts` | video-content-package/[id]/transcript.ts (UPSERT) |

---

## 8. Error Handling Patterns

### 8.1 Consistent Patterns

All endpoints use `shared.ts` `json()` helper which produces `{error: "message"}` with appropriate HTTP status codes:

| Status | Usage |
|--------|-------|
| 400 | Bad request, invalid JSON, missing fields |
| 401 | Unauthorized (bad/missing cookie) |
| 403 | Forbidden (path restriction, manual-only task) |
| 404 | Not found (file, inquiry, product, etc.) |
| 405 | Method not allowed |
| 413 | File too large |
| 422 | Validation failed (missing required fields, invalid values) |
| 429 | Rate limited (login), budget exceeded (task-execute) |
| 500 | Internal error, DB unavailable |
| 502 | Upstream failure (GitHub API, AI API) |
| 503 | Service unavailable (no API key, R2 unavailable, budget exhausted) |

### 8.2 AI Failure Handling

All AI-dependent endpoints fail gracefully:
- Return `null` on any failure → caller returns 502 or degrades to rule-based fallback
- Budget exhaustion returns 503
- Missing API key returns 503 with descriptive Chinese error message

### 8.3 Notable Patterns

- `import-1688.ts` and `import-excel.ts`: AI translation failures are **non-blocking** — imports proceed with raw Chinese names
- `cron-pull.ts` AI recs: Falls back to rule-based analysis when AI is unavailable
- `content-generate.ts`: Quality/truthfulness gate failures are recorded as `rejected` (not errors) with `finishRun("success")` to prevent budget-wasting retries

---

## 9. V2 Migration Notes Per Endpoint

| Endpoint | Stability | V2 Recommendation |
|----------|-----------|-------------------|
| `login.ts` | 稳定可复用 | Keep as-is. Add 2FA? |
| `logout.ts` | 稳定可复用 | Keep as-is. |
| `load.ts` | 稳定可复用 | Keep. Good V3 fix (single manifest subrequest). |
| `get.ts` | 稳定可复用 | Keep. |
| `save.ts` | 稳定可复用 | Keep. Server-side validation is solid. |
| `delete.ts` | 稳定可复用 | Keep. |
| `upload.ts` | 稳定可复用 | Keep. |
| `upload-image.ts` | 稳定可复用 | Keep. |
| `upload-video.ts` | 稳定可复用 | Keep. |
| `settings.ts` | 稳定可复用 | Keep. |
| `faqs.ts` | 稳定可复用 | Keep. |
| `ai-roles.ts` | 稳定可复用 | Keep. |
| `ai-provider.ts` | 稳定可复用 | Keep. |
| `autonomy.ts` | 稳定可复用 | Keep. |
| `ai-assist.ts` | 稳定可复用 | Migrate from deepseek.ts → lib/ai.ts for consistent budget tracking. |
| `ai-product.ts` | 稳定可复用 | Migrate from deepseek.ts → lib/ai.ts. |
| `ai-batch-generate.ts` | 需重构 | Migrate to lib/ai.ts; add batch budget check; consider merging with ai-product. |
| `ai-brief.ts` | 需重构 | Legacy endpoint; health_score field is deprecated (SSOT is ai_daily_report). Could be merged into ai-command-center. |
| `commerce-products.ts` | 稳定可复用 | Keep. Very large file (718 lines) — consider splitting CRUD handlers into separate files. |
| `commerce-orders.ts` | 稳定可复用 | Keep. |
| `commerce-reviews.ts` | 稳定可复用 | Keep. |
| `merchandising.ts` | 稳定可复用 | Keep. |
| `import-1688.ts` | 需重构 | Migrate AI calls to lib/ai.ts; large file (551 lines). |
| `import-excel.ts` | 需重构 | Migrate AI calls to lib/ai.ts; large file (521 lines). |
| `translate-products.ts` | 需重构 | Migrate AI calls to lib/ai.ts; could be unified with other translation endpoints. |
| `migrate-images.ts` | 需替换 | One-time migration tool. Once all alicdn URLs are migrated, this can be removed. |
| `inquiries.ts` | 稳定可复用 | Keep. |
| `subscribers.ts` | 稳定可复用 | Keep. |
| `ai-lead-score.ts` | 稳定可复用 | Keep. (Rule-based, not AI despite name.) |
| `email-send.ts` | 稳定可复用 | Keep. |
| `email-thread.ts` | 稳定可复用 | Keep. |
| `os-data.ts` | 仅UI调用 | Keep as read-only aggregator. |
| `os-tasks.ts` | 稳定可复用 | Keep. |
| `os-audit.ts` | 需重构 | Migrate AI calls to lib/ai.ts. |
| `os-reports.ts` | 需重构 | Migrate AI calls to lib/ai.ts. |
| `os-daily.ts` | Cron专用 | Very large file (931 lines). Consider splitting 4-step pipeline into separate files. Already uses lib/ai.ts (good). |
| `ai-command-center.ts` | 仅UI调用 | Keep as read-only dashboard aggregator. |
| `content-generate.ts` | 需重构 | Solid safety gates. Migrate from deepseek.ts path to lib/ai.ts path for writer model resolution. |
| `ai-opportunities.ts` | 需重构 | Legacy — replace with growth-sync/growth-board. |
| `growth-sync.ts` | Cron专用 | Keep. |
| `growth-board.ts` | 仅UI调用 | Keep as read-only dashboard. |
| `cron-pull.ts` | Cron专用 | Very large file (901 lines). Consider splitting per-phase. |
| `task-execute.ts` | Cron专用 | Keep. Solid 4-gate chain. |
| `video-center.ts` | 稳定可复用 | Very large file (1157 lines). Consider splitting action handlers. |
| `video-content-package/*` | 稳定可复用 | Keep. Clean modular design. |
| `knowledge.ts` | 稳定可复用 | Keep. |
| `ai-feedback.ts` | 稳定可复用 | Keep. |
| `image-nos.ts` | 稳定可复用 | Keep. |
| `commit-localized-image.ts` | 稳定可复用 | Keep. |
| `stats.ts` | 仅UI调用 | Keep as read-only analytics aggregator. |

---

## 10. Summary Statistics

| Category | Count |
|----------|-------|
| Total API endpoints | 57 |
| Auth required (admin cookie) | 57 (all) |
| Cron-accessible endpoints | 7 (cron-pull, os-daily, os-reports, os-audit, growth-sync, task-execute, content-generate) |
| Cron-only endpoints | 1 (cron-pull — no admin cookie fallback) |
| Endpoints writing to GitHub | 6 (save, delete, upload, settings, faqs, content-generate for check only) |
| Endpoints writing to R2 | 8 (upload-image, upload-video, import-1688, migrate-images, video-center, video-content-package/video, video-content-package/cover) |
| Endpoints calling AI APIs | 16 |
| AI roles invoked | 10+ (analyst, librarian, strategist, executor, auditor, translator, translator_title, product_copywriter, content_writer, video_translator, ai_brief, report-*) |
| External services | 8 (GitHub API, GSC API, GA4 API, Google OAuth2, DeepSeek/SiliconFlow API, Resend API, R2, Cloudflare Turnstile) |
| D1 tables read | 40+ |
| D1 tables written | 35+ |
| "稳定可复用" | 33 endpoints |
| "需重构" | 12 endpoints |
| "需替换" | 1 endpoint (migrate-images) |
| "仅UI调用" | 5 endpoints |
| "Cron专用" | 5 endpoints |

---

*Document generated by reading all source files in `functions/api/admin/`, `functions/api/_lib/`, and `functions/lib/`. No guessing — only documented what was found in source code.*