# CR-001: Rate Limiting 15-Minute Block via Independent Block Key

状态：WAITING FOR HUMAN APPROVAL
日期：2026-08-27
来源：Phase 2 Final Reverse Audit Finding 2
影响文件：functions/api/admin/v2/auth/login.ts

---

## Problem

当前实现采用固定窗口（fixed-window）方案：

```
window_id = floor(timestamp_ms / 300_000)
rl:login:{ip}:{window_id}
TTL = 900s
```

429 响应仅在当前窗口达到 5 次后触发，持续到该窗口结束（最多 5 分钟）。当 5 分钟窗口翻转时，计数器自动重置，攻击者可立即重试。

架构文档 PHASE2_AUTH_ARCHITECTURE.md §6.1 和 PHASE2_SECURITY_REMEDIATION.md §4.3 均要求：**15 分钟 block**。

```
5 attempts / 5 min / IP
→ 429
→ block 15 min
```

当前实现无法兑现此约束。窗口边界绕过示例：

```
T = 04:58  失败 1-5 → 429
T = 05:00  新窗口，计数器为 0
T = 05:00  失败 1-5 → 再次 429（仅 2 分钟后又可尝试）
```

连续攻击者最短 2 分钟即可重新获得 5 次尝试机会，而非设计中的 15 分钟。

---

## Evidence

- 代码：`login.ts` 第 62-70 行 `windowId = Math.floor(Date.now() / RL_WINDOW_MS)`
- 代码：`login.ts` 第 85-89 行，失败 PUT 时 TTL = 900（与 block 无关，仅为保留计数器）
- 设计：PHASE2_AUTH_ARCHITECTURE.md §6.1 "Block: 15 minutes after limit reached"
- 设计：PHASE2_SECURITY_REMEDIATION.md §4.3 "Block duration: 15 minutes"
- 测试：当前 6th attempt 正确返回 429，但下一窗口可立即重试

---

## Proposed Solution

在现有固定窗口计数器之上，增加独立的 block key：

```
rl:login:{ip}:{window_id}   ← 计数器（保留现有行为）
rl:login:block:{ip}          ← 新增：触发 block 的标志
```

逻辑调整：

```
1. 检查 block key：
   KV GET rl:login:block:{ip}
   → 存在 → 429（无论当前窗口计数是多少）

2. 读取当前窗口计数：
   KV GET rl:login:{ip}:{window_id}
   → count < 5 → 放行

3. 失败时：
   KV PUT rl:login:{ip}:{window_id} = "{count+1}:{firstTs}"  TTL 900
   if count+1 >= 5:
     KV PUT rl:login:block:{ip} = "1"  TTL 900

4. 成功登录时：
   KV DELETE rl:login:{ip}:{window_id}
   KV DELETE 之前一个窗口的 key
   KV DELETE rl:login:block:{ip}
```

### 重要约束

- 复用现有 KV namespace `aromiso-drafts`
- 不新增 D1 / migration / KV namespace / 第三方服务
- 不改变 token 格式 / HMAC 算法 / cookie 名称 / RBAC 模型
- 继续使用 CF-Connecting-IP 作为客户端标识（不引入 X-Forwarded-For）
- KV 失败策略不变：fail-open（跳过 rate limiting）

### 成功行为

成功登录后清除所有 rate-limit 状态：当前窗口 key + 前一窗口 key + block key。

### 失败行为

达到阈值 → block key 存活 900 秒 → 期间所有请求（任何窗口）均返回 429。

### 验收标准

```
失败 1 → 401
失败 2 → 401
失败 3 → 401
失败 4 → 401
失败 5 → 401
失败 6 → 429
正确密码 + block 存在 → 429
block TTL = 900 seconds
成功登录 → 清除 rate-limit state（含 block key）
前一窗口达到阈值 → 下一窗口仍 429（fixed-window bypass 已消除）
```

---

## Alternatives Considered

### 选项 B：滑动窗口（每请求递增 + 最早条目过期检查）

优点：精确滑动窗口。
缺点：需在每次请求中维护计数器列表（多个 KV key），读写放大，CF KV 延迟增加，实现复杂度高。对 admin 登录场景过度设计。

### 选项 C：只用 block key，无 window 计数器

优点：最简单。
缺点：无法区分 1 次失败和 4 次失败——每次失败都应记录，但只有第 5 次才触发 block。

**推荐选项 A（独立 block key）**，与现有实现兼容性最高，改动最小。

---

## Phase 影响

- 实施 Phase：Phase 2（security remediation，与 F3 同属一个工作包）
- 需要 ADR 修改？ 否（ADRs 定义策略，未规定具体 KV schema）
- 需要 Migration？ 否
- 需要更新架构文档？ 是：PHASE2_AUTH_ARCHITECTURE.md §6.2 的 KV Schema 需补充 block key

---

*此 CR 由 Phase 2 Final Reverse Audit 触发。V2_DEVELOPMENT_GATES.md 要求：发现设计缺口 → CHANGE_REQUEST → 人工批准 → 才能写代码。*
