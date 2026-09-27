-- Jewelry — Market shipping config + order discount code
-- Tax stays on markets.tax_rate (config-driven, never hardcoded).

ALTER TABLE markets ADD COLUMN flat_shipping_rate INTEGER;      -- minor units
ALTER TABLE markets ADD COLUMN free_shipping_threshold INTEGER; -- minor units, 0/NULL = disabled

ALTER TABLE orders ADD COLUMN discount_code TEXT;

-- Default shipping for seeded markets (15 SAR flat, free from 300 SAR)
UPDATE markets SET flat_shipping_rate = 1500, free_shipping_threshold = 30000 WHERE code = 'KSA';
UPDATE markets SET flat_shipping_rate = 2000, free_shipping_threshold = 30000 WHERE code = 'UAE';
