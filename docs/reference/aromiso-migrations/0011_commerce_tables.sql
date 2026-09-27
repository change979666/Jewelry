-- Aromiso Commerce V1 — Ready-to-Ship B2B Commerce
-- Independent commerce tables, separate from existing CMS/inquiry system.

-- Products (stock items for the shop)
CREATE TABLE IF NOT EXISTS commerce_products (
  id TEXT PRIMARY KEY,
  product_key TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  short_description TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  cover_image TEXT NOT NULL DEFAULT '',
  gallery TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  moq INTEGER NOT NULL DEFAULT 1,
  stock_status TEXT NOT NULL DEFAULT 'in_stock',
  lead_time TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'pcs',
  weight REAL,
  certifications TEXT NOT NULL DEFAULT '[]',
  oem_available INTEGER NOT NULL DEFAULT 1,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_product_key TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_commerce_products_status ON commerce_products(status);
CREATE INDEX IF NOT EXISTS idx_commerce_products_category ON commerce_products(category);
CREATE INDEX IF NOT EXISTS idx_commerce_products_slug ON commerce_products(slug);

-- Product variants (SKU / size / scent options)
CREATE TABLE IF NOT EXISTS commerce_product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  options_json TEXT NOT NULL DEFAULT '{}',
  image TEXT NOT NULL DEFAULT '',
  stock INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_commerce_variants_product ON commerce_product_variants(product_id);

-- Price tiers (quantity-based pricing)
CREATE TABLE IF NOT EXISTS commerce_price_tiers (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES commerce_product_variants(id) ON DELETE CASCADE,
  min_qty INTEGER NOT NULL DEFAULT 1,
  max_qty INTEGER,
  unit_price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_commerce_prices_product ON commerce_price_tiers(product_id);
CREATE INDEX IF NOT EXISTS idx_commerce_prices_variant ON commerce_price_tiers(variant_id);

-- Orders
CREATE TABLE IF NOT EXISTS commerce_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal REAL NOT NULL DEFAULT 0,
  shipping_cost REAL,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  source_type TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_product_id TEXT NOT NULL DEFAULT '',
  source_category TEXT NOT NULL DEFAULT '',
  customer_note TEXT NOT NULL DEFAULT '',
  admin_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_commerce_orders_status ON commerce_orders(status);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_created ON commerce_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_email ON commerce_orders(email);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_number ON commerce_orders(order_number);

-- Order items (snapshot of product data at time of order)
CREATE TABLE IF NOT EXISTS commerce_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL DEFAULT '',
  variant_id TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  variant_name TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_commerce_order_items_order ON commerce_order_items(order_id);

-- Order events (status change timeline)
CREATE TABLE IF NOT EXISTS commerce_order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL DEFAULT '',
  to_status TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_commerce_order_events_order ON commerce_order_events(order_id);

-- Commerce settings (key-value store)
CREATE TABLE IF NOT EXISTS commerce_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Seed default settings
INSERT OR IGNORE INTO commerce_settings (key, value) VALUES ('default_currency', 'USD');
INSERT OR IGNORE INTO commerce_settings (key, value) VALUES ('order_notification_email', 'sales@aromiso.com');
INSERT OR IGNORE INTO commerce_settings (key, value) VALUES ('enable_shop', '1');
INSERT OR IGNORE INTO commerce_settings (key, value) VALUES ('enable_cart', '1');
INSERT OR IGNORE INTO commerce_settings (key, value) VALUES ('enable_crisp', '1');
