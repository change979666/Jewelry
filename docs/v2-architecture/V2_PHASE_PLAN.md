# V2 P0-13: 开发阶段详细计划
## Development Phase Plan

> 基于 V2 设计规范 §50 + §55 + P0-7（目标架构）+ P0-8（新旧映射）
> 日期：2026-08-24

---

## 1. 总览

```
Phase 0:  Architecture Review     ← 当前（13 份文档）
Phase 1:  AdminShell + Design     ── 框架层
Phase 2:  RBAC + Audit + Version  ── 基础服务
Phase 3:  Dashboard V2            ─┐
Phase 4:  Content Center          ─┤
Phase 5:  Commerce Center         ─┼─ 核心业务
Phase 6:  Customer & OEM          ─┘
Phase 7:  AI Integration          ─┐─ 智能层
Phase 8:  Growth Center           ─┘
Phase 9:  Media Center            ── 媒体
Phase 10: Notification + Search   ─┐
Phase 11: System Settings         ─┼─ 系统层
Phase 12: Import Center           ─┘
Phase 13: Polish & QA             ── 打磨
Phase 14: Final Verification      ── 切换上线
```

**里程碑**：
- **M1** (Phase 1-2 完成)：V2 壳层可运行 + 基础设施就位
- **M2** (Phase 3-6 完成)：核心业务闭环可用（Dashboard→内容→商品→客户→OEM）
- **M3** (Phase 7-8 完成)：AI 闭环 + 增长闭环运行
- **M4** (Phase 9-12 完成)：全系统功能就位
- **M5** (Phase 13-14 完成)：验收通过，V2 正式上线

---

## 2. Phase 0: Architecture Review

**状态**：🟢 进行中
**依赖**：无
**目标**：13 份架构文档，为全部后续 Phase 提供精确蓝图

### 输出清单
| # | 文档 | 路径 | 状态 |
|---|------|------|------|
| P0-1 | Current System Architecture | `docs/V2_ARCHITECTURE_CURRENT.md` | ✅ |
| P0-2 | Current Page Map | `docs/V2_PAGE_MAP_CURRENT.md` | ✅ |
| P0-3 | Current API Map | `docs/V2_API_MAP_CURRENT.md` | ✅ |
| P0-4 | Current DB Map | `docs/V2_DB_MAP_CURRENT.md` | ⏳ |
| P0-5 | Current AI Map | `docs/V2_AI_MAP_CURRENT.md` | ✅ |
| P0-6 | Current Permission Map | `docs/V2_PERMISSION_MAP_CURRENT.md` | ✅ |
| P0-7 | V2 Target Architecture | `docs/V2_ARCHITECTURE_TARGET.md` | ✅ |
| P0-8 | New-Old Mapping | `docs/V2_MIGRATION_MAP.md` | ✅ |
| P0-9 | Data Migration Strategy | `docs/V2_DATA_MIGRATION.md` | ✅ |
| P0-10 | API Compatibility Strategy | `docs/V2_API_COMPAT.md` | ✅ |
| P0-11 | Component Splitting Strategy | `docs/V2_COMPONENT_PLAN.md` | ✅ |
| P0-12 | Risk Register | `docs/V2_RISK_REGISTER.md` | ✅ |
| P0-13 | Development Phase Plan | `docs/V2_PHASE_PLAN.md` | ✅ (本文档) |

### 验收标准
- [ ] 用户审查 13 份文档
- [ ] 确认架构方向
- [ ] 批准进入 Phase 1

---

## 3. Phase 1: AdminShell + Design System

**依赖**：Phase 0 完成 + 用户批准
**预计工作量**：3-5 个会话
**V2 规范**：§2, §3, §43, §46, §47
**风险**：R5（React/Astro 混合复杂度）, R11（不破坏旧页面）

### 3.1 目标

建立 V2 壳层（AdminShell），替换 10,381 行 SPA 的壳部分。在此阶段**不迁移任何业务逻辑**，所有业务视图继续在旧 `/admin` 下运行。

### 3.2 涉及文件

**新增**：
```
src/pages/admin-v2/index.astro            — V2 入口（AdminShell 壳）
src/components/admin/layout/
  AdminShell.astro                         — 壳层容器
  Sidebar.astro                            — 左侧导航
  SidebarNavItem.astro                     — 导航项
  Topbar.astro                             — 顶部工具栏
  Breadcrumb.astro                         — 面包屑
src/components/admin/shared/
  KPICard.astro                            — KPI 统计卡
  StatusBadge.astro                        — 状态标签
  Toast.astro                              — Toast 通知
  Drawer.astro                             — 右侧抽屉
  Modal.astro                              — 弹窗
  ConfirmDialog.astro                      — 确认弹窗
  EmptyState.astro                         — 空状态
  ErrorState.astro                         — 错误状态
  Skeleton.astro                           — 骨架屏
  Tabs.astro                               — 标签页
src/lib/admin/
  api/client.ts                            — 前端 API 调用封装
  api/types.ts                             — API 类型定义
  design-tokens.css                        — CSS 自定义属性（从 DESGIGN_TOKENS.md 提取）
```

**修改**：
```
（不修改任何现有文件）
```

### 3.3 API
```
（Phase 1 不新增 API。所有数据通过旧 API 获取，前端封装 client.ts）
```

### 3.4 DB Migration
```
（无）
```

### 3.5 权限
```
（Phase 1 使用 V1 的 isAuthed 模式。V2 前端检测 401 状态处理未登录）
```

### 3.6 AI
```
（Phase 1 无 AI 变更。Topbar 的 AI 状态灯显示占位）
```

### 3.7 测试
```
□ AdminShell 渲染（Sidebar + Topbar + 空白内容区）
□ 侧边栏 8 个一级入口点击高亮
□ 侧边栏折叠/展开
□ 面包屑正确显示
□ Cmd+K 弹出搜索框（UI 就位）
□ Drawer 打开/关闭
□ Modal 打开/关闭/ESC 关闭
□ ConfirmDialog 确认/取消
□ Toast 弹出/自动消失
□ EmptyState / ErrorState / Skeleton 各态渲染
□ Tabs 切换
□ 移动端响应式（侧边栏折叠为汉堡菜单）
```

### 3.8 验收标准
- [ ] 访问 `/admin-v2` 看到 V2 壳层
- [ ] 访问 `/admin` 看到旧后台（完全不受影响）
- [ ] Design System 10 个基础组件就位
- [ ] CSS 自定义属性文件完成
- [ ] `npm run check` 0 error
- [ ] `npm run build` 通过
- [ ] 推送部署后 `/admin-v2` 可访问

---

## 4. Phase 2: RBAC + Audit Log + Soft Delete + Version System

**依赖**：Phase 1
**预计工作量**：3-4 个会话
**V2 规范**：§29, §30, §33, §35, §40
**风险**：R15（RBAC 配置错误锁死）, R17（RBAC 绕过）, R10（Migration 失败）

### 4.1 目标

建立 V2 基础服务层：认证升级（单密码 → 多用户 RBAC）、操作审计、内容版本管理、软删除机制。

### 4.2 涉及文件

**新增**：
```
functions/api/admin/v2/auth/
  login.ts                                 — V2 登录（HMAC + 加载用户角色）
  logout.ts                                — V2 登出
  me.ts                                    — 当前用户+权限
functions/api/admin/v2/system/
  users.ts                                 — 用户 CRUD（仅 Owner/Admin）
  roles.ts                                 — 角色管理
  audit.ts                                 — 审计日志查询
functions/lib/admin/
  rbac.ts                                  — RBAC 中间件（checkPermission）
  audit.ts                                 — Audit 中间件（logAction）
  versioning.ts                            — 版本中间件（createVersion）
  soft-delete.ts                           — 软删除中间件
src/pages/admin-v2/system/
  users.astro                              — 用户管理页
  audit-log.astro                          — 审计日志查看页
src/components/admin/shared/
  VersionHistory.astro                     — 版本历史列表（从 Phase 1 移到 Phase 2）
```

**修改**：
```
migrations/                                — +0049, 0050, 0051
```

### 4.3 API
```
POST /api/admin/v2/auth/login              — 登录（返回用户+角色+权限）
POST /api/admin/v2/auth/logout             — 登出
GET  /api/admin/v2/auth/me                 — 当前用户信息
GET  /api/admin/v2/system/users            — 用户列表
POST /api/admin/v2/system/users            — 创建用户
PUT  /api/admin/v2/system/users/:id        — 编辑用户
DELETE /api/admin/v2/system/users/:id      — 删除用户
GET  /api/admin/v2/system/roles            — 角色列表
GET  /api/admin/v2/system/audit            — 审计日志（分页/筛选）
```

### 4.4 DB Migration
```
0049: admin_users, admin_roles, admin_permissions (seed Owner 角色)
0050: audit_logs
0051: content_versions (metadata-only + github_commit_sha + rollback_to_version_id)
0064: admin_entities (Search Index — INV-1: 5字段上限)
```

### 4.5 权限
```
□ RBAC 中间件就位（checkPermission）
□ Owner 角色硬编码（不可删除/降权）
□ 4 个标准角色定义（Owner/Admin/Editor/Viewer）— 按需扩展
□ 9 个权限动作（view/create/edit/publish/delete/export/execute_ai/approve_ai/manage_settings)
□ 8 个资源域（content/commerce/customers/oem/media/ai/growth/system）
□ audit_logs 自动记录所有写操作
□ content_versions 自动记录内容编辑
```

### 4.6 测试
```
□ 默认 Owner 用户创建成功
□ 登录返回用户+角色+权限
□ 无权限 API 返回 403 FORBIDDEN
□ 写操作产生 audit_log
□ 审计日志可分页查看
□ 内容编辑创建版本记录
□ 版本历史可列表查看
```

### 4.7 验收标准
- [ ] 至少 2 个角色可创建/切换
- [ ] RBAC 服务端强制验证（UI 不可绕过）
- [ ] 审计日志记录所有写操作
- [ ] 版本系统对编辑操作自动记录
- [ ] 旧 `/admin` + V1 API 完全不受影响
- [ ] `npm run build` 通过

---

## 5. Phase 3: Dashboard V2

**依赖**：Phase 1 + Phase 2
**预计工作量**：2-3 个会话
**V2 规范**：§4
**风险**：R1（超时），R11（兼容）

### 5.1 目标

将首页从「静态数字展示」升级为「老板驾驶舱 + AI 工作台」。

### 5.2 涉及文件

**新增**：
```
src/pages/admin-v2/index.astro            — Dashboard V2 页面
src/components/admin/analytics/
  FunnelChart.astro                        — 漏斗图
  MetricCard.astro                         — 指标卡
src/components/admin/ai/
  AIStatusIndicator.astro                  — AI 状态灯
  AISuggestionCard.astro                   — AI 建议卡片
functions/api/admin/v2/dashboard/
  kpi.ts                                   — 4 个核心 KPI
  ai-status.ts                             — AI 今日状态
  funnel.ts                                — 业务漏斗
  recent.ts                                — 最近工作
  action-items.ts                          — 需要处理
```

### 5.3 API
```
GET /api/admin/v2/dashboard/kpi            — 本月询盘/订单金额/网站用户/AI 已完成
GET /api/admin/v2/dashboard/ai-status      — AI 健康分/正在执行/完成/待确认/成本
GET /api/admin/v2/dashboard/funnel         — 询盘漏斗 + 商城漏斗
GET /api/admin/v2/dashboard/recent         — 最近编辑内容 + 最近询盘
GET /api/admin/v2/dashboard/action-items   — 需要处理列表
```

### 5.4 验收标准
- [ ] 4 个 KPI 卡有真实数据 + 环比 + 趋势
- [ ] KPI 卡可点击跳转对应模块并带筛选
- [ ] AI 今日建议最多 5 条，可查看/执行/忽略
- [ ] 漏斗图节点可点击下钻
- [ ] 「需要我处理」收口正确

---

## 6. Phase 4: Content Center

**依赖**：Phase 1 + Phase 2 + Phase 3
**预计工作量**：4-6 个会话
**V2 规范**：§5-7, §10, §30, §31
**风险**：R1（批量超时），R2（GitHub rate limit），R6（软删除遗漏）

### 6.1 目标

建立统一内容中心：5 种内容类型（博客/产品资料/指南/案例/FAQ）使用同一列表框架 + 三栏编辑器 + 文案资产中心 + 回收站 + 批量中心。

### 6.2 涉及文件（核心）

**新增**：
```
src/pages/admin-v2/content/
  blogs.astro                              — 博客列表
  products.astro                           — 产品资料列表
  guides.astro                             — 指南列表
  cases.astro                              — 案例列表
  faqs.astro                               — FAQ 列表
  edit/[type]/[id].astro                   — 内容编辑器（三栏）
  copy-assets.astro                        — 文案资产中心
  recycle-bin.astro                        — 回收站
  bulk.astro                               — 批量中心
src/components/admin/form/
  MarkdownEditor.tsx                       — Markdown 编辑器
  MediaPicker.astro                        — 媒体选择器
src/components/admin/shared/
  DataTable.astro                          — 通用数据表格（Phase 4 实现）
  FilterBar.astro                          — 筛选栏
  SearchBox.astro                          — 搜索框
  Pagination.astro                         — 分页
  BulkActionBar.astro                      — 批量操作工具栏
  QuickEdit.astro                          — 单元格快速编辑
functions/api/admin/v2/content/
  blogs.ts                                 — 博客 CRUD
  products.ts                              — 产品资料 CRUD
  guides.ts                                — 指南 CRUD
  cases.ts                                 — 案例 CRUD
  faqs.ts                                  — FAQ CRUD
  copy-assets.ts                           — 文案资产 CRUD
  bulk.ts                                  — 批量操作
  recycle-bin.ts                           — 回收站管理
```

**修改**：
```
migrations/                                — +0052, 0053, 0054, 0055
```

### 6.3 DB Migration
```
0052: copy_versions
~~0053~~: （跳过 — ADR-12 取消 recycle_bin）
0054: soft_delete columns (ALTER 内容相关表)
0055: copy_assets（linked_entity_type + linked_entity_id 关联，无 AI 冗余字段）
```

### 6.4 验收标准
- [ ] 5 种内容类型使用同一 DataTable 组件
- [ ] 每个内容编辑页预留 AI Panel 插槽（`<div id=\"ai-panel-slot\" />`），Phase 7 填充
- [ ] 关键操作（保存/发布/删除）有 Toast 即时反馈
- [ ] 列表全部支持搜索/筛选/排序/分页/批量选择/Quick Edit
- [ ] 新建/编辑内容走三栏编辑页（非 Modal）
- [ ] 删除内容进入回收站
- [ ] 回收站可恢复/永久删除
- [ ] 批量操作可用（至少批量发布/删除）
- [ ] 文案资产可新建/编辑/AI 重写（如果 AI 未就绪则标记 [AI-PENDING]）
- [ ] 旧内容页面 `/admin` 继续可用

---

## 7. Phase 5: Commerce Center

**依赖**：Phase 1 + Phase 2 + Phase 4
**预计工作量**：3-5 个会话
**V2 规范**：§8-9, §16, §45
**风险**：R6（软删除），R9（R2 文件残留）

### 7.1 目标

现货商品 V2 + SKU/变体 + 订单中心 + 利润率计算器 + 数据质量面板。

### 7.2 涉及文件（核心）

**新增**：
```
src/pages/admin-v2/commerce/
  products.astro                           — 现货商品列表
  products/[id].astro                      — 商品编辑页（三栏+计算器）
  orders.astro                             — 订单中心
  merchandising.astro                      — 运营位管理
src/components/admin/commerce/
  ProductKPIBar.astro                      — 商品 KPI 栏
  PriceCalculator.astro                    — 利润率计算器
  DataQualityPanel.astro                   — 数据质量面板
functions/api/admin/v2/commerce/
  products.ts                              — 商品 CRUD
  skus.ts                                  — SKU 管理
  orders.ts                                — 订单管理
  merchandising.ts                         — 运营位
  calculate.ts                             — 利润计算
```

**修改**：
```
migrations/                                — +0063 (saved_calculations)
```

### 7.3 验收标准
- [ ] 商品列表 5 种筛选可用
- [ ] 编辑页含实时利润率计算器
- [ ] 订单列表分页/筛选/详情 Drawer
- [ ] 商品可与产品资料关联
- [ ] 旧商品页面继续可用
- [ ] 商品编辑页预留 AI Panel 插槽（Phase 7 填充）
- [ ] 关键操作（改价/上下架/删除）有 Toast 即时反馈

---

## 8. Phase 6: Customer & OEM

**依赖**：Phase 1 + Phase 2 + Phase 5
**预计工作量**：5-7 个会话（最大 Phase）
**V2 规范**：§11-16, §45
**风险**：R8（OEM 从零开始），R17（报价权限）

### 8.1 目标

V2 最大新增模块：Customer 360 + OEM 项目中心 + OEM 计算器 + 报价管理 + 邮件中心。

### 8.2 涉及文件（核心）

**新增**：
```
src/pages/admin-v2/customers/
  inquiries.astro                          — 询盘中心 V2
  customers.astro                          — 客户列表
  customers/[id].astro                     — Customer 360
  oem.astro                                — OEM 项目列表
  oem/[id].astro                           — OEM 详情（12 Tab）
  quotes.astro                             — 报价管理
  emails.astro                             — 邮件中心
src/components/admin/customer/
  CustomerCard.astro                       — 客户信息卡
  InquiryTimeline.astro                    — 询盘时间线
  LeadScore.astro                          — Lead Score
  EmailComposer.tsx                        — 邮件编辑器
src/components/admin/oem/
  OEMStepper.astro                         — OEM 阶段进度条
  OEMCalculator.astro                      — OEM 报价计算器
  OEMQuoteCompare.astro                    — 报价版本对比
functions/api/admin/v2/customers/
  inquiries.ts                             — 询盘 CRUD
  customers.ts                             — 客户 CRUD
  emails.ts                                — 邮件管理
functions/api/admin/v2/oem/
  projects.ts                              — OEM 项目 CRUD
  requirements.ts                          — OEM 需求
  samples.ts                               — OEM 打样
  quotes.ts                                — OEM 报价
  calculate.ts                             — OEM 计算器
```

**修改**：
```
migrations/                                — +0056, 0057, 0058, 0059
```

### 8.4 DB Migration
```
0056: customers + inquiries.customer_id FK (ADR-17)
0057: oem_projects, oem_requirements, oem_samples
0058: oem_quotes (含 status + converted_to_order_id), oem_files, oem_timeline
~~0059~~: （跳过 — ADR-13 取消 entity_links）
```

### 8.5 验收标准
- [ ] 客户可关联询盘/邮件/OEM/订单
- [ ] Customer 360 展示完整关联数据
- [ ] OEM 项目完整 12 Tab 详情
- [ ] OEM 计算器实时计算
- [ ] 报价多版本对比
- [ ] **报价/付款/合同/合规声明必须人工确认（硬编码 MANUAL）**
- [ ] 旧询盘/客户页面继续可用
- [ ] 询盘/OEM/Customer 360 页面预留 AI Panel 插槽（Phase 7 填充）
- [ ] 关键操作（报价发送/项目阶段变更）有 Toast 即时反馈

---

## 9. Phase 7: AI Integration

**依赖**：Phase 3-6（业务对象就位）
**预计工作量**：4-6 个会话
**V2 规范**：§19-23, §44, §51
**风险**：R13（幻觉），R14（预算），R18（提权注入）

### 9.1 目标

AI 不再独占页面，融入每个业务对象。统一 AI Action 标准 + AI Panel + Task Queue + 自动化规则 + Rollback。

### 9.2 涉及文件（核心）

**新增**：
```
src/components/admin/ai/
  AIActionButton.astro                     — ✨ AI 按钮
  AIPanel.tsx                              — AI 操作面板
  AITaskStatus.astro                       — AI 任务状态
  DiffViewer.tsx                           — AI 修改前后对比
functions/api/admin/v2/ai/
  execute.ts                               — 统一 AI 执行
  approve.ts                               — AI 结果批准
  reject.ts                                — AI 结果拒绝
  rollback.ts                              — AI 回滚
  tasks.ts                                 — AI 任务管理
  rules.ts                                 — AI 自动化规则
functions/lib/admin/ai/
  action-standard.ts                       — AI Action 标准封装
  ai-panel-registry.ts                     — 模块注册 AI Actions
```

**修改**：
```
（不修改 functions/lib/permissions.ts / truthfulness.ts / action-budget.ts / mission-log.ts）
migrations/                                — +0061, 0062 (ai_tasks 合并 V1 tasks+task_runs, ADR-15)
```

### 9.3 验收标准
- [ ] 至少 3 个业务对象（产品/询盘/OEM）有 AI Panel
- [ ] AI 操作展示 Before/After Diff
- [ ] L2 操作等待人工批准
- [ ] AI 自动操作可回滚（content_versions.github_commit_sha + rollback_to_version_id）
- [ ] AI 操作频率限制（Per Minute + Concurrency）
- [ ] AI 任务列表可查看/重试/回放
- [ ] AI 安全网四件套零改动
- [ ] 旧 AI 页面继续可用

---

## 10. Phase 8: Growth Center

**依赖**：Phase 7（AI Task Queue）
**预计工作量**：3-4 个会话
**V2 规范**：§24-26
**风险**：R2（GSC API rate limit），R13（AI 幻觉）

### 10.1 目标

SEO Inspector + 可交互 Analytics + Growth Opportunities（证据→影响→置信度→动作）+ Experiment 闭环。

### 10.2 验收标准
- [ ] SEO Score 0-100 可用
- [ ] Analytics 图表可点击下钻
- [ ] Growth 机会可创建 AI Task
- [ ] Experiment 记录 Before/After 对比

---

## 11. Phase 9: Media Center

**依赖**：Phase 1 + Phase 2
**预计工作量**：3-4 个会话

### 11.1 目标

统一媒体资产库 + 视频中心 V2（保留五步流水线 + AI Score + 商品关联）。

### 11.2 验收标准
- [ ] 媒体资产按类型/关联对象筛选
- [ ] 视频五步流水线完整保留
- [ ] AI 翻译任务可用

---

## 12. Phase 10: Notification + Global Search

**依赖**：Phase 2 + Phase 3-9
**预计工作量**：2-3 个会话

### 12.1 目标

通知中心 + 全局搜索后端（12 种对象类型）。

### 12.2 验收标准
- [ ] Topbar 铃铛有未读计数
- [ ] 通知可已读/跳转
- [ ] Cmd+K 搜索返回结果

---

## 13. Phase 11: System Settings

**依赖**：Phase 2 + Phase 10
**预计工作量**：2-3 个会话

### 13.1 目标

站点设置 + 多语言管理 + 知识库 V2。

### 13.2 验收标准
- [ ] 管理员可增删成员
- [ ] 知识库可增删改查

---

## 14. Phase 12: Import Center

**依赖**：Phase 5 + Phase 9
**预计工作量**：2-3 个会话

### 14.1 目标

1688/Excel/CSV 统一导入：Upload→Parse→Validate→Preview→Mapping→AI Enrich→Confirm→Create→Report。

### 14.2 验收标准
- [ ] 上传后预览（不直接写库）
- [ ] 导入报告显示成功/失败/跳过

---

## 15. Phase 13: Polish & QA

**依赖**：Phase 1-12
**预计工作量**：2-3 个会话

### 15.1 范围

- 全部列表五态检查（Loading/Empty/Error/Success/Permission）
- 返回保留筛选
- 面包屑完整
- 性能（分页/缓存/Debounce/Lazy Load/缩略图）
- UI 文案（英文 + 中文注释）
- 移动端响应式

---

## 16. Phase 14: Final Verification & Cutover

**依赖**：Phase 13
**预计工作量**：2-3 个会话

### 16.1 范围

1. V2 §54 验收标准逐项检查
2. V1 API 冒烟全量回归
3. `/admin` → 切换到 V2 Shell（内部转发）
4. 旧路由保留兼容转发 30 天
5. 旧代码归档到 `_archive/`
6. 推送部署
7. 监控 7 天

### 16.2 验收标准（V2 §54）

**可用性**：
- [ ] 重要操作 1-2 次点击
- [ ] 列表全部支持搜索/筛选/分页
- [ ] 返回列表保留筛选
- [ ] 复杂编辑不使用 Modal

**数据**：
- [ ] 每对象有明确数据源
- [ ] API 统一格式
- [ ] 删除可恢复
- [ ] 修改有版本

**AI**：
- [ ] 每个核心对象有 AI Action
- [ ] AI 有 Role / 权限 / 成本 / 日志 / Diff / 回滚
- [ ] AI 失败可重试

**业务**：
- [ ] 询盘→客户→OEM→报价→订单链路通
- [ ] 产品关联内容/视频/文案

**增长**：
- [ ] SEO→任务→执行→验证
- [ ] Analytics→对象下钻
- [ ] Growth→实验记录

**安全**：
- [ ] RBAC / Audit Log / Soft Delete / Server-side Permission / AI Approval

---

## 17. 每个 Phase 的执行协议

### 开发前
1. 重读该 Phase 对应的 V2 规范章节 + P0 审计结果
2. 列出精确的文件清单（新增 + 修改）
3. 列出精确的 API 清单
4. 确认 Migration 就绪
5. 列出环境变量需求
6. 确认前置 Phase 已完成

### 开发中
1. 先写 API + Migration
2. 再写组件
3. 最后写页面组装
4. 每完成一个文件 → 验证 build

### 开发后
1. 自测（该 Phase 的验收标准逐项过）
2. 跑 V1 API 冒烟（确保未破坏旧功能）
3. 跑 `npm run check && npm run build`
4. 输出 Phase 报告
5. 推送部署
6. 用户验收
7. 通过后进入下一 Phase

---

## 18. 关键依赖路径

```
Phase 0 ──→ Phase 1 ──→ Phase 2 ──→ Phase 3
                                       │
                    ┌──────────────────┤
                    ▼                  ▼
                Phase 4            Phase 5
                    │                  │
                    └──────┬───────────┘
                           ▼
                       Phase 6
                           │
                           ▼
                       Phase 7
                        │    │
                        ▼    ▼
                    Phase 8  Phase 9
                        │    │
                        └────┼────┐
                             ▼    ▼
                          Phase 10
                             │
                             ▼
                          Phase 11
                             │
                             ▼
                          Phase 12
                             │
                             ▼
                          Phase 13
                             │
                             ▼
                          Phase 14
```

Phase 4 和 Phase 5 可部分并行（内容中心不依赖商城）。Phase 8 和 Phase 9 可完全并行。

---

*本文为 Phase 0 最终输出。每个 Phase 执行前将基于本文 + 最新代码状态做更精确的施工计划。*"