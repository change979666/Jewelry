# V2 P0-9: 数据迁移策略
## Data Migration Strategy

> 基于 V2 设计规范 §48 + P0-4（DB 地图）+ V2 §36 兼容层
> 日期：2026-08-24

---

## 1. 迁移原则

```
铁律 1: 不破坏现有 52 张 D1 表的结构（仅 ALTER ADD COLUMN，不 DROP/RENAME）
铁律 2: 所有新表从 0049 开始编号，不与已有 migration 冲突
铁律 3: 每张新 migration 必须包含回滚 DDL（注释在文件中）
铁律 4: 不可逆 migration 必须标记 [IRREVERSIBLE] 并说明原因
铁律 5: 每次 migration 上线前先在本地 D1 验证
```

---

## 2. Migration 编号方案

```
已有: 0001-0048（52 张表）
V2 新增: 0049-0063（18 张新表 + ALTER 现有表）
```

### 完整 Migration 路线图

| # | 内容 | Phase | 表数 | 可回滚 |
|---|------|-------|------|--------|
| 0049 | admin_users, admin_roles, admin_permissions | Phase 2 | 3 | ✅ |
| 0050 | audit_logs | Phase 2 | 1 | ✅ |
| 0051 | content_versions | Phase 2 | 1 | ✅ |
| 0052 | copy_versions | Phase 4 | 1 | ✅ |
| 0053 | recycle_bin | Phase 4 | 1 | ✅ |
| 0054 | soft_delete columns (ALTER 现有表) | Phase 4 | 多表 | ⚠️ 列可 DROP |
| 0055 | copy_assets（13 类型文案资产） | Phase 4 | 1 | ✅ |
| 0056 | customers | Phase 6 | 1 | ✅ |
| 0057 | oem_projects, oem_requirements, oem_samples | Phase 6 | 3 | ✅ |
| 0058 | oem_quotes, oem_files, oem_timeline | Phase 6 | 3 | ✅ |
| ~~0059~~ | ~~entity_links~~ | ~~Phase 6~~ | — | ❌ 已取消（ADR-13） |
| 0060 | notifications | Phase 10 | 1 | ✅ |
| 0061 | ai_automation_rules | Phase 7 | 1 | ✅ |
| 0062 | ai_tasks | Phase 7 | 1 | ✅ |
| 0063 | saved_calculations | Phase 5 | 1 | ✅ |
| 0064 | admin_entities | Phase 2 | 1 | ✅ |
| 0065 | deprecated_tables_cleanup | Phase 14 | 8 DROP | ⚠️ 不可逆 |

---

## 3. Migration DDL（关键新表）

### 0049: RBAC 基础

```sql
-- UP
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES admin_roles(id),
  status TEXT NOT NULL DEFAULT 'active',  -- active | disabled
  last_login_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES admin_roles(id),
  resource TEXT NOT NULL,   -- 'content' | 'commerce' | 'customers' | 'oem' | 'media' | 'ai' | 'growth' | 'system'
  action TEXT NOT NULL,     -- 'view' | 'create' | 'edit' | 'publish' | 'delete' | 'export' | 'execute_ai' | 'approve_ai' | 'manage_settings'
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, resource, action)
);

-- Seed data: Owner role with all permissions
INSERT INTO admin_roles (id, name, description) VALUES ('role_owner', 'Owner', 'Full access to all modules');
INSERT INTO admin_permissions (id, role_id, resource, action)
SELECT 'perm_' || lower(hex(randomblob(8))), 'role_owner', r.resource, a.action
FROM (SELECT 'content' AS resource UNION SELECT 'commerce' UNION SELECT 'customers' UNION SELECT 'oem' UNION SELECT 'media' UNION SELECT 'ai' UNION SELECT 'growth' UNION SELECT 'system') r
CROSS JOIN (SELECT 'view' AS action UNION SELECT 'create' UNION SELECT 'edit' UNION SELECT 'publish' UNION SELECT 'delete' UNION SELECT 'export' UNION SELECT 'execute_ai' UNION SELECT 'approve_ai' UNION SELECT 'manage_settings') a;

-- DOWN
DROP TABLE IF EXISTS admin_permissions;
DROP TABLE IF EXISTS admin_users;
DROP TABLE IF EXISTS admin_roles;
```

### 0050: 审计日志

```sql
-- UP
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT,
  action TEXT NOT NULL,           -- 'create' | 'update' | 'delete' | 'publish' | 'approve_ai' | 'reject_ai' | 'login' | 'logout'
  resource_type TEXT NOT NULL,    -- 'content' | 'product' | 'order' | 'customer' | 'inquiry' | 'oem_project' | 'video' | ...
  resource_id TEXT,
  resource_title TEXT,
  before_state TEXT,              -- JSON snapshot before
  after_state TEXT,               -- JSON snapshot after
  change_summary TEXT,            -- human-readable summary
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- DOWN
DROP TABLE IF EXISTS audit_logs;
```

### 0051: 内容版本

```sql
-- UP
CREATE TABLE content_versions (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,      -- 'blog' | 'product_content' | 'guide' | 'case_study' | 'faq' | 'copy_asset'
  entity_key TEXT NOT NULL,       -- content key/slug
  locale TEXT NOT NULL DEFAULT 'en',
  version INTEGER NOT NULL,
  author TEXT NOT NULL,           -- 'human:<username>' | 'ai:<role_name>'
  source TEXT,                    -- 'manual_edit' | 'ai_generate' | 'ai_translate' | 'publish' | 'rollback'
  change_summary TEXT,
  github_commit_sha TEXT,         -- 对应 GitHub commit SHA（回滚用，ADR-11）
  rollback_to_version_id TEXT,    -- 回滚时记录「回滚到哪个版本」（版本链可追溯）
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_content_versions_entity ON content_versions(entity_type, entity_key, locale);
CREATE INDEX idx_content_versions_created ON content_versions(created_at);

-- DOWN
DROP TABLE IF EXISTS content_versions;
```

### 0054: 软删除列（逐表 ALTER）

```sql
-- UP (example for commerce_products)
ALTER TABLE commerce_products ADD COLUMN deleted_at DATETIME;
ALTER TABLE commerce_products ADD COLUMN deleted_by TEXT;
ALTER TABLE commerce_products ADD COLUMN created_by TEXT;
ALTER TABLE commerce_products ADD COLUMN updated_by TEXT;
ALTER TABLE commerce_products ADD COLUMN version INTEGER DEFAULT 1;

-- 对其他表重复类似 ALTER:
-- commerce_orders
-- video_media
-- video_content
-- growth_opportunities
-- growth_actions
-- 等等（在 Phase 0 P0-4 完成后确定精确清单）

-- DOWN
ALTER TABLE commerce_products DROP COLUMN deleted_at;
ALTER TABLE commerce_products DROP COLUMN deleted_by;
ALTER TABLE commerce_products DROP COLUMN created_by;
ALTER TABLE commerce_products DROP COLUMN updated_by;
ALTER TABLE commerce_products DROP COLUMN version;
-- [IRREVERSIBLE WARNING]: DROP COLUMN 会丢失数据。执行 DOWN 前确认无依赖。
```

### ~~0053: 回收站~~ → 已取消（ADR-12）

> **ADR-12 裁决**：不建独立 recycle_bin 表。回收站 UI 直接查源表 `WHERE deleted_at IS NOT NULL`。
> 原因：deleted_at 列已实现软删除，独立表是双重标记（双写不一致源）。
> Migration 0053 编号保留但跳过（不使用）。

### 0055: 文案资产（13 类型 × 多语言 × 多版本）

```sql
-- UP
CREATE TABLE copy_assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                     -- 文案名称
  type TEXT NOT NULL,                     -- 'product_title' | 'product_bullets' | 'product_description' |
                                          -- 'seo_title' | 'seo_description' | 'ad_copy' | 'social_media' |
                                          -- 'video_title' | 'video_description' | 'faq' | 'cta' |
                                          -- 'oem_copy' | 'email_template'
  locale TEXT NOT NULL DEFAULT 'en',      -- 'en' | 'es' | 'de'
  linked_entity_type TEXT,                -- 'commerce_product' | 'content_blog' | 'video_asset' | 'oem_project' | NULL
  linked_entity_id TEXT,
  current_body TEXT NOT NULL,             -- 当前文案正文
  status TEXT NOT NULL DEFAULT 'draft',   -- 'draft' | 'reviewed' | 'published' | 'archived'
  created_by_source TEXT NOT NULL,        -- 'human:<username>' | 'ai:<role_name>'
  ai_role_used TEXT,                      -- 如果是 AI 生成，记录使用的 role
  ai_model_used TEXT,                     -- 如果是 AI 生成，记录使用的 model
  ai_cost_cents INTEGER DEFAULT 0,        -- 如果是 AI 生成，记录 token 成本
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  deleted_by TEXT
);

CREATE INDEX idx_copy_assets_type ON copy_assets(type, locale);
CREATE INDEX idx_copy_assets_linked ON copy_assets(linked_entity_type, linked_entity_id);

-- V2 §10 要求每条文案有独立版本，复用 copy_versions (0052)
-- 每次编辑/AI重写→createVersion()→INSERT copy_versions

-- DOWN
DROP TABLE IF EXISTS copy_assets;
```

### 0056: 客户档案

```sql
-- UP
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  country TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  source TEXT,                    -- 'inquiry' | 'manual' | 'import'
  tags TEXT,                      -- JSON array
  notes TEXT,
  total_inquiries INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_oem_projects INTEGER DEFAULT 0,
  total_revenue_cents INTEGER DEFAULT 0,
  lead_score INTEGER,
  ai_summary TEXT,
  last_contact_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  deleted_by TEXT
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_country ON customers(country);

-- DOWN
DROP TABLE IF EXISTS customers;
```

### 0057: OEM 项目核心表

```sql
-- UP
CREATE TABLE oem_projects (
  id TEXT PRIMARY KEY,
  project_code TEXT NOT NULL UNIQUE,  -- OEM-2026-0001
  customer_id TEXT REFERENCES customers(id),
  name TEXT NOT NULL,
  product_type TEXT,
  quantity INTEGER,
  target_moq INTEGER,
  current_stage TEXT NOT NULL DEFAULT 'lead',  -- lead|requirement|sampling|quotation|negotiation|production|shipping|completed|lost
  estimated_amount_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  assigned_to TEXT,
  ai_score INTEGER,
  ai_notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  deleted_by TEXT
);

CREATE TABLE oem_requirements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES oem_projects(id),
  requirement_type TEXT,          -- 'formula' | 'fragrance' | 'packaging' | 'certification' | 'labeling' | 'other'
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'normal', -- 'critical' | 'high' | 'normal' | 'low'
  status TEXT DEFAULT 'pending',  -- 'pending' | 'in_progress' | 'resolved'
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE oem_samples (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES oem_projects(id),
  sample_name TEXT,
  quantity INTEGER,
  status TEXT DEFAULT 'requested', -- 'requested' | 'in_production' | 'shipped' | 'received' | 'approved' | 'rejected'
  tracking_number TEXT,
  shipped_at DATETIME,
  received_at DATETIME,
  feedback TEXT,
  cost_cents INTEGER,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- DOWN
DROP TABLE IF EXISTS oem_samples;
DROP TABLE IF EXISTS oem_requirements;
DROP TABLE IF EXISTS oem_projects;
```

---

### 0064: admin_entities（Search Index — INV-1）

> **INV-1 架构不变量**：admin_entities 是 Search Index，不是 Domain Model。
> 不拥有业务真相。不允许承载业务字段。
> 字段上限：entity_type, entity_id, title, status, updated_at。永不加列。

```sql
-- UP
CREATE TABLE admin_entities (
  entity_type TEXT NOT NULL,      -- 'blog' | 'product_content' | 'commerce_product' | 'customer' | 'inquiry' | 'oem_project' | 'video' | 'copy_asset'
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX idx_admin_entities_status ON admin_entities(status);
CREATE INDEX idx_admin_entities_updated ON admin_entities(updated_at);

-- Seed: Phase 2 migration 后一次性脚本从各源表填充
-- 同步: 每个 V2 API handler 在写操作成功后调用 syncAdminEntity()

-- DOWN
DROP TABLE IF EXISTS admin_entities;
```

### 0065: 废弃旧表清理（Phase 14 执行）

```sql
-- ⚠️ [IRREVERSIBLE] 永久删除以下 8 张表及其全部数据。
-- 执行前必须逐表确认：
--   ① 无 API 仍读取  ② cron 不写入  ③ 有价值数据已迁移  ④ 本地 D1 备份已导出

-- UP
DROP TABLE IF EXISTS knowledge_base;
DROP TABLE IF EXISTS daily_recs;
DROP TABLE IF EXISTS experiments;
DROP TABLE IF EXISTS ai_opportunities;
DROP TABLE IF EXISTS ai_daily_briefs;
DROP TABLE IF EXISTS ai_usage;
DROP TABLE IF EXISTS ai_reports;
DROP TABLE IF EXISTS decisions;

-- DOWN
-- [IRREVERSIBLE] 无法恢复。需要从备份手动恢复。
```

---

## 4. 数据迁移脚本

### 4.1 KV Drafts → content_versions（Phase 4 可选迁移）

```
目的: 将 KV 中的历史草稿快照到 content_versions 表
时机: Phase 4 内容中心完成后，可选执行
方式: D1 batch 读取 KV keys → 写入 content_versions
风险: 低（纯追加，不删除 KV 数据）
```

### 4.2 GitHub Commit History → content_versions（长期可选）

```
目的: 用 GitHub API 拉取历史 commit 作为初始版本记录
时机: Phase 14 后可考虑
方式: 逐文件拉取 commit history → 解析 MD → 写入 content_versions
风险: GitHub API rate limit（不紧急，可延后）
```

### 4.3 单用户 → admin_users 迁移（Phase 2 自动）

```
目的: V2 启动时自动创建默认 Owner 用户
方式: 首次访问 V2 时检测 admin_users 为空 → seed Owner 用户
      密码使用环境变量 ADMIN_PASSWORD（与 V1 共享）
SQL: 见 0049 seed data
```

---

## 5. 回滚策略

### 每张新表的回滚

| 表 | 回滚方式 | 风险 |
|----|---------|------|
| admin_users/roles/permissions | DROP TABLE | 低（Phase 2 初期无真实用户数据） |
| audit_logs | DROP TABLE | 低（审计日志可丢弃） |
| content_versions | DROP TABLE | 低（初期版本记录可丢弃） |
| ~~recycle_bin~~ | — | 已取消（ADR-12） |
| customers | DROP TABLE | 中（如果有客户数据写入则丢失） |
| oem_* 系列 | DROP TABLE | 高（业务数据丢失不可接受，Phase 6 后禁止回滚） |
| soft delete 列 | DROP COLUMN | ⚠️ 数据丢失，仅紧急情况 |

### 回滚触发条件
- Migration 执行失败（语法错误 / 冲突）
- 发现严重数据损坏
- 性能严重退化

### 回滚流程
1. 确认回滚 migration 经 review
2. 备份被影响数据到 JSON 文件
3. 执行 DOWN migration
4. 验证系统可用

---

## 6. 不可逆 Migration 标记

| Migration | 不可逆部分 | 原因 |
|-----------|----------|------|
| 0054 (soft delete ALTER) | DROP COLUMN | D1 不支持事务回滚 DDL，列数据永久丢失 |
| 0057-0058 (OEM tables) | Phase 6 后 DROP TABLE | 业务数据不可恢复 |

---

## 7. 执行清单

```
Phase 2:
  □ 0049: RBAC 表
  □ 0050: audit_logs
  □ 0051: content_versions
  □ 0064: admin_entities（统一对象注册表）

Phase 4:
  □ 0052: copy_versions
  □ 0053: recycle_bin
  □ 0054: soft delete columns (逐表)
  □ 0055: copy_assets

Phase 5:
  □ 0063: saved_calculations

Phase 6:
  □ 0056: customers
  □ 0057: oem_projects, oem_requirements, oem_samples
  □ 0058: oem_quotes, oem_files, oem_timeline
  □ ~~0059: entity_links~~（已取消，ADR-13）

Phase 7:
  □ 0061: ai_automation_rules
  □ 0062: ai_tasks

Phase 10:
  □ 0060: notifications

Phase 14:
  □ 0065: deprecated_tables_cleanup（DROP 8 张废弃表）
```

---

*本文基于 V2 设计规范 §48 + 审计报告 P0-4。DDL 为初步设计，具体列名和约束在开发 Phase 时基于现有表结构精确确定。*