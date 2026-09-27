# V2 Development Gates
## Phase 门禁检查清单

版本：V1.0
日期：2026-08-24
状态：Phase 0 已封版，进入 Gate-based Development

---

## 核心规则

### 单向约束链

```
README.md → V2_MASTER_PLAN → ADR → V2_ARCHITECTURE_TARGET → V2_DATA_MIGRATION → V2_PHASE_PLAN → CODE
```

**代码不能反向修改设计。** 如果开发过程中发现设计缺口：

```
发现缺口 → 写 ARCHITECTURE_CHANGE_REQUEST.md → 人工批准 → 修改 ADR → 修改 Architecture → 修改 Migration → 修改 Phase Plan → 才能写代码
```

### INV-1：admin_entities 字段永不加列

```
entity_type, entity_id, title, status, updated_at。五个。永远不变。
任何 AI 或开发者不得因为"加一个字段比较方便"而 ALTER。
必须通过 JOIN 源表获取额外数据。
```

### 开发者规则

```
□ 当前只允许执行本 Phase 的任务
□ 后续 Phase 只能读取设计，不得提前实现
□ 不允许自行新增 DB 表、API、ADR、权限规则、AI Role、业务状态
□ 发现设计缺口 → 写 CHANGE_REQUEST → 等批准 → 不得自行修改架构
```

---

## Gate 1 — Phase 1: AdminShell + Design System

### 前置条件

```
□ Phase 0 已封版（本目录全部文档完成且一致性验证通过）
□ 开发者已阅读本文档
```

### 允许的范围

```
□ AdminShell 壳层（Sidebar 240px + Topbar 64px + 内容区 max 1440px）
□ 8 个一级导航入口（Dashboard / Content / Commerce / Customers / Media / Growth / AI / System）
□ Topbar（Breadcrumb + GlobalSearch UI shell + AI 状态灯 + 通知铃铛 + 用户菜单）
□ 10 个基础组件：
    KPICard, StatusBadge, ScoreBadge, Toast, Skeleton, EmptyState, ErrorState,
    Drawer, Modal, ConfirmDialog, Tabs
□ CSS 自定义属性（从 DESGIGN_TOKENS.md 提取颜色/间距/字体令牌）
□ 路由系统（/admin-v2 壳层 + 子路由占位）
```

### 禁止的范围

```
❌ 修改任何现有文件（/admin 路由和所有 V1 API 保持不动）
❌ 新增数据库表或 Migration
❌ 新增 API 端点
❌ 修改现有业务逻辑
❌ 新增 AI Role 或 AI 功能
❌ 新增权限规则
❌ 迁移任何 V1 业务视图到 V2
```

### 验收标准

```
□ 访问 /admin-v2 看到新壳层（Sidebar + Topbar + 空白内容区）
□ 访问 /admin 看到旧后台（完全不受影响）
□ 侧边栏 8 个一级入口可点击高亮
□ Cmd+K 弹出搜索框（UI 就位，后端搜索可空）
□ 10 个基础组件可渲染
□ Toast 可弹出/自动消失
□ Drawer 可打开/关闭
□ Modal 可打开/关闭/ESC 关闭
□ ConfirmDialog 确认/取消
□ npm run check 0 error
□ npm run build 通过
□ 推送部署后 /admin-v2 可访问
```

### Gate PASS 标志

```
🟢 以上全部 □ 打勾 → 进入 Phase 2
```

---

## Gate 2 — Phase 2: RBAC + Audit Log + Version System + admin_entities

### 前置条件

```
□ Gate 1 PASS
□ 开发者已阅读 V2_PERMISSION_MAP_CURRENT.md（当前 HMAC 认证机制）
□ 开发者已阅读 ADR-10~17 + INV-1
```

### 新增 DB（必须与本目录 Migration DDL 完全一致）

```
□ 0049: admin_users, admin_roles, admin_permissions（4 角色：Owner/Admin/Editor/Viewer）
□ 0050: audit_logs（actor_type: human/ai/cron/system）
□ 0051: content_versions（metadata-only，含 github_commit_sha + rollback_to_version_id）
□ 0064: admin_entities（5 字段，INV-1 锁定）
```

### 新增 API

```
□ POST /api/admin/v2/auth/login
□ POST /api/admin/v2/auth/logout
□ GET  /api/admin/v2/auth/me
□ GET/POST/PUT/DELETE /api/admin/v2/system/users（仅 Owner/Admin）
□ GET  /api/admin/v2/system/roles
□ GET  /api/admin/v2/system/audit（分页/筛选）
```

### 必须实现

```
□ RBAC 中间件（checkPermission(user, action, resource) — 服务端强制）
□ Audit 中间件（logAction(actor_type, action, entity_type, entity_id, before, after)）
□ Version 中间件（createVersion(entity_type, entity_key, author, source, change_summary, github_commit_sha)）
□ Soft Delete 基础（deleted_at + deleted_by 列 + API UPDATE 而非 DELETE）
□ admin_entities 同步函数（syncAdminEntity(entity_type, entity_id, title, status) — 每个 V2 API handler 写操作后调用）
□ admin_entities 初始种子脚本（从各源表一次性填充）
```

### 禁止的范围

```
❌ 不修改任何 V1 API（/api/admin/* 保持原样）
❌ 不对旧表加 soft delete 列（Phase 4 逐表进行）
❌ 不实现搜索后端（Phase 3/10）
❌ 不实现 AI 功能
```

### 验收标准

```
□ 4 个角色可创建/切换
□ Owner 角色硬编码不可删除/降权
□ Viewer 访问 POST/PUT/DELETE API 返回 403
□ 任何写操作产生 audit_log 记录（含 actor_type 区分）
□ 内容编辑自动创建 content_versions（metadata-only）
□ admin_entities 种子脚本成功（现有对象全部注册）
□ admin_entities 5 字段，无多余列（INV-1 验证）
□ Migration 可回滚（DOWN 执行后表删除、恢复 V1 单密码模式）
□ V1 /admin 和全部 V1 API 正常运作
□ npm run build 通过
```

### Gate PASS 标志

```
🟢 以上全部 □ 打勾 → 进入 Phase 3
```

---

## Gate 3 — Phase 3: Dashboard V2

### 前置条件

```
□ Gate 2 PASS
```

### 必须实现

```
□ 4 个 KPI 卡（本月询盘/订单金额/网站用户/AI 完成动作）— 数据来自真实 D1 查询，非写死
□ KPI 卡可点击跳转对应模块并带筛选参数
□ AI 今日状态面板（健康分/正在执行/完成/待确认/成本 — 读 ai_missions + ai_daily_report）
□ AI 今日建议（最多 5 条 — 读 growth_opportunities + ai_feedback）
□ 业务漏斗（询盘漏斗 + 商城漏斗 — 读 inquiries + commerce_orders）
□ 最近编辑内容（读 content_versions）
□ 最近询盘（读 inquiries）
□ 「需要我处理」统一收口（AI 待确认 + 新询盘 + 商品缺字段 + SEO 问题 + OEM 待报价）
□ admin_entities 基础搜索（Cmd+K → LIKE title + LIMIT 20）
```

### 禁止

```
❌ 不做 AI Command（/ai 模式搁置到 Phase 8）
❌ 不做外部搜索索引
```

### 验收标准

```
□ KPI 数字来自真实数据源（非硬编码）
□ KPI 卡可点击 → 跳转到对应模块带筛选
□ AI 建议可查看/忽略（执行搁置到 Phase 7）
□ 漏斗节点可点击下钻
□ Cmd+K 可搜索 admin_entities（基础实现）
□ 不增加任何新 DB 表
```

### Gate PASS 标志

```
🟢 以上全部 □ 打勾 → 进入 Phase 4
```

---

## Gate 4 — Phase 4: Content Center

### 前置条件

```
□ Gate 3 PASS
□ **STOP-01 check**：Unified Product View 页面设计已完成
□ **Cross-Source check**：发布状态五态（Draft→Committing→Building→Deployed→BuildFailed）已设计
□ **Rollback check**：content_versions 含 github_commit_sha + rollback_to_version_id（Phase 2 已建）
□ **Batch check**：批量操作 item-level 幂等设计已完成
```

### 新增 DB

```
□ 0052: copy_versions
□ 0054: soft_delete 列（ALTER 内容相关表）
□ 0055: copy_assets（linked_entity_type + linked_entity_id 关联，无 AI 冗余字段）
```

### 新增 API

```
□ CRUD /api/admin/v2/content/blogs
□ CRUD /api/admin/v2/content/products
□ CRUD /api/admin/v2/content/guides
□ CRUD /api/admin/v2/content/cases
□ CRUD /api/admin/v2/content/faqs
□ CRUD /api/admin/v2/content/copy-assets
□ POST /api/admin/v2/content/bulk
□ GET/PUT/DELETE /api/admin/v2/content/recycle-bin（查源表 WHERE deleted_at IS NOT NULL）
```

### 必须实现

```
□ 统一内容列表（DataTable + FilterBar + Pagination — 5 种内容类型复用同一组件）
□ 内容编辑器（两栏默认：导航 + 编辑；右栏 AI/SEO 可折叠）
□ 发布状态五态（Draft → Committing → Building → Deployed → BuildFailed）
□ GitHub 发布 idempotency key（防重复 Publish）
□ CF Build 状态回调（Deployment Hook → 更新 publish_status）
□ 回收站（查源表 WHERE deleted_at IS NOT NULL，无独立 recycle_bin 表）
□ 批量中心（轻量操作同步分批每批 20；AI 操作创建 batch job 异步）
□ 文案资产 CRUD（13 类型 × locale × linked_entity）
□ 每个内容编辑页预留 AI Panel 插槽
□ 关键操作有 Toast 即时反馈
```

### 禁止

```
❌ 不修改 V1 内容 API
❌ 不迁移旧内容数据到 D1（GitHub MD 真源不变）
❌ AI Panel 内容留空（Phase 7 填充）
```

### 验收标准

```
□ 5 种内容类型使用同一 DataTable 组件
□ 列表支持搜索/筛选/排序/分页/批量选择/Quick Edit（title 字段）
□ 新建/编辑走独立页面（非 Modal）
□ 发布状态五态完整可用
□ 删除内容进入回收站（可恢复/永久删除）
□ 批量操作可用（至少批量发布/批量删除）
□ 返回列表保留筛选
□ 旧 /admin 内容页面继续可用
```

### Gate PASS 标志

```
🟢 以上全部 □ 打勾 → 进入 Phase 4.5 (Unified Product View) → Phase 5
```

---

## Gate 5 — Phase 5: Commerce Center

### 前置条件

```
□ Gate 4 PASS
□ **Product Model check**：Product Content vs Commerce Product 的统一 UI 视图已设计（Phase 4.5）
```

### 新增 DB

```
□ 0063: saved_calculations
□ commerce_products 加 deleted_at/deleted_by/version 列
```

### 必须实现

```
□ 现货商品列表（ProductKPIBar + DataTable + 6 种筛选）
□ 商品编辑页（两栏 + 利润率计算器 + AI Panel 插槽）
□ SKU/变体管理
□ 订单中心（分页/筛选/详情 Drawer）
□ 数据质量面板
□ Commerce Product + Product Content 统一视图入口（Phase 4.5 交付）
```

### 禁止

```
❌ 不合并 Content Product 和 Commerce Product 到一个表
❌ AI Panel 内容留空
```

### 验收标准

```
□ 商品列表 6 种筛选可用
□ 编辑页含实时利润率计算器
□ 订单列表分页/筛选/详情 Drawer
□ 统一产品视图（从一个入口看到 Product Content + Commerce + Copy + Media + SEO + AI）
□ 关键操作有 Toast 反馈
```

### Gate PASS 标志

```
🟢 以上全部 □ 打勾 → 进入 Phase 6
```

---

## Gate 6 — Phase 6: Customer & OEM

### 前置条件

```
□ Gate 5 PASS
□ **STOP-02 check**：Inquiry→Customer→OEM→Quote→Order 完整业务链已设计
□ **Business Flow check**：Quote→Order 转换 API 已设计（oem_quotes.converted_to_order_id）
□ **OEM Scope check**：Phase 6 V1 范围已确认（Inquiry→Customer→OEM→Req→Sample→Quote→Order 转换）
```

### 新增 DB

```
□ 0056: customers + inquiries.customer_id FK (ADR-17)
□ 0057: oem_projects, oem_requirements, oem_samples
□ 0058: oem_quotes（含 status + converted_to_order_id）, oem_files, oem_timeline
□ commerce_orders 加 source_type + source_id（ADR-17）
```

### 必须实现

```
□ 询盘中心 V2（Lead Score / AI 摘要 / Drawer 回复）
□ 客户中心（Customer 360：关联询盘/邮件/OEM/订单/评价）
□ OEM 项目中心（列表 + 详情概览页 — 非 12 Tab）
□ OEM 计算器
□ 报价管理（多版本 + Quote→Order 一键转换）
□ 邮件中心
□ 关键操作（报价/付款/合同/合规声明）必须人工确认（MANUAL）
□ 每个详情页预留 AI Panel 插槽
```

### 禁止

```
❌ OEM 不要做成 12 Tab 信息过载（概览页 + 分段滚动）
❌ 不建 Formula/Fragrance/Production/Shipment 表（V2 后迭代）
```

### 验收标准

```
□ 询盘可一键创建客户（自动复制 name/email/company/country → INSERT customer + UPDATE inquiry.customer_id）
□ Customer 360 展示完整关联数据
□ OEM 详情页核心信息首屏可见（待办/最近沟通/报价状态/样品状态）
□ OEM 计算器实时计算
□ Quote→Order 一键转换（复制 product/sku/qty/price → INSERT commerce_order + UPDATE oem_quote.converted_to_order_id）
□ 报价/付款/合同/合规声明必须人工确认（硬编码 MANUAL，API 层二次验证）
□ 旧询盘/客户页面继续可用
```

### Gate PASS 标志

```
🟢 以上全部 □ 打勾 → 进入 Phase 7
```

---

## Gate 7 — Phase 7: AI Integration

### 前置条件

```
□ Gate 6 PASS
□ **AI Rate Limiting check**：Per Minute / Concurrency / Circuit Breaker 已设计
□ **AI Worker check**：批量 AI Worker 超时的 item-level 幂等 + 状态恢复已设计
□ **Rollback check**：content_versions 含 github_commit_sha + rollback_to_version_id（Phase 2 已建）
□ AI 安全网四件套（permissions/truthfulness/budget/mission-log）原样可用
```

### 新增 DB

```
□ 0061: ai_automation_rules
□ 0062: ai_tasks（合并 V1 tasks + task_runs，ADR-15）
```

### 必须实现

```
□ AI Action 标准（Input/Reason/Risk/Permission/Model/Cost/Output/Diff/Approval/Execution/Result/Rollback）
□ AI Panel 统一组件（AIPanel + AIActionButton + AITaskStatus + DiffViewer）
□ Phase 4-6 预留的 AI Panel 插槽全部填充
□ AI Panel Registry（每个业务模块注册自己的 AI Actions）
□ AI Task Queue（D1-based：queued→running→awaiting_approval→completed→failed）
□ AI 自动化规则（WHEN/IF/THEN — 初期手动触发，Phase 8+ 自动触发）
□ AI 操作频率限制（Per Minute 上限 + Queue）
□ 批量 AI item-level 幂等键（每 item 独立 idempotency_key）
□ 批量 AI 进度 + 部分成功 + 失败重试
□ AI 修改 Before/After Diff + Accept/Reject
□ AI Rollback（content_versions.github_commit_sha 回滚）
□ Content→AI 输入边界 sanitization（剥离 IGNORE ALL/SYSTEM:/DELETE/EXECUTE 等指令模式）
```

### 禁止

```
❌ 不修改 V1 permissions.ts / truthfulness.ts / action-budget.ts / mission-log.ts
❌ 不做 AI Command 自然语言执行（Phase 8）
❌ 不开放 AI 自动执行 MANUAL 级别的操作
```

### 验收标准

```
□ 至少 3 个业务对象（产品/询盘/OEM）有 AI Panel
□ AI 操作展示 Before/After Diff
□ L2 操作等待人工批准
□ AI 自动操作可回滚（读 github_commit_sha → GitHub API 读旧版 → 恢复）
□ AI 任务列表可查看/重试/回放
□ AI 频率限制生效（连续触发 5 次后第 6 次进入队列）
□ 批量 AI 操作显示进度（23/100）+ 失败 item 可单独重试
□ AI 安全网四件套零改动
□ Content→AI 输入边界 sanitization 已实现
□ 旧 AI 页面继续可用
```

### Gate PASS 标志

```
🟢 以上全部 □ 打勾 → 进入 Phase 8
```

---

## Gate 8 — Phase 8: Growth Center

### 前置条件

```
□ Gate 7 PASS
□ AI Command 子系统设计已完成
```

### 必须实现

```
□ SEO Inspector（页面级 SEO Score 0-100）
□ 可交互 Analytics 图表
□ Growth Opportunities（证据→影响→置信度→推荐动作）
□ Experiment 闭环（假设→执行→Before→After→结果→学习）
□ AI Command 基础版（预定义命令模板，非自由文本解析）
```

### 禁止

```
❌ 不做自由文本 AI 命令（如"找出最近 30 天流量下降最大的 5 个产品" — Phase 8+ 迭代）
```

---

## Gate 9 — Phase 9: Media Center

### 前置条件

```
□ Gate 1+2 PASS（Phase 9 可与 Phase 3-8 部分并行）
```

### 必须实现

```
□ 统一媒体资产库（图片/视频/PDF/证书/SDS/COA/IFRA）
□ 视频中心 V2（保留 V1 五步流水线 + AI Score + 商品关联）
□ AI 翻译任务
□ 图片引用计数（R2 object → 关联 entity 计数，删前检查）
```

---

## Gate 10 — Phase 10: Notification + Search

### 前置条件

```
□ Gate 2+3-9（通知事件源就位）
□ 外部搜索索引方案已评估
```

### 必须实现

```
□ 通知中心（新询盘/新订单/AI 完成/AI 失败/SEO 异常/商品质量/OEM 待处理）
□ 全局搜索后端（admin_entities + JOIN 源表）
□ 搜索性能达标（LIKE 在 10K 记录下 <500ms；或使用外部索引）
```

---

## Gate 11 — Phase 11: System Settings

### 必须实现

```
□ 站点设置 UI
□ 多语言管理（EN/ES/DE 翻译状态）
□ 用户与角色管理（RBAC UI）
□ 知识库 V2（L0-L4 分层 + AI 生成前检索）
□ i18n 从硬编码 ts 迁移到 D1 i18n_strings（可选，按需）
```

---

## Gate 12 — Phase 12: Import Center

### 必须实现

```
□ 1688/Excel/CSV 统一导入（Upload→Parse→Validate→Preview→Mapping→AI Enrich→Confirm→Create→Report）
□ 上传后预览（不直接写库）
```

---

## Gate 13 — Phase 13: Polish & QA

### 必须实现

```
□ 全部列表五态检查（Loading/Empty/Error/Success/Permission）
□ 返回保留筛选
□ 面包屑完整
□ 性能（分页/缓存/Debounce/Lazy Load/缩略图）
□ UI 文案（英文 + 中文注释）
□ 移动端响应式
□ 快捷键体系（Ctrl+K/Ctrl+S/Ctrl+Enter/Esc）
□ 性能压力测试（100K+ 记录场景）
```

---

## Gate 14 — Phase 14: Final Verification & Cutover

### 前置条件

```
□ Gate 1-13 全部 PASS
□ V1 API 全量冒烟回归通过
□ 废弃 8 表：grep 源码确认无 API/cron 读写 → RENAME → 观察 7 天无异常
```

### 必须实现

```
□ V2 §54 验收标准逐项检查
□ /admin → 切换到 V2 Shell（V1 路由保留转发 30 天）
□ 旧代码归档
□ 监控 7 天
```

### 最终 Gate PASS 标志

```
🟢 全部 14 Gate PASS → V2 正式上线
```

---

## 架构变更流程

开发过程中如果发现设计缺口，必须走以下流程：

```
1. 创建 docs/v2-architecture/CHANGE_REQUESTS/CR-###.md
2. 填写：问题描述 / 影响范围 / 建议方案 / 替代方案
3. 提交人工审批
4. 批准后：
   a. 更新 ADR（新编号）
   b. 更新受影响的 Architecture 文档
   c. 更新 Migration（如需新 migration 编号）
   d. 更新 Phase Plan（如需新任务）
   e. 更新本 Gate 文档（如需新验收标准）
5. 代码实现
```

**禁止跳过审批直接修改代码。**

---

## 快速参考：每 Phase 不可做的事

| Phase | 不可做 |
|-------|--------|
| Phase 1 | 改 DB / 加 API / 改业务逻辑 / 改旧页面 |
| Phase 2 | 改 V1 API / 改旧表结构 / 实现搜索/AI |
| Phase 3 | 加 DB 表 / AI Command / 外部搜索 |
| Phase 4 | 改 V1 内容 API / 迁移 GitHub MD 到 D1 / 填充 AI Panel |
| Phase 5 | 合并 Content Product + Commerce Product 到一个表 |
| Phase 6 | 12 Tab OEM / 建 Formula/Production/Shipment 表 |
| Phase 7 | 改安全网四件套 / AI Command / AI 自动 MANUAL |
| Phase 8 | 自由文本 AI 命令 |
| Phase 9 | 删 R2 文件前不检查引用计数 |
| Phase 10 | D1 LIKE 100K 行全表扫描 |
| Phase 11 | 保留 i18n 硬编码（建议迁移） |
| Phase 13 | 跳过性能压力测试 |
| Phase 14 | 废弃表直接 DROP（必须 RENAME+观察） |

---

*本文档是 V2 开发阶段唯一的门禁检查清单。每个 Phase 开始前必须重读对应 Gate。Phase 0 已封版，不再接受开放式架构审查。*