-- Migration 0069: Customer & OEM tables
-- Phase 6: Customer Center + OEM Project Center

-- Customer profiles (unified from inquiries + orders)
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  lead_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at);

-- Link inquiries to customers
ALTER TABLE inquiries ADD COLUMN customer_id TEXT;

-- OEM Projects
CREATE TABLE IF NOT EXISTS oem_projects (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  project_name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'inquiry',
  stage TEXT NOT NULL DEFAULT 'inquiry',
  priority TEXT NOT NULL DEFAULT 'normal',
  estimated_volume INTEGER,
  target_price REAL,
  currency TEXT NOT NULL DEFAULT 'USD',
  start_date TEXT,
  target_date TEXT,
  assigned_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  deleted_by TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_oem_projects_customer ON oem_projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_oem_projects_status ON oem_projects(status);
CREATE INDEX IF NOT EXISTS idx_oem_projects_stage ON oem_projects(stage);
CREATE INDEX IF NOT EXISTS idx_oem_projects_deleted ON oem_projects(deleted_at);

-- OEM Requirements
CREATE TABLE IF NOT EXISTS oem_requirements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  specification TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES oem_projects(id)
);

CREATE INDEX IF NOT EXISTS idx_oem_req_project ON oem_requirements(project_id);

-- OEM Samples
CREATE TABLE IF NOT EXISTS oem_samples (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  sample_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested',
  tracking_number TEXT NOT NULL DEFAULT '',
  cost REAL,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT NOT NULL DEFAULT '',
  requested_at TEXT,
  shipped_at TEXT,
  received_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES oem_projects(id)
);

CREATE INDEX IF NOT EXISTS idx_oem_samples_project ON oem_samples(project_id);

-- OEM Quotes
CREATE TABLE IF NOT EXISTS oem_quotes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  unit_price REAL,
  tooling_cost REAL,
  sample_cost REAL,
  shipping_cost REAL,
  moq INTEGER,
  lead_time_days INTEGER,
  payment_terms TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'USD',
  valid_until TEXT,
  sent_at TEXT,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  FOREIGN KEY (project_id) REFERENCES oem_projects(id)
);

CREATE INDEX IF NOT EXISTS idx_oem_quotes_project ON oem_quotes(project_id);
CREATE INDEX IF NOT EXISTS idx_oem_quotes_status ON oem_quotes(status);

-- OEM Files
CREATE TABLE IF NOT EXISTS oem_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',
  file_type TEXT NOT NULL DEFAULT '',
  file_size INTEGER,
  category TEXT NOT NULL DEFAULT 'general',
  uploaded_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES oem_projects(id)
);

CREATE INDEX IF NOT EXISTS idx_oem_files_project ON oem_files(project_id);

-- OEM Timeline
CREATE TABLE IF NOT EXISTS oem_timeline (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES oem_projects(id)
);

CREATE INDEX IF NOT EXISTS idx_oem_timeline_project ON oem_timeline(project_id);
