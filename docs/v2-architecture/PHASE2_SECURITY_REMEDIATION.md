# PHASE 2 SECURITY REMEDIATION DESIGN
## Repair Design Audit — F1/F2/F3 + W1/W4

日期：2026-08-24
基于：PHASE2_REVERSE_AUDIT.md，Phase 0 封版架构，ADR-10~17，P0-6 权限地图
规则：不修改代码。不重构架构。不引入新系统。设计最小修复。

---

## 1. Security Remediation Decision Matrix

| ID   | 问题                                     | 严重度 | 修复 Phase | 需要 ADR？ | 需要 Migration？ | Owner 决策 |
|------|------------------------------------------|--------|-----------|-----------|-----------------|-----------|
| F1   | V1 fallback 绕过 V2 RBAC                 | 🔴     | Phase 2   | 是        | 否              | 否        |
| F2   | Logout 不撤销 token                      | 🔴     | Phase 2   | 是        | 否（KV-based）| 否        |
| F3   | Login 无 rate limiting                   | 🔴     | Phase 3   | 是        | 否（KV-based）| 否        |
| W1   | 所有用户共享 ADMIN_PASSWORD              | 🟠     | Phase 3   | 是        | 是（如选 B）   | **是**    |
| W4   | Synthetic Owner 权限与 DB seed 不一致    | 🟡     | Phase 2   | 否        | 否              | 否        |

---

## 2. F1 — V1 fallback 绕过 V2 RBAC

### 2.1 根因分析

V1 fallback 存在于 `rbac.ts:113-139`。其存在原因：

**Phase 2 migration 创建了 admin_users 表，但此时表为空（只有 seed 的 role 定义，没有任何用户）。** 如果 V2 authenticateRequest 只检查 V2 cookie → 找不到用户 → 返回 null → 所有 V2 端点 401。这会导致 V2 管理页面完全不可用——连第一个管理员都无法创建。

**fallback 的原始意图**：在「V2 管理员尚未创建」的过渡期，V1 管理员（持有 V1 aromiso_admin cookie）可以通过 V2 端点，以让系统可操作。

**问题**：fallback 授予的是**合成 Owner**（`rbac.ts:122-138`），拥有几乎全部权限。这使 V2 RBAC 在整个过渡期内形同虚设。

### 2.2 架构兼容边界

对照 P0-6（权限地图）§6.4 迁移策略：

```
- Phase 2 创建 RBAC 表和中间件
- Phase 2 后 新 API (/api/admin/v2/*) 走 RBAC
- 旧 API (/api/admin/*) 保留原有 isAuthed() 检查，不加 RBAC
- Phase 14 旧 API 下线后全部走 RBAC
```

**架构意图**：Phase 2 后 V2 API 就应该走 RBAC。V1 fallback 不应该**绕过** RBAC——它应该是一个**受限制的过渡通道**。

### 2.3 修复方案

**方案 A（推荐）— Fallback 降级为「仅种子操作」权限**

```
修改 rbac.ts authenticateRequest V1 fallback 分支：

1. 检查 admin_users 表是否已有至少一个 role_owner 用户
2. 如果有 → V1 fallback 完全禁用（返回 null，V1 cookie 不能访问 V2 API）
3. 如果没有 → V1 fallback 授予「临时种子权限」（最终锁定设计，见
   PHASE2_AUTH_ARCHITECTURE.md §3.1/§5.2 — DB-driven，永不硬编码）：
   - 权限 = SELECT resource, action FROM admin_permissions
     WHERE role_id = 'role_owner' AND resource = 'system'
     （即 DB seed 中全部 system:* 权限，足以查看系统状态并创建第一个用户）
   - 所有非 system 权限一律拒绝
4. 临时种子权限在第一个 Owner 被创建后立即失效
```

**过渡流程图**：

```
Phase 2 migration 执行后：
  admin_users 表为空（0 个用户）
  → V1 fallback 授予「临时种子权限」
  → V1 管理员可调用 POST /api/admin/v2/system/users 创建第一个 Owner
  → Owner 创建后，admin_users 表有 1+ 个 role_owner
  → V1 fallback **立即禁用**
  → 此后所有 V2 API 必须通过 V2 cookie + RBAC
```

### 2.4 终止条件

**触发条件**：`SELECT COUNT(*) FROM admin_users WHERE role_id = 'role_owner' AND status = 'active'` > 0

**行为**：`authenticateRequest()` 中 V1 fallback 分支返回 null（不授权）

**Phase 2 migration seed 执行后**：V1 fallback 仍然有效（尚无 Owner 用户）。用户通过 V1 登录 → 在 V2 用户管理页创建第一个 Owner → fallback 自动禁用。

### 2.5 删除计划

**Phase 14（旧 API 下线时）**：删除 `rbac.ts` 中整个 V1 fallback 代码块（lines 113-139）。因为 Phase 14 后 V1 API 已下线，V1 cookie 不再存在。

### 2.6 对现有系统的影响

| 影响项             | 评估 |
|--------------------|------|
| V1 /admin 页面     | 零影响（V1 页面不调 V2 API）|
| V1 API             | 零影响（V1 isAuthed 未修改）|
| V2 admin-v2 页面   | 过渡期：V1 管理员可创建第一个 Owner。过渡后：必须 V2 登录 |
| Phase 0 架构       | 完全兼容 P0-6 §6.4 |

---

## 3. F2 — Logout 不撤销 Token

### 3.1 根因分析

当前 token 是**纯 stateless HMAC**——`verifyV2Token()` 只验证签名+过期，不查任何服务端状态。因此 logout 只能清除浏览器 cookie，无法使已签发的 token 在服务端失效。

V1 auth（`shared.ts`）有同样的设计——V1 的 `clearCookie()` 也只是清除 cookie。

### 3.2 架构约束

- 不能引入新数据库表（Phase 2 migration 已封版，不加表）
- 不能引入 Redis/Memcached 等新基础设施
- 不能改变 token 格式（已有 V2 cookie 依赖）

### 3.3 修复方案

**使用现有 KV namespace（aromiso-drafts）做 token 吊销列表**。

```
KV key:   revoked_token:{token_hash}
Value:    "1"
TTL:      7 days（与 token Max-Age 一致）

authenticateRequest() 验证流程变为：
  1. 解析 V2 cookie → 提取 token
  2. verifyV2Token(token) → HMAC + 过期
  3. **新增**：查 KV revoked_token:{SHA256(token)} → 如果存在 → 401
  4. loadUser(username) → RBAC
```

**logout 处理**：
```
1. 解析当前请求的 V2 cookie
2. SHA256(token)
3. KV.put("revoked_token:{hash}", "1", { expirationTtl: 7 * 86400 })
4. 清除浏览器 cookie
```

**并发行为**：
- 重复 logout：幂等（KV.put 覆盖，无副作用）
- 过期 token：verifyV2Token 先拦截（HMAC 过期检查），不查 KV
- 吊销后并发请求：KV 最终一致性，短暂窗口（<1s）旧 token 可能仍通过。可接受（管理后台非高并发场景）

### 3.4 资源消耗

- KV 读：每个 V2 API 请求多 1 次 KV.get（仅 V2 cookie 路径）
- KV 写：仅 logout 时 1 次 KV.put
- 存储：每个吊销 token 的 KV key ≈ 100 bytes，7 天自动过期
- 零新增 D1 表，零新增 migration

### 3.5 备选方案（不推荐）

- **D1 session 表**：需 migration + 定期清理过期行。Phase 0 已封版，不新增 Phase 2 migration。
- **短 TTL token（1 小时）+ refresh**：改变 token 设计，影响整个认证流程。

---

## 4. F3 — Login 无 Rate Limiting

### 4.1 根因分析

`login.ts` 无任何频率限制。攻击者可无限尝试密码。

### 4.2 架构约束

- 复用现有基础设施：KV 已有 rate limit 机制（`guard.ts` 的 `checkBlacklist()`）
- CF Workers 无全局状态，KV 是唯一跨 Worker 共享存储
- Admin login 频率远低于 public API（正常一天几次）

### 4.3 修复方案

**复用 KV + guard.ts 的 checkBlacklist 模式**。

```
KV key pattern: rl:login:v2:{ip}:{window}
Window:        5 minutes
Max attempts:  5 per window
Block duration: 15 minutes

login.ts 流程变为：
  1. 检查 KV rl:login:v2:{ip}:{window} 计数
  2. 如果 ≥ 5 → 429 "Too many login attempts. Try again in N minutes."
  3. 密码验证
  4. 成功 → 清除该 IP 的失败计数
  5. 失败 → 递增计数，TTL = window + block
```

**错误响应不泄露用户存在性**：
```
所有失败统一返回：
{ success: false, error: { code: "UNAUTHORIZED", message: "Invalid credentials" } }
401
速率限制时返回：
{ success: false, error: { code: "RATE_LIMITED", message: "Too many attempts. Try again in 15 minutes." } }
429
```

**实现方式**：在 `login.ts` 中直接使用 `env.DRAFTS`（即 aromiso-drafts KV namespace），不需要修改 `guard.ts`。

### 4.4 分布式一致性

- KV 最终一致性，延迟 < 1s
- 5 次/5 分钟的窗口足够宽松，短暂不一致不导致误封
- 如攻击者分布式 IP → 每个 IP 独立计数，无跨 IP 协调

---

## 5. W1 — 共享 ADMIN_PASSWORD 架构裁决

### 5.1 当前设计意图

P0-6（权限地图）§6.3 设计了 `admin_users` 表含 `password_hash` 字段。意图是 per-user 认证。

Phase 2 `0049_rbac.sql` 创建了 `password_hash` 列。

但 Phase 2 `login.ts` 的实现**比较密码时用的是 `env.ADMIN_PASSWORD`**（login.ts:65），不查 admin_users.password_hash。这意味着当前 `password_hash` 列写入但从不读取。

### 5.2 裁决选项

#### 选项 A：继续共享 ADMIN_PASSWORD（当前实现）

**优点**：零改动。与 V1 一致。
**缺点**：
- admin_users.password_hash 列是死数据（写入但从不验证）
- 无法区分「哪个管理员登录了」（所有登录都通过同一密码）
- 无法单独吊销某个用户的密码
- audit log 中的 username 来自 cookie 中的自行声明，不可信

**安全性保障**（如果选 A）：
- 立即移除 admin_users.password_hash 列（避免误认为已实现）
- login.ts 的 username 字段仅用于 audit 标识，不做认证用
- 在架构文档中声明「V2 Phase 2-3 保持单密码模式」

#### 选项 B：Per-user password（Phase 0 设计意图）

**需要的变化**：
1. **Migration**：无需——password_hash 列已存在（0049 已建）
2. **login.ts**：改为查 `SELECT password_hash FROM admin_users WHERE username = ?`，比较 HMAC(password_input, ADMIN_PASSWORD) 与 password_hash
3. **users.ts POST**：创建用户时的 password_hash 写入逻辑不变（已经正确实现）
4. **users.ts PUT**：增加 password 修改能力
5. **rbac.ts**：V1 fallback 移除后，不再需要合成 Owner
6. **API**：login 响应中不暴露 password_hash

**风险**：
- Phase 2 已创建的用户（如果有）的 password_hash 是用 HMAC(ADMIN_PASSWORD, body.password) 计算的——正确
- V1 fallback 移除后，admin_users 表必须有至少一个用户

### 5.3 裁决建议

**不自行裁决。** 两选项均可行。需 Owner 决策。

| 决策维度                 | 选项 A（共享）                         | 选项 B（Per-user）               |
|--------------------------|---------------------------------------|----------------------------------|
| Phase 0 设计意图         | 不一致（设计了 password_hash 但不用） | 一致                             |
| 安全性                   | 低                                     | 中                               |
| 实现工作量               | 零                                     | 修改 login.ts 密码验证逻辑       |
| 迁移风险                 | 零                                     | 需确保至少一个 Owner 用户存在     |
| 最晚决策 Phase           | Phase 3                               | Phase 3（实施）                  |

**如果选 B**：Phase 3 开始前实施。所需改动仅限于 `login.ts` 的密码验证逻辑（1 个文件），非架构级变更。

---

## 6. W4 — Synthetic Owner 权限与 DB seed 不一致

### 6.1 根因分析

当前有两处定义了 Owner 的权限：

| 位置                                  | 权限数 | 说明                           |
|---------------------------------------|--------|--------------------------------|
| `0049_rbac.sql:46-55` seed            | 72 行  | 8 resource × 9 action = 全部   |
| `rbac.ts:128-137` synthetic Owner     | 43 行  | 缺少 `ai:create/edit/publish/delete`, `growth:create/edit/publish/delete/export`, `system:create/edit/publish/delete/export` |

**根因**：Phase 2 编写 `rbac.ts` 时，手动列出了 Owner 权限字符串，未从 DB 读取。这是典型的 hardcode duplicate 问题。

### 6.2 唯一 Source of Truth

**DB 中的 `admin_permissions` 表是唯一 Source of Truth。** `loadUser()` 从 DB 读取权限到 `Set<string>`。`checkPermission()` 查询这个 Set。

因此 `rbac.ts:128-137` 的硬编码权限列表不应存在。修复方案：**消除硬编码，从 DB 读取**。

### 6.3 修复方案

```
修改 rbac.ts authenticateRequest 的 V1 fallback 分支（lines 121-138）：

当前：
  if (ownerUser) return loadUser(env, ownerUser.username);
  // 硬编码合成 Owner
  return { id: "v1_admin", ..., permissions: new Set([...43 项...]) };

修复后：
  if (ownerUser) return loadUser(env, ownerUser.username);
  // 如果 DB 中没有 Owner → 从 DB 读 role_owner 的权限，创建临时用户
  const ownerPerms = await env.DB.prepare(
    "SELECT resource, action FROM admin_permissions WHERE role_id = 'role_owner'"
  ).all();
  const permSet = new Set<string>();
  for (const p of ownerPerms.results) permSet.add(`${p.resource}:${p.action}`);
  return { id: "v1_transitional", ..., permissions: permSet };
```

优点：
- 消除了 hardcode duplicate
- 临时用户权限与 DB seed 永远一致
- 如果未来修改 Owner 权限（在 admin_permissions 表中增删），临时用户自动同步

---

## 7. Migration 清单

**F2（Token 吊销）：无需 migration。** 使用现有 KV namespace（aromiso-drafts），纯代码改动。

**F3（Rate limiting）：无需 migration。** 使用现有 KV namespace，纯代码改动。

**W1（如选 B）：无需新 migration。** password_hash 列已存在于 0049。

**总计：零新增 migration。**

---

## 8. ADR 修改清单

| 新 ADR  | 内容                                         | 替换/新增 |
|---------|----------------------------------------------|-----------|
| ADR-18  | V1 auth fallback 降级为过渡种子权限           | 新增      |
| ADR-19  | Token 吊销使用 KV blacklist                   | 新增      |
| ADR-20  | Login rate limiting 使用 KV 滑动窗口           | 新增      |
| ADR-21  | Admin permissions 唯一 Source of Truth = DB   | 新增      |

---

## 9. Phase Plan 修改清单

| Phase     | 修改                                      |
|-----------|-------------------------------------------|
| Phase 2   | 增加验收标准：F1 fallback 降级实现 + F2 token 吊销实现 + W4 消除 hardcode |
| Phase 2   | Gate 2 增加：`authenticateRequest()` 中 V1 fallback 不授予 Owner 权限 |
| Phase 3   | 增加验收标准：F3 login rate limiting 实现 |
| Phase 14  | 增加清理任务：删除 rbac.ts 中 V1 fallback 代码块 |

---

## 10. 每项修复最晚完成 Phase

| ID   | 最晚 Phase | 原因                                           |
|------|-----------|------------------------------------------------|
| F1   | Phase 2   | Phase 3 Dashboard 必须走 RBAC，不能有 V1 绕过   |
| F2   | Phase 2   | Phase 3 Dashboard 显示当前用户，登出必须有效     |
| F3   | Phase 3   | Dashboard 上线后 login 端点暴露，需保护          |
| W1   | Phase 3   | 如选 B，需在 Phase 3 实施 per-user auth         |
| W4   | Phase 2   | 与 F1 同时修复（同一代码块）                    |

---

## 11. 修复后的 Security Gate

修复完成后，以下条件必须全部满足才能通过 Phase 2 Security Gate：

```
□ F1：V1 cookie 不能绕过 V2 RBAC（过渡期仅限于创建第一个 Owner）
□ F2：Logout 后 token 立即失效（KV revocation + 浏览器 cookie 清除）
□ W4：Synthetic Owner 权限从 DB 读取，不存在 hardcode duplicate
□ F3：（Phase 3）Login 有 5 次/5 分钟速率限制
□ W1：（Phase 3）已明确 Owner 裁决并实施
□ 所有 V2 API 端点（5 个）经受过以下攻击测试：
  - 无 cookie → 401
  - V1 cookie（有 V2 Owner 存在时）→ 401（非 200）
  - Viewer cookie 调用 POST/DELETE → 403
  - 过期 V2 cookie → 401
  - 吊销 V2 token（logout 后复用）→ 401
```

---

## 12. SECURITY REMEDIATION STATUS

**🟡 ARCHITECTURE DECISION REQUIRED**

**唯一阻塞项：W1 — Owner 需在选项 A（共享 ADMIN_PASSWORD）和选项 B（per-user password）之间选择。**

其余 4 项（F1/F2/F3/W4）均有明确修复方案，不依赖 Owner 决策。可在 Phase 2 立即实施 F1/F2/W4，Phase 3 实施 F3。

**如果 Owner 选 A**：Phase 3 无需修改 login.ts。需从 admin_users 表移除 password_hash 列（避免误导），并将 login.ts:65 的 password 比较行为用注释明确说明。

**如果 Owner 选 B**：Phase 3 修改 login.ts 的密码验证逻辑（1 行改动：从 `password !== env.ADMIN_PASSWORD` 改为查 admin_users.password_hash 表）。不涉及架构变更。

---

*本设计基于 Phase 0 封版架构文档和 Phase 2 实际代码。所有修复方案不引入新基础设施。所有决策点已明确标注。*