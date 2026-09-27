-- Jewelry Commerce Core V1 Migration

CREATE TABLE IF NOT EXISTS markets (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE, -- e.g. KSA, UAE
    currency TEXT NOT NULL,
    locale TEXT NOT NULL,
    tax_rate REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    sku TEXT UNIQUE,
    title TEXT NOT NULL,
    short_description TEXT,
    description TEXT,
    status TEXT DEFAULT 'draft', -- draft, active, archived
    product_type TEXT,
    brand TEXT,
    
    -- Facts
    material TEXT,
    base_material TEXT,
    plating TEXT,
    color TEXT,
    dimensions TEXT,
    weight TEXT,
    care_instructions TEXT,
    size_info TEXT,
    country_of_origin TEXT,
    
    -- SEO
    seo_title TEXT,
    seo_description TEXT,
    canonical_url TEXT,
    og_title TEXT,
    og_description TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published_at DATETIME
);

CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    sku TEXT UNIQUE,
    option_values TEXT, -- JSON array of option values
    price INTEGER NOT NULL, -- integer minor units
    compare_at_price INTEGER,
    currency TEXT NOT NULL,
    inventory_quantity INTEGER DEFAULT 0,
    inventory_policy TEXT DEFAULT 'deny', -- deny, continue
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_media (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    type TEXT NOT NULL, -- hero, gallery, detail, model, lifestyle, packaging
    url TEXT NOT NULL,
    alt TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active', -- draft, active, archived
    sort_order INTEGER DEFAULT 0,
    seo_title TEXT,
    seo_description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collection_products (
    collection_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY(collection_id, product_id),
    FOREIGN KEY(collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    phone TEXT,
    first_name TEXT,
    last_name TEXT,
    locale TEXT,
    market TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_addresses (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    district TEXT,
    address_line_1 TEXT,
    address_line_2 TEXT,
    postal_code TEXT,
    additional_info TEXT,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS carts (
    id TEXT PRIMARY KEY,
    customer_id TEXT, -- null for anonymous cart
    session_id TEXT,
    currency TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    cart_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(cart_id) REFERENCES carts(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(variant_id) REFERENCES product_variants(id)
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    customer_id TEXT, -- nullable for guest checkout
    session_id TEXT,
    market TEXT,
    currency TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    discount_amount INTEGER DEFAULT 0,
    shipping_amount INTEGER DEFAULT 0,
    tax_amount INTEGER DEFAULT 0,
    total_amount INTEGER NOT NULL,
    
    order_status TEXT DEFAULT 'PENDING_CONFIRMATION',
    payment_status TEXT DEFAULT 'PENDING',
    fulfillment_status TEXT DEFAULT 'UNFULFILLED',
    delivery_status TEXT DEFAULT 'PENDING',
    confirmation_status TEXT DEFAULT 'UNCONFIRMED',
    
    -- Gifts & Personalization
    gift_wrap INTEGER DEFAULT 0,
    gift_message TEXT,
    gift_box INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT,
    variant_id TEXT,
    sku TEXT,
    title TEXT,
    unit_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    line_total INTEGER NOT NULL,
    product_snapshot TEXT, -- JSON representation of product at time of order
    
    personalization_type TEXT,
    personalization_value TEXT,
    
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_addresses (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    type TEXT NOT NULL, -- shipping, billing
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    district TEXT,
    address_line_1 TEXT,
    address_line_2 TEXT,
    postal_code TEXT,
    additional_info TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_events (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    status TEXT NOT NULL, -- e.g., PENDING_CONFIRMATION, CONFIRMED, PROCESSING, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, DELIVERY_FAILED, NDR, RTO
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    provider TEXT NOT NULL, -- cod, stripe, tabby, etc.
    provider_reference TEXT,
    checkout_reference TEXT,
    status TEXT DEFAULT 'pending',
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    provider TEXT, -- manual, imile, aramex
    carrier TEXT,
    tracking_number TEXT,
    tracking_url TEXT,
    status TEXT DEFAULT 'pending',
    shipped_at DATETIME,
    delivered_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shipment_events (
    id TEXT PRIMARY KEY,
    shipment_id TEXT NOT NULL,
    status TEXT NOT NULL,
    description TEXT,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bundles (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    bundle_price INTEGER NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bundle_items (
    bundle_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    PRIMARY KEY(bundle_id, product_id),
    FOREIGN KEY(bundle_id) REFERENCES bundles(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Seed initial markets
INSERT OR IGNORE INTO markets (id, code, currency, locale, tax_rate) VALUES
('market_ksa', 'KSA', 'SAR', 'ar-SA', 0.15),
('market_uae', 'UAE', 'AED', 'en-AE', 0.05);

-- Seed basic collections
INSERT OR IGNORE INTO collections (id, slug, name) VALUES
('col_everyday', 'everyday', 'Everyday'),
('col_gulf_design', 'gulf-design', 'Gulf Design'),
('col_gift', 'gift', 'Gift'),
('col_statement', 'statement', 'Statement');
