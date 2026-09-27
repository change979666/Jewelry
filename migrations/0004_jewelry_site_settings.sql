-- Jewelry — site_settings (Settings Service single store)
-- Consumed by functions/api/admin/v2/system/settings.ts and storefront config.

CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    category TEXT DEFAULT 'general',
    description TEXT,
    updated_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_settings_category ON site_settings(category);

-- Brand / contact defaults (overridable in admin; no secrets here)
INSERT OR IGNORE INTO site_settings (key, value, category, description) VALUES
('site.name', 'Jewelry', 'brand', 'Brand name (en)'),
('site.tagline', 'Everyday fine jewelry, designed for the Gulf.', 'brand', 'Brand tagline (en)'),
('site.email', 'support@example.com', 'brand', 'Support email'),
('site.whatsapp', '', 'brand', 'WhatsApp number (international format, digits only)'),
('site.instagram', '', 'social', 'Instagram URL'),
('site.tiktok', '', 'social', 'TikTok URL'),
('site.pinterest', '', 'social', 'Pinterest URL'),
('site.facebook', '', 'social', 'Facebook URL'),
('market.default', 'KSA', 'market', 'Default market code (KSA | UAE)'),
('feature.enable_online_payment', 'false', 'feature', 'Show hosted online payment at checkout'),
('shipping.flat_rate_sar', '1500', 'shipping', 'Flat shipping rate in minor units (SAR)'),
('shipping.free_shipping_threshold_sar', '30000', 'shipping', 'Free shipping threshold in minor units (SAR), 0 = disabled');
