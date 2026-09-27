# V2 AUTHENTICATION ARCHITECTURE — FINAL LOCKDOWN
## Per-User Auth / Session / RBAC / Audit Closed Loop

日期: 2026-08-24
基于: W1 = Option B (Per-user password) + F1/F2/F3/W4 Security Remediation
状态: 最后一次认证架构审查，锁定后进入实施

---

## 1. Authentication Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                      V2 AUTHENTICATION                            │
│                                                                    │
│  ┌──────────┐                                                      │
│  │  LOGIN   │  POST /api/admin/v2/auth/login                     │
│  │          │   { username, password }                             │
│  └────┬─────┘                                                      │
│       │                                                            │
│       ▼                                                            │
│  ┌──────────────────────────────────────────────┐                 │
│  │  RATE LIMIT CHECK (F3 fix)                    │                 │
│  │  KV: rl:login:{ip}:{window_5min}              │                 │
│  │  5 次/5 分 → 超限 429 → 封 15 分               │                 │
│  └────┬─────────────────────────────────────────┘                 │
│       │ (within limit)                                             │
│       ▼                                                            │
│  ┌──────────────────────────────────────────────┐                 │
│  │  CREDENTIAL VERIFICATION                      │                 │
│  │  1. SELECT password_hash FROM admin_users     │                 │
│  │     WHERE username = ? AND status = 'active'   │                 │
│  │  2. Compute: HMAC-SHA256(ADMIN_PASSWORD,       │                 │
│  │     body.password)                             │                 │
│  │  3. Constant-time compare with DB hash         │                 │
│  │  4. Match → ok. No match → 401                │                 │
│  │  5. UPDATE last_login_at                       │                 │
│  └────┬─────────────────────────────────────────┘                 │
│       │ (match)                                                    │
│       ▼                                                            │
│  ┌──────────────────────────────────────────────┐                 │
│  │  CLEAR RATE LIMIT (success clears failures)   │                 │
│  │  KV.DELETE rl:login:{ip}:*                    │                 │
│  └────┬─────────────────────────────────────────┘                 │
│       │                                                            │
│       ▼                                                            │
│  ┌──────────────────────────────────────────────┐                 │
│  │  TOKEN CREATION                               │                 │
│  │  token = HMAC-SHA256(ADMIN_PASSWORD,           │                 │
│  │    "{username}.{timestamp}")                   │                 │
│  │  Format: "{sig_hex}.{username}.{timestamp}"    │                 │
│  │  Cookie: aromiso_admin_v2={token}             │                 │
│  │    HttpOnly; Secure; SameSite=Lax; Path=/      │                 │
│  │    Max-Age=604800 (7 days)                     │                 │
│  └────┬─────────────────────────────────────────┘                 │
│       │                                                            │
│       ▼                                                            │
│  ┌──────────────────────────────────────────────┐                 │
│  │  AUDIT: logAction({                           │                 │
│  │    actor_type: "human",                        │                 │
│  │    username: body.username,                     │                 │
│  │    action: "login",                             │                 │
│  │    resource_type: "system",                     │                 │
│  │    change_summary: "Login successful"           │                 │
│  │  })                                            │                 │
│  └────────────────────────────────────────────────┘                 │
│                                                                    │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                    │
│  ┌──────────┐                                                      │
│  │ REQUEST  │  GET/POST/PUT/DELETE /api/admin/v2/*                │
│  └────┬─────┘                                                      │
│       │                                                            │
│       ▼                                                            │
│  ┌──────────────────────────────────────────────┐                 │
│  │  TOKEN VERIFICATION                           │                 │
│  │  1. Extract cookie: aromiso_admin_v2           │                 │
│  │  2. Parse token: sig.username.timestamp       │                 │
│  │  3. Verify HMAC (constant-time)                │                 │
│  │  4. Check expiry: now - timestamp < 7 days    │                 │
│  │  5. Check KV revocation (F2 fix):              │                 │
│  │     KV.GET revoked_token:{sha256(token)}       │                 │
│  │     → exists → 401                             │                 │
│  └────┬─────────────────────────────────────────┘                 │
│       │ (valid)                                                    │
│       ▼                                                            │
│  ┌──────────────────────────────────────────────┐                 │
│  │  RBAC                                        │                 │
│  │  1. loadUser(env, username) → AuthUser       │                 │
│  │  2. checkPermission(user, resource, action)   │                 │
│  │  3. No → 403                                  │                 │
│  └────┬─────────────────────────────────────────┘                 │
│       │ (authorized)                                               │
│       ▼                                                            │
│  ┌──────────────────────────────────────────────┐                 │
│  │  BUSINESS LOGIC + AUDIT                       │                 │
│  │  logAction() on all writes                     │                 │
│  └────────────────────────────────────────────────┘                 │
│                                                                    │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                    │
│  ┌──────────┐                                                      │
│  │ LOGOUT   │  POST /api/admin/v2/auth/logout                     │
│  └────┬─────┘                                                      │
│       │                                                            │
│       ▼                                                            │
│  ┌──────────────────────────────────────────────┐                 │
│  │  1. Extract current token from cookie         │                 │
│  │  2. KV.PUT revoked_token:{sha256(token)} = "1"│                 │
│  │     TTL = 7 days                              │                 │
│  │  3. Clear cookie (Max-Age=0)                  │                 │
│  │  4. AUDIT: logAction({ action: "logout" })    │                 │
│  └────────────────────────────────────────────────┘                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Session Lifecycle

### 2.1 Token Format

```
Token: "{sig_hex}.{username}.{timestamp}"

sig_hex    = HMAC-SHA256(ADMIN_PASSWORD, "{username}.{timestamp}").toHex()
username   = admin_users.username (plain text, signed — not encrypted)
timestamp  = Date.now() at creation time

Type: Stateless HMAC token (not JWT). Payload is in plain text, integrity protected by HMAC signature.
```

### 2.2 Cookie

```
Name:     aromiso_admin_v2
Value:    {token} (URL-encoded)
Flags:    HttpOnly; Secure; SameSite=Lax; Path=/
Max-Age:  604800 (7 days)
```

### 2.3 Token Verification (every request)

```
Step 1: Parse cookie → decodeURIComponent → split "." → [sig, username, ts]
Step 2: Recompute HMAC(ADMIN_PASSWORD, "{username}.{ts}")
Step 3: Constant-time compare computed sig with cookie sig
Step 4: Check (Date.now() - ts) < 604800000
Step 5: Check KV: revoked_token:{SHA256(token)} → if exists → FAIL
Step 6: All pass → return { username } → proceed to loadUser()
```

### 2.4 Token Revocation (logout)

```
KV Key:    revoked_token:{SHA256(token)}
Value:     "1"
TTL:       604800 (7 days, same as token Max-Age)
Namespace: aromiso-drafts (existing KV binding)
```

**Logout behavior**:
- Single logout: KV.PUT → cookie cleared → 200
- Double logout (replay): KV.PUT overwrites same key → cookie already cleared → 200 (idempotent)
- After logout: any request with old token → KV.GET hits → 401

**Concurrent request + logout**:
- T0: Request A starts (token verified, KV not checked yet)
- T1: Logout → KV.PUT revocation
- T2: Request A KV check → FAIL → 401
- KV eventual consistency: worst case < 1s window where old token works after logout. Acceptable for admin panel (not high-frequency API).

### 2.5 Token Expiry

- Normal expiry: verify step 4 catches `now - ts > 7 days` → 401
- KV cleanup: KV TTL = 7 days → revoked keys auto-expire when token would have expired anyway
- No manual cron needed for cleanup

### 2.6 Token Leakage

If a token is stolen:
- Attacker can impersonate user for up to 7 days
- No session binding to IP/browser (by design — admin panel, not banking)
- Mitigation: change ADMIN_PASSWORD → all tokens immediately invalid (new HMAC key)
- Mitigation: Owner can disable user's status → loadUser returns null → 401

### 2.7 Session Fixation

**Not possible.** Token is generated AFTER credential verification. No pre-existing token is promoted to authenticated.

### 2.8 CSRF

- SameSite=Lax: browser does not send cookie on cross-site POST
- All state-changing endpoints are POST/PUT/DELETE (no GET side effects)
- Risk: LOW. No CSRF token needed for current architecture.

---

## 3. V1 → V2 Migration Flow

### 3.1 Bootstrap State Machine

```
┌─────────────────────────────────────────────────────────────────────┐
│                     V1 → V2 AUTH TRANSITION                          │
│                                                                      │
│  Phase 2 Migration 0049 Executed:                                    │
│    admin_roles:    seeded (4 roles)                                  │
│    admin_users:    empty (0 users)                                   │
│    admin_permissions: seeded (131 rows)                               │
│                                                                      │
│  State: BOOTSTRAP                                                     │
│    V1 cookie → authenticateRequest → V1 fallback →                   │
│      SELECT COUNT(*) FROM admin_users                                │
│        WHERE role_id = 'role_owner' AND status = 'active'             │
│      → cnt = 0 → "Bootstrap allowed"                                 │
│                                                                      │
│  Bootstrap permissions (temporary, DB-driven — W4, never hardcoded):  │
│    SELECT resource, action FROM admin_permissions                     │
│      WHERE role_id = 'role_owner' AND resource = 'system'             │
│    → every system:* row seeded in DB (covers user management          │
│      needed to create the first Owner)                                │
│    ALL NON-system PERMISSIONS: DENIED                                 │
│                                                                      │
│  User creates first Owner:                                            │
│    POST /api/admin/v2/system/users                                   │
│    { username: "admin", password: "xxx", role_id: "role_owner" }     │
│                                                                      │
│  State: ACTIVE (bootstrap complete)                                   │
│    SELECT COUNT(*) WHERE role_id='role_owner' AND status='active'    │
│    → cnt > 0 → "Bootstrap DISABLED"                                  │
│    V1 cookie → authenticateRequest → **return null (401)**           │
│    All subsequent auth must use V2 cookie                             │
│                                                                      │
│  State: DEGRADED (last Owner deleted/disabled)                        │
│    cnt = 0 → Bootstrap re-enabled → same temporary permissions       │
│                                                                      │
│  Phase 14:                                                            │
│    V1 API offline → remove entire V1 fallback code block             │
│    Bootstrap is no longer needed (V2 is the only admin system)       │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 V1 Fallback Rules (Final)

| Scenario | V1 cookie behavior |
|----------|-------------------|
| No Owner in DB | Temporary bootstrap permissions (system:* only) |
| Owner exists in DB | **401 — V1 cookie rejected for V2 API** |
| Owner deleted | Bootstrap re-enabled |
| Phase 14 | V1 fallback code removed entirely |

### 3.3 Concurrent Bootstrap Protection

```
CREATE USER endpoint (POST /api/admin/v2/system/users):
  - UNIQUE(username) on admin_users → D1 constraint prevents duplicate usernames
  - Two concurrent V1 admins both try to create "admin" → first wins → second gets 409 CONFLICT
  - No race condition on bootstrap itself (one Owner is enough to disable fallback)
```

### 3.4 V1 /admin Preservation

- V1 /admin route: **unchanged** (Phase 1-14)
- V1 API endpoints: **unchanged** (Phase 1-13, Phase 14 compatibility routing)
- V1 isAuthed(): **unchanged** (continues to work for V1 pages)
- V1 cookie is NEVER invalidated by V2 operations

---

## 4. Per-user Authentication Design

### 4.1 admin_users Schema

```
Current (0049_rbac.sql):
  id TEXT PRIMARY KEY               ✅
  username TEXT NOT NULL UNIQUE     ✅
  password_hash TEXT NOT NULL       ✅ (already exists)
  role_id TEXT NOT NULL FK          ✅
  status TEXT DEFAULT 'active'      ✅
  last_login_at DATETIME            ✅
  created_at DATETIME               ✅
  updated_at DATETIME               ✅

No additional columns needed. No migration needed.
```

### 4.2 Password Hash Mechanism

```
STORAGE (users.ts POST — already correct):
  key = HMAC-SHA256 signing key from ADMIN_PASSWORD
  hash = HMAC_sign(key, user_supplied_password)
  INSERT INTO admin_users ... password_hash = hash

VERIFICATION (login.ts — needs fix for Option B):
  row = SELECT password_hash, status FROM admin_users WHERE username = ?
  if !row → 401 "Invalid credentials" (same message as wrong password)
  if row.status != 'active' → 401 "Invalid credentials"
  computed = HMAC_sign(ADMIN_PASSWORD_key, body.password)
  if constant_time_compare(computed, row.password_hash) → OK
  else → 401 "Invalid credentials"
```

### 4.3 ADMIN_PASSWORD Role After Option B

```
ADMIN_PASSWORD continues to exist as:
  1. HMAC signing key for all V2 tokens (token integrity)
  2. HMAC signing key for password_hash computation (password storage)
  3. V1 auth password (backward compatibility)
  4. NEVER compared as plaintext in V2 login

Changing ADMIN_PASSWORD:
  - All existing V2 tokens become invalid (new HMAC key → signature mismatch)
  - All existing password_hash values become invalid (computed with old key)
  - Effectively: full session invalidation + full password reset
```

### 4.4 First Owner Initialization

```
Phase 2 migration executes → admin_users is empty
V1 admin accesses /admin-v2/system/users
V1 cookie → bootstrap permissions → can create user
Create first user with role_id = "role_owner":
  username: "admin" (or any name)
  password: (user-chosen)
Bootstrap → detected cnt > 0 → V1 fallback DISABLED
Owner logs in via /admin-v2 with V2 cookie
Owner creates additional users as needed
```

### 4.5 Login Failure — No User Enumeration

```
All failure cases return IDENTICAL response:
  { success: false, error: { code: "UNAUTHORIZED", message: "Invalid credentials" } }
  401

Failure cases:
  - username not found
  - status = 'disabled'
  - password_hash mismatch
  - all return the same message

Rate limited response (different — intentional, informs user to wait):
  { success: false, error: { code: "RATE_LIMITED", message: "Too many attempts. Try again in 15 minutes." } }
  429
```

---

## 5. RBAC — Single Source of Truth

### 5.1 Permission Source

```
SINGLE SOURCE OF TRUTH: admin_permissions table (DB)

loadUser(env, username):
  1. SELECT ... FROM admin_users JOIN admin_roles
  2. SELECT resource, action FROM admin_permissions WHERE role_id = ?
  3. Build permissions Set<string>
  4. Return AuthUser

checkPermission(user, resource, action):
  → user.permissions.has("{resource}:{action}")
  → O(1) lookup
```

### 5.2 No Hardcoded Permissions

```
ELIMINATED:
  - rbac.ts:128-137 hardcoded synthetic Owner permissions (W4 fix)
  - login.ts:65 plaintext ADMIN_PASSWORD comparison (W1 fix)

REMAINING code-based permissions:
  - NONE. All permissions from DB.

TRANSITION:
  - V1 fallback bootstrap permissions: read from DB (SELECT ... WHERE role_id='role_owner')
    then filter to system:* only. NOT hardcoded.
```

### 5.3 RBAC Enforcement

```
requirePermission(user, resource, action):
  if !user → 401
  if !checkPermission → 403
  → null (pass)

Called in EVERY V2 API handler before business logic.
UI MAY hide buttons based on /me permissions — but security is SERVER-SIDE ONLY.
```

---

## 6. Rate Limiting Design

### 6.1 Strategy

```
Type:     IP-based (not account-based — avoids username enumeration via lockout)
Window:   5 minutes (sliding, not fixed)
Limit:    5 failed attempts per window
Block:    15 minutes after limit reached

Why not account-based: Account-based lockout reveals "this username exists".
Why IP: An attacker with distributed IPs can bypass. But this is an admin panel,
         not a public service — distributed IP attack requires significant effort.
```

### 6.2 KV Schema

```
Key:       rl:login:{ip}:{window_id}
           window_id = floor(timestamp_ms / 300000)  (5-minute bucket)
Value:     "{count}:{first_attempt_timestamp}"
TTL:       900 (15 minutes = window + block)
```

### 6.3 Flow

```
LOGIN ATTEMPT:
  1. Compute window_id = floor(now / 300000)
  2. KV.GET rl:login:{ip}:{window_id}
  3. If exists and count >= 5:
       → 429 "Too many attempts. Try again in 15 minutes."
  4. If not exists or count < 5:
       → proceed to credential check
  5. Credential check SUCCESS:
       → DELETE rl:login:{ip}:* (clear all windows for this IP — success resets)
       → Continue to token creation
  6. Credential check FAIL:
       → count = (existing?.count ?? 0) + 1
       → KV.PUT rl:login:{ip}:{window_id} = "{count}:{now}"
       → 401 "Invalid credentials"
```

### 6.4 Multi-Worker Consistency

```
KV is eventually consistent (propagation < 1s).
Edge case: two concurrent login attempts from same IP, both within 5/5 limit.
  → Both proceed to credential check.
  → One succeeds → clears count → other's count is stale.
  → Acceptable: admin login is low-frequency, edge case is unlikely.
```

---

## 7. Audit Event Coverage

### 7.1 Required Events

| Event | logAction call | Location |
|-------|---------------|----------|
| login_success | `logAction({ actor_type:"human", username, action:"login", resource_type:"system", change_summary:"Login successful" })` | login.ts (NEW) |
| login_failed | `logAction({ actor_type:"human", username, action:"login", resource_type:"system", change_summary:"Login failed" })` | login.ts (NEW) |
| logout | `logAction({ actor_type:"human", username, action:"logout", resource_type:"system", change_summary:"Logout" })` | logout.ts (NEW) |
| user_created | `logAction({ actor_type:"human", ... action:"create", resource_type:"system", resource_id, resource_title:newUsername })` | users.ts:42 ✅ |
| user_updated | `logAction({ ..., action:"update", resource_type:"system", resource_id })` | users.ts:55 ✅ |
| user_deleted | `logAction({ ..., action:"delete", resource_type:"system", resource_id })` | users.ts:66 ✅ |
| permission_denied | NOT logged (volume risk — every 403 would write an audit row). Frontend shows error. Backend returns 403 JSON. | N/A — explicit design choice |

### 7.2 Forbidden in Audit

```
NEVER log these values in ANY audit_logs field:
  - password (plaintext)
  - password_hash
  - token (raw cookie value)
  - cookie header
  - API key
  - secret
  - ADMIN_PASSWORD

PII caution:
  - resource_title MAY contain customer name (future Phase 4-6)
  - before_snippet / after_snippet MUST NOT contain full product descriptions
    (use change_summary for human-readable diff)

Enforcement: Code review on every Phase 4+ API handler that calls logAction().
```

---

## 8. Migration List

```
NONE.

admin_users.password_hash column: already exists (0049_rbac.sql:18)
  → No ALTER TABLE needed
KV namespace: already exists (aromiso-drafts)
  → No new binding needed
Rate limit: uses same KV namespace
  → No new binding needed
Token revocation: uses same KV namespace
  → No new binding needed

Total new migrations: 0
Total new KV namespaces: 0
Total new D1 tables: 0
```

---

## 9. ADR Change List

| ADR | Change | Reason |
|-----|--------|--------|
| ADR-18 (new) | V1 auth fallback = bootstrap-only, system:* permissions, auto-disables after first Owner | F1 fix |
| ADR-19 (new) | Token revocation via KV blacklist (revoked_token:{sha256}) | F2 fix |
| ADR-20 (new) | Login rate limiting: IP-based, 5/5min sliding window, KV-backed | F3 fix |
| ADR-21 (new) | admin_permissions = single source of truth for RBAC. No hardcoded permissions | W4 fix |
| ADR-22 (new) | Per-user password via admin_users.password_hash. ADMIN_PASSWORD = HMAC signing key only, never plaintext-compared | W1 Option B |

---

## 10. Phase Plan Change List

### Phase 2 (current) — Additional acceptance criteria

```
□ login.ts: Per-user password verification (HMAC compare with DB password_hash)
□ login.ts: Rate limiting (KV sliding window)
□ login.ts: Audit: login_success / login_failed
□ logout.ts: Token revocation (KV blacklist)
□ logout.ts: Audit: logout
□ rbac.ts: V1 fallback → bootstrap-only (system:* permissions, auto-disable)
□ rbac.ts: Synthetic Owner permissions → read from DB (not hardcoded)
□ rbac.ts: authenticateRequest → KV revocation check for every V2 cookie
```

### Phase 3 — No change needed (uses Phase 2 auth as-is)

### Phase 14 — Cleanup task

```
□ rbac.ts: Remove V1 fallback code block entirely
□ login.ts: Remove comment about "shared password for now"
```

---

## 11. Security Gate

```
□ F1: V1 cookie grants bootstrap-only permissions (system:*). Auto-disables after first Owner
□ F2: Logout revokes token via KV. Stale token → 401
□ F3: Login rate limited: 5/5min per IP
□ W1: Per-user password via admin_users.password_hash. ADMIN_PASSWORD = signing key only
□ W4: All permissions from admin_permissions DB table. Zero hardcoded permissions
□ Login failure does not reveal username existence
□ Login success / failed / logout all produce audit records
□ No password/token/secret in any audit_logs field
□ Token: HttpOnly; Secure; SameSite=Lax
□ Token: 7-day expiry
□ Token: HMAC-SHA256 with constant-time comparison
□ KV revocation check on every authenticated request
□ Bootstrap: Concurrent → UNIQUE(username) prevents duplicate Owner creation
□ Bootstrap: Owner deleted → re-enabled (system can recover from accidental lockout)
```

---

## 12. AUTHENTICATION STATUS

## 🟢 READY TO IMPLEMENT

**零阻塞项。零架构决策待定。零新增 migration。零新增基础设施。**

所有 5 项安全修复（F1/F2/F3/W1/W4）均有明确设计。所有改动限于现有 3 个文件（login.ts, logout.ts, rbac.ts）。KV 复用现有 aromiso-drafts namespace。

**每项改动的代码变更量**：

| Item | Files | Lines changed |
|------|-------|--------------|
| F1 (fallback) | rbac.ts | ~25 lines (replace lines 114-138) |
| F2 (revocation) | rbac.ts + logout.ts | ~15 lines (KV check + KV put) |
| F3 (rate limit) | login.ts | ~20 lines (KV sliding window) |
| W1 (per-user) | login.ts | ~5 lines (change password check) |
| W4 (hardcode) | rbac.ts | ~15 lines (read from DB, not hardcoded) |

**Total: ~80 lines changed across 3 files. Zero new files. Zero migrations.**

---

*本文档为 V2 Authentication Architecture 最终锁定版本。所有设计基于 Phase 0 封版架构 + Phase 2 已实施代码。实施前无需进一步架构决策。*