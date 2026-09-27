# PHASE 1 CODE AUDIT
## Independent Code-Level Verification

审计日期：2026-08-24
审计范围：Phase 1 全部 18 个新增文件
审计依据：docs/v2-architecture/ 封版文档（ADR/INV/GATES/PHASE_PLAN）
原则：不修改代码，不新增文件，不进入 Phase 2

---

## 1. 总判定

**🟡 PASS WITH WARNINGS**

Phase 1 核心交付满足架构约束。发现 4 个 WARNING（无 BLOCKING 问题），1 个架构对齐备注。

---

## 2. V1 Isolation

**PASS** ✅

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 修改 /admin | ❌ 无 | `git diff --name-only` 输出空 |
| 修改 V1 API | ❌ 无 | 同上 |
| 修改业务组件 | ❌ 无 | 同上 |
| 修改现有 DB | ❌ 无 | 无 migration |
| 增加 AI Role | ❌ 无 | 无新增 role 定义 |
| 增加权限规则 | ❌ 无 | 无 RBAC 代码 |
| 迁移 V1 业务页面 | ❌ 无 | `/admin-v2` 是全新路由 |
| 改变 build 行为 | ❌ 无 | 2419 pages (pre-Phase 1: 2419，build 页面数未变) |
| V1 页面引用 V2 组件 | ❌ 无 | grep 确认零交叉引用 |
| V2 组件引用 V1 页面 | ❌ 无 | grep 确认零交叉引用 |

**唯一交叉点**：`client.ts` 中 `BASE = '/api/admin'` — V2 前端调用 V1 API 路径。这是 Phase 1 设计内行为（无 V2 API 可调），Phase 2 起新增 `/api/admin/v2/` 端点后逐步切换。不是隔离违规。

---

## 3. Architecture Compliance

**PASS** ✅

| ADR/INV/Gate | 内容 | Phase 1 状态 |
|-------------|------|-------------|
| ADR-6 | 不做 SPA 框架 | ✅ Astro 多页面，无 React Router |
| ADR-7 | Astro 组件优先 | ✅ 全部 13 个组件为 `.astro`，零 React island |
| ADR-8 | 保留 GitHub 内容管线 | ✅ 不涉及 |
| ADR-10 | admin_entities = Search Index | ✅ Phase 1 不涉及 |
| ADR-11 | content_versions metadata-only | ✅ Phase 1 不涉及 |
| ADR-12 | recycle_bin 取消 | ✅ Phase 1 不涉及 |
| ADR-13 | entity_links 取消 | ✅ Phase 1 不涉及 |
| ADR-14 | copy_assets AI 字段移除 | ✅ Phase 1 不涉及 |
| ADR-15 | AI 模型 5→2 层 | ✅ Phase 1 不涉及 |
| ADR-16 | 发布五态 | ✅ Phase 1 不涉及 |
| ADR-17 | 业务链 FK | ✅ Phase 1 不涉及 |
| INV-1 | admin_entities 5 字段 | ✅ Phase 1 不涉及 |
| Gate 1 允许范围 | 全部 12 项 | ✅ 全部实现 |
| Gate 1 禁止范围 | 全部 7 项 | ✅ 零违反 |

**架构对齐备注**：Sidebar 导航标签（Sidebar.astro:13）"商品 Commerce" vs V2 §1.1 "C. 商品与商城"。中文简化 2 字，英文匹配。不违反规范（AGENTS.md 要求双语标注，语义一致）。

---

## 4. Component Compliance

**PASS** ✅（1 WARNING）

| 组件 | Props 耦合业务 | 命名一致 | Slot 合理 | 职责单一 | Phase 4-6 可复用 |
|------|--------------|---------|---------|---------|----------------|
| KPICard | ✅ 无 | ✅ | N/A | ✅ | ✅ |
| StatusBadge | ✅ 无 | ✅ | N/A | ✅ | ✅ |
| Toast | ✅ 无 | ⚠️ W1 | N/A | ✅ | ✅ |
| Drawer | ✅ 无 | ✅ | ✅ | ✅ | ✅ |
| Modal | ✅ 无 | ✅ | ✅ | ✅ | ✅ |
| ConfirmDialog | ✅ 无 | ✅ | ✅ | ✅ | ✅ |
| EmptyState | ✅ 无 | ✅ | ✅ | ✅ | ✅ |
| ErrorState | ✅ 无 | ✅ | ✅ | ✅ | ✅ |
| Skeleton | ✅ 无 | ✅ | N/A | ✅ | ✅ |
| Tabs | ✅ 无 | ✅ | ✅ | ✅ | ✅ |

**W1 — Toast 全局命名空间**：`window.AromisoToast` 挂载在全局 window 对象上（Toast.astro:13）。如果未来有其他脚本使用同名全局变量会产生冲突。建议 Phase 2 后迁移到 ES module export 或 event-based 模式。非阻塞（Phase 1 无模块化要求）。

---

## 5. API Layer Compliance

**PASS** ✅（2 WARNINGS）

| 检查项 | 结果 | 说明 |
|--------|------|------|
| ApiEnvelope\<T\> 与 V2 §37 一致 | ✅ | `{ success, data, error, meta }` |
| PaginationMeta 与规范一致 | ✅ | `{ page, pageSize, total, totalPages }` |
| ErrorCode 与架构一致 | ✅ | 11 个标准 code（UNAUTHORIZED 到 EXTERNAL_SERVICE_ERROR）|
| GET/POST/PUT/DELETE 统一 | ✅ | 全部方法通过 `request()` 统一处理 |
| V2 envelope 解析 | ✅ | `'success' in json` 检测 |
| V1 fallback 标准化 | ✅ | V1 `{ error }` → V2 `{ success: false, error: { code: 'UNKNOWN', ... } }` |

**W2 — fetch() 无 try/catch**（client.ts:12）：`fetch()` 在网络故障时 reject，当前未捕获。调用方 `api.get()` 的 Promise 会抛出未处理的 rejection。Phase 2 应加 try/catch → 返回标准化错误 envelope。非阻塞（Phase 1 无实时 API 调用）。

**W3 — 无 timeout 处理**（client.ts）：无 `AbortController` 或 timeout 机制。Phase 2+ 长运行 API（批量/导入/AI）需 timeout。非阻塞（Phase 1 无 API 调用）。

---

## 6. Design System Compliance

**PASS** ✅（1 WARNING）

| 检查项 | 结果 |
|--------|------|
| 布局尺寸 240/64/1440 | ✅ 全部用 CSS 变量（`--admin-sidebar-w` 等） |
| 颜色体系 | ✅ 全部用 CSS 变量或 Tailwind token |
| 间距/圆角/阴影 | ✅ 全部用 CSS 变量 |
| 状态色（draft/published/error...） | ✅ 在 CSS 中定义完整 |
| 响应式断点 768px | ✅ 统一 |

**W4 — 汉堡按钮硬编码 inline style**（AdminShell.astro:58）：`style="display:none; position:fixed; top:12px; left:12px; z-index:150; background:var(--card); box-shadow:var(--admin-shadow-card);"`。其中 `top:12px; left:12px; z-index:150` 三个数值硬编码在 HTML 中而非 CSS 变量。非阻塞（值合理，不会膨胀），Phase 13 Polish 可抽取。

**硬编码值审计**（检查全部 18 个文件）：
- AdminShell.astro:58 — 汉堡按钮（见 W4）
- admin-v2/index.astro 多处 `style="..."` — demo 页面展示用，非组件
- 其余组件：零硬编码样式值

---

## 7. Runtime / Build

**PASS** ✅

| 检查 | 结果 |
|------|------|
| `npm run check` | ✅ 0 errors（4 个初始 ts 错误已修复）|
| `npm run build` | ✅ 2419 pages, exit 0, 122s |
| `dist/admin-v2/index.html` | ✅ 已生成 |
| 浏览器运行时验证 | ⚠️ NOT VERIFIED — 无法在本环境启动浏览器。代码逻辑检查通过（无死代码、无循环引用、无未定义对象引用） |

---

## 8. Architecture Violations

**无。** ✅

Phase 1 没有违反以下任何架构红线：
- ❌ 创建 recycle_bin
- ❌ 创建 entity_links
- ❌ 恢复 body_snapshot
- ❌ 新增 AI 数据结构
- ❌ 新增 RBAC 表/代码
- ❌ 新增业务 FK
- ❌ 新增 migration
- ❌ 新增真实 API endpoint
- ❌ 实现 admin_entities（INV-1）
- ❌ 实现 content_versions
- ❌ 实现 AI Panel（仅留插槽）
- ❌ 修改 `/admin` 或 V1 API

---

## 9. Warnings

| ID | 严重度 | 位置 | 问题 | 建议 | 阻塞 Phase 2? |
|----|--------|------|------|------|--------------|
| W1 | 低 | Toast.astro:13 | `window.AromisoToast` 全局命名空间 | Phase 2 后迁移到 ES module | 否 |
| W2 | 中 | client.ts:12 | `fetch()` 无 try/catch，网络故障时 reject | Phase 2 加 try/catch → error envelope | 否 |
| W3 | 低 | client.ts | 无 AbortController/timeout | Phase 2+ 长运行 API 需加 | 否 |
| W4 | 低 | AdminShell.astro:58 | 汉堡按钮 3 个硬编码像素值 | Phase 13 抽取为 CSS 变量 | 否 |

---

## 10. Phase 2 Pre-flight Risks

以下风险来源于架构审查（P0-1/P0-2/P0-3）+ Phase 1 代码审计。Phase 2 开始前必须确认：

| # | 风险 | 来源 | 必须确认 |
|---|------|------|---------|
| R1 | admin_entities 同步机制未设计 | P0-1 STOP | Phase 2 migration 0064 执行前必须有 `syncAdminEntity()` 函数设计 |
| R2 | admin_entities 初始种子脚本不存在 | P0-1 | Phase 2 seed 脚本必须覆盖全部现有 entity（1470+ 商品、142+ 博客...）|
| R3 | RBAC fallback 设计缺失 | P0-6 | admin_users 为空时系统必须 fallback 到 V1 isAuthed 模式（防锁死）|
| R4 | content_versions 需 github_commit_sha 列 | P0-5 STOP | 0051 migration DDL 必须包含此列 |
| R5 | content_versions 需 rollback_to_version_id 列 | P0-5 STOP | 同上 |
| R6 | Gate 2 Migration 编号 0053 已跳过（ADR-12） | Cross Audit #1 | 确认 migration 目录无 0053 文件 |
| R7 | Gate 2 Migration 编号 0059 已跳过（ADR-13） | Cross Audit #1 | 确认 migration 目录无 0059 文件 |
| R8 | RBAC 4 角色（非 7） | ADR + Phase Plan fix | admin_roles seed 只创建 Owner/Admin/Editor/Viewer |
| R9 | API client timeout | W3 | Phase 2 API 调用前需加 AbortController |
| R10 | `git diff` 确认 Phase 1 后工作区干净 | 本次审计 | Phase 2 开始前确认无未提交的 Phase 1 残留 |

**以上 10 项均来自已封版的架构文档和审查报告。不新增设计。Phase 2 开始前逐项检查。** 这些是 Phase 0 审查发现但尚未在代码中落地的设计决策——Phase 2 是它们的首次代码落地。

---

## 11. 是否允许进入 Phase 2

**YES** ✅

Phase 1 没有发现阻塞 Phase 2 的问题。4 个 WARNING 均非阻塞。

Phase 2 开始前必须：
1. 重读 `V2_DEVELOPMENT_GATES.md` Gate 2
2. 确认上述 10 项 Pre-flight Risks
3. 执行 Gate 2 Migration 0049/0050/0051/0064
4. 实现 RBAC 中间件 + Audit 中间件 + Version 中间件 + admin_entities 同步

---

*本次审计不修改任何代码。所有发现可追溯到具体文件行号。*