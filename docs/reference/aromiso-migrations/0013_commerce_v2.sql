-- Aromiso Commerce V2 — Product detail page fields + Reviews/Q&A

-- Extended product fields for B2B product page
ALTER TABLE commerce_products ADD COLUMN key_features TEXT NOT NULL DEFAULT '[]';
ALTER TABLE commerce_products ADD COLUMN specifications TEXT NOT NULL DEFAULT '{}';
ALTER TABLE commerce_products ADD COLUMN materials TEXT NOT NULL DEFAULT '';
ALTER TABLE commerce_products ADD COLUMN fragrance_options TEXT NOT NULL DEFAULT '[]';
ALTER TABLE commerce_products ADD COLUMN packaging_options TEXT NOT NULL DEFAULT '[]';
ALTER TABLE commerce_products ADD COLUMN application TEXT NOT NULL DEFAULT '[]';
ALTER TABLE commerce_products ADD COLUMN shipping_info TEXT NOT NULL DEFAULT '{}';
ALTER TABLE commerce_products ADD COLUMN sample_available INTEGER NOT NULL DEFAULT 1;
ALTER TABLE commerce_products ADD COLUMN private_label INTEGER NOT NULL DEFAULT 1;
ALTER TABLE commerce_products ADD COLUMN product_highlights TEXT NOT NULL DEFAULT '[]';
ALTER TABLE commerce_products ADD COLUMN faq TEXT NOT NULL DEFAULT '[]';
ALTER TABLE commerce_products ADD COLUMN seo_title TEXT NOT NULL DEFAULT '';
ALTER TABLE commerce_products ADD COLUMN seo_description TEXT NOT NULL DEFAULT '';
ALTER TABLE commerce_products ADD COLUMN completeness INTEGER NOT NULL DEFAULT 0;

-- Product reviews (real buyer reviews only)
CREATE TABLE IF NOT EXISTS commerce_product_reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES commerce_orders(id) ON DELETE SET NULL,
  reviewer_name TEXT NOT NULL DEFAULT '',
  reviewer_email TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 5,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  verified_buyer INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON commerce_product_reviews(product_id, status);

-- Product Q&A
CREATE TABLE IF NOT EXISTS commerce_product_questions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
  question TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  asker_name TEXT NOT NULL DEFAULT '',
  asker_email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  answered_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_questions_product ON commerce_product_questions(product_id, status);
