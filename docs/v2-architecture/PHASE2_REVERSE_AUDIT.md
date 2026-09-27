# PHASE 2 INFRASTRUCTURE REVERSE AUDIT + PHASE 3 CONTRACT AUDIT

审计日期：2026-08-24  
审计范围：Phase 2 全部 15 个文件 + 4 个 migration  
审计方法：逐行读码 × 逐 DDL 列验证 × V1 绕过路径模拟  
原则：不信任 Phase 2 完成报告，全部实际验证

---

## A. 逐项审计

### 1. RBAC 认证绕过审计

| 路径 | 结果 | 证据 |
|------|------|------|
| V2 cookie 验证 | ✅ PASS | `login.ts:20-46` verifyV2Token: HMAC 常量时间比较 + 7 天过期 |
| V2 cookie 解析 | ✅ PASS | `rbac.ts:103` regex 提取，decodeURIComponent |
| checkPermission 逻辑 | ✅ PASS | `rbac.ts:32-34`: status 检查 + Set.has O(1) |
| requirePermission 拒绝 | ✅ PASS | `rbac.ts:43-55`: null user→401, no perm→403 |
| **V1 fallback 绕过** | 🔴 FAIL | `rbac.ts:114-138`: V1 isAuthed → 合成 Owner(**全部权限**)。绕过 admin_users DB 的 RBAC 角色分配 |
| Synthetic Owner 权限集 | ⚠️ WARNING | `rbac.ts:128-137`: 合成 Owner 漏了 `ai:create/edit/publish/delete`, `growth:create/edit/publish/delete/export`, `system:create/edit/publish/delete/export` — 与 seed Owner (72 rows=ALL) 不一致 |

**V1 fallback 详细分析**：

```
攻击者只需知道 ADMIN_PASSWORD → 获取 V1 aromiso_admin cookie →
  → 访问任何 /api/admin/v2/* 端点 →
  → authenticateRequest() 走 V1 fallback 分支 →
  → 合成 Owner (全部权限) →
  → 绕过 admin_users 表中的角色限制
```

**结论**：V2 RBAC 在 V1 fallback 启用时**完全不生效**。这是 Phase 2 设计内过渡行为（V2 管理员尚未创建），但必须在 Phase 3 前**明确过渡终止条件**。

**最小修复方案**（不修改代码，只补充架构约束）：
- 在 V2_DEVELOPMENT_GATES.md Gate 3 前置条件中追加：「admin_users 表至少存在一条非 v1_admin 的 Owner 用户后，移除 rbac.ts V1 fallback 的合成 Owner 分支」
- 或在代码中加开关：`if (ownerCount > 0) { /* 禁用 V1 fallback */ }`

---

### 2. admin_users / roles / permissions 数据库约束与 API 行为一致性

| 检查项 | 结果 | 证据 |
|--------|------|------|
| admin_users UNIQUE(username) | ✅ PASS | `0049_rbac.sql:17` |
| admin_users FK→admin_roles | ✅ PASS | `0049_rbac.sql:19` |
| admin_permissions UNIQUE(role_id,resource,action) | ✅ PASS | `0049_rbac.sql:32` |
| Seed 幂等 INSERT OR IGNORE | ✅ PASS | `0049_rbac.sql:40,46,58,69,79` |
| API POST users 验证 username+password+role_id | ✅ PASS | `users.ts:32-33`: 422 if missing |
| API DELETE 最后 Owner 保护 | ✅ PASS | `users.ts:60-63`: role_owner + cnt ≤ 1 → 403 |
| **API PUT 未验证 role_id 是否存在于 admin_roles** | 🔴 FAIL | `users.ts:53`: `body.role_id` 直接写入 UPDATE，无 FK 前检查。若 role_id='nonexistent' → D1 FK constraint 报错 → 500，非 422 |
| API GET 返回数据包含 password_hash？ | ✅ PASS | `users.ts:22-25`: SELECT 列表无 password_hash |

**结论**：核心约束一致。API PUT 缺少 role_id 存在性验证（依赖 D1 FK 报错而非友好错误）。

---

### 3. /api/admin/v2/** 写操作 audit log 覆盖率

| Endpoint | 写操作 | logAction 调用 | 覆盖 |
|----------|--------|---------------|------|
| POST /api/admin/v2/system/users | INSERT admin_users | `users.ts:42` logAction("create") | ✅ |
| PUT /api/admin/v2/system/users/:id | UPDATE admin_users | `users.ts:55` logAction("update") | ✅ |
| DELETE /api/admin/v2/system/users/:id | DELETE admin_users | `users.ts:66` logAction("delete") | ✅ |
| POST /api/admin/v2/auth/login | 登录（无 DB 写） | **❌ MISSING** | ❌ |
| POST /api/admin/v2/auth/logout | 登出（无 DB 写） | **❌ MISSING** | ❌ |

**覆盖率**：3/5 写操作接入 audit（60%）。login/logout 未记录。

login/logout 应记录 audit：`logAction({ actor_type:"human", action:"login"|"logout", ... })`。当前缺失意味着无法审计「谁在什么时候登录/登出」。

---

### 4. audit_logs 是否记录敏感信息

| 敏感信息类型 | 是否可能进入 audit_logs | 证据 |
|------------|----------------------|------|
| password | ❌ 否 | `audit.ts:12` action 类型无 "password_change" |
| token/cookie | ❌ 否 | 无 token 写入 change_summary |
| API key | ❌ 否 | 无 API key 管理端点 |
| secret | ❌ 否 | 无 secret 字段 |
| **客户敏感信息** | ⚠️ POSSIBLE | `audit.ts:15` resource_title 可能包含客户名/公司名/邮箱（若未来 Phase 4-6 的 API handler 调用 logAction 时将这些填入 resource_title） |
| before_snippet/after_snippet | ⚠️ POSSIBLE | `audit.ts:17-18` 这些字段可包含任意内容（取决于调用方）。当前 Phase 2 无数据填入（users.ts 所有 logAction 调用均未提供 before_snippet/after_snippet），但未来 Phase 4+ 的业务 API 可能将产品描述/客户信息填入 |

**结论**：当前 Phase 2 范围安全。未来 Phase 4+ 须追加约束：**禁止将 password/token/secret/PII 写入 audit_logs 的任何字段**。

---

### 5. content_versions ADR-11 合规

| ADR-11 要求 | 实际 | 证据 |
|-----------|------|------|
| metadata-only | ✅ PASS | `0051_content_versions.sql:10-16`: 无 body_snapshot 列 |
| github_commit_sha 列 | ✅ PASS | `0051:14` github_commit_sha TEXT |
| rollback_to_version_id 列 | ✅ PASS | `0051:15` rollback_to_version_id TEXT |
| body 走 GitHub API | ✅ PASS | `versioning.ts` createVersion 不写 body |
| 回滚=新版本,不改历史 | ✅ PASS | `versioning.ts:17` source='rollback' + rollback_to_version_id 指向被恢复版本 |

**结论**：ADR-11 完全合规。

---

### 6. admin_entities INV-1 合规

| INV-1 要求 | 实际 | 证据 |
|-----------|------|------|
| 5 字段上限 | ✅ PASS | `0064_admin_entities.sql:10-16`: entity_type, entity_id, title, status, updated_at |
| 无 source | ✅ PASS | 无 source 列 |
| 无 owner | ✅ PASS | 无 owner 列 |
| 无 locale | ✅ PASS | 无 locale 列 |
| 无 created_at | ✅ PASS | 无 created_at 列（只有 updated_at） |
| PRIMARY KEY(entity_type, entity_id) | ✅ PASS | `0064:16` |
| syncAdminEntity 只写 5 字段 | ✅ PASS | `admin-entities.ts:19-22`: 只 bind 4 个值 + CURRENT_TIMESTAMP |
| 搜索索引,非业务真源 | ✅ PASS | 代码注释 + DDL 设计明确 |

**结论**：INV-1 完全合规。admin_entities 严格 5 字段，无膨胀风险。

---

### 7. admin_entities 同步失败处理

| 失败场景 | 当前处理 | 问题 |
|---------|---------|------|
| 业务写成功,syncAdminEntity 失败 | `admin-entities.ts:28` catch(_) → console.error → 静默 | ⚠️ FAIL: 搜索索引 stale。无 retry,无补偿,无告警 |
| syncAdminEntity 调用遗漏 | 依赖每个 API handler 手动调用 | ⚠️ FAIL: 无 middleware 强制调用。Phase 4+ 业务 API 可能遗漏 |

**结论**：当前无 retry/补偿机制。syncAdminEntity 是「尽力而为」语义。对于仅作搜索索引的表,这是可接受的——但必须在架构文档中**明确声明此表数据可能 stale**。

**最小修复**：在 V2_DATA_MIGRATION.md INV-1 注释区追加：「admin_entities 是 best-effort 搜索索引。同步失败不重试。数据可能落后于源表最多一个请求周期。Dashboard 全局搜索和 KPI 统计需考虑此延迟。」

---

### 8. Auth/Session 安全边界

| 检查项 | 状态 | 证据 |
|--------|------|------|
| HttpOnly | ✅ PASS | `login.ts:73` `HttpOnly` |
| Secure | ✅ PASS | `login.ts:73` `Secure` |
| SameSite | ✅ PASS | `login.ts:73` `SameSite=Lax` |
| expiry (7 days) | ✅ PASS | `login.ts:73` `Max-Age=604800` |
| 常量时间 HMAC 验证 | ✅ PASS | `login.ts:34-38` XOR comparison |
| **logout invalidation** | 🔴 FAIL | `logout.ts:6` 只清除 cookie,不使服务端 token 失效。已签发 token 7 天内仍有效 |
| **rate limiting** | 🔴 FAIL | login.ts 无登录失败计数/锁定/延迟。可暴力破解 ADMIN_PASSWORD |
| **session fixation** | ✅ PASS | Token 在密码验证后生成,非预分配 |
| **password 存储** | ⚠️ WARNING | `login.ts:65` 明文比较 `password !== expectedPw`。不查 admin_users.password_hash。所有 V2 用户共享同一 ADMIN_PASSWORD |
| CSRF | ⚠️ WARNING | SameSite=Lax 提供基本保护。无 CSRF token。GET 端点 (/me, /audit, GET /users) 无副作用,安全。POST/PUT/DELETE 需额外保护 |

**结论**：Token 安全（HttpOnly/Secure/SameSite/HMAC）。**但 logout 不撤销 token + 无 rate limiting + 所有用户共享密码 = 三个安全缺陷。**

---

### 9. Migration 回滚可行性

| Migration | UP | DOWN | D1 可执行 | 数据丢失风险 | 评估 |
|-----------|-----|------|----------|------------|------|
| 0049 | CREATE 3 tables + seed | DROP 3 tables | ✅ | ⚠️ 执行 DOWN 后所有用户/角色/权限数据永久丢失 | 🟡 CONDITIONAL: Phase 2 初期安全;Phase 2 后禁止 |
| 0050 | CREATE audit_logs | DROP audit_logs | ✅ | 低（审计数据非业务关键） | 🟢 PASS |
| 0051 | CREATE content_versions | DROP content_versions | ✅ | 低（初始版本记录可丢弃） | 🟢 PASS |
| 0064 | CREATE admin_entities | DROP admin_entities | ✅ | 低（搜索索引可重建） | 🟢 PASS |

**结论**：全部 4 个 migration 在 D1/SQLite 下技术可行。0049 在 Phase 2 后不可回滚（数据丢失不可接受）,需在 migration 文件中追加 `-- [WARNING: IRREVERSIBLE after Phase 2]` 标记。

---

### 10. Phase 3 Contract Audit

以下是对 Phase 3 开发者的可执行契约：

| 契约项 | 当前状态 | Phase 3 要求 |
|--------|---------|------------|
| **current user** | ✅ `/api/admin/v2/auth/me` 返回 `{ id, username, role_id, role_name, status, permissions[] }` | Phase 3 Dashboard 可调用此端点获取当前用户信息。契约稳定 |
| **permission check** | ✅ `rbac.ts` `checkPermission(user, resource, action)` → boolean。`requirePermission()` → Response\|null | Phase 3 所有管理页面可调用 `/me` 获取权限列表,前端据此显示/隐藏 UI 元素。但**前端权限判断仅用于 UX,安全由后端 requirePermission 保证** |
| **API client** | ✅ `src/lib/admin/api/client.ts` `api.get/post/put/del<T>()` 返回 `ApiEnvelope<T>` | Phase 3 可直接使用。Warning: `fetch()` 无 try/catch (Phase 1 audit W2),网络错误时 reject。Phase 3 建议加 `.catch()` |
| **error envelope** | ✅ 统一 `{ success, data, error: { code, message }, meta }` | Phase 3 所有 UI 组件按此格式处理错误。ErrorCode 类型定义在 `types.ts` |
| **401/403** | ✅ 401 = 未登录, 403 = 无权限 | Phase 3 前端检测 401 → 跳转登录; 403 → 显示「无权限」 |
| **audit** | ✅ `logAction()` 已就位。5 个 V2 端点中 3 个写操作接入 | Phase 3 新增的 API handler 写操作必须调用 logAction。login/logout 当前未记录 — Phase 3 不要求修复 |
| **versioning** | ✅ `createVersion()` + `nextVersion()` 已就位 | Phase 3 Dashboard 不涉及内容版本,无需调用 |
| **admin_entities sync** | ✅ `syncAdminEntity()` 已就位。best-effort,无 retry | Phase 3 如 API handler 有写操作,需调用 syncAdminEntity |
| **failure/retry** | ⚠️ syncAdminEntity 无 retry。logAction 无 retry（设计内） | Phase 3 接受此行为。Dashboard KPI 从源表直接 COUNT,不依赖 admin_entities |
| **session expiry** | ✅ 7 days。logout 不清除服务端 token | Phase 3 前端在 `/me` 返回 401 时跳转登录 |
| **禁止重复实现** | ❌ Phase 3 不得重新实现 rbac/audit/versioning/sync | 调用已提供的函数。不得自行建表/加字段 |

---

## B. 最终判定

### PHASE 2 INFRASTRUCTURE AUDIT

**🟡 PASS WITH 3 FAILS + 5 WARNINGS**

| ID | 级别 | 问题 | 位置 |
|----|------|------|------|
| F1 | 🔴 FAIL | V1 fallback 绕过 V2 RBAC — V1 cookie 持有者自动获得全部 Owner 权限 | rbac.ts:114-138 |
| F2 | 🔴 FAIL | Logout 不撤销 token — 已签发 token 7 天内仍有效 | logout.ts:6 |
| F3 | 🔴 FAIL | 无 rate limiting — 可暴力破解 ADMIN_PASSWORD | login.ts |
| W1 | 🟠 WARNING | 所有 V2 用户共享同一 ADMIN_PASSWORD（不查 admin_users.password_hash） | login.ts:65 |
| W2 | 🟠 WARNING | admin_entities sync 无 retry — 搜索索引可能 stale | admin-entities.ts:28 |
| W3 | 🟡 WARNING | login/logout 未接入 audit log — 无法审计登录行为 | login.ts, logout.ts |
| W4 | 🟡 WARNING | Synthetic Owner 权限集与 seed Owner 不一致（缺少 ai:create/edit/publish/delete 等） | rbac.ts:128-137 |
| W5 | 🟡 WARNING | audit_logs 未来可能记录 PII（Phase 4+ 需约束） | audit.ts:15,17-18 |

### PHASE 3 CONTRACT: 🟡 CONDITIONAL

Phase 3 Dashboard 可以开始开发。但必须在开发前确认以下条件：

1. **V1 fallback 过渡策略**：明确何时移除 rbac.ts V1 fallback 的合成 Owner 分支
2. **Password 策略**：明确 Phase 3 期间是否继续共享 ADMIN_PASSWORD,还是实施 per-user password
3. **Rate limiting 优先级**：login rate limiting 是在 Phase 3 加还是 Phase 7+（AI 相关安全加固）？

以上 3 项不阻塞 Phase 3 Dashboard 代码开发（Dashboard 只读,不涉及登录/用户管理/权限变更）。但必须在进入 Phase 4（Content Center,涉及写操作 + 多角色）前解决。

---

*本审计基于 Phase 2 全部 15 个文件 + 4 个 migration 的实际代码。所有 PASS/FAIL/WARNING 可追溯到具体行号。*