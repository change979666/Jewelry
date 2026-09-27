-- 0052: Phase 11 — System Settings, i18n Translations, Knowledge Base V2

-- Site Settings (key-value store for global config)
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',  -- general | seo | email | commerce | ai | integration
  description TEXT,
  updated_by TEXT,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- i18n Translation Management
CREATE TABLE IF NOT EXISTS i18n_locales (
  code TEXT PRIMARY KEY,        -- en, es, de, zh
  name TEXT NOT NULL,           -- English, Spanish, German, Chinese
  native_name TEXT NOT NULL,    -- English, Español, Deutsch, 中文
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS i18n_translations (
  id TEXT PRIMARY KEY,
  locale TEXT NOT NULL REFERENCES i18n_locales(code),
  namespace TEXT NOT NULL DEFAULT 'ui',    -- ui | content | commerce | email | seo
  key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | translated | reviewed | approved
  updated_by TEXT,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(locale, namespace, key)
);

CREATE INDEX IF NOT EXISTS idx_i18n_trans_locale ON i18n_translations(locale);
CREATE INDEX IF NOT EXISTS idx_i18n_trans_ns ON i18n_translations(namespace);
CREATE INDEX IF NOT EXISTS idx_i18n_trans_status ON i18n_translations(status);

-- Knowledge Base V2 (L0-L4 layers)
CREATE TABLE IF NOT EXISTS knowledge_v2 (
  id TEXT PRIMARY KEY,
  layer TEXT NOT NULL DEFAULT 'L0',  -- L0=raw, L1=classified, L2=enriched, L3=optimized, L4=actionable
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',  -- manual | ai | import | cron
  importance INTEGER NOT NULL DEFAULT 5,  -- 1-10
  confidence INTEGER DEFAULT 50,          -- 0-100
  tags_json TEXT NOT NULL DEFAULT '[]',
  embedding_status TEXT NOT NULL DEFAULT 'pending',  -- pending | indexed | error
  linked_entity_type TEXT,
  linked_entity_id TEXT,
  created_by TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_v2_layer ON knowledge_v2(layer);
CREATE INDEX IF NOT EXISTS idx_kb_v2_category ON knowledge_v2(category);
CREATE INDEX IF NOT EXISTS idx_kb_v2_importance ON knowledge_v2(importance DESC);

-- Seed default locales
INSERT OR IGNORE INTO i18n_locales (code, name, native_name, is_default, is_active) VALUES ('en', 'English', 'English', 1, 1);
INSERT OR IGNORE INTO i18n_locales (code, name, native_name, is_default, is_active) VALUES ('es', 'Spanish', 'Español', 0, 1);
INSERT OR IGNORE INTO i18n_locales (code, name, native_name, is_default, is_active) VALUES ('de', 'German', 'Deutsch', 0, 1);
INSERT OR IGNORE INTO i18n_locales (code, name, native_name, is_default, is_active) VALUES ('zh', 'Chinese', '中文', 0, 1);

-- Seed default site settings
INSERT OR IGNORE INTO site_settings (key, value, category, description) VALUES ('site_name', 'Aromiso', 'general', 'Site name');
INSERT OR IGNORE INTO site_settings (key, value, category, description) VALUES ('site_tagline', 'Premium scent, sourced with confidence.', 'general', 'Site tagline');
INSERT OR IGNORE INTO site_settings (key, value, category, description) VALUES ('site_email', 'sales@aromiso.com', 'general', 'Contact email');
INSERT OR IGNORE INTO site_settings (key, value, category, description) VALUES ('site_logo', '/images/logo.png', 'general', 'Site logo URL');
INSERT OR IGNORE INTO site_settings (key, value, category, description) VALUES ('site_favicon', '/favicon.svg', 'general', 'Favicon URL');
INSERT OR IGNORE INTO site_settings (key, value, category, description) VALUES ('seo_title_suffix', ' | Aromiso', 'seo', 'SEO title suffix');
INSERT OR IGNORE INTO site_settings (key, value, category, description) VALUES ('seo_default_description', 'Premium aromatherapy products from China.', 'seo', 'Default meta description');
INSERT OR IGNORE INTO site_settings (key, value, category, description) VALUES ('seo_og_image', '/images/og-default.jpg', 'seo', 'Default OG image');
INSERT OR IGNORE INTO site_settings (key, value, category, description) VALUES ('commerce_currency', 'USD', 'commerce', 'Default currency');
INSERT OR IGNORE INTO site_settings (key, value, category, description) VALUES ('commerce_min_order', '100', 'commerce', 'Minimum order amount');
INSERT OR IGNORE INTO site_settings (key, value, category, description) VALUES ('ai_auto_translate', '1', 'ai', 'Auto-translate new content');
INSERT OR IGNORE INTO site_settings (key, value, category, description) VALUES ('ai_content_review', '1', 'ai', 'AI content review enabled');
INSERT OR IGNORE INTO site_settings (key, value, category, description) VALUES ('email_smtp_host', '', 'email', 'SMTP host');
INSERT OR IGNORE INTO site_settings (key, value, category, description) VALUES ('email_from_name', 'Aromiso', 'email', 'Email sender name');

-- DOWN
-- DROP TABLE IF EXISTS knowledge_v2;
-- DROP TABLE IF EXISTS i18n_translations;
-- DROP TABLE IF EXISTS i18n_locales;
-- DROP TABLE IF EXISTS site_settings;
