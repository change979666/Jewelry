-- Jewelry — Reviews (schema + service boundary; UI automation comes later)

CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    customer_id TEXT,
    order_id TEXT,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title TEXT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending | approved | rejected
    verified_purchase INTEGER DEFAULT 0,
    locale TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_status ON reviews(product_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);
