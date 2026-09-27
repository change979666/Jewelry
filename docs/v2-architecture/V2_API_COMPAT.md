# V2 P0-10: API 兼容策略
## API Compatibility Strategy

> 基于 V2 设计规范 §37 + P0-3（API 地图）+ P0-6（权限地图）
> 日期：2026-08-24

---

## 1. 兼容原则

```
铁律：V1 API 在 V2 开发期间和上线后 30 天内必须保持完整可用。
     不能因为 V2 开发而破坏任何正在使用的 API。
```

---

## 2. 三阶段共存策略

### Phase 1-13（开发期）：双路由并存

```
CF Pages Functions 路由:

/api/admin/*       → functions/api/admin/*.ts  (V1，原样不动)
/api/admin/v2/*    → functions/api/admin/v2/*.ts (V2，全新)
```

- V1 API 代码完全不修改（除非修 bug）
- V2 API 从零开始写，不依赖 V1 内部实现
- 前端 V2 页面只调 V2 API
- 前端 V1 页面只调 V1 API
- 两边完全隔离

### Phase 14（切换期）：兼容路由

```
/api/admin/*       → 大部分转发到 /api/admin/v2/*
                     少数保留 V1 原始实现（如 login/logout）
/api/admin/v2/*    → functions/api/admin/v2/*.ts (V2)
```

转发实现：

```ts
// functions/api/admin/save.ts (Phase 14 改造)
export async function onRequest(context) {
  // 转发到 V2
  const url = new URL(context.request.url);
  url.pathname = url.pathname.replace('/api/admin/', '/api/admin/v2/');
  const newRequest = new Request(url, context.request);
  return context.next(newRequest); // 或直接调用 V2 handler
}
```

### Phase 14+30d（清理期）：下线旧路由

- 确认 `/api/admin/*` 调用量为零（通过 CF analytics）
- 删除转发层
- 删除原始 V1 API 文件（归档到 `_archive/`）

---

## 3. 统一响应格式适配层

### 问题

V1 API 返回格式不一致：
- 有些返回 `{ error: "..." }` 在 200 状态码下
- 有些返回 `json(data)`
- 有些返回 `json({ error: "..." }, 401)`
- 分页格式不统一

### 方案：V2 API 统一格式（V2 §37）

```ts
// src/lib/admin/api/response.ts
export function success(data: unknown, meta?: PaginationMeta): Response {
  return new Response(JSON.stringify({
    success: true,
    data,
    error: null,
    meta: meta ?? null,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function error(code: ErrorCode, message: string, status: number, details?: unknown): Response {
  return new Response(JSON.stringify({
    success: false,
    data: null,
    error: { code, message, details: details ?? null },
  }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### V1 API 不改

V1 API 保持原有格式，不套适配层（避免引入兼容 bug）。

### 前端数据层统一

```ts
// src/lib/admin/api/client.ts
async function request<T>(path: string, opts?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(path, opts);
  const json = await res.json();

  // V2 format
  if ('success' in json) return json as ApiResponse<T>;

  // V1 format fallback — normalize
  if (json.error) {
    return { success: false, data: null, error: { code: 'UNKNOWN', message: json.error }, meta: null };
  }
  return { success: true, data: json as T, error: null, meta: null };
}
```

---

## 4. 分页/筛选/排序标准化

### V2 标准（所有新 API 强制）

```
GET /api/admin/v2/<module>/<resource>
  ?page=1           (default 1)
  &pageSize=20       (default 20, max 100)
  &search=...        (full-text search string)
  &status=...        (enum filter)
  &sort=updated_at   (column name)
  &order=desc        (asc/desc)

Response:
{
  "success": true,
  "data": [ ...items ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 87,
    "totalPages": 5
  }
}
```

### V1 兼容

V1 API 分页参数不统一（有的无分页、有的用 `limit`/`offset`）。不改 V1，前端调用 V1 时按各自格式。

---

## 5. 错误码体系

详见 P0-7 §4.3。V2 新 API 全部使用此错误码体系。V1 API 保持原有错误格式。

---

## 6. 认证兼容

### 当前

```
V1: HMAC cookie (aromiso_admin) → isAuthed() → YES/NO
```

### V2

```
V2: HMAC cookie (aromiso_admin) → isAuthed() → user + role → RBAC check
```

### 共存期

```ts
// V2 auth middleware
async function authV2(request: Request, env: Env): Promise<AuthResult> {
  // Step 1: same HMAC verification as V1
  const token = readCookie(request);
  if (!(await verifySession(token, env.ADMIN_PASSWORD || ''))) {
    return { authenticated: false, user: null };
  }

  // Step 2: load user from admin_users (V2 new)
  // If no RBAC set up yet (Phase 1), return default Owner role
  const user = await loadUser(token, env.DB);
  return { authenticated: true, user };
}
```

**迁移路径**：
- Phase 1：V2 API 用 `authV2`，无 RBAC 时默认 Owner（所有权限）
- Phase 2：创建 `admin_users` 表，迁移单用户到 Owner 角色
- Phase 2 后：RBAC 生效，但 Owner 保留所有权限（向后兼容）

---

## 7. 前端 API 调用迁移路径

```
Phase 1-3:  前端 V2 新页面 → 直接调 /api/admin/v2/*
            前端 V1 旧页面 → 继续调 /api/admin/*

Phase 4-13: 逐模块切换
            新模块 → V2 API
            未迁移模块 → V1 API

Phase 14:   全部前端 → V2 API
            V1 API → 兼容转发到 V2
```

---

## 8. V1 API 不修改清单（锁死）

以下 V1 API 在 V2 开发期间**绝对不修改**（除非修 Critical bug）：

```
/api/admin/login
/api/admin/logout
/api/admin/load
/api/admin/save
/api/admin/delete
/api/admin/get
/api/admin/upload
/api/admin/upload-image
/api/admin/upload-video
/api/admin/faqs
/api/admin/settings
/api/admin/stats
/api/admin/commerce-products
/api/admin/commerce-orders
/api/admin/commerce-reviews
/api/admin/inquiries
/api/admin/subscribers
/api/admin/import-1688
/api/admin/import-excel
/api/admin/merchandising
/api/admin/translate-products
/api/admin/email-send
/api/admin/email-thread
/api/admin/video-center
/api/admin/ai-*
/api/admin/gsc-*
/api/admin/ga4-*
/api/admin/cron-pull
/api/admin/task-execute
/api/admin/content-generate
/api/admin/os-*
```

共计约 50 个端点。全部锁死。

---

## 9. 测试策略

### 冒烟测试（每 Phase 发布前必跑）

```bash
# V1 API 冒烟：确保未破坏
curl -X GET https://aromiso.com/api/admin/stats -H "Cookie: ..."

# V2 API 冒烟：确保新 API 正常
curl -X GET https://aromiso.com/api/admin/v2/dashboard/kpi -H "Cookie: ..."
```

### 回归测试（Phase 14 切换前）

- V1 API 全量回归（至少每个端点的 GET 请求）
- 与 Phase 0 记录的 V1 响应格式对比

---

*本文基于 V2 规范 §37 + §56。所有兼容决策遵循"稳定 > 兼容 > 可维护 > 快速开发"原则。*"