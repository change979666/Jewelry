# V2 P0-8: 新旧对应关系
## New-Old Mapping

> 基于 V2 设计规范 + 5 份审计报告 + P0-2（页面地图）+ P0-3（API 地图）+ P0-4（DB 地图）
> 日期：2026-08-24

---

## 1. 页面/视图映射（V1 → V2）

### 1.1 独立页面映射

| V1 页面 | V1 路由 | V2 模块 | V2 路由 | 处理方式 |
|---------|---------|---------|---------|---------|
| `admin/index.astro` (Dashboard) | `/admin` | Dashboard V2 | `/admin` | 完全重写，保留 KPI 数据源 |
| `admin/index.astro` (Content) | `/admin` (view state) | Content Center | `/admin/content` | 拆分为独立页面，复用旧 API |
| `admin/index.astro` (Products) | `/admin` (view state) | Product Content | `/admin/content/products` | 拆分为独立页面 |
| `admin/index.astro` (Commerce) | `/admin` (view state) | Commerce Center | `/admin/commerce` | 拆分为独立页面 |
| `admin/index.astro` (Customers) | `/admin` (view state) | Customer Center | `/admin/customers` | 拆分为独立页面 |
| `admin/index.astro` (Inquiries) | `/admin` (view state) | Customer Center | `/admin/customers/inquiries` | 拆分为独立页面 |
| `admin/index.astro` (SEO/Analytics) | `/admin` (view state) | Growth Center | `/admin/growth` | 拆分为独立页面 |
| `admin/index.astro` (AI Panel) | `/admin` (view state) | AI Center | `/admin/ai` | 拆分为独立页面 |
| `admin/index.astro` (Settings) | `/admin` (view state) | System Settings | `/admin/system` | 拆分为独立页面 |
| `admin/command-center.astro` | `/admin/command-center` | AI Center | `/admin/ai/command-center` | 保留 + 融入 V2 AI 总控台 |
| `admin/os.astro` | `/admin/os` | Growth + AI | `/admin/growth` + `/admin/ai/daily` | 拆分：增长部分 → Growth，AI 日报 → AI |
| `admin/video-center.astro` | `/admin/video-center` | Media Center | `/admin/media/videos` | 保留五步流水线，加 AI Score |
| `admin/faqs.astro` | `/admin/faqs` | Content Center | `/admin/content/faqs` | 融入统一内容列表 |

### 1.2 SPA 内嵌视图映射（admin/index.astro 的 19 个视图）

| V1 视图 | V1 触发 | V2 归属 | V2 页面 |
|---------|---------|---------|---------|
| Dashboard | 默认 | Dashboard V2 | `/admin` |
| Content List (Blog) | 侧边栏 | Content Center | `/admin/content/blogs` |
| Content List (Products) | 侧边栏 | Content Center | `/admin/content/products` |
| Content List (Guides) | 侧边栏 | Content Center | `/admin/content/guides` |
| Content List (Cases) | 侧边栏 | Content Center | `/admin/content/cases` |
| Content Editor | 新建/编辑 | Content Editor V2 | `/admin/content/blogs/edit/:id` |
| Commerce Products | 侧边栏 | Commerce Center | `/admin/commerce/products` |
| Commerce Product Edit | 编辑 | Commerce Editor V2 | `/admin/commerce/products/:id` |
| Commerce Orders | 侧边栏 | Commerce Center | `/admin/commerce/orders` |
| Customer List | 侧边栏 | Customer Center | `/admin/customers` |
| Inquiry List | 侧边栏 | Customer Center | `/admin/customers/inquiries` |
| Inquiry Detail | 点击 | Inquiry Drawer | 右侧 Drawer（不独立路由） |
| 1688 Import | 侧边栏 | Commerce Center | `/admin/commerce/import` |
| Excel Import | 侧边栏 | Commerce Center | `/admin/commerce/import` |
| Merchandising | 侧边栏 | Commerce Center | `/admin/commerce/merchandising` |
| SEO/GSC Dashboard | 侧边栏 | Growth Center | `/admin/growth/seo` |
| Analytics Dashboard | 侧边栏 | Growth Center | `/admin/growth/analytics` |
| AI Assist Panel | 多入口 | 每个对象内嵌 AI Panel | 非独立页面 |
| Settings | 侧边栏 | System Settings | `/admin/system` |
| Subscribers | 侧边栏 | Customer Center | `/admin/customers/subscribers` |

### 1.3 V2 全新页面（无 V1 对应）

| V2 页面 | V2 路由 | 来源 |
|---------|---------|------|
| Content: Copy Assets | `/admin/content/copy` | V2 §10 全新 |
| Content: Recycle Bin | `/admin/content/recycle-bin` | V2 §30 全新 |
| Content: Bulk Center | `/admin/content/bulk` | V2 §31 全新 |
| Customer: OEM Projects | `/admin/customers/oem` | V2 §11 全新 |
| Customer: OEM Detail | `/admin/customers/oem/:id` | V2 §11 全新 |
| Customer: Quotes | `/admin/customers/quotes` | V2 §16 全新 |
| Customer: Customer 360 | `/admin/customers/:id` | V2 §15 全新 |
| Customer: Emails | `/admin/customers/emails` | V2 §14 全新 |
| Media: Asset Library | `/admin/media` | V2 §18 全新 |
| Media: File/Certs | `/admin/media/files` | V2 §18 全新 |
| Growth: Opportunities | `/admin/growth/opportunities` | V2 §26 重构 |
| Growth: Experiments | `/admin/growth/experiments` | V2 §26 重构 |
| Growth: SEO Inspector | `/admin/growth/seo/inspect/:url` | V2 §24 全新 |
| AI: Task Queue | `/admin/ai/tasks` | V2 §23 全新 |
| AI: Role Center | `/admin/ai/roles` | V2 保留+扩展 |
| AI: Automation Rules | `/admin/ai/rules` | V2 §22 全新 |
| AI: Cost Dashboard | `/admin/ai/cost` | V2 §19 全新 |
| System: Users & Roles | `/admin/system/users` | V2 §33 全新 |
| System: Audit Log | `/admin/system/audit` | V2 §35 全新 |
| System: Knowledge Base | `/admin/system/knowledge` | V2 §27 扩展 |
| System: Health | `/admin/system/health` | V2 全新 |

---

## 2. API 映射（V1 → V2）

### 2.1 V1 API → V2 API 精确映射

| V1 API | Method | V2 API | 处理方式 |
|--------|--------|--------|---------|
| `/api/admin/login` | POST | `/api/admin/v2/auth/login` | 保留旧路由 + 新路由，内部分享逻辑 |
| `/api/admin/logout` | POST | `/api/admin/v2/auth/logout` | 同上 |
| `/api/admin/load` | GET | `/api/admin/v2/content/load` | 兼容路由：旧→新转发 |
| `/api/admin/save` | POST | `/api/admin/v2/content/save` | 兼容路由，叠加版本层 |
| `/api/admin/delete` | POST | `/api/admin/v2/content/delete` | 改为软删除 |
| `/api/admin/get` | GET | `/api/admin/v2/content/get` | 兼容路由 |
| `/api/admin/upload` | POST | `/api/admin/v2/media/upload` | 兼容路由 |
| `/api/admin/upload-image` | POST | `/api/admin/v2/media/upload-image` | 兼容路由 |
| `/api/admin/upload-video` | POST | `/api/admin/v2/media/upload-video` | 兼容路由 |
| `/api/admin/faqs` | GET/POST | `/api/admin/v2/content/faqs` | 兼容路由 |
| `/api/admin/settings` | GET/POST | `/api/admin/v2/system/settings` | 兼容路由 |
| `/api/admin/stats` | GET | `/api/admin/v2/dashboard/stats` | 兼容路由，补充数据 |
| `/api/admin/commerce-products` | GET/POST/PUT | `/api/admin/v2/commerce/products` | 兼容路由 |
| `/api/admin/commerce-orders` | GET/PUT | `/api/admin/v2/commerce/orders` | 兼容路由 |
| `/api/admin/commerce-reviews` | GET/PUT | `/api/admin/v2/commerce/reviews` | 兼容路由 |
| `/api/admin/inquiries` | GET/PUT | `/api/admin/v2/customers/inquiries` | 兼容路由 |
| `/api/admin/subscribers` | GET | `/api/admin/v2/customers/subscribers` | 兼容路由 |
| `/api/admin/import-1688` | POST | `/api/admin/v2/commerce/import/1688` | 兼容路由 |
| `/api/admin/import-excel` | POST | `/api/admin/v2/commerce/import/excel` | 兼容路由 |
| `/api/admin/merchandising` | GET/POST | `/api/admin/v2/commerce/merchandising` | 兼容路由 |
| `/api/admin/translate-products` | POST | `/api/admin/v2/commerce/translate` | 兼容路由 |
| `/api/admin/email-send` | POST | `/api/admin/v2/customers/emails/send` | 兼容路由 |
| `/api/admin/email-thread` | GET | `/api/admin/v2/customers/emails/thread` | 兼容路由 |
| `/api/admin/ai-*` (系列) | GET/POST | `/api/admin/v2/ai/*` | 全部迁移到 V2 统一 AI Action |
| `/api/admin/video-center` | GET/POST/PUT | `/api/admin/v2/media/videos` | 兼容路由，保留管线 |
| `/api/admin/gsc/*`, `/api/admin/ga4/*` | GET | `/api/admin/v2/growth/*` | 兼容路由 |
| `/api/admin/cron-pull` | Cron | 不变 | 内部任务，不迁移 |
| `/api/admin/task-execute` | POST | `/api/admin/v2/ai/tasks/execute` | 内部 |
| `/api/admin/content-generate` | POST | `/api/admin/v2/ai/content/generate` | 内部 |
| `/api/admin/os-*` (系列) | GET/POST | `/api/admin/v2/growth/*` + `/api/admin/v2/ai/*` | 拆分 |

### 2.2 V2 全新 API（无 V1 对应）

```
/api/admin/v2/auth/me                    GET    — 当前用户信息+权限
/api/admin/v2/dashboard/kpi              GET    — 4 个核心 KPI
/api/admin/v2/dashboard/ai-status        GET    — AI 今日状态
/api/admin/v2/dashboard/recent           GET    — 最近工作
/api/admin/v2/dashboard/action-items     GET    — 需要处理
/api/admin/v2/content/copy-assets/*      CRUD   — 文案资产
/api/admin/v2/content/bulk               POST   — 批量操作
/api/admin/v2/content/recycle-bin/*      GET/PUT/DELETE — 回收站
/api/admin/v2/commerce/calculate-margin  POST   — 利润率计算器
/api/admin/v2/customers/*                CRUD   — 客户档案
/api/admin/v2/customers/oem/*            CRUD   — OEM 项目
/api/admin/v2/customers/oem/calculate    POST   — OEM 计算器
/api/admin/v2/customers/quotes/*         CRUD   — 报价
/api/admin/v2/media/assets/*             CRUD   — 媒体资产
/api/admin/v2/ai/execute                 POST   — 统一 AI 执行
/api/admin/v2/ai/approve                 PUT    — AI 结果批准
/api/admin/v2/ai/reject                  PUT    — AI 结果拒绝
/api/admin/v2/ai/rollback                POST   — AI 操作回滚
/api/admin/v2/ai/tasks/*                 CRUD   — AI 任务管理
/api/admin/v2/ai/rules/*                 CRUD   — AI 自动化规则
/api/admin/v2/growth/opportunities/*     CRUD   — 增长机会
/api/admin/v2/growth/experiments/*       CRUD   — 实验管理
/api/admin/v2/growth/seo/inspect         GET    — SEO 检查
/api/admin/v2/system/users/*             CRUD   — 用户管理
/api/admin/v2/system/audit               GET    — 审计日志
/api/admin/v2/system/notifications/*     CRUD   — 通知
/api/admin/v2/search                     GET    — 全局搜索
```

### 2.3 处理方式说明

| 处理方式 | 含义 | 数量 |
|---------|------|------|
| **保留旧路由** | V1 路由继续工作，内部不变 | 全部 V1 API（~30 个） |
| **+新路由** | 新增 `/api/admin/v2/` 版本，内部可共享业务逻辑 | ~15 个 |
| **兼容路由** | V1 路由保留，内部转发到 V2 实现 | ~20 个 |
| **废弃（30天后）** | Phase 14 后下线 | 待定 |

---

## 3. DB 表映射（V1 → V2）

### 3.1 保留不变的表

| V1 表 | 说明 |
|-------|------|
| `commerce_products` | 保留，+ soft delete 列 |
| `commerce_orders` | 保留，+ soft delete 列 |
| `commerce_reviews` | 保留 |
| `commerce_categories` | 保留 |
| `video_media` | 保留，+ soft delete 列 |
| `video_content` | 保留，+ soft delete 列 |
| `video_translations` | 保留 |
| `video_ai_drafts` | 保留 |
| `video_publish_status` | 保留 |
| `video_products` | 保留 |
| `video_seo` | 保留 |
| `gsc_queries` | 保留 |
| `gsc_query_page` | 保留 |
| `ga4_data` | 保留 |
| `growth_opportunities` | 保留 |
| `growth_actions` | 保留 |
| `growth_experiments` | 保留 |
| `ai_roles` | 保留，+扩展 |
| `ai_missions` | 保留 |
| `ai_actions` | 保留 |
| `ai_budget` | 保留 |
| `import_jobs` | 保留，+扩展列 |

### 3.2 需要新增列的表

| V1 表 | 新增列 |
|-------|--------|
| `commerce_products` | `deleted_at`, `deleted_by`, `created_by`, `updated_by`, `version` |
| `commerce_orders` | `deleted_at`, `deleted_by` |
| `video_media` | `deleted_at`, `deleted_by` |
| `video_content` | `deleted_at`, `deleted_by` |
| `growth_opportunities` | `deleted_at` |
| `growth_actions` | `deleted_at` |
| 其他内容相关表 | `deleted_at`, `deleted_by`（逐表评估） |

### 3.3 V2 全新表

见 P0-7 §6.1（18 张新表）。

### 3.4 废弃/被取代表处理（P0-4 核查确认 8 张）

| V1 表 | 被替代为 | V2 处理 |
|-------|---------|---------|
| `knowledge_base` | `knowledge` (0009) — 分层+衰减+证据+置信度 | Phase 14 废弃，数据迁移后 DROP |
| `daily_recs` | `growth_opportunities` (0031) + `ai_opportunities` (0014) | Phase 14 废弃，DROP |
| `experiments` | `growth_actions` (0031) — before/after/outcome 更强 | Phase 14 废弃，迁移活跃实验后 DROP |
| `ai_opportunities` | `growth_opportunities` (0031) — week 去重+exec_level+intent+score_json | Phase 14 废弃，数据迁移后 DROP |
| `ai_daily_briefs` | `ai_daily_report` (0037) — 日报+健康分更丰富 | Phase 14 废弃，确认 cron 已切后 DROP |
| `ai_usage` | `ai_cost_tracking` (0037) — 按日期×模型更细粒度 | Phase 14 废弃，迁移历史成本后 DROP |
| `ai_reports` | `ai_daily_report` (0037) — 日报结构更强 | Phase 14 废弃，DROP |
| `decisions` | `ai_feedback` (0019) — 更丰富的反馈类型 | Phase 14 废弃，合并决策到 feedback 后 DROP |

**待定 3 张**（P0-4 标记为「需 API usage audit 确认活跃状态」）：
| `email_messages` | `gsc_query_page` | `growth_actions` |
|---|---|---|
| Phase 0 结束后核查引用，确定保留/扩展/废弃 | 同上 | 同上（可能需新增列而非废弃） |

**废弃前置条件（每张表）**：① 确认无 API 仍读取 ② 确认 cron 不写入 ③ 有价值数据已迁移 ④ 在 Phase 14 执行 DROP migration。

---

## 4. AI 角色映射（V1 → V2）

| V1 角色 | V2 角色 | 处理 |
|---------|---------|------|
| 全部 12+ 现有角色 | 保留原名 | 全部保留，system prompt 不变 |
| — | 新增：per-object AI actions | 每个业务对象注册 AI Actions |
| — | 新增：automation rules executor | AI 自动化规则引擎 |

---

## 5. 不再需要的旧代码（下线时机）

| 代码 | 下线 Phase | 原因 |
|------|-----------|------|
| `admin/index.astro` 壳层部分 | Phase 1 | 被 AdminShell 替换 |
| `admin/index.astro` 业务视图 | Phase 4-11 | 逐模块迁移后删除对应片段 |
| 旧 API（兼容路由 30 天后） | Phase 14+30d | 确认无调用方后下线 |
| 旧组件内联代码 | Phase 4-13 | 被统一组件替换 |

---

## 6. 迁移优先级矩阵

```
        高影响
          │
  OEM     │   Copy Assets
  RBAC    │   Customer 360
  Audit   │   Soft Delete
  Version │
          │
──────────┼────────── 低影响
          │
  Global  │   Polish
  Search  │   Import Center
  Notif   │
          │
          ▼
        低影响
```

**核心原则**：先基础（Shell/RBAC/Audit/Version）→ 再业务（Dashboard/Content/Commerce/Customer/OEM）→ 再 AI → 再增长 → 最后系统收尾。

---

*本文基于源码审计和 V2 设计规范。每项映射可追溯至具体源码或设计节号。*