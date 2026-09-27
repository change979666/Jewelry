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
INSERT OR IGNORE INTO admin_roles (id, name, description) VALUES
('role_owner',  'Owner',  'Full access, including settings and member management'),
('role_admin',  'Admin',  'Manage content, commerce and customers'),
('role_editor', 'Editor', 'Create/edit content and products, no settings'),
('role_viewer', 'Viewer', 'Read-only access');

-- Resource/action matrix used by functions/lib/admin/rbac.ts.
-- Resources: content | commerce | customers | oem | media | ai | growth | system
-- Actions: view | create | edit | publish | delete | export | execute_ai | approve_ai | manage_settings

-- Owner: everything
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action)
SELECT 'role_owner', r.resource, a.action
FROM (SELECT 'content' AS resource UNION SELECT 'commerce' UNION SELECT 'customers'
      UNION SELECT 'oem' UNION SELECT 'media' UNION SELECT 'ai' UNION SELECT 'growth'
      UNION SELECT 'system') r
CROSS JOIN (SELECT 'view' AS action UNION SELECT 'create' UNION SELECT 'edit'
            UNION SELECT 'publish' UNION SELECT 'delete' UNION SELECT 'export'
            UNION SELECT 'execute_ai' UNION SELECT 'approve_ai' UNION SELECT 'manage_settings') a;

-- Admin: everything except member/settings management
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action)
SELECT 'role_admin', r.resource, a.action
FROM (SELECT 'content' AS resource UNION SELECT 'commerce' UNION SELECT 'customers'
      UNION SELECT 'oem' UNION SELECT 'media' UNION SELECT 'ai' UNION SELECT 'growth'
      UNION SELECT 'system') r
CROSS JOIN (SELECT 'view' AS action UNION SELECT 'create' UNION SELECT 'edit'
            UNION SELECT 'publish' UNION SELECT 'delete' UNION SELECT 'export'
            UNION SELECT 'execute_ai' UNION SELECT 'approve_ai') a;

-- Editor: content + commerce + media, no delete/export/AI approve
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action)
SELECT 'role_editor', r.resource, a.action
FROM (SELECT 'content' AS resource UNION SELECT 'commerce' UNION SELECT 'media') r
CROSS JOIN (SELECT 'view' AS action UNION SELECT 'create' UNION SELECT 'edit'
            UNION SELECT 'publish' UNION SELECT 'execute_ai') a;

-- Viewer: view everything
INSERT OR IGNORE INTO admin_permissions (role_id, resource, action)
SELECT 'role_viewer', r.resource, 'view'
FROM (SELECT 'content' AS resource UNION SELECT 'commerce' UNION SELECT 'customers'
      UNION SELECT 'oem' UNION SELECT 'media' UNION SELECT 'ai' UNION SELECT 'growth'
      UNION SELECT 'system') r;
