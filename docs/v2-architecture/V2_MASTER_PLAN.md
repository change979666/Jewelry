# Aromiso CMS V2 — 总体开发规划
## Master Development Plan

版本：V1.0
日期：2026-08-24
基于：《Aromiso CMS V2 总体设计规范》（2111 行，58 节）+ 5 份现有系统审计报告

---

# 第一部分：原则与铁律

## 1.1 架构公理（不可违反）

| # | 规则 | 来源 |
|---|------|------|
| 1 | 稳定 > 兼容 > 可维护 > 快速开发 | 用户指令 |
| 2 | 不破坏已有正常工作的 API / DB / AI 自动化 / GitHub 发布 / D1 / R2 / KV / GSC / GA4 / 视频流水线 | 用户指令 |
| 3 | 不一次性重写整个后台 | 用户指令 + V2 §56 |
| 4 | 不删除现有功能 | 用户指令 |
| 5 | 不猜测业务规则 — 不确定时先读源码/migration | 用户指令 + V2 §55 |
| 6 | 每 Phase 独立可运行 | V2 §55 |
| 7 | 做完一个 Phase → 先验收 → 再推送部署 | 用户本次指令 |
| 8 | AI owns information preparation. Human owns commercial relationship. | AGENTS.md |
| 9 | 不为「看起来完成」创建假数据 | V2 §55 |
| 10 | 不实现不存在的后端能力而不说明 | V2 §55 |

## 1.2 开发四不准则

1. **不确定时不猜**：不确定 DB 结构 → 读 migration；不确定 API 行为 → 读源码
2. **歧义时保当前行为**：新旧选择 → 优先保留当前行为 → 最小改动 → 必要时问用户
3. **不发明业务规则**：不凭空创建业务逻辑，一切基于已有代码和数据
4. **不留 UI 空壳**：新增功能必须有后端能力支撑，纯占位标记 `[UI-ONLY]`

## 1.3 每 Phase 输出清单（Phase 0+ 强制执行）

```
□ 修改前说明（做什么、为什么、影响范围）
□ 修改文件列表
□ 新增文件列表
□ API 端点清单
□ DB Migration（如有）
□ 权限变更（如有）
□ AI 影响（如有）
□ 迁移步骤（如有）
□ 测试清单
□ 完成验收标准
□ 风险与回滚方案
```

## 1.4 AI 功能 13 问（V2 §51，开发 AI 功能前必答）

1. 输入是什么？2. 数据来源是什么？3. 使用哪个 Role？4. 使用哪个模型？5. 权限等级是什么？6. 是否自动执行？7. 结果保存在哪里？8. 是否生成版本？9. 是否记录成本？10. 是否能 Diff？11. 是否能回滚？12. 失败怎么办？13. 用户在哪里看到结果？

---

# 第二部分：当前系统基线

> 以下数据来自 5 份审计报告，是 V2 开发的起点和边界。

## 2.1 资产地图

| 维度 | 现状 | 来源 |
|------|------|------|
| 后台页面 | 7 个入口（Dashboard / Content / Products / Customers / Commerce / AI / System），实际 19 个视图 | audit-master |
| 前端架构 | 单文件 SPA：`admin/index.astro` 10,381 行，0 组件复用 | audit-spa |
| API | ~50 个端点，分布在 `functions/api/admin/*` | audit-api |
| 数据库 | 52 张 D1 表，6 个域（content / commerce / video / ai / growth / system），8 张待废弃表 + 3 张待定（P0-4 核查确认） | audit-db |
| AI | 12+ 角色，L0-L4 + MANUAL 四级闸 + 5 条红线 + 3 层预算 | audit-ai |
| 存储 | GitHub Contents API（内容 MD）+ KV（草稿）+ R2 IMAGES + R2 KB | audit-master |
| 权限 | 单用户/单密码 HMAC，无 RBAC | audit-master |
| 删除 | 物理删除，无回收站 | audit-master |
| 版本 | 无版本系统（内容依赖 GitHub commit history） | audit-master |
| 批量 | 无批量操作 | audit-master |
| 搜索 | 各页面独立搜索，无全局搜索 | audit-master |
| i18n | 3 语（en/es/de），硬编码字典 `src/i18n.ts` ~2,500 行 | audit-master |

## 2.2 P0 缺口（V2 必须填补）

| # | 缺口 | 当前状态 |
|---|------|---------|
| 1 | OEM/定制项目管理 | 零后端、零 UI |
| 2 | 文案资产中心 | AI 功能散落 5 处，无管理 UI |
| 3 | 批量操作 | 零 — 所有操作逐条执行 |
| 4 | 回收站/软删除 | 无 — 全部物理删除 |
| 5 | 版本系统 | 无 — 仅依赖 GitHub 历史 |
| 6 | RBAC 权限系统 | 无 — 单密码 |
| 7 | 操作日志 | 无 — 仅 AI 有 mission log |
| 8 | 通知系统 | 无 |
| 9 | Customer 360 | 无 — 客户/询盘/邮件无关联 |
| 10 | 全局搜索 | 无 |

## 2.3 不可触碰的稳定资产

| 资产 | 位置 | 原因 |
|------|------|------|
| GitHub 内容发布管线 | `functions/api/admin/save.ts` + `shared.ts` | 工作内容发布，不能断 |
| AI 安全网四件套 | `functions/lib/permissions.ts` / `truthfulness.ts` / `action-budget.ts` / `mission-log.ts` | AI 行为护栏 |
| 视频五步流水线 | `admin/video-center` + 7 张 D1 表 | 最佳设计参考，需完整保留 |
| GSC/GA4 数据采集 | `functions/api/admin/gsc-*.ts` + D1 growth 表 | 增长基线 |
| HMAC 认证 | `functions/api/admin/shared.ts` | 唯一认证机制，V2 扩展到 RBAC |
| KV 草稿系统 | `aromiso-drafts` | 内容暂存，迁移到版本系统前必须兼容 |
| D1 52 张表 | `aromiso-db` | 核心数据，不破坏 schema |
| R2 对象存储 | IMAGES + KB bucket | 全部媒体资产和知识库 |

---

# 第三部分：V2 目标架构

## 3.1 目标全景

```
Aromiso CMS V2 = CMS + Commerce + CRM + OEM + AI Agent + SEO + Analytics + Knowledge
                = Business Operating System（不是简单后台）
```

## 3.2 V2 一级导航（对应 V2 §1.1）

```
A. 首页          — Dashboard V2（驾驶舱 + AI 工作台）
B. 内容          — 博客 / 产品资料 / 指南 / 案例 / FAQ / 文案资产 / 回收站 / 批量中心
C. 商品与商城    — 现货 / SKU / 变体 / 订单 / 运营位 / 1688 导入 / 数据质量 / 商城分析
D. 客户与业务    — 询盘 / 客户 / 邮件 / OEM / 报价 / 评价 / 订阅者
E. 媒体          — 图片 / 视频 / 文件 / 证书 / AI 翻译任务
F. 增长          — SEO / Analytics / Behavior / 增长机会 / 实验 / SEO 审计
G. AI 中心       — 总控台 / 任务 / 日报 / 建议 / 执行记录 / Role Center / 成本 / 自动化规则
H. 系统          — 知识库 / 站点设置 / 多语言 / 权限与成员 / 操作日志 / 系统健康
```

## 3.3 核心闭环（V2 §53）

```
数据采集 → AI 发现 → AI 建议 → 人工确认/自动执行 → 业务对象变化
    ↑                                                         ↓
    └──────── 数据重新采集 ← AI 判断结果 ← 知识沉淀 ←─────────┘
```

## 3.4 数据流（V2 §36 兼容层策略）

```
V1 存储                     V2 兼容层                    V2 新增
───────                     ────────                    ────────
GitHub MD ─────────┐
D1 (52 tables) ────┼──→ admin_entities ──→ Search Index (INV-1)
KV drafts ─────────┤     (5字段上限)           ↓
R2 objects ────────┘                           V2 新表：
                                                - customers + inquiries.customer_id (ADR-17)
                                                - oem_projects 系列
                                                - copy_assets
                                                - content_versions (metadata-only, ADR-11)
                                                - notifications
                                                - audit_logs
                                                - ai_automation_rules
                                                - ai_tasks (合并 tasks/task_runs, ADR-15)
                                                - admin_users/roles/permissions
                                                - （无 entity_links — ADR-13 具体关联表）
                                                - （无 recycle_bin — ADR-12 deleted_at）
```

## 3.5 前端架构（V2 §2.1 + §47）

```
/admin  ── AdminShell（壳层，替换当前 10,381 行 SPA）
  ├── Layout: Sidebar(240px) + Topbar(64px) + Content(max 1440px)
  ├── 每个模块独立页面：src/pages/admin/<module>/
  ├── 公共组件：src/components/admin/
  │   ├── layout/     (AdminShell, Sidebar, Topbar, Breadcrumb)
  │   ├── table/      (DataTable, FilterBar, SearchBox, Pagination, BulkActionBar)
  │   ├── form/       (RichEditor, MarkdownEditor, MediaPicker, UploadZone)
  │   ├── ai/         (AIActionButton, AIPanel, AITaskStatus, DiffViewer)
  │   ├── shared/     (KPICard, StatusBadge, ScoreBadge, EmptyState, ErrorState, Skeleton,
  │   │                Drawer, Modal, ConfirmDialog, Toast, Timeline, Stepper, Tabs)
  │   ├── commerce/   (PriceCalculator)
  │   ├── customer/   (CustomerCard, InquiryTimeline)
  │   ├── oem/        (OEMStepper, OEMCalculator)
  │   └── analytics/  (Chart, MetricCard)
  └── 数据层统一封装：src/lib/admin/api/
```

## 3.6 API 架构（V2 §37）

```
/api/admin/v2/   — 新 API（统一 JSON 格式）
  ├── content/      博客/产品资料/指南/案例/FAQ/文案
  ├── commerce/     现货/SKU/订单/导入
  ├── customers/    客户/询盘/报价
  ├── oem/          OEM 项目
  ├── media/        图片/视频/文件
  ├── ai/           AI Action/Task/Role/Rules
  ├── growth/       SEO/Analytics/Opportunity/Experiment
  └── system/       设置/权限/日志/通知/回收站

/api/admin/      — 旧 API（保留兼容，路由到 V2 或原始实现）

统一返回格式：
  { success: true, data: {...}, error: null, meta: { page, pageSize, total, totalPages } }
  { success: false, data: null, error: { code: "...", message: "..." } }
```

---

# 第四部分：Phase 0 — Architecture Review（当前阶段）

## Phase 0 概述

**目标**：在写任何业务代码前，输出 13 份架构文档，为全部后续 Phase 提供精确的「施工蓝图」。

**持续时间**：2-3 个会话（可能跨天）

**不做什么**：不修改任何现有代码、不建新表、不写新 API、不改 UI。

## Phase 0 输出清单（13 项）

### P0-1: Current System Architecture（当前系统架构）

**内容**：
- 完整技术栈图（Cloudflare Pages + Astro + Functions + D1 + KV + R2 + GitHub API）
- 运行时拓扑（浏览器 → CF Pages → Functions → D1/KV/R2/GitHub/DeepSeek/GSC/GA4/Resend）
- 数据流图（内容流 / 商品流 / 视频流 / AI 流 / 增长流）
- 构建与部署管线（GitHub push → CF auto-deploy → edge distribution）
- 安全边界（HMAC auth / Turnstile / KV blacklist / 来源验证）

**基于**：`CMS_AUDIT_MASTER.md` + `CMS_AUDIT_ADMIN_SPA.md` + `wrangler.toml` + `package.json` + `astro.config.mjs`

---

### P0-2: Current Page Map（当前页面地图）

**内容**：
- 每个现有页面的完整路由表（URL → Astro 文件 → 包含的视图 → 调用的 API → 读取的 DB 表 → 使用的 AI 角色）
- 页面间导航关系图
- 每个页面的行数、函数数、API 调用数
- 标注「独立页面」「内嵌视图」「AI 独有页面」

**基于**：`CMS_AUDIT_ADMIN_SPA.md` + `src/pages/admin/*` 全部源码

---

### P0-3: Current API Map（当前 API 地图）

**内容**：
- 每个 API 端点的完整描述（method / path / auth / input / output / 读写的 DB 表 / 调用的外部服务）
- API 间调用关系（谁调谁）
- 标注「稳定可复用」「需重构」「需替换」「仅 UI 调用」「Cron 专用」
- 错误处理模式汇总

**基于**：`CMS_AUDIT_API.md` + `functions/api/admin/*` 全部源码

---

### P0-4: Current DB Map（当前数据库地图）

**内容**：
- 52 张表的完整清单：表名 / 所属域 / 列 / 主键 / 外键（及缺失的 FK）/ 索引 / 行数估算 / 读写频率
- 表间实际关系图（含缺失的 FK 虚线标注）
- 疑似孤表确认（P0-4 核查：8 张废弃 + 3 张待定）
- Migration-to-Table 索引（每张表由哪个 migration 创建，最后哪个 migration 修改）
- 每张表的 V2 命运：保留/扩展/替换/废弃

**基于**：`CMS_AUDIT_DATABASE.md` + 48 个 migration 文件

---

### P0-5: Current AI Map（当前 AI 地图）

**内容**：
- 所有 AI 角色的完整描述（名称 / System Prompt 位置 / 调用的模型 / 权限等级 / 触发方式 / 输入/输出 / 成本记录）
- AI 安全网详细架构：`permissions.ts`（L0-L4+MANUAL 决策树）/ `truthfulness.ts`（5 条红线检测逻辑）/ `action-budget.ts`（3 层预算计数器）/ `mission-log.ts`（日志结构）
- AI 调用点分布（哪些 API / 哪些页面触发了哪些 AI 角色）
- V2 需要保留/扩展/替换的 AI 功能

**基于**：`CMS_AUDIT_AI.md` + `functions/lib/permissions.ts` + `truthfulness.ts` + `action-budget.ts` + `mission-log.ts` + 全部 AI Role 定义

---

### P0-6: Current Permission Map（当前权限地图）

**内容**：
- 当前认证机制详解（HMAC 签名 / Cookie 结构 / 7 天过期 / 验证流程）
- 当前授权检查点分布（哪些 API 做了什么权限检查）
- 权限缺口清单（哪些操作没有权限检查）
- V2 RBAC 设计的影响范围（哪些 API/UI 需要改造）

**基于**：`functions/api/admin/shared.ts` + 各 API 源码

---

### P0-7: V2 Target Architecture（V2 目标架构）

**内容**：
- V2 完整架构图（叠加 V2 新层：AdminShell / 组件系统 / V2 API / 兼容层 / RBAC / 版本 / 审计 / 通知）
- V2 与 V1 的边界划分（哪些完全不动、哪些加兼容层、哪些全新）
- V2 数据流图（含新表、soft delete 流、版本流、任务队列流）
- V2 部署拓扑变化（无 runtime 变化，仍在 CF Pages）
- 架构决策记录（ADR）：为什么不做 SPA 框架、为什么不做微服务、为什么保留 GitHub 内容管线

---

### P0-8: New-Old Mapping（新旧对应关系）

**内容**：
- 每个 V1 页面/视图 → V2 页面/模块的精确映射表
- 每个 V1 API → V2 API 的映射（复用/兼容路由/重写/废弃）
- 每个 V1 DB 表 → V2 DB 表的映射（保留/扩展/迁移/新表关联）
- 每个 V1 AI 角色 → V2 AI 角色的映射（保留/扩展/合并/替换）
- 不再需要的旧代码清单（标注下线时机）

---

### P0-9: Data Migration Strategy（数据迁移策略）

**内容**：
- 全部新增 V2 表的 DDL（CREATE TABLE，基于 V2 §48）
- 现有表需要新增的列（如 `deleted_at` / `deleted_by` / `version` / `created_by` / `updated_by`）
- Migration 编号方案（从 0049 开始，不与已有冲突）
- 数据迁移脚本设计（如 KV drafts → content_versions）
- 回滚策略（每张新表/新列的 DROP/ALTER 回滚）
- 不可逆迁移的标记与警告

---

### P0-10: API Compatibility Strategy（API 兼容策略）

**内容**：
- API 版本共存方案（`/api/admin/` vs `/api/admin/v2/`，CF Functions 路由配置）
- 旧 API 兼容路由清单（哪些旧 API 内部切换到 V2 实现）
- 统一响应格式的适配层设计
- 分页/筛选/排序参数标准化
- 错误码体系定义
- API 文档自动生成方案

---

### P0-11: Component Splitting Strategy（组件拆分策略）

**内容**：
- 从 `admin/index.astro`（10,381 行）拆出哪些组件
- 组件树设计（layout / table / form / ai / shared / commerce / customer / oem / analytics）
- 每个组件的 props 接口定义
- 组件间的数据流（props down / events up / shared state）
- 与 Astro 的集成方式（Astro 组件 vs React/Svelte island）
- 复用优先级的五层判断：全局复用 → 模块内复用 → 页面级 → 一次性 → 保留内联

---

### P0-12: Risk List（风险清单）

**内容**：
- 技术风险（如 CF Functions 10s 超时影响批量操作 → 需要异步 Queue）
- 数据风险（如 GitHub API rate limit / D1 并发限制 / R2 非原子删除）
- 兼容风险（如旧 API 调用方未知 → 需要日志观察期）
- 业务风险（如 OEM 项目无历史数据、文案资产从零开始）
- AI 风险（如模型幻觉导致误写内容、预算超支）
- 每个风险的：概率 / 影响 / 缓解措施 / 回滚方案

---

### P0-13: Development Phase Plan（开发阶段计划）

**内容**：
- Phase 1–14 的完整路线图（基于 P0-7 架构 + V2 §50 优先级 + V2 §55 执行顺序）
- 每个 Phase 的：目标 / 涉及模块 / 预估工作量 / 前置依赖 / 输出清单 / 验收标准
- Phase 间依赖关系图（哪些可以并行、哪些必须串行）
- 里程碑定义（M1: Shell 可用 / M2: 核心业务可操作 / M3: AI 闭环 / M4: 增长闭环 / M5: 全系统验收）

---

# 第五部分：Phase 1–14 开发计划（骨架）

> **每个 Phase 的详细任务清单、文件清单、API 清单、DB Migration、测试清单将在 Phase 0 完成后逐个展开。以下为骨架级路线图。**

## Phase 1: AdminShell + Design System（框架）
**依赖**：Phase 0 完成
**V2 §50**：Phase 1 #1-4
**V2 §55**：Design System → Shell
**目标**：建立 V2 壳层，替换 10,381 行 SPA 的壳部分，不迁移任何业务逻辑

### 范围
1. **AdminShell** — 左侧导航 240px + 顶部工具栏 64px + 主内容区
2. **Sidebar** — 一级导航渲染（8 个一级入口 + 当前高亮 + 折叠）
3. **Topbar** — 面包屑 + 全局搜索 (Cmd+K) + AI 状态灯 + 通知铃铛 + 用户菜单
4. **Design System 基础组件** — KPI Card / StatusBadge / ScoreBadge / Toast / Skeleton / EmptyState / ErrorState / ConfirmDialog / Drawer / Modal / Tabs
5. **共享布局** — 页面容器 / 卡片 / 间距 / 响应式断点
6. **路由系统** — `/admin` 壳层 + 子路由占位

### 不做
- 不迁移任何现有业务页面内容
- 不修改任何 API
- 旧 `admin/index.astro` 保留不动（通过路由共存）

### 关键技术决策
- 组件技术选型：Astro 组件 vs React island（待 Phase 0 确定）
- CSS 方案：继承现有令牌体系（`docs/DESIGN_TOKENS.md`），提取为 CSS 自定义属性
- 全局搜索实现：前端过滤（Phase 1）→ 后端索引（Phase 后期）

### 验收标准
- [ ] 访问 `/admin-v2` 看到新壳层（Sidebar + Topbar + 空白内容区）
- [ ] 侧边栏 8 个一级入口可点击高亮
- [ ] Cmd+K 弹出搜索框（UI 就位，搜索逻辑可空）
- [ ] Design System 组件 Story/文档就位
- [ ] 旧 `/admin` 完全不受影响
- [ ] `npm run build` 通过

---

## Phase 2: RBAC + Audit Log + Soft Delete + Version System（基础服务）
**依赖**：Phase 1
**V2 §50**：Phase 1 #5-8
**V2 §55**：Auth/RBAC → Audit/Version

### 范围
1. **`admin_users` 表** — 用户/密码哈希/角色/状态/最后登录
2. **`admin_roles` + `admin_permissions` 表** — 角色定义 + 权限矩阵（View/Create/Edit/Publish/Delete/Export/Execute AI/Approve AI/Manage Settings）
3. **RBAC 中间件** — `functions/lib/admin/rbac.ts`，服务端强制验证，UI 不可绕
4. **`audit_logs` 表** — who/when/object/action/before/after/result
5. **Audit 中间件** — 写操作自动记录
6. **Soft Delete** — 所有可删除表加 `deleted_at` / `deleted_by`，DELETE API → UPDATE
7. **`content_versions` 表** — version/author/source/created_at/change_summary/github_commit_sha/rollback_to_version_id（metadata-only，body 走 GitHub API，ADR-11）
8. **版本中间件** — 编辑操作自动创建版本

### 不做
- 不改造旧 API（新 API `/api/admin/v2/` 才走 RBAC + Audit）
- 不立即对旧表加 soft delete 列（先建新表，旧表迁移在 Phase 各业务 Phase 中逐表进行）

### DB Migration（初步）
```
0049: admin_users, admin_roles, admin_permissions
0050: audit_logs
0051: content_versions (metadata-only, ADR-11)
0064: admin_entities (Search Index, INV-1)
0052: soft_delete 基础列（deleted_at, deleted_by）— 逐表 ALTER
```

### 验收标准
- [ ] 至少 2 个角色可创建/切换
- [ ] 无权限用户访问 API 返回 403
- [ ] 任何写操作产生 audit_log 记录
- [ ] 内容编辑自动创建 content_versions
- [ ] Soft-delete API 返回 deleted_at 而非物理删除

---

## Phase 3: Dashboard V2（首页）
**依赖**：Phase 1 + Phase 2（部分：RBAC 基础）
**V2 §50**：Phase 2 #1

### 范围（V2 §4）
1. **第一行**：4 个 KPI 卡（本月询盘/订单金额/网站用户/AI 完成动作），环比/趋势/可点击
2. **第二行**：AI 今日状态（40%）+ AI 今日建议（60%，最多 5 条）
3. **第三行**：业务漏斗（询盘漏斗 + 商城漏斗），节点可点击
4. **第四行**：最近编辑内容 + 最近询盘
5. **第五行**：「需要我处理」统一收口

### API
- `GET /api/admin/v2/dashboard/kpi` — 4 个核心 KPI
- `GET /api/admin/v2/dashboard/ai-status` — AI 今日状态
- `GET /api/admin/v2/dashboard/funnel` — 业务漏斗
- `GET /api/admin/v2/dashboard/recent` — 最近工作
- `GET /api/admin/v2/dashboard/action-items` — 需要处理

### 验收标准
- [ ] 所有 KPI 数字来自真实数据，非写死
- [ ] KPI 卡可点击并跳转到对应模块带筛选
- [ ] AI 建议可查看/执行/忽略
- [ ] 漏斗节点可点击

---

## Phase 4: Content Center（内容中心）
**依赖**：Phase 1 + Phase 2（版本/软删除/审计）
**V2 §50**：Phase 2 #2

### 范围（V2 §5-7 + §10）
1. **统一内容列表** — 博客 / 产品资料 / 指南 / 案例 / FAQ 复用同一 DataTable
2. **内容编辑器 V2** — 三栏（导航 + 编辑 + AI/SEO），替换当前 Modal 编辑
3. **产品资料系统** — 与现货商品彻底区分，Product Content ≠ Commerce Product
4. **文案资产中心** — 集中管理散落的 AI 文案
5. **内容批量中心** — 批量发布/翻译/SEO/Alt/分类/导出/删除
6. **内容回收站** — 软删除内容恢复/永久删除

### API
- `GET/POST/PUT/DELETE /api/admin/v2/content/*` — 统一内容 CRUD
- `POST /api/admin/v2/content/batch` — 批量操作
- `GET/POST /api/admin/v2/copy-assets` — 文案资产 CRUD
- `GET/PUT /api/admin/v2/recycle-bin` — 回收站

### DB Migration
```
0052: copy_versions
0053: （跳过 — ADR-12 取消 recycle_bin）
0054: content 相关表加 deleted_at/deleted_by
0055: copy_assets
```

### 关键技术决策
- 内容编辑：保留 GitHub 发布管线，叠加版本层（content_versions metadata-only）
- 编辑器：Markdown 为基础（现有内容为 MD），富文本可选
- 文案资产：独立表，linked_entity_type + linked_entity_id 字段关联

### 验收标准
- [ ] 5 种内容类型使用同一列表组件
- [ ] 列表支持搜索/筛选/分页/批量选择
- [ ] 新建/编辑内容走三栏编辑页（非 Modal）
- [ ] 删除内容进入回收站（非物理删除）
- [ ] 文案资产可新建/编辑/AI 重写/版本对比

---

## Phase 5: Commerce（商品与商城）
**依赖**：Phase 1 + Phase 2 + Phase 4（产品资料）
**V2 §50**：Phase 2 #4

### 范围（V2 §8-9）
1. **现货商品列表 V2** — 顶部 KPI（总数/Active/Draft/缺字段/缺图片/AI 待处理），筛选（状态/分类/价格/MOQ/库存/数据质量/AI 状态）
2. **现货商品编辑页** — 三栏（结构 + 编辑 + 实时检查），含利润率计算器
3. **SKU/变体管理**
4. **订单中心 V2** — 分页/筛选/详情 Drawer
5. **商品数据质量面板** — 完整性检查
6. **商城分析** — 访问→加购→结账→支付漏斗

### API
- `GET/POST/PUT/DELETE /api/admin/v2/commerce/products`
- `GET/POST/PUT /api/admin/v2/commerce/skus`
- `GET/PUT /api/admin/v2/commerce/orders`
- `GET /api/admin/v2/commerce/analytics`
- `POST /api/admin/v2/commerce/calculate-margin`

### 验收标准
- [ ] 商品列表支持全部 6 种筛选
- [ ] 编辑页含实时利润率计算器
- [ ] 订单列表分页/筛选/详情 Drawer
- [ ] 商品可与产品资料关联（content_product_key）

---

## Phase 6: Customer & OEM（客户与业务）
**依赖**：Phase 1 + Phase 2 + Phase 5（商品）
**V2 §50**：Phase 2 #5-7
**核心新增**：OEM 模块 + Customer 360

### 范围（V2 §11-16）
1. **询盘中心 V2** — Lead Score / AI 摘要 / 右侧 Drawer 回复 / AI 助手
2. **客户中心** — Customer 360 档案（关联询盘/邮件/OEM/订单/评价/下载/行为/订阅）
3. **OEM 项目中心** — 列表（项目编号/客户/国家/产品/数量/阶段/金额/负责人/AI Score）+ 详情 12 Tab
4. **OEM 计算器** — 成本/报价/毛利/毛利率，多版本报价
5. **报价管理** — 关联 OEM/客户/商品
6. **邮件中心** — 收发记录/模板

### API
- `GET/PUT /api/admin/v2/customers/*`
- `GET/PUT /api/admin/v2/inquiries/*`
- `GET/POST/PUT/DELETE /api/admin/v2/oem/projects`
- `GET/POST/PUT/DELETE /api/admin/v2/oem/requirements`
- `GET/POST/PUT/DELETE /api/admin/v2/oem/quotes`
- `GET/POST/PUT/DELETE /api/admin/v2/oem/samples`
- `POST /api/admin/v2/oem/calculate`

### DB Migration（最大新表批次）
```
0056: customers + inquiries.customer_id FK (ADR-17)
0057: oem_projects, oem_requirements, oem_samples
0058: oem_quotes (含 status + converted_to_order_id), oem_files, oem_timeline
```

### 验收标准
- [ ] 客户可关联询盘/邮件/OEM/订单
- [ ] OEM 项目完整 12 Tab 详情页
- [ ] OEM 计算器实时计算
- [ ] 报价多版本对比
- [ ] 危险操作（报价/付款/合同/合规声明）必须人工确认

---

## Phase 7: AI Integration（AI 融入业务）
**依赖**：Phase 3-6（业务模块就位）
**V2 §50**：Phase 3

### 范围（V2 §19-23）
1. **AI Action 标准** — 所有 AI 操作统一结构（Action/Input/Reason/Risk/Permission/Model/Cost/Output/Diff/Approval/Execution/Result/Rollback）
2. **AI Panel** — 每个业务对象右上角 ✨ AI 按钮 → 对象 AI 操作面板
3. **AI Task Queue** — 异步任务队列（Queued→Running→Waiting Approval→Completed→Failed→Cancelled）
4. **AI 自动化规则** — WHEN/IF/THEN 规则引擎
5. **AI 总控台 V2** — 当前执行/队列/完成/待确认/失败/成本/节省时间
6. **AI Diff & Rollback** — 所有 AI 修改可查看 Diff、可回滚

### 关键技术决策
- AI 安全网四件套（permissions/truthfulness/budget/mission-log）**完整复用**，不重写
- AI Panel 注册机制：模块声明自己的 AI Actions，AIPanel 动态渲染
- 任务队列：初期 CF Queues 或 D1-based 简单队列（CF 环境适配）

### 验收标准
- [ ] 至少 3 个业务对象（产品/询盘/OEM）有 AI Panel
- [ ] AI 修改展示 Before/After Diff
- [ ] L2 操作等待人工确认
- [ ] AI 执行有日志
- [ ] AI 自动操作可回滚

---

## Phase 8: Growth（增长中心）
**依赖**：Phase 7（AI Task Queue）
**V2 §50**：Phase 4

### 范围（V2 §24-26）
1. **SEO Inspector** — 页面级 SEO Score 0-100（Title/Description/H1/Keyword/Internal Links/Alt/Schema/Canonical/Hreflang/Indexability）
2. **Analytics V2** — 所有图表可交互点击
3. **Behavior** — 行为数据进入具体对象
4. **Growth Opportunities** — 机会→证据→影响→置信度→推荐动作→AI Action→预期 KPI
5. **Experiment 闭环** — 发现→假设→执行→Before→After→结果→学习

### 验收标准
- [ ] SEO Score 可用（至少覆盖内容页）
- [ ] Analytics 图表可点击下钻
- [ ] Growth 机会可创建 AI Task
- [ ] Experiment 记录 Before/After 对比

---

## Phase 9: Media（媒体中心）
**依赖**：Phase 1 + Phase 2
**V2 §50**：Phase 5

### 范围（V2 §17-18）
1. **统一媒体资产库** — 图片/视频/PDF/证书/SDS/COA/IFRA/包装文件
2. **视频中心 V2** — 保留五步流水线 + AI Content Score + 商品关联 + SEO Score
3. **AI 翻译任务** — 原文→AI Translation→QA→Publish

### 验收标准
- [ ] 媒体资产按类型/关联对象/使用次数筛选
- [ ] 图片支持 AI 处理（Alt Text/OCR/翻译）
- [ ] 视频五步流水线完整保留

---

## Phase 10: Notification + Global Search（通知 + 全局搜索）
**依赖**：Phase 2 + Phase 3-9（事件源就位）
**V2 §34 + §3.1**

### 范围
1. **通知中心** — 新询盘/新订单/AI 完成/AI 失败/SEO 异常/商品质量/OEM 待处理
2. **全局搜索后端** — D1 索引搜索（产品/博客/指南/案例/FAQ/文案/客户/询盘/OEM/订单/视频/AI 任务）

### DB Migration
```
0059: notifications
```

### 验收标准
- [ ] Topbar 铃铛有未读计数
- [ ] 通知可已读/全部已读/跳转
- [ ] 全局搜索返回 12 种对象类型

---

## Phase 11: System Settings（系统设置）
**依赖**：Phase 2 + Phase 10
**V2 §27-28 + §33**

### 范围
1. **站点设置** — 全局配置 UI
2. **多语言管理** — EN/ES/DE 翻译状态
3. **权限与成员管理** — 用户/角色/权限 CRUD
4. **知识库 V2** — L0-L4 分层 + AI 生成前检索

### 验收标准
- [ ] 管理员可增删成员/分配角色
- [ ] 权限变更实时生效
- [ ] 知识库可增删改查

---

## Phase 12: Import Center（导入中心）
**依赖**：Phase 5 + Phase 9
**V2 §32**

### 范围
1. 1688 ZIP 导入
2. Excel/CSV 导入
3. 统一导入流程：Upload→Parse→Validate→Preview→Mapping→AI Enrich→Confirm→Create→Report

### 验收标准
- [ ] 上传后预览（不直接写库）
- [ ] AI 补全可选
- [ ] 导入报告显示成功/失败/跳过

---

## Phase 13: Polish & QA（打磨）
**依赖**：Phase 1-12

### 范围
1. 全部列表五态检查（Loading / Empty / Error / Success / Permission）
2. 返回保留筛选
3. 面包屑完整
4. 性能（分页/缓存/Debounce/Lazy Load/缩略图）
5. UI 文案（英文 + 中文注释）
6. 移动端响应式（侧边栏折叠）

---

## Phase 14: Final Verification & Migration（最终验收与切换）
**依赖**：Phase 13

### 范围
1. V2 §54 验收标准逐项检查
2. 旧页面下线（保留兼容路由 30 天）
3. 旧代码归档
4. 推送部署
5. 监控 7 天

---

# 第六部分：迁移策略（V2 §56）

```
Phase 1       Phase 2-13        Phase 14
────────      ──────────        ────────
旧系统        V2 Shell          V2 全功能
  │             │                  │
  ├─ /admin (旧) ├─ /admin-v2 (新)  ├─ /admin (切换到 V2)
  │             │                  │
  └─ 旧 API ────┴─ 旧 API 兼容 ────┴─ 淘汰旧路由（30 天后）
                 │
                 └─ /api/admin/v2/ (新)
```

关键规则：
- Phase 1-13 期间，`/admin` 保持旧系统完整可用
- V2 开发在 `/admin-v2` 路由下进行
- Phase 14 切换：`/admin` → V2 Shell + 内容，旧路由保留重定向 30 天
- API 层面：`/api/admin/` 和 `/api/admin/v2/` 长期共存

---

# 第七部分：风险清单（初步，Phase 0 详细化）

| # | 风险 | 概率 | 影响 | 缓解 |
|---|------|------|------|------|
| 1 | CF Functions 10s 超时 → 批量操作中断 | 高 | 中 | 异步 Queue（Phase 7）+ 分批执行 |
| 2 | GitHub API rate limit → 内容发布失败 | 中 | 高 | 保留现有节流逻辑，加队列重试 |
| 3 | D1 并发限制 → 多用户写入冲突 | 低 | 中 | WAL 模式已启用，加乐观锁 |
| 4 | 旧 API 调用方未知 → 兼容路由遗漏 | 中 | 中 | Phase 0 API map 全面审计 + 30 天观察期 |
| 5 | OEM 项目从零开始 → 无历史数据 | 高 | 低 | OEM 为新增模块，接受冷启动 |
| 6 | AI 模型幻觉 → 内容误写 | 中 | 高 | 复用 truthfulness.ts + Diff + 人工确认闸 |
| 7 | 组件拆分后 Astro/React 集成复杂度 | 中 | 中 | Phase 0 确定技术选型，Phase 1 验证 |
| 8 | Soft delete 迁移 → 现有查询需全量加 `WHERE deleted_at IS NULL` | 高 | 中 | 逐表迁移 + ORM 层统一过滤 |
| 9 | RBAC 影响现有单用户工作流 | 低 | 低 | 默认 Owner 角色有全部权限 |
| 10 | 预算/时间超预期 | 高 | 高 | 14 个 Phase 可独立交付，核心价值 Phase 3-6 优先 |

---

# 第八部分：开发顺序总览

```
Phase 0:  Architecture Review        ← 当前阶段（13 份文档）
Phase 1:  AdminShell + Design System  ─┐
Phase 2:  RBAC + Audit + Version      ├─ 基础层（不涉及业务迁移）
Phase 3:  Dashboard V2                ─┤
Phase 4:  Content Center              ─┤
Phase 5:  Commerce                    ─┼─ 业务层（核心价值）
Phase 6:  Customer & OEM              ─┘
Phase 7:  AI Integration              ─┐
Phase 8:  Growth                      ─┼─ 智能层（AI + 增长闭环）
Phase 9:  Media                       ─┘
Phase 10: Notification + Search       ─┐
Phase 11: System Settings             ─┼─ 系统层（收尾）
Phase 12: Import Center               ─┘
Phase 13: Polish & QA                 ── 打磨
Phase 14: Final Verification          ── 切换
```

**里程碑**：
- **M1**（Phase 1-2 完成）：Shell 可运行 + 基础设施就位
- **M2**（Phase 3-6 完成）：核心业务闭环可用（内容→商品→客户→OEM→报价）
- **M3**（Phase 7-8 完成）：AI 闭环 + 增长闭环运行
- **M4**（Phase 9-12 完成）：全系统功能就位
- **M5**（Phase 13-14 完成）：验收通过，V2 上线

---

# 第九部分：当前任务 — Phase 0 启动

Phase 0 共 13 份文档。今天先输出 P0-1 到 P0-7（架构类），明天继续 P0-8 到 P0-13（规划类）。

### P0-1: Current System Architecture → `docs/V2_ARCHITECTURE_CURRENT.md`
### P0-2: Current Page Map → `docs/V2_PAGE_MAP_CURRENT.md`
### P0-3: Current API Map → `docs/V2_API_MAP_CURRENT.md`
### P0-4: Current DB Map → `docs/V2_DB_MAP_CURRENT.md`
### P0-5: Current AI Map → `docs/V2_AI_MAP_CURRENT.md`
### P0-6: Current Permission Map → `docs/V2_PERMISSION_MAP_CURRENT.md`
### P0-7: V2 Target Architecture → `docs/V2_ARCHITECTURE_TARGET.md`
### P0-8: New-Old Mapping → `docs/V2_MIGRATION_MAP.md`
### P0-9: Data Migration Strategy → `docs/V2_DATA_MIGRATION.md`
### P0-10: API Compatibility Strategy → `docs/V2_API_COMPAT.md`
### P0-11: Component Splitting Strategy → `docs/V2_COMPONENT_PLAN.md`
### P0-12: Risk List → `docs/V2_RISK_REGISTER.md`
### P0-13: Development Phase Plan → 本文档即为 P0-13

---

*本规划基于 Aromiso CMS V2 总体设计规范（V2.0, 2026-08-24）和 5 份现有系统审计报告。每一 Phase 执行前将展开为详细的施工文档。*