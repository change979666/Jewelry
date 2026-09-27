-- Add tags field to commerce_products for merchandising labels
-- tags stores a JSON array like ["new_arrival","low_moq","best_seller"]
ALTER TABLE commerce_products ADD COLUMN tags TEXT DEFAULT '[]';
