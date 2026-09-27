-- 0044: stable 6-digit human-reference numbers for commerce product images.
-- Owner workflow (2026-08-22): spot a missed Chinese image on the storefront,
-- open the product in admin, read its image number, process it manually.
-- Keyed by URL so the same asset keeps one number across products; the
-- gallery JSON shape (array of URL strings) stays untouched.
CREATE TABLE IF NOT EXISTS commerce_image_nos (
  url TEXT PRIMARY KEY,
  image_no INTEGER NOT NULL UNIQUE
);
