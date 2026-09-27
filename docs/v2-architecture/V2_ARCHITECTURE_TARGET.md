# V2 P0-7: V2 目标架构
## V2 Target Architecture

> 基于《Aromiso CMS V2 总体设计规范》（58 节，2111 行）+ 5 份审计报告
> 日期：2026-08-24

---

## 1. V2 架构全景图

```
┌──────────────────────────────────────────────────────────────────┐
│                     Aromiso CMS V2                                │
│              Business Operating System                            │
│       CMS + Commerce + CRM + OEM + AI + SEO + Analytics          │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      用户浏览器                                    │
│                                                                   │
│  /admin  ─── V2 AdminShell (替换 10,381 行 SPA)                   │
│  ┌──────────┬──────────────────────────────────────────┐         │
│  │ Sidebar  │  Main Content Area                        │         │
│  │ (240px)  │  (max 1440px)                             │         │
│  │          │  ┌────────────────────────────────────┐   │         │
│  │ A 首页   │  │ Topbar (64px)                       │   │         │
│  │ B 内容   │  │ Breadcrumb | Global Search | AI 🔔   │   │         │
│  │ C 商品   │  ├────────────────────────────────────┤   │         │
│  │ D 客户   │  │                                     │   │         │
│  │ E 媒体   │  │  Module Page                        │   │         │
│  │ F 增长   │  │  (Astro page + islands)              │   │         │
│  │ G AI     │  │                                     │   │         │
│  │ H 系统   │  │  Shared Components:                  │   │         │
│  │          │  │  DataTable, FilterBar, Drawer,       │   │         │
│  │          │  │  AIPanel, DiffViewer, Toast, ...     │   │         │
│  │          │  │                                     │   │         │
│  └──────────┴────────────────────────────────────────┴──┘         │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Cloudflare Pages (Edge)                          │
│                                                                   │
│  ┌────────────────────────┐  ┌────────────────────────────┐     │
│  │  Static (Astro SSG)    │  │  Functions (Workers)        │     │
│  │  - AdminShell HTML     │  │                              │     │
│  │  - Module pages        │  │  /api/admin/    (V1 兼容)    │     │
│  │  - Component bundles   │  │  /api/admin/v2/ (V2 新 API)  │     │
│  │  - R2 CDN assets       │  │                              │     │
│  └────────────────────────┘  └──────────┬───────────────────┘     │
│                                         │                          │
└─────────────────────────────────────────┼──────────────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────┐
        │                                 │                     │
        ▼                                 ▼                     ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Cloudflare  │  │  Cloudflare  │  │  Cloudflare  │  │  Cloudflare  │
│  D1          │  │  KV          │  │  R2          │  │  Queues?     │
│  (aromiso-db)│  │  (drafts)    │  │  (IMAGES+KB) │  │  (V2 异步)   │
│              │  │              │  │              │  │              │
│  V1: 52 tbls │  │  V1: drafts  │  │  V1: images  │  │  V2 NEW:     │
│  V2: +18 tbls│  │  V2: +cache  │  │  V2: +assets │  │  AI Task     │
│  = 70 tables │  │              │  │              │  │  Queue        │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘

        ┌─────────────────────────────────┬─────────────────────┐
        │                                 │                     │
        ▼                                 ▼                     ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  GitHub API  │  │  DeepSeek    │  │  GSC/GA4     │  │  Resend      │
│  (Contents)  │  │  API         │  │  APIs        │  │  (email)     │
│              │  │              │  │              │  │              │
│  V1: MD files│  │  V1: 12+     │  │  V1: data    │  │  V1: email   │
│  V2: +commit │  │   roles      │  │   collection │  │  V2: +notif  │
│     metadata │  │  V2: +actions│  │  V2: +exper  │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

---

## 2. V2 与 V1 的边界划分

### 2.1 完全不动的（保留原样）

| 组件 | 原因 |
|------|------|
| GitHub 内容发布管线 (save.ts + shared.ts) | 稳定运行，是内容 source-of-truth |
| AI 安全网四件套 (permissions/truthfulness/budget/mission-log) | 行业领先设计，完整保留 |
| 视频五步流水线 (video-center.astro + 7 D1 tables) | 最佳 UX 参考，内部逻辑保留 |
| GSC/GA4 数据采集 (cron-pull.ts) | 增长基线，持续运行 |
| HMAC 认证 (shared.ts) | Phase 2 扩展为 RBAC 的 Auth Provider，但 HMAC 机制本身保留 |
| KV 草稿系统 | 内容暂存，叠加版本层 |
| R2 存储 (IMAGES + KB) | 对象存储底层不变 |
| Astro SSG + CF Pages | 部署管线不变 |
| Content Collections + Zod | 内容校验不变 |

### 2.2 加兼容层的（保留旧 API + 新 API 共存）

| 组件 | 兼容方式 |
|------|---------|
| 内容 CRUD (save/load/delete/get) | `/api/admin/save` → 保留；新增 `/api/admin/v2/content/*` |
| 商品 CRUD (commerce-products) | 保留旧路由；新增 `/api/admin/v2/commerce/*` |
| 询盘 (inquiries) | 保留；新增 V2 format |
| FAQ (faqs.ts) | 保留；新增 V2 content 统一路由 |
| 订单 (commerce-orders) | 保留；新增 V2 |
| 导入 (import-1688, import-excel) | 保留；新增统一 Import Center |

### 2.3 全新的（V2 新增，无旧版本）

| 模块 | 范围 |
|------|------|
| AdminShell + Design System | 全新壳层 + 46 个统一组件 |
| RBAC (admin_users/roles/permissions) | 全新权限系统 |
| Audit Log (audit_logs) | 全新操作日志 |
| Version System (content_versions) | 全新版本管理 |
| Soft Delete + Recycle Bin | 全新软删除 |
| Notification Center | 全新通知系统 |
| Global Search | 全新全局搜索 |
| OEM Project Center | 全新 OEM 项目管理 |
| OEM Calculator | 全新报价计算器 |
| Customer 360 | 全新客户档案 |
| Copy Assets Center | 全新文案资产管理 |
| AI Action Standard | 全新 AI 操作统一结构 |
| AI Panel (per-object) | 全新对象内嵌 AI |
| AI Task Queue | 全新异步 AI 任务队列 |
| AI Automation Rules | 全新 WHEN/IF/THEN 规则引擎 |
| SEO Inspector | 全新页面级 SEO 评分 |
| Growth Experiment | 全新实验闭环 |
| Unified Media Library | 全新统一媒体资产库 |
| Bulk Operation Center | 全新批量操作 |
| Import Center | 全新统一导入 |
| Knowledge Base V2 | L0-L4 分层知识库 |

---

## 3. V2 数据流

### 3.1 整体数据流

```
┌────────────────────────────────────────────────────────────────┐
│                      V2 DATA FLOWS                              │
│                                                                 │
│  [User Action]                                                   │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────────┐                                               │
│  │  AdminShell  │  ─── getModule(route) ──→ Module Page         │
│  │  (auth state │      (Content/Commerce/Customer/...)          │
│  │   + RBAC)    │                                               │
│  └──────────────┘                                               │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────────┐                                               │
│  │  API Layer   │  ─── /api/admin/v2/<module>/<action>         │
│  │  (V2 format) │                                               │
│  └──────┬───────┘                                               │
│         │                                                       │
│    ┌────┴────────────────────────┐                              │
│    ▼                             ▼                              │
│  ┌──────────┐              ┌──────────┐                         │
│  │ RBAC     │              │ Validation│                        │
│  │ Gate     │              │ Layer    │                         │
│  └────┬─────┘              └────┬─────┘                         │
│       │ (pass)                  │ (pass)                        │
│       └────────┬────────────────┘                              │
│                ▼                                                │
│  ┌──────────────────────────┐                                  │
│  │   Business Logic Layer    │                                  │
│  │   (per module handler)    │                                  │
│  └──────┬──────────┬────────┘                                  │
│         │          │                                            │
│    ┌────▼────┐ ┌───▼──────────────┐                             │
│    │ D1 Read │ │ D1 Write          │                            │
│    │ /Write  │ │ + AuditLog.write  │                            │
│    │         │ │ + Version.create  │                            │
│    │         │ │ + Notify.send     │                            │
│    └────┬────┘ └───┬──────────────┘                             │
│         │          │                                            │
│    ┌────▼──────────▼────┐                                       │
│    │  AI Action (if)     │                                      │
│    │  ├─ AI Role Select  │                                      │
│    │  ├─ Truth Check     │                                      │
│    │  ├─ Budget Check    │                                      │
│    │  ├─ Model Call      │                                      │
│    │  ├─ Mission Log     │                                      │
│    │  └─ Result (pending │                                      │
│    │      or auto-apply) │                                      │
│    └────────────────────┘                                       │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Soft Delete 流

```
  User clicks "Delete"
        │
        ▼
  Frontend: ConfirmDialog ("确定要删除吗？")
        │ (confirmed)
        ▼
  PUT /api/admin/v2/content/:id
  Body: { deleted: true }
        │
        ▼
  Backend:
    UPDATE content SET deleted_at = NOW(), deleted_by = $user_id
    INSERT INTO audit_logs (action='delete', ...)
    INSERT INTO recycle_bin (entity_type, entity_id, deleted_at, deleted_by)
        │
        ▼
  Frontend: Toast "已移至回收站" + refresh list
        │
        ▼
  Later: User goes to Recycle Bin
    ├─ Restore: UPDATE SET deleted_at = NULL
    └─ Permanent Delete: actual DELETE (after ConfirmDialog "永久删除不可恢复")
```

### 3.3 AI Action 流（V2 标准）

```
  User clicks ✨ AI on any object
        │
        ▼
  AIPanel opens (Drawer, right side)
    Displays available AI Actions for this object type
        │
        ▼
  User selects an action (e.g., "优化产品描述")
        │
        ▼
  POST /api/admin/v2/ai/execute
  Body: {
    action_type: "product_desc_optimize",
    object_type: "commerce_product",
    object_id: "123",
    role: "product_copywriter",
    model: "deepseek-ai/DeepSeek-V4-Pro"
  }
        │
        ▼
  Backend:
    1. Load object current data (before snapshot)
    2. permissions.enforceMode(action_type) → L2
    3. truthfulness.checkClaims(prompt) → pass
    4. budget.consume(action_type) → within budget
    5. AI Role → DeepSeek API → response
    6. Store: ai_tasks table (status: awaiting_approval)
    7. Store: ai_draft (before + after for Diff)
    8. mission-log.log(mission_id, action_id, cost, ...)
    9. Return: { task_id, status: "awaiting_approval", diff }
        │
        ▼
  AIPanel shows Diff (before/after)
    [Accept] → PUT /api/admin/v2/ai/approve → apply + log + version
    [Reject] → PUT /api/admin/v2/ai/reject → log + discard
```

### 3.4 批量操作流

```
  User selects N items in DataTable
        │
        ▼
  BulkActionBar appears (floating toolbar)
    e.g., "已选择 8 项 | [AI 优化] [翻译] [补 SEO] [发布] [删除]"
        │
        ▼
  User clicks action
    ├─ Simple (change status)  → Batch API (sync, N ≤ 50)
    └─ Complex (AI generate)   → POST /api/admin/v2/batch
                                  Body: { action, items: [...], options: {} }
                                  → Creates batch job
                                  → Returns { job_id, total: 8 }
                                        │
                                        ▼
                                  Poll: GET /api/admin/v2/batch/:job_id
                                  → { completed: 5, failed: 1, progress: "5/8" }
                                  → Frontend progress bar
                                  → Failed items: show error, [Retry]
```

---

## 4. V2 API 架构

### 4.1 URL 命名规范

```
旧 (V1):  /api/admin/<function>.ts
          e.g., /api/admin/save, /api/admin/load, /api/admin/delete

新 (V2):  /api/admin/v2/<module>/<resource>[/<id>][/<sub-resource>]
          e.g., /api/admin/v2/content/blogs
                /api/admin/v2/content/blogs/123
                /api/admin/v2/content/blogs/123/versions
                /api/admin/v2/commerce/products
                /api/admin/v2/customers/456/oem-projects
```

### 4.2 统一响应格式

```json
// SUCCESS
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}

// ERROR
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": { "field": "title" }
  }
}
```

### 4.3 错误码体系（新定义）

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `UNAUTHORIZED` | 401 | 未登录或 token 过期 |
| `FORBIDDEN` | 403 | 已登录但无此操作权限 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `VALIDATION_ERROR` | 422 | 输入验证失败 |
| `CONFLICT` | 409 | 资源冲突（如 key 重复） |
| `RATE_LIMITED` | 429 | 请求频率超限 |
| `AI_BUDGET_EXCEEDED` | 429 | AI 调用预算耗尽 |
| `AI_TRUTH_FAILED` | 422 | AI 输出未通过真实性检查 |
| `AI_PERMISSION_DENIED` | 403 | 此 AI 操作不允许自动执行 |
| `INTERNAL_ERROR` | 500 | 服务端内部错误 |
| `EXTERNAL_SERVICE_ERROR` | 502 | 上游服务（GitHub/DeepSeek/GSC）错误 |

### 4.4 分页/筛选/排序标准

```
GET /api/admin/v2/content/blogs
  ?page=1
  &pageSize=20
  &search=lavender          (full-text search)
  &status=draft             (enum filter)
  &locale=en                (enum filter)
  &category=aromatherapy    (enum filter)
  &sort=updated_at          (column name)
  &order=desc               (asc/desc)
  &date_from=2026-01-01
  &date_to=2026-08-24

Response meta:
{
  "page": 1,
  "pageSize": 20,
  "total": 87,
  "totalPages": 5,
  "filters": {
    "status": { "draft": 8, "published": 79 },
    "locale": { "en": 45, "es": 30, "de": 12 }
  }
}
```

---

## 5. V2 前端组件树

```
AdminShell
├── Sidebar
│   ├── NavItem × 8 (Dashboard/Content/Commerce/Customers/
│   │                 Media/Growth/AI/System)
│   ├── NavGroup (可折叠分组)
│   └── UserInfo (底部：头像 + 角色 + 退出)
│
├── Topbar
│   ├── Breadcrumb
│   ├── GlobalSearch (Cmd+K — 双模式：对象搜索 + /ai 前缀触发 AI 命令)
│   ├── AIStatusIndicator (● Working / ✓ Idle)
│   ├── NotificationBell (未读计数)
│   └── UserMenu
│
└── ContentArea
    ├── Dashboard
    │   ├── KPICard × 4
    │   ├── AIStatusPanel + AISuggestions
    │   ├── FunnelChart (Inquiry + Commerce)
    │   ├── RecentList × 2 (Content + Inquiries)
    │   └── ActionItemsList
    │
    ├── ContentCenter
    │   ├── DataTable (with FilterBar, SearchBox, Pagination, BulkActionBar)
    │   ├── ContentEditor (三栏：Nav + Edit + AI/SEO)
    │   ├── CopyAssetManager
    │   └── RecycleBin
    │
    ├── CommerceCenter
    │   ├── ProductKPIBar
    │   ├── DataTable
    │   ├── ProductEditor (三栏 + PriceCalculator)
    │   ├── SKUManager
    │   ├── OrderCenter
    │   └── ImportCenter
    │
    ├── CustomerCenter
    │   ├── InquiryList (with LeadScore + AIDrawer)
    │   ├── Customer360
    │   ├── OEMProjectList
    │   ├── OEMDetail (12 Tabs + OEMCalculator)
    │   ├── QuoteManager
    │   └── EmailCenter
    │
    ├── MediaCenter
    │   ├── MediaLibrary (grid + table views)
    │   ├── VideoCenter (5-step stepper)
    │   ├── AIBatchTranslate
    │   └── AssetUploader
    │
    ├── GrowthCenter
    │   ├── SEODashboard + SEOInspector
    │   ├── AnalyticsDashboard (interactive charts)
    │   ├── BehaviorViewer
    │   ├── OpportunityList → AIAction
    │   └── ExperimentBoard (before/after)
    │
    ├── AICenter
    │   ├── AIControlTower (总控台)
    │   ├── AITaskQueue (状态列表 + retry/replay/diff/rollback)
    │   ├── AIRoleCenter
    │   ├── AIAutomationRules
    │   ├── AIDailyReport
    │   └── AICostDashboard
    │
    └── SystemSettings
        ├── SiteSettings
        ├── I18nManager
        ├── UserRoleManager (RBAC)
        ├── KnowledgeBase
        ├── AuditLogViewer
        └── SystemHealth
```

---

## 6. V2 数据库扩展

### 6.1 新增表（18 张，基于 V2 §48）

```
  系统层:
    admin_users              — 用户账户
    admin_roles              — 角色定义
    admin_permissions        — 角色-权限矩阵
    audit_logs               — 操作审计日志
    notifications            — 通知消息

  版本层:
    content_versions         — 内容版本 metadata（version/author/source/change_summary/github_commit_sha）
                               body 走 GitHub API（ADR-11）

  ~~软删除层~~:
    （无独立表 — ADR-12: deleted_at + 源表查询）

  业务层:
    customers                — 客户统一档案
    oem_projects             — OEM 项目
    oem_requirements         — OEM 需求细节
    oem_samples              — OEM 打样记录
    oem_quotes               — OEM 报价版本
    oem_files                — OEM 文件关联
    oem_timeline             — OEM 项目时间线
    copy_assets              — 文案资产
    saved_calculations       — 计算器快照

  统一搜索索引层:
    admin_entities           — Search Index（entity_type/entity_id/title/status/updated_at）
                               INV-1: 不是 Domain Model，字段永不加列
  ~~关联层~~:
    （entity_links 已取消 — ADR-13: 具体关系具体建模，用专用关联表 + FK）

  AI 层:
    ai_automation_rules      — AI 自动化规则 (WHEN/IF/THEN)
    ai_tasks                 — AI 任务队列 (统一)
```

### 6.2 现有表新增列

```
content 相关表:
  + deleted_at DATETIME
  + deleted_by TEXT
  + created_by TEXT        (区分 AI/人工)
  + updated_by TEXT

commerce 相关表:
  + deleted_at DATETIME
  + deleted_by TEXT
  + version INTEGER DEFAULT 1

video 相关表:
  + deleted_at DATETIME
  + deleted_by TEXT

growth 相关表:
  + deleted_at DATETIME
```

### 6.3 Migration 编号方案

```
0049: admin_users, admin_roles, admin_permissions
0050: audit_logs
0051: content_versions（metadata-only，含 github_commit_sha + rollback_to_version_id）
0052: copy_versions
~~0053~~: （跳过 — ADR-12 取消 recycle_bin）
0054: soft_delete columns (ALTER existing tables)
0055: copy_assets
0056: customers + inquiries.customer_id FK（ADR-17）
0057: oem_projects, oem_requirements, oem_samples
0058: oem_quotes（含 status + converted_to_order_id）, oem_files, oem_timeline
~~0059~~: （跳过 — ADR-13 取消 entity_links）
0060: notifications
0061: ai_automation_rules
0062: ai_tasks（合并 V1 tasks + task_runs，ADR-15）
0063: saved_calculations
0064: admin_entities（Search Index，INV-1）
0065: deprecated_tables_cleanup（DROP 8 张废弃表，Phase 14 执行）
```

---

## 7. V2 安全架构

```
                      Request
                         │
          ┌──────────────▼──────────────┐
          │  Auth Layer                  │
          │  - HMAC Cookie (保留)         │
          │  - Session validation        │
          │  - V2: + user identity       │
          └──────────────┬──────────────┘
                         │ (authenticated)
          ┌──────────────▼──────────────┐
          │  RBAC Gate                   │
          │  - Load user + role          │
          │  - Check permission matrix   │
          │  - action × resource × role  │
          │  - V2 NEW: admin_users/      │
          │    roles/permissions         │
          └──────────────┬──────────────┘
                         │ (authorized)
          ┌──────────────▼──────────────┐
          │  Validation Layer            │
          │  - Input schema validation   │
          │  - Business rule validation  │
          └──────────────┬──────────────┘
                         │
          ┌──────────────▼──────────────┐
          │  Business Logic              │
          │  ┌────────────────────────┐ │
          │  │  If WRITE operation:    │ │
          │  │  + audit_logs.insert   │ │
          │  │  + versioning (if      │ │
          │  │    versioned entity)   │ │
          │  └────────────────────────┘ │
          │  ┌────────────────────────┐ │
          │  │  If DELETE operation:   │ │
          │  │  + soft delete (SET    │ │
          │  │    deleted_at)         │ │
          │  │  + recycle_bin.insert  │ │
          │  └────────────────────────┘ │
          │  ┌────────────────────────┐ │
          │  │  If AI operation:       │ │
          │  │  + permissions.enforce │ │
          │  │  + truthfulness.check  │ │
          │  │  + budget.consume      │ │
          │  │  + mission_log.log     │ │
          │  │  + ai_tasks.insert     │ │
          │  └────────────────────────┘ │
          └──────────────────────────────┘
```

---

## 8. V2 部署拓扑（变化为零）

V2 **不改变**部署管线：

```
Developer → git-bash → scripts/push-now.mjs → GitHub main
                                                    │
                                          CF Pages auto-deploy
                                                    │
                                          astro build + functions bundle
                                                    │
                                          CF Edge deployment
```

唯一变化：构建产物增多（更多模块页面 + 组件），但管线不变。

---

## 9. 架构决策记录（ADR，V2）

### ADR-6: 为什么不做 SPA 框架（React/Vue Router）

- **决策**：保留 Astro 多页面路由，不做 CSR SPA
- **原因**：
  - Astro SSG/SSR 是 CF Pages 一等公民
  - 多页面天然代码分割（每模块独立 bundle）
  - SEO 不相关（后台不需要 SEO），但性能和首屏更好
  - 避免引入 React Router / Vue Router 的构建复杂度
- **代价**：页面切换有短暂白屏（~100ms），但 Astro View Transitions 可缓解
- **例外**：复杂交互组件（编辑器、AI Panel、图表）可用 React/Svelte island

### ADR-7: 为什么组件用 Astro 组件而非纯 React

- **决策**：通用组件（DataTable、FilterBar、Drawer 等）用 Astro 组件，交互密集组件（RichEditor、AIPanel、Charts）用 React island
- **原因**：
  - Astro 组件零 JS 默认，大部分后台 UI 不需要 hydration
  - React island 按需激活，保持小 bundle
  - 混合使用 Astro 原生支持
- **标准**：需要 `useState`/`useEffect`/复杂客户端状态 → React island；纯渲染 + 简单事件 → Astro 组件

### ADR-8: 为什么保留 GitHub 内容管线

- **决策**：内容（博客/产品资料/指南/案例/FAQ）继续以 GitHub MD 文件为 source-of-truth
- **原因**：已在 ADR-1 中说明。V2 叠加 content_versions 表做更细粒度版本管理
- **不做什么**：不把内容全部迁移到 D1（会破坏 Astro Content Collections 构建链路）

### ADR-9: 为什么不用 CF Durable Objects

- **决策**：AI Task Queue 初期用 D1-based 简单队列
- **原因**：
  - CF DO 增加 billing 复杂度
  - 当前 AI 任务量不高（每天 < 100），D1 完全够用
  - 保留未来切换到 CF Queues 的可能性
- **触发升级条件**：日均 AI 任务 > 500 或延迟 > 30s

---

## 10. 关键性能指标（V2 目标 vs V1 当前）

| 指标 | V1 当前 | V2 目标 |
|------|---------|---------|
| 后台首屏 JS | ~500KB（全部视图） | ~50KB（单模块） |
| 页面切换 | 视图状态切换（SPA） | 页面导航（~100ms 白屏） |
| 列表加载 | 全量加载 | 分页 20/页 |
| AI 操作 | 同步等待（10s 超时风险） | 异步 Queue |
| Dashboard | 静态 KPI 卡（纯展示） | 可交互卡（点击下钻） |
| 内容编辑 | 巨型 Modal | 独立页面（三栏） |
| 删除 | 物理删除（不可恢复） | 软删除 + 回收站 |
| 权限 | 单密码 | RBAC 多角色 |

---

## 11. V2 架构评分目标

| 维度 | V1 评分 | V2 目标 | 提升方式 |
|------|---------|---------|---------|
| 内容管理 | B+ | A- | +版本 +软删除 +批量 +回收站 |
| 商品管理 | B | B+ | +利润率计算器 +数据质量面板 |
| 视频管理 | A- | A | +AI Score +商品关联 +SEO Score |
| AI 安全 | A | A | 保留 + AI Panel + Task Queue |
| 权限 | D | B+ | RBAC + Audit Log |
| 前端 | D | B | Shell + 组件化 + 模块化 |
| SEO/增长 | B | B+ | SEO Inspector + Experiment |
| 客户/业务 | C- | B | OEM + Customer 360 + Quote |
| 部署 | B+ | B+ | 不变 |
| 数据 | B | B+ | +FK +软删除 +版本 |
| **总评** | **B-** | **B+** | V2 是质的飞跃 |

---

*本文基于 V2 设计规范 §1-58 和 5 份审计报告。未做猜测。所有架构选择都有明确的 ADR 记录。*"