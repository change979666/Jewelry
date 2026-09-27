-- 0008_jewelry_seed.sql — V1.0 catalog seed: 8 products, variants, media,
-- collections (new) and collection membership. Idempotent (INSERT OR IGNORE).
-- Prices are integer minor units. Variant currency: SAR (KSA primary market).

-- --------------------------------------------------------------------------
-- Collections: extend 0001 seed with browsing collections
-- --------------------------------------------------------------------------
INSERT OR IGNORE INTO collections (id, slug, name, description, sort_order) VALUES
('col_new_arrivals', 'new-arrivals', 'New Arrivals', 'The latest pieces to land in the collection', 1),
('col_best_sellers', 'best-sellers', 'Best Sellers', 'Most-loved pieces, restocked', 2),
('col_gold', 'gold', 'Gold', '18K gold pieces', 3),
('col_silver', 'silver', 'Silver', '925 sterling silver pieces', 4),
('col_pearls', 'pearls', 'Pearls', 'Freshwater pearl jewelry', 5);

-- --------------------------------------------------------------------------
-- Products + variants (price in minor units; 14900 = SAR 149.00)
-- --------------------------------------------------------------------------
INSERT OR IGNORE INTO products
(id, slug, sku, title, short_description, description, status, product_type, brand, material, base_material, plating, color, care_instructions, country_of_origin, published_at) VALUES
('prod_001', 'aurora-gold-hoop-earrings', 'JW-AUR-001', 'Aurora Gold Hoop Earrings',
 'Lightweight 18K gold hoops for everyday wear.',
 'Hand-finished 18K gold hoop earrings with a secure hinge closure. Hypoallergenic and tarnish-resistant, designed for all-day comfort.',
 'active', 'earrings', 'Jewelry', '18K Gold', 'Brass', '18K Gold Plating', 'Gold',
 'Wipe with a soft cloth after wear. Store in the pouch provided.', 'Saudi Arabia', CURRENT_TIMESTAMP),
('prod_002', 'noor-pearl-necklace', 'JW-NOR-002', 'Noor Pearl Necklace',
 'Freshwater pearl pendant on a fine gold chain.',
 'A single freshwater pearl suspended from an 18K gold vermeil chain. Arrives in a gift box with a certificate of authenticity.',
 'active', 'necklace', 'Jewelry', 'Freshwater Pearl', 'Sterling Silver', '18K Gold Vermeil', 'White',
 'Avoid perfume and water. Wipe pearls with a soft dry cloth.', 'Saudi Arabia', CURRENT_TIMESTAMP),
('prod_003', 'layla-stackable-rings-set', 'JW-LAY-003', 'Layla Stackable Rings — Set of 3',
 'Three slim gold bands, stackable or worn alone.',
 'A set of three hand-polished 18K gold-plated bands in varied textures: smooth, twisted and beaded. Wear together or separately.',
 'active', 'rings', 'Jewelry', '18K Gold Plating', 'Brass', '18K Gold Plating', 'Gold',
 'Remove before washing hands. Keep away from chemicals.', 'Saudi Arabia', CURRENT_TIMESTAMP),
('prod_004', 'safa-silver-tennis-bracelet', 'JW-SAF-004', 'Safa Silver Tennis Bracelet',
 'Classic cubic zirconia tennis bracelet in 925 silver.',
 'A timeless tennis bracelet set with brilliant-cut cubic zirconia in rhodium-plated 925 sterling silver, with a double safety clasp.',
 'active', 'bracelet', 'Jewelry', 'Cubic Zirconia', '925 Sterling Silver', 'Rhodium Plating', 'Silver',
 'Store in a dry place. Polish with a silver cloth.', 'Saudi Arabia', CURRENT_TIMESTAMP),
('prod_005', 'dune-chain-necklace', 'JW-DUN-005', 'Dune Chain Necklace',
 'Bold curb chain in 18K gold vermeil.',
 'A statement curb-chain necklace in thick 18K gold vermeil over sterling silver. Wear solo or layered.',
 'active', 'necklace', 'Jewelry', '18K Gold Vermeil', 'Sterling Silver', '18K Gold Vermeil', 'Gold',
 'Avoid water and perfume. Store flat to prevent kinks.', 'Saudi Arabia', CURRENT_TIMESTAMP),
('prod_006', 'mona-pearl-stud-earrings', 'JW-MON-006', 'Mona Pearl Stud Earrings',
 'Classic freshwater pearl studs.',
 'Hand-matched freshwater pearl studs on 925 sterling silver posts. The everyday pearl, gift-boxed.',
 'active', 'earrings', 'Jewelry', 'Freshwater Pearl', 'Sterling Silver', NULL, 'White',
 'Put on after cosmetics. Wipe with a soft cloth.', 'Saudi Arabia', CURRENT_TIMESTAMP),
('prod_007', 'rimal-evil-eye-bracelet', 'JW-RIM-007', 'Rimal Evil Eye Bracelet',
 'Protective evil-eye bracelet with blue enamel and zircon.',
 'A Gulf-inspired evil-eye bracelet: hand-set blue enamel eye framed by cubic zirconia on an adjustable 18K gold-plated chain.',
 'active', 'bracelet', 'Jewelry', 'Enamel, Cubic Zirconia', 'Brass', '18K Gold Plating', 'Blue',
 'Avoid water. Adjust clasp gently.', 'Saudi Arabia', CURRENT_TIMESTAMP),
('prod_008', 'celest-gold-anklet', 'JW-CEL-008', 'Celest Gold Anklet',
 'Delicate 18K gold anklet with extender.',
 'A fine cable-chain anklet in 18K gold plating with a 2 cm extender and lobster clasp. Made for sandal season.',
 'active', 'anklet', 'Jewelry', '18K Gold Plating', 'Brass', '18K Gold Plating', 'Gold',
 'Remove before swimming or showering.', 'Saudi Arabia', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO product_variants
(id, product_id, sku, option_values, price, compare_at_price, currency, inventory_quantity, inventory_policy, status) VALUES
('var_001_std', 'prod_001', 'JW-AUR-001-STD', '["Standard"]', 14900, 18900, 'SAR', 25, 'deny', 'active'),
('var_002_std', 'prod_002', 'JW-NOR-002-STD', '["45cm"]', 32000, NULL, 'SAR', 12, 'deny', 'active'),
('var_003_std', 'prod_003', 'JW-LAY-003-S', '["Size 6"]', 9900, NULL, 'SAR', 30, 'deny', 'active'),
('var_003_m',   'prod_003', 'JW-LAY-003-M', '["Size 7"]', 9900, NULL, 'SAR', 30, 'deny', 'active'),
('var_004_std', 'prod_004', 'JW-SAF-004-STD', '["18cm"]', 21500, 25900, 'SAR', 8, 'deny', 'active'),
('var_005_std', 'prod_005', 'JW-DUN-005-STD', '["50cm"]', 27900, NULL, 'SAR', 15, 'deny', 'active'),
('var_006_std', 'prod_006', 'JW-MON-006-STD', '["8mm"]', 7900, 9900, 'SAR', 40, 'deny', 'active'),
('var_007_std', 'prod_007', 'JW-RIM-007-STD', '["Adjustable"]', 11900, NULL, 'SAR', 20, 'deny', 'active'),
('var_008_std', 'prod_008', 'JW-CEL-008-STD', '["25cm"]', 6900, NULL, 'SAR', 35, 'deny', 'active');

-- Media (placeholder artwork ships with the repo)
INSERT OR IGNORE INTO product_media (id, product_id, type, url, alt, sort_order) VALUES
('pm_001', 'prod_001', 'hero', '/images/placeholder-product.jpg', 'Aurora Gold Hoop Earrings', 0),
('pm_002', 'prod_002', 'hero', '/images/placeholder-product.jpg', 'Noor Pearl Necklace', 0),
('pm_003', 'prod_003', 'hero', '/images/placeholder-product.jpg', 'Layla Stackable Rings Set', 0),
('pm_004', 'prod_004', 'hero', '/images/placeholder-product.jpg', 'Safa Silver Tennis Bracelet', 0),
('pm_005', 'prod_005', 'hero', '/images/placeholder-product.jpg', 'Dune Chain Necklace', 0),
('pm_006', 'prod_006', 'hero', '/images/placeholder-product.jpg', 'Mona Pearl Stud Earrings', 0),
('pm_007', 'prod_007', 'hero', '/images/placeholder-product.jpg', 'Rimal Evil Eye Bracelet', 0),
('pm_008', 'prod_008', 'hero', '/images/placeholder-product.jpg', 'Celest Gold Anklet', 0);

-- --------------------------------------------------------------------------
-- Collection membership
-- --------------------------------------------------------------------------
INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES
-- everyday
('col_everyday', 'prod_001', 1), ('col_everyday', 'prod_003', 2), ('col_everyday', 'prod_006', 3),
('col_everyday', 'prod_008', 4),
-- new-arrivals
('col_new_arrivals', 'prod_007', 1), ('col_new_arrivals', 'prod_005', 2),
-- best-sellers
('col_best_sellers', 'prod_001', 1), ('col_best_sellers', 'prod_002', 2), ('col_best_sellers', 'prod_006', 3),
-- gift
('col_gift', 'prod_002', 1), ('col_gift', 'prod_006', 2), ('col_gift', 'prod_007', 3),
-- statement
('col_statement', 'prod_004', 1), ('col_statement', 'prod_005', 2),
-- gold
('col_gold', 'prod_001', 1), ('col_gold', 'prod_003', 2), ('col_gold', 'prod_005', 3),
('col_gold', 'prod_007', 4), ('col_gold', 'prod_008', 5),
-- silver
('col_silver', 'prod_004', 1), ('col_silver', 'prod_006', 2),
-- pearls
('col_pearls', 'prod_002', 1), ('col_pearls', 'prod_006', 2),
-- gulf-design
('col_gulf_design', 'prod_007', 1);
