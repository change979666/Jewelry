# V2 P0-6: 当前权限地图
## Current Permission Map

> 基于 shared.ts / permissions.ts / 全部 API 源码 / CMS_AUDIT_AI.md
> 日期：2026-08-24

---

## 1. 权限系统总览

当前系统有**两套并行的权限/认证体系**：

| 体系 | 用途 | 位置 |
|------|------|------|
| **人类认证** | 后台登录 + API 访问控制 | `functions/api/admin/shared.ts` |
| **AI 权限** | AI 任务执行前的权限裁定 | `functions/lib/permissions.ts` |

两者**互不通信**：人类认证只判断「是不是管理员」，AI 权限只判断「AI 能不能执行这个任务类型」。没有「哪个管理员能审批什么 AI 任务」的中间层。

---

## 2. 人类认证体系

### 2.1 认证机制

```
┌──────────────────────────────────────────────────┐
│              AUTH FLOW                            │
│                                                    │
│  1. LOGIN                                          │
│     POST /api/admin/login                          │
│     Body: { password }                             │
│     ↓                                              │
│     Compare password against ADMIN_PASSWORD        │
│     (from .dev.vars / CF Pages Secrets)            │
│     ↓                                              │
│     Generate HMAC token:                           │
│       payload = Date.now()                         │
│       sig = HMAC-SHA256(password, payload)         │
│       token = "sig.payload"                        │
│     ↓                                              │
│     Set cookie:                                    │
│       aromiso_admin = token                        │
│       HttpOnly; Secure; SameSite=Lax; Path=/       │
│       Max-Age = 7 days                             │
│                                                    │
│  2. VERIFICATION (every API call)                  │
│     Read cookie: request.headers.get("Cookie")     │
│     Parse aromiso_admin value                      │
│     Split on "." → [sig, payload]                  │
│     Re-compute HMAC-SHA256(password, payload)      │
│     Constant-time compare sig                      │
│     Check: Date.now() - payload < 7 days           │
│     ↓                                              │
│     Pass → continue                                │
│     Fail → 401 Unauthorized                        │
│                                                    │
│  3. LOGOUT                                         │
│     Set cookie: aromiso_admin=; Max-Age=0          │
└──────────────────────────────────────────────────┘
```

### 2.2 关键代码位置

| 函数 | 位置 | 用途 |
|------|------|------|
| `hmac(secret, data)` | shared.ts:17 | 计算 HMAC-SHA256 签名 |
| `newSession(password)` | shared.ts:31 | 生成新 token |
| `verifySession(token, password)` | shared.ts:36 | 验证 token（常量时间比较） |
| `readCookie(request)` | shared.ts:52 | 从 Cookie header 提取 aromiso_admin |
| `isAuthed(request, env)` | shared.ts:70 | 便捷封装：readCookie + verifySession |
| `sessionCookie(token)` | shared.ts:62 | 生成 Set-Cookie header |
| `clearCookie()` | shared.ts:66 | 清除 Cookie |

### 2.3 认证覆盖范围

**所有管理 API 都有认证检查**。通过 grep audit，133 处 auth 调用覆盖了所有 `functions/api/admin/*.ts` 文件。

检查模式分两种：

**模式 A**（简洁）：
```ts
import { isAuthed, json } from "./shared";
if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);
```

**模式 B**（直接）：
```ts
import { readCookie, verifySession } from "./shared";
const token = readCookie(request);
if (!(await verifySession(token, env.ADMIN_PASSWORD || ""))) {
  return json({ error: "Unauthorized" }, 401);
}
```

### 2.4 ⚠️ 已知安全漏洞

| 漏洞 | 位置 | 严重度 | 说明 |
|------|------|--------|------|
| **漏 await 导致鉴权绕过（历史）** | merchandising.ts:95-96 | 🔴 Critical | 代码注释自证：`"isAuthed 返回 Promise —— 必须 await（漏 await 曾导致鉴权绕过）"`。已修复，但证明此类 bug 发生过。 |
| **单密码** | 全局 | 🟡 Medium | 所有管理员共享同一密码。无法区分谁做了什么。无法吊销单人权限而不影响他人。 |
| **无会话管理** | shared.ts | 🟡 Medium | Token 一旦签发 7 天有效，服务端无吊销机制。密码改了旧 token 自动失效（因为 HMAC 密钥变了）。 |
| **无暴力破解防护** | login API | 🟡 Medium | 没有登录失败计数/锁定/速率限制。依赖密码强度 + CF edge 基础防护。 |
| **无审计日志** | 全局 | 🟠 High | 人类的所有操作不记录 who/when/what。只有 AI 操作有 mission-log。无法追溯「谁删了什么」。 |

### 2.5 当前权限模型

```
当前 = 单层二元模型

  Request → isAuthed() → YES → 全部权限
                        → NO  → 401

没有:
  - 用户身份（who）
  - 角色（role）
  - 权限矩阵（view/create/edit/delete/publish/export/ai_execute/ai_approve/settings）
  - 用户管理 UI
  - 权限变更日志
```

---

## 3. AI 权限体系

### 3.1 架构概览

```
┌──────────────────────────────────────────────────┐
│           AI PERMISSION GATE (permissions.ts)      │
│                                                    │
│  AI generates task with self-reported mode         │
│  ↓                                                 │
│  ⚠️ DO NOT TRUST AI'S MODE                        │
│  ↓                                                 │
│  enforceMode(task_type):                           │
│    ├─ Is task_type in FORBIDDEN_TASK_TYPES?        │
│    │   → MANUAL (hard block, no appeal)            │
│    ├─ Is task_type in TASK_TYPE_POLICY?            │
│    │   → Return mapped level                       │
│    └─ Unknown task_type?                           │
│        → MANUAL (conservative default)              │
│  ↓                                                 │
│  canAutoExecute(task, opts):                        │
│    ├─ MANUAL  → never auto, forbidden=true         │
│    ├─ L1      → auto allowed (read-only)           │
│    ├─ L2      → auto IF reviewApproved=true        │
│    ├─ L3      → auto allowed (low-risk reversible) │
│    └─ L4      → auto IF executor in allowlist      │
│                                                    │
│  铁律：AI 自报的 execution_mode 被完全忽略。       │
│  代码层 enforceMode() 依据 task_type 重新裁定。     │
│  这防止 prompt 注入提权（把 delete_page 标成 L3）。 │
└──────────────────────────────────────────────────┘
```

### 3.2 权限等级详细定义

| 等级 | 名称 | 自动化程度 | 副作用 | 示例 task_type |
|------|------|-----------|--------|---------------|
| **L1** | 分析/监控/报告 | 全自动 | 无（只读） | analysis, audit, monitor, report |
| **L2** | 生成内容 | 人工审核后才执行 | 有（内容变更） | content_refresh, faq_append, meta_rewrite, content_generate, growth_review |
| **L3** | 低风险自动修复 | 全自动 | 有（可逆） | meta_fix, internal_link, translate_fill, alt_text_fill |
| **L4** | 受限白名单发布 | 白名单执行器自动 | 有（对外） | sitemap_ping |
| **MANUAL** | 硬禁止 | 永不自动 | 有（不可逆/法律/金钱） | delete_page, delete_content, delete_product, price_change, payment, external_quote, compliance_claim, publish_content, send_email, contract |

### 3.3 硬禁止清单（FORBIDDEN_TASK_TYPES）

```
delete_page       — 删除页面 / 路由
delete_content    — 删除文章 / 商品 / 案例
delete_product    — 删除商品
price_change      — 改价 / 调价
payment           — 支付 / 退款 / 结算
external_quote    — 对外报价 / 报盘
compliance_claim  — 资质 / 认证 / 合规声明
publish_content   — 对外发布新内容
send_email        — 对外发件
contract          — 合同 / 条款变更
```

**这 10 个类型 = AI 永不自动执行。只能建议，人工手动操作。且 MANUAL 不可被「批准」提权为自动。**

### 3.4 任务类型 → 权限策略（TASK_TYPE_POLICY）

```ts
analysis:        "L1"      // 只读分析
audit:           "L1"      // 审计
monitor:         "L1"      // 监控
report:          "L1"      // 报告
content_refresh: "L2"      // 旧文焕新（人工把关）
faq_append:      "L2"      // 追加 FAQ
meta_rewrite:    "L2"      // 重写 meta
content_generate:"L2"      // 内容草稿
growth_review:   "L2"      // 增长机会评审
meta_fix:        "L3"      // 补全缺失 meta（不覆盖已有）
internal_link:   "L3"      // 内链注入
translate_fill:  "L3"      // 补填缺失译文
alt_text_fill:   "L3"      // 补图片 alt
sitemap_ping:    "L4"      // 通知搜索引擎重抓
// 未在此表的 task_type → MANUAL（保守默认）
```

### 3.5 L4 白名单（L4_EXECUTOR_ALLOWLIST）

当前仅有：`sitemap_ping`

不在白名单的 L4 执行器 → 退回人工审核。

### 3.6 AI 权限的关键安全设计

```
防提权注入的三层防线：

  第1层：AI 自报 mode 被忽略
         enforceMode() 只看 task_type，不看 execution_mode

  第2层：未知类型 = MANUAL
         不在 TASK_TYPE_POLICY 表里的 task_type 一律 MANUAL
         （不认识的就不自动跑）

  第3层：MANUAL 不可批准
         canAutoExecute 对 MANUAL 返回 forbidden=true
         即使误给了 reviewApproved，也返回 allowed=false
```

**代码层不信任 AI 是明确的设计原则**（见 permissions.ts 注释第 11-15 行）。

### 3.7 AI 权限的实际调用点

| 调用文件 | 用途 | enforceMode / canAutoExecute |
|----------|------|------------------------------|
| `task-execute.ts` | AI 任务执行引擎 | ✅ 完整调用，含 reviewApproved 判定 + MANUAL/L2 提前 403 |
| `content-generate.ts` | 内容生成 | ✅ import enforceMode |
| `os-daily.ts` | AI 日报 | ✅ import enforceMode |

### 3.8 AI 权限的缺失

- **无 RBAC 集成**：当前 `canAutoExecute` 不检查「谁」批准的——任何人类管理员批准都算数。V2 需要区分「谁」可以批准什么类型的 AI 任务。
- **无批准日志**：AI task 被批准 → 谁批的？什么时候？没有记录（依赖 mission-log 间接记录）。
- **无角色级权限**：没有「AI Operator 可以批准 L2 但不能批准 MANUAL」这种中间角色。当前二元：管理员 or 不是。

---

## 4. 前端权限检查

### 4.1 当前状态

**前端不做权限判断。** 所有权限控制在后端。

- 前端不存储用户角色/权限（因为没有角色系统）
- 前端通过 API 的 401 响应来判断是否登录
- 页面/功能的显示/隐藏依赖后端返回的数据，而非前端权限过滤
- 没有「这个按钮对 Viewer 隐藏」这种逻辑

### 4.2 ⚠️ 风险

- 如果后端漏了某个 auth check（历史发生过，merchandising.ts 的 `isAuthed` 漏 await），前端不会发现
- 前端无法做乐观 UI 优化（比如提前隐藏不可用的按钮）
- 用户体验差：点击操作后才发现 401

---

## 5. 公共 API 防护（非管理后台）

| 防护层 | 位置 | 说明 |
|--------|------|------|
| **Turnstile** | `functions/api/_lib/guard.ts` | Cloudflare Turnstile 验证（询盘/订阅表单） |
| **KV Blacklist** | `guard.ts` | IP-based 频率限制 |
| **Mail Budget** | `guard.ts` | Resend 每日发送上限 |
| **De-duplication** | `guard.ts` | 防止重复提交 |
| **HMAC Auth** | shared.ts | 管理 API 专用 |
| **AI Safety** | permissions.ts + truthfulness.ts + action-budget.ts | AI 任务三道闸 |

---

## 6. V2 RBAC 设计的影响范围

基于以上分析，V2 RBAC 需要改造以下层面：

### 6.1 API 层面（已确认需要改造）

| 文件/API | 当前检查 | V2 需要 |
|-----------|---------|---------|
| 全部 `functions/api/admin/*.ts` | `isAuthed()` → YES/NO | `isAuthed()` → user + role → `checkPermission(user, action, resource)` |
| `task-execute.ts` | `canAutoExecute()` | + `checkPermission(user, "approve_ai", task_type)` |
| `permissions.ts` | 无人类身份 | + `user: User` 参数到 `canAutoExecute` |

### 6.2 前端层面（需要新增）

| 组件 | V2 需要 |
|------|---------|
| AdminShell | 根据角色过滤 Sidebar 入口 |
| Topbar | 显示当前用户 + 角色 + 退出 |
| AI Panel | 根据角色显示/隐藏 AI Action |
| 操作按钮 | 根据权限（create/edit/delete/publish）显示/隐藏 |
| 设置入口 | 仅 Admin/Owner 可见 |

### 6.3 数据库层面（需要新增）

```
admin_users        — id, username, password_hash, role_id, status, last_login_at, created_at
admin_roles        — id, name, description, created_at
admin_permissions  — id, role_id, resource, action (view/create/edit/delete/publish/export/execute_ai/approve_ai/manage_settings)
audit_logs         — id, user_id, action, resource_type, resource_id, before, after, created_at
```

### 6.4 迁移策略

- **Phase 2** 创建 RBAC 表和中间件
- **Phase 2 后** 新 API (`/api/admin/v2/*`) 走 RBAC
- **旧 API** (`/api/admin/*`) 保留原有 `isAuthed()` 检查，不加 RBAC（保护兼容性）
- **Phase 14** 旧 API 下线后全部走 RBAC

---

## 7. 当前权限系统评分

| 维度 | 评分 | 评语 |
|------|------|------|
| 认证机制 | B | HMAC-signed cookie 设计合理，常量时间比较正确。但单密码是硬伤。 |
| 认证覆盖 | A- | 所有管理 API 都有 auth check（但历史上发生过漏 await 绕过） |
| 授权（人类） | F | 无 RBAC，无角色，无用户管理 |
| 授权（AI） | A | 四级闸 + 硬禁止 + 防注入，设计优秀 |
| 审计日志 | D | 只有 AI 有 mission-log，人类操作零日志 |
| 会话管理 | C | 7 天固定，无吊销。改密码可间接吊销。 |
| 公共防护 | B+ | Turnstile + KV 黑名单 + 去重 + 速率限制 |
| 前端权限 | F | 无任何前端权限判断 |

**总评：人类权限系统是 V2 最大短板之一（与 OEM、文案资产并列 P0 缺口）。AI 权限系统则是当前架构中最成熟的部分，V2 必须完整保留并扩展。**

---

*本文基于实际源码，非猜测。所有 auth check 位置经 grep 确认，permissions 逻辑经逐行阅读。*