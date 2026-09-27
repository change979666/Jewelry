-- Jewelry Admin V2 — RBAC schema
-- Tables expected by functions/lib/admin/rbac.ts:
--   admin_users(id, username, password_hash, role_id, status, last_login_at)
--   admin_roles(id, name)
--   admin_permissions(role_id, resource, action)

CREATE TABLE IF NOT EXISTS admin_roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_permissions (
    role_id TEXT NOT NULL,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    PRIMARY KEY (role_id, resource, action),
    FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- active | disabled
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES admin_roles(id)
);

-- Seed roles
INSERT OR IGNORE INTO admin_roles (id, name, description) VALUES ('role_owner',  'Owner',  'Full access, including settings and member management');
INSERT OR IGNORE INTO admin_roles (id, name, description) VALUES ('role_admin',  'Admin',  'Manage content, commerce and customers');
INSERT OR IGNORE INTO admin_roles (id, name, description) VALUES ('role_editor', 'Editor', 'Create/edit content and products, no settings');
INSERT OR IGNORE INTO admin_roles (id, name, description) VALUES ('role_viewer', 'Viewer', 'Read-only access');

-- Permission matrix consumed by src/lib/admin/rbac.ts.
-- Resources: content | commerce | customers | shipping | media | ai | growth | system
-- ('shipping' replaced the Aromiso-era 'oem' resource; see migration 0010.)
-- Actions:   view | create | edit | publish | delete | export | execute_ai | approve_ai | manage_settings
--
-- IMPORTANT (workerd constraint, verified 2026-09-27): the local D1 runtime
-- rejects multi-row VALUES lists and UNION/CROSS JOIN row-set construction with
-- "too many terms in compound SELECT: SQLITE_ERROR". Each grant is therefore
-- written as an independent single-row INSERT. Do NOT re-compress these into
-- VALUES (..),(..) batches — migrations will fail on `wrangler d1 migrations apply`.

-- Owner: full access — 8 resources x 9 actions = 72 grants
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'content', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'content', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'content', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'content', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'content', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'content', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'content', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'content', 'approve_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'content', 'manage_settings');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'commerce', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'commerce', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'commerce', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'commerce', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'commerce', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'commerce', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'commerce', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'commerce', 'approve_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'commerce', 'manage_settings');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'customers', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'customers', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'customers', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'customers', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'customers', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'customers', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'customers', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'customers', 'approve_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'customers', 'manage_settings');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'shipping', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'shipping', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'shipping', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'shipping', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'shipping', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'shipping', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'shipping', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'shipping', 'approve_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'shipping', 'manage_settings');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'media', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'media', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'media', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'media', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'media', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'media', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'media', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'media', 'approve_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'media', 'manage_settings');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'ai', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'ai', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'ai', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'ai', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'ai', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'ai', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'ai', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'ai', 'approve_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'ai', 'manage_settings');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'growth', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'growth', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'growth', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'growth', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'growth', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'growth', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'growth', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'growth', 'approve_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'growth', 'manage_settings');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'system', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'system', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'system', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'system', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'system', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'system', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'system', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'system', 'approve_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_owner', 'system', 'manage_settings');

-- Admin: all resources, no settings/member management — 8 resources x 8 actions = 64 grants
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'content', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'content', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'content', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'content', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'content', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'content', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'content', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'content', 'approve_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'commerce', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'commerce', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'commerce', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'commerce', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'commerce', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'commerce', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'commerce', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'commerce', 'approve_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'customers', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'customers', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'customers', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'customers', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'customers', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'customers', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'customers', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'customers', 'approve_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'shipping', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'shipping', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'shipping', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'shipping', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'shipping', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'shipping', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'shipping', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'shipping', 'approve_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'media', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'media', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'media', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'media', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'media', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'media', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'media', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'media', 'approve_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'ai', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'ai', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'ai', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'ai', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'ai', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'ai', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'ai', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'ai', 'approve_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'growth', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'growth', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'growth', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'growth', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'growth', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'growth', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'growth', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'growth', 'approve_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'system', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'system', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'system', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'system', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'system', 'delete');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'system', 'export');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'system', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_admin', 'system', 'approve_ai');

-- Editor: content/commerce/media, no delete/export/approve_ai — 3 resources x 5 actions = 15 grants
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_editor', 'content', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_editor', 'content', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_editor', 'content', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_editor', 'content', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_editor', 'content', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_editor', 'commerce', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_editor', 'commerce', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_editor', 'commerce', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_editor', 'commerce', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_editor', 'commerce', 'execute_ai');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_editor', 'media', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_editor', 'media', 'create');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_editor', 'media', 'edit');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_editor', 'media', 'publish');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_editor', 'media', 'execute_ai');

-- Viewer: read-only — 8 resources x 1 actions = 8 grants
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_viewer', 'content', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_viewer', 'commerce', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_viewer', 'customers', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_viewer', 'shipping', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_viewer', 'media', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_viewer', 'ai', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_viewer', 'growth', 'view');
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action) VALUES ('role_viewer', 'system', 'view');

-- Total grants seeded: 159
