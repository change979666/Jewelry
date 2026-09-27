-- Jewelry — Promotions & Coupons (schema + pricing boundary only for V1.0)
-- Checkout applies promotions ONLY through the pricing service; Order Core stays unchanged.

CREATE TABLE IF NOT EXISTS promotions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- percentage | fixed | free_shipping | bundle | gift
    value INTEGER,      -- minor units (fixed) or basis points (percentage: 1000 = 10%)
    currency TEXT,
    status TEXT DEFAULT 'draft', -- draft | active | archived
    min_subtotal INTEGER,        -- minor units
    starts_at DATETIME,
    ends_at DATETIME,
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    promotion_id TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- active | disabled
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
