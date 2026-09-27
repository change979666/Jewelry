-- 0008_jewelry_seed.sql — DEMO FIXTURE, NOT PRODUCTION CATALOG DATA
--
-- WARNING: fixture/demo only — DO NOT ship to production as-is.
--   These 8 rows exist to exercise the full cart -> checkout -> order -> admin
--   loop on a fresh database. Replace them with the real 20-30 SKU list
--   (verified supplier cost, real photography, confirmed materials) before
--   the storefront takes live orders. See docs/01-项目说明.md (catalog section).
--
--   Copy rules enforced in this file:
--     · no unverified performance claims (hypoallergenic / tarnish-proof /
--       waterproof / nickel-free / "solid 18K") — plated items are labelled
--       "18K Gold Plating" with a brass base, never as solid gold
--     · no fabricated provenance — country_of_origin is NULL (TBC) until the
--       supplier confirms it
--     · no fabricated certifications — no "certificate of authenticity" copy
--
-- Contents: 8 products, 9 variants (SAR integer minor units), hero media,
-- 5 browsing collections and their membership. Idempotent (INSERT OR IGNORE).

-- --------------------------------------------------------------------------
-- Collections: extend 0001 seed with browsing collections
-- --------------------------------------------------------------------------
INSERT OR IGNORE INTO collections (id, slug, name, description, sort_order) VALUES ('col_new_arrivals', 'new-arrivals', 'New Arrivals', 'The latest pieces to land in the collection', 1);
INSERT OR IGNORE INTO collections (id, slug, name, description, sort_order) VALUES ('col_best_sellers', 'best-sellers', 'Best Sellers', 'Most-loved pieces, restocked', 2);
INSERT OR IGNORE INTO collections (id, slug, name, description, sort_order) VALUES ('col_gold', 'gold', 'Gold', '18K gold pieces', 3);
INSERT OR IGNORE INTO collections (id, slug, name, description, sort_order) VALUES ('col_silver', 'silver', 'Silver', '925 sterling silver pieces', 4);
INSERT OR IGNORE INTO collections (id, slug, name, description, sort_order) VALUES ('col_pearls', 'pearls', 'Pearls', 'Freshwater pearl jewelry', 5);

-- --------------------------------------------------------------------------
-- Products + variants (price in minor units; 14900 = SAR 149.00)
-- --------------------------------------------------------------------------
INSERT OR IGNORE INTO products (id, slug, sku, title, short_description, description, status, product_type, brand, material, base_material, plating, color, care_instructions, country_of_origin, published_at) VALUES ('prod_001', 'aurora-gold-hoop-earrings', 'JW-AUR-001', 'Aurora Gold Hoop Earrings', 'Lightweight 18K gold hoops for everyday wear.', 'Hand-finished gold-plated hoop earrings with a secure hinge closure, designed for comfortable all-day wear.', 'active', 'earrings', 'Jewelry', 'Brass', 'Brass', '18K Gold Plating', 'Gold', 'Wipe with a soft cloth after wear. Store in the pouch provided.', NULL, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO products (id, slug, sku, title, short_description, description, status, product_type, brand, material, base_material, plating, color, care_instructions, country_of_origin, published_at) VALUES ('prod_002', 'noor-pearl-necklace', 'JW-NOR-002', 'Noor Pearl Necklace', 'Freshwater pearl pendant on a fine gold chain.', 'A single freshwater pearl on a gold-vermeil chain. Arrives in a gift box.', 'active', 'necklace', 'Jewelry', 'Freshwater Pearl', 'Sterling Silver', '18K Gold Vermeil', 'White', 'Avoid perfume and water. Wipe pearls with a soft dry cloth.', NULL, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO products (id, slug, sku, title, short_description, description, status, product_type, brand, material, base_material, plating, color, care_instructions, country_of_origin, published_at) VALUES ('prod_003', 'layla-stackable-rings-set', 'JW-LAY-003', 'Layla Stackable Rings — Set of 3', 'Three slim gold bands, stackable or worn alone.', 'A set of three hand-polished gold-plated bands in varied textures: smooth, twisted and beaded. Wear together or separately.', 'active', 'rings', 'Jewelry', '18K Gold Plating', 'Brass', '18K Gold Plating', 'Gold', 'Remove before washing hands. Keep away from chemicals.', NULL, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO products (id, slug, sku, title, short_description, description, status, product_type, brand, material, base_material, plating, color, care_instructions, country_of_origin, published_at) VALUES ('prod_004', 'safa-silver-tennis-bracelet', 'JW-SAF-004', 'Safa Silver Tennis Bracelet', 'Classic cubic zirconia tennis bracelet in 925 silver.', 'A tennis bracelet set with brilliant-cut cubic zirconia in rhodium-plated 925 sterling silver, with a double safety clasp.', 'active', 'bracelet', 'Jewelry', 'Cubic Zirconia', '925 Sterling Silver', 'Rhodium Plating', 'Silver', 'Store in a dry place. Polish with a silver cloth.', NULL, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO products (id, slug, sku, title, short_description, description, status, product_type, brand, material, base_material, plating, color, care_instructions, country_of_origin, published_at) VALUES ('prod_005', 'dune-chain-necklace', 'JW-DUN-005', 'Dune Chain Necklace', 'Bold curb chain in 18K gold vermeil.', 'A statement curb-chain necklace in gold vermeil over sterling silver. Wear solo or layered.', 'active', 'necklace', 'Jewelry', 'Sterling Silver', 'Sterling Silver', '18K Gold Vermeil', 'Gold', 'Avoid water and perfume. Store flat to prevent kinks.', NULL, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO products (id, slug, sku, title, short_description, description, status, product_type, brand, material, base_material, plating, color, care_instructions, country_of_origin, published_at) VALUES ('prod_006', 'mona-pearl-stud-earrings', 'JW-MON-006', 'Mona Pearl Stud Earrings', 'Classic freshwater pearl studs.', 'Hand-matched freshwater pearl studs on 925 sterling silver posts. Gift-boxed.', 'active', 'earrings', 'Jewelry', 'Freshwater Pearl', 'Sterling Silver', NULL, 'White', 'Put on after cosmetics. Wipe with a soft cloth.', NULL, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO products (id, slug, sku, title, short_description, description, status, product_type, brand, material, base_material, plating, color, care_instructions, country_of_origin, published_at) VALUES ('prod_007', 'rimal-evil-eye-bracelet', 'JW-RIM-007', 'Rimal Evil Eye Bracelet', 'Protective evil-eye bracelet with blue enamel and zircon.', 'A Gulf-inspired evil-eye bracelet: a blue enamel eye framed by cubic zirconia on an adjustable gold-plated chain.', 'active', 'bracelet', 'Jewelry', 'Brass', 'Brass', 'Enamel, 18K Gold Plating', 'Blue', 'Avoid water. Adjust clasp gently.', NULL, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO products (id, slug, sku, title, short_description, description, status, product_type, brand, material, base_material, plating, color, care_instructions, country_of_origin, published_at) VALUES ('prod_008', 'celest-gold-anklet', 'JW-CEL-008', 'Celest Gold Anklet', 'Delicate 18K gold anklet with extender.', 'A fine cable-chain anklet in gold plating with a 2 cm extender and lobster clasp.', 'active', 'anklet', 'Jewelry', 'Brass', 'Brass', '18K Gold Plating', 'Gold', 'Remove before swimming or showering.', NULL, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO product_variants (id, product_id, sku, option_values, price, compare_at_price, currency, inventory_quantity, inventory_policy, status) VALUES ('var_001_std', 'prod_001', 'JW-AUR-001-STD', '["Standard"]', 14900, 18900, 'SAR', 25, 'deny', 'active');
INSERT OR IGNORE INTO product_variants (id, product_id, sku, option_values, price, compare_at_price, currency, inventory_quantity, inventory_policy, status) VALUES ('var_002_std', 'prod_002', 'JW-NOR-002-STD', '["45cm"]', 32000, NULL, 'SAR', 12, 'deny', 'active');
INSERT OR IGNORE INTO product_variants (id, product_id, sku, option_values, price, compare_at_price, currency, inventory_quantity, inventory_policy, status) VALUES ('var_003_std', 'prod_003', 'JW-LAY-003-S', '["Size 6"]', 9900, NULL, 'SAR', 30, 'deny', 'active');
INSERT OR IGNORE INTO product_variants (id, product_id, sku, option_values, price, compare_at_price, currency, inventory_quantity, inventory_policy, status) VALUES ('var_003_m', 'prod_003', 'JW-LAY-003-M', '["Size 7"]', 9900, NULL, 'SAR', 30, 'deny', 'active');
INSERT OR IGNORE INTO product_variants (id, product_id, sku, option_values, price, compare_at_price, currency, inventory_quantity, inventory_policy, status) VALUES ('var_004_std', 'prod_004', 'JW-SAF-004-STD', '["18cm"]', 21500, 25900, 'SAR', 8, 'deny', 'active');
INSERT OR IGNORE INTO product_variants (id, product_id, sku, option_values, price, compare_at_price, currency, inventory_quantity, inventory_policy, status) VALUES ('var_005_std', 'prod_005', 'JW-DUN-005-STD', '["50cm"]', 27900, NULL, 'SAR', 15, 'deny', 'active');

INSERT OR IGNORE INTO product_variants (id, product_id, sku, option_values, price, compare_at_price, currency, inventory_quantity, inventory_policy, status) VALUES ('var_006_std', 'prod_006', 'JW-MON-006-STD', '["8mm"]', 7900, 9900, 'SAR', 40, 'deny', 'active');
INSERT OR IGNORE INTO product_variants (id, product_id, sku, option_values, price, compare_at_price, currency, inventory_quantity, inventory_policy, status) VALUES ('var_007_std', 'prod_007', 'JW-RIM-007-STD', '["Adjustable"]', 11900, NULL, 'SAR', 20, 'deny', 'active');
INSERT OR IGNORE INTO product_variants (id, product_id, sku, option_values, price, compare_at_price, currency, inventory_quantity, inventory_policy, status) VALUES ('var_008_std', 'prod_008', 'JW-CEL-008-STD', '["25cm"]', 6900, NULL, 'SAR', 35, 'deny', 'active');

-- Media — placeholder artwork only; real photography replaces these before launch
INSERT OR IGNORE INTO product_media (id, product_id, type, url, alt, sort_order) VALUES ('pm_001', 'prod_001', 'hero', '/images/placeholder-product.jpg', 'Aurora Gold Hoop Earrings', 0);
INSERT OR IGNORE INTO product_media (id, product_id, type, url, alt, sort_order) VALUES ('pm_002', 'prod_002', 'hero', '/images/placeholder-product.jpg', 'Noor Pearl Necklace', 0);
INSERT OR IGNORE INTO product_media (id, product_id, type, url, alt, sort_order) VALUES ('pm_003', 'prod_003', 'hero', '/images/placeholder-product.jpg', 'Layla Stackable Rings Set', 0);
INSERT OR IGNORE INTO product_media (id, product_id, type, url, alt, sort_order) VALUES ('pm_004', 'prod_004', 'hero', '/images/placeholder-product.jpg', 'Safa Silver Tennis Bracelet', 0);
INSERT OR IGNORE INTO product_media (id, product_id, type, url, alt, sort_order) VALUES ('pm_005', 'prod_005', 'hero', '/images/placeholder-product.jpg', 'Dune Chain Necklace', 0);
INSERT OR IGNORE INTO product_media (id, product_id, type, url, alt, sort_order) VALUES ('pm_006', 'prod_006', 'hero', '/images/placeholder-product.jpg', 'Mona Pearl Stud Earrings', 0);

INSERT OR IGNORE INTO product_media (id, product_id, type, url, alt, sort_order) VALUES ('pm_007', 'prod_007', 'hero', '/images/placeholder-product.jpg', 'Rimal Evil Eye Bracelet', 0);
INSERT OR IGNORE INTO product_media (id, product_id, type, url, alt, sort_order) VALUES ('pm_008', 'prod_008', 'hero', '/images/placeholder-product.jpg', 'Celest Gold Anklet', 0);

-- --------------------------------------------------------------------------
-- Collection membership
-- --------------------------------------------------------------------------
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_everyday', 'prod_001', 1);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_everyday', 'prod_003', 2);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_everyday', 'prod_006', 3);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_everyday', 'prod_008', 4);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_new_arrivals', 'prod_007', 1);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_new_arrivals', 'prod_005', 2);

INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_best_sellers', 'prod_001', 1);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_best_sellers', 'prod_002', 2);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_best_sellers', 'prod_006', 3);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_gift', 'prod_002', 1);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_gift', 'prod_006', 2);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_gift', 'prod_007', 3);

INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_statement', 'prod_004', 1);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_statement', 'prod_005', 2);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_gold', 'prod_001', 1);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_gold', 'prod_003', 2);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_gold', 'prod_005', 3);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_gold', 'prod_007', 4);

INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_gold', 'prod_008', 5);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_silver', 'prod_004', 1);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_silver', 'prod_006', 2);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_pearls', 'prod_002', 1);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_pearls', 'prod_006', 2);
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES ('col_gulf_design', 'prod_007', 1);
