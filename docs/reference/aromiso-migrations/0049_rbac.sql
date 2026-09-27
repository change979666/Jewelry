-- 0049: Phase 2 RBAC — admin_users, admin_roles, admin_permissions
-- V2 ADR: 4 roles (Owner/Admin/Editor/Viewer), server-side RBAC enforcement
-- Phase 2 only. Business FK (ADR-17) deferred to Phase 6.
-- Rollback: DROP TABLE (reversible in Phase 2; irreversible after user data exists)

-- UP ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES admin_roles(id),
  status TEXT NOT NULL DEFAULT 'active',  -- active | disabled
  last_login_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES admin_roles(id),
  resource TEXT NOT NULL,   -- 'content' | 'commerce' | 'customers' | 'oem' | 'media' | 'ai' | 'growth' | 'system'
  action TEXT NOT NULL,     -- 'view' | 'create' | 'edit' | 'publish' | 'delete' | 'export' | 'execute_ai' | 'approve_ai' | 'manage_settings'
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, resource, action)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role_id);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_role ON admin_permissions(role_id);

-- Seed: 4 roles (Owner, Admin, Editor, Viewer)
INSERT OR IGNORE INTO admin_roles (id, name, description) VALUES ('role_owner',    'Owner',     'Full access to all modules and system settings');
INSERT OR IGNORE INTO admin_roles (id, name, description) VALUES ('role_admin',    'Admin',     'Content, commerce, customer management');
INSERT OR IGNORE INTO admin_roles (id, name, description) VALUES ('role_editor',   'Editor',    'Content creation and editing only');
INSERT OR IGNORE INTO admin_roles (id, name, description) VALUES ('role_viewer',   'Viewer',    'Read-only access to reports and data');

-- Seed: Owner = all permissions (8 resources × 9 actions = 72 rows)
INSERT OR IGNORE INTO admin_permissions (id, role_id, resource, action)
SELECT 'perm_own_' || r.resource || '_' || a.action, 'role_owner', r.resource, a.action
FROM (
  SELECT 'content'   AS resource UNION SELECT 'commerce' UNION SELECT 'customers'
  UNION SELECT 'oem' UNION SELECT 'media' UNION SELECT 'ai' UNION SELECT 'growth' UNION SELECT 'system'
) r
CROSS JOIN (
  SELECT 'view' AS action UNION SELECT 'create' UNION SELECT 'edit' UNION SELECT 'publish'
  UNION SELECT 'delete' UNION SELECT 'export' UNION SELECT 'execute_ai' UNION SELECT 'approve_ai' UNION SELECT 'manage_settings'
) a;

-- Seed: Admin = content + commerce + customers + media (8 actions, no manage_settings)
INSERT OR IGNORE INTO admin_permissions (id, role_id, resource, action)
SELECT 'perm_adm_' || r.resource || '_' || a.action, 'role_admin', r.resource, a.action
FROM (
  SELECT 'content' AS resource UNION SELECT 'commerce' UNION SELECT 'customers' UNION SELECT 'media' UNION SELECT 'ai' UNION SELECT 'growth'
) r
CROSS JOIN (
  SELECT 'view' AS action UNION SELECT 'create' UNION SELECT 'edit' UNION SELECT 'publish'
  UNION SELECT 'delete' UNION SELECT 'export' UNION SELECT 'execute_ai' UNION SELECT 'approve_ai'
) a;

-- Seed: Editor = content + media (view, create, edit only — no publish, no delete, no export)
INSERT OR IGNORE INTO admin_permissions (id, role_id, resource, action)
SELECT 'perm_edt_' || r.resource || '_' || a.action, 'role_editor', r.resource, a.action
FROM (
  SELECT 'content' AS resource UNION SELECT 'media'
) r
CROSS JOIN (
  SELECT 'view' AS action UNION SELECT 'create' UNION SELECT 'edit'
) a;

-- Seed: Viewer = view only on content, commerce, customers, media, growth
INSERT OR IGNORE INTO admin_permissions (id, role_id, resource, action)
SELECT 'perm_vwr_' || r.resource || '_view', 'role_viewer', r.resource, 'view'
FROM (
  SELECT 'content' AS resource UNION SELECT 'commerce' UNION SELECT 'customers' UNION SELECT 'media' UNION SELECT 'growth'
) r;

-- DOWN ----------------------------------------------------------------------

-- WARNING: DROP destroys all user/role/permission data. Only run in Phase 2
-- when no real user data exists yet. After Phase 2, rollback = restore from backup.
DROP TABLE IF EXISTS admin_permissions;
DROP TABLE IF EXISTS admin_users;
DROP TABLE IF EXISTS admin_roles;