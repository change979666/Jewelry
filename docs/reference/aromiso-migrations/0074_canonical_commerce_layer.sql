-- ============================================================================
-- 0074 — Canonical Commerce Data Layer（Phase 1 核心数据层）
-- 2026-09-03 ｜ Shop V2 总文档 §4.2 ｜ 旧表一字不动，全部新建
-- 幂等：CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE（可重复执行）
-- ============================================================================

-- ── A. 三级分类树 + 商品关联 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER,                          -- NULL = 一级分类
  level INTEGER NOT NULL DEFAULT 1,           -- 1/2/3（一级/二级/产品类型）
  slug TEXT NOT NULL UNIQUE,                  -- URL 稳定（canonical URL 组件）
  name_zh TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  name_es TEXT NOT NULL DEFAULT '',
  description_zh TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  description_es TEXT NOT NULL DEFAULT '',
  seo_title_json TEXT NOT NULL DEFAULT '{}',      -- {en,es,de} 各语言独立
  seo_description_json TEXT NOT NULL DEFAULT '{}',
  icon TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shop_cat_parent ON shop_categories(parent_id);

CREATE TABLE IF NOT EXISTS shop_product_categories (
  product_id TEXT NOT NULL,                   -- commerce_products.id
  category_id INTEGER NOT NULL REFERENCES shop_categories(id),
  is_primary INTEGER NOT NULL DEFAULT 0,      -- 主分类
  source TEXT NOT NULL DEFAULT 'manual',      -- manual/ai/import/rule
  confidence INTEGER NOT NULL DEFAULT 100,
  verification_status TEXT NOT NULL DEFAULT 'DEFAULT', -- VERIFIED/INFERRED/IMPORTED/DEFAULT/UNKNOWN
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (product_id, category_id)
);

-- ── 来源分类映射层（1688/Alibaba/CSV/Supplier/AI Import 统一入口）──────────
CREATE TABLE IF NOT EXISTS shop_category_source_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_platform TEXT NOT NULL DEFAULT '',   -- 1688/alibaba/csv/supplier/ai_import
  source_category_id TEXT NOT NULL DEFAULT '',
  source_category_name TEXT NOT NULL DEFAULT '',
  category_id INTEGER REFERENCES shop_categories(id),
  confidence INTEGER NOT NULL DEFAULT 50,
  verified INTEGER NOT NULL DEFAULT 0,        -- 0 待确认 / 1 已确认
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source_platform, source_category_id)
);

-- ── B. 属性系统（动态筛选核心）──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,                  -- capacity/material/...
  attr_group TEXT NOT NULL DEFAULT 'spec',    -- spec/procurement/fragrance/scene
  name_zh TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  name_es TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'text',          -- text/number/select/multi_select/range
  unit TEXT NOT NULL DEFAULT '',              -- ml/g/h/...
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shop_attribute_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attribute_id INTEGER NOT NULL REFERENCES shop_attributes(id),
  value TEXT NOT NULL,
  value_number REAL,                          -- 数值型属性存数字（区间筛选用）
  slug TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (attribute_id, value)
);
CREATE INDEX IF NOT EXISTS idx_shop_attrval_attr ON shop_attribute_values(attribute_id);

-- 分类-属性模板：哪个分类显示哪些筛选器
CREATE TABLE IF NOT EXISTS shop_category_attributes (
  category_id INTEGER NOT NULL REFERENCES shop_categories(id),
  attribute_id INTEGER NOT NULL REFERENCES shop_attributes(id),
  is_filterable INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (category_id, attribute_id)
);

-- 商品实际属性值（AI 提取结果带 source/confidence，低置信进审核不直接生效）
CREATE TABLE IF NOT EXISTS shop_product_attributes (
  product_id TEXT NOT NULL,                   -- commerce_products.id
  attribute_id INTEGER NOT NULL REFERENCES shop_attributes(id),
  value_id INTEGER REFERENCES shop_attribute_values(id),
  value_number REAL,
  value_text TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',      -- supplier/ai_extracted/ai_inferred/manual/import
  confidence INTEGER NOT NULL DEFAULT 50,     -- 0-100
  verification_status TEXT NOT NULL DEFAULT 'INFERRED', -- VERIFIED/INFERRED/IMPORTED/DEFAULT/UNKNOWN
  verified_by TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (product_id, attribute_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_pattr_value ON shop_product_attributes(value_id);

-- ── C. 香味体系（行业核心资产）──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_fragrance_families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  name_es TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS shop_fragrances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER REFERENCES shop_fragrance_families(id),
  slug TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  name_es TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  seo_keyword TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- 同义词：Rose/玫瑰/Rose Scent 归一到同一 fragrance_id
CREATE TABLE IF NOT EXISTS shop_fragrance_synonyms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fragrance_id INTEGER NOT NULL REFERENCES shop_fragrances(id),
  synonym TEXT NOT NULL UNIQUE COLLATE NOCASE,
  lang TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_shop_syn_frag ON shop_fragrance_synonyms(fragrance_id);

CREATE TABLE IF NOT EXISTS shop_product_fragrances (
  product_id TEXT NOT NULL,
  fragrance_id INTEGER NOT NULL REFERENCES shop_fragrances(id),
  role TEXT NOT NULL DEFAULT 'primary',       -- primary/secondary
  source TEXT NOT NULL DEFAULT 'ai_inferred',
  confidence INTEGER NOT NULL DEFAULT 50,
  verification_status TEXT NOT NULL DEFAULT 'INFERRED',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (product_id, fragrance_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_pfrag_frag ON shop_product_fragrances(fragrance_id);

-- ── B2. 采购场景（Applications）────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  name_es TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  seo_title_json TEXT NOT NULL DEFAULT '{}',
  seo_description_json TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS shop_product_applications (
  product_id TEXT NOT NULL,
  application_id INTEGER NOT NULL REFERENCES shop_applications(id),
  source TEXT NOT NULL DEFAULT 'ai_inferred',
  confidence INTEGER NOT NULL DEFAULT 50,
  verification_status TEXT NOT NULL DEFAULT 'INFERRED',
  PRIMARY KEY (product_id, application_id)
);

-- ── C2. Collections（营销/SEO 集合：规则自动收录 + 人工精选）────────────────
CREATE TABLE IF NOT EXISTS shop_collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'curated',       -- best_sellers/new_arrivals/curated/rule
  slug TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  name_es TEXT NOT NULL DEFAULT '',
  rule_json TEXT NOT NULL DEFAULT '{}',       -- 自动收录规则（如 moq<=100 且现货）
  banner_image TEXT NOT NULL DEFAULT '',
  seo_title_json TEXT NOT NULL DEFAULT '{}',
  seo_description_json TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shop_collection_products (
  collection_id INTEGER NOT NULL REFERENCES shop_collections(id),
  product_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'manual',        -- manual/rule（规则自动收录标记）
  sort_order INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (collection_id, product_id)
);

-- ── 字段级溯源（核心商业字段：这个值从哪来？为什么可信？）──────────────────
CREATE TABLE IF NOT EXISTS shop_product_provenance (
  product_id TEXT NOT NULL,
  field TEXT NOT NULL,                        -- moq/oem_available/private_label/ready_to_ship/lead_time/...
  value TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'default',     -- supplier/import/default/manual/ai_inferred/ai_extracted
  source_type TEXT NOT NULL DEFAULT 'DEFAULT',
  confidence INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'DEFAULT', -- VERIFIED/INFERRED/IMPORTED/DEFAULT/UNKNOWN
  verified_by TEXT,
  verified_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (product_id, field)
);

-- ── 种子：三级分类树（总文档 §5.7 参考树，slug 稳定可重复执行）──────────────
INSERT OR IGNORE INTO shop_categories (slug, parent_id, level, name_zh, name_en, name_es, sort_order) VALUES
 ('home-fragrance', NULL, 1, '家居香氛', 'Home Fragrance', 'Fragancia del Hogar', 10),
 ('car-fragrance', NULL, 1, '车载香氛', 'Car Fragrance', 'Fragancia para Auto', 20),
 ('aroma-machines', NULL, 1, '香薰设备', 'Aroma Machines', 'Máquinas de Aroma', 30),
 ('accessories', NULL, 1, '香薰配件', 'Accessories', 'Accesorios', 40),
 ('gift-sets', NULL, 1, '礼品套装', 'Gift Sets', 'Sets de Regalo', 50),
 ('scented-candles', (SELECT id FROM shop_categories WHERE slug='home-fragrance'), 2, '香薰蜡烛', 'Scented Candles', 'Velas Aromáticas', 10),
 ('reed-diffusers', (SELECT id FROM shop_categories WHERE slug='home-fragrance'), 2, '无火香薰', 'Reed Diffusers', 'Difusores de Varillas', 20),
 ('room-sprays', (SELECT id FROM shop_categories WHERE slug='home-fragrance'), 2, '香薰喷雾', 'Room Sprays', 'Sprays Ambientales', 30),
 ('fragrance-oils', (SELECT id FROM shop_categories WHERE slug='home-fragrance'), 2, '香薰油', 'Fragrance Oils', 'Aceites Aromáticos', 40),
 ('home-fragrance-other', (SELECT id FROM shop_categories WHERE slug='home-fragrance'), 2, '室内香氛其他', 'Others', 'Otros', 90),
 ('car-vent-clip', (SELECT id FROM shop_categories WHERE slug='car-fragrance'), 2, '出风口夹', 'Vent Clip', 'Clip de Ventilación', 10),
 ('car-hanging', (SELECT id FROM shop_categories WHERE slug='car-fragrance'), 2, '挂式', 'Hanging', 'Colgante', 20),
 ('car-dashboard', (SELECT id FROM shop_categories WHERE slug='car-fragrance'), 2, '台面式', 'Dashboard', 'Tablero', 30),
 ('car-refill', (SELECT id FROM shop_categories WHERE slug='car-fragrance'), 2, '补充液', 'Refill Liquid', 'Líquido de Repuesto', 40),
 ('ultrasonic-diffuser', (SELECT id FROM shop_categories WHERE slug='aroma-machines'), 2, '超声波香薰机', 'Ultrasonic Diffuser', 'Difusor Ultrasónico', 10),
 ('waterless-diffuser', (SELECT id FROM shop_categories WHERE slug='aroma-machines'), 2, '无水香薰机', 'Waterless Diffuser', 'Difusor sin Agua', 20),
 ('commercial-diffuser', (SELECT id FROM shop_categories WHERE slug='aroma-machines'), 2, '商用扩香设备', 'Commercial Diffuser', 'Difusor Comercial', 30),
 ('reeds-sticks', (SELECT id FROM shop_categories WHERE slug='accessories'), 2, '藤条', 'Reed Sticks', 'Varillas', 10),
 ('empty-bottles', (SELECT id FROM shop_categories WHERE slug='accessories'), 2, '空瓶', 'Empty Bottles', 'Botellas Vacías', 20),
 ('gift-packaging', (SELECT id FROM shop_categories WHERE slug='accessories'), 2, '礼盒包装', 'Gift Packaging', 'Embalaje de Regalo', 30),
 ('fragrance-gift-box', (SELECT id FROM shop_categories WHERE slug='gift-sets'), 2, '香薰礼盒', 'Fragrance Gift Box', 'Caja de Regalo', 10),
 ('seasonal-sets', (SELECT id FROM shop_categories WHERE slug='gift-sets'), 2, '节日套装', 'Seasonal Sets', 'Sets de Temporada', 20),
 ('glass-reed-diffuser', (SELECT id FROM shop_categories WHERE slug='reed-diffusers'), 3, '玻璃瓶无火香薰', 'Glass Reed Diffuser', 'Difusor de Vidrio', 10),
 ('plastic-reed-diffuser', (SELECT id FROM shop_categories WHERE slug='reed-diffusers'), 3, '塑料瓶无火香薰', 'Plastic Reed Diffuser', 'Difusor de Plástico', 20),
 ('gift-reed-diffuser', (SELECT id FROM shop_categories WHERE slug='reed-diffusers'), 3, '礼盒装无火香薰', 'Gift Reed Diffuser', 'Difusor de Regalo', 30),
 ('glass-candle', (SELECT id FROM shop_categories WHERE slug='scented-candles'), 3, '玻璃杯蜡烛', 'Glass Candle', 'Vela de Vidrio', 10),
 ('tin-candle', (SELECT id FROM shop_categories WHERE slug='scented-candles'), 3, '铁罐蜡烛', 'Tin Candle', 'Vela de Lata', 20),
 ('ceramic-candle', (SELECT id FROM shop_categories WHERE slug='scented-candles'), 3, '陶瓷蜡烛', 'Ceramic Candle', 'Vela de Cerámica', 30),
 ('travel-candle', (SELECT id FROM shop_categories WHERE slug='scented-candles'), 3, '旅行蜡烛', 'Travel Candle', 'Vela de Viaje', 40),
 ('pillar-candle', (SELECT id FROM shop_categories WHERE slug='scented-candles'), 3, '柱状蜡烛', 'Pillar Candle', 'Vela Pilar', 50),
 ('gift-candle', (SELECT id FROM shop_categories WHERE slug='scented-candles'), 3, '礼盒蜡烛', 'Gift Candle', 'Vela de Regalo', 60);

-- ── 种子：香味家族（16 家族）────────────────────────────────────────────────
INSERT OR IGNORE INTO shop_fragrance_families (slug, name_zh, name_en, name_es, sort_order) VALUES
 ('floral', '花香', 'Floral', 'Floral', 10),
 ('fruity', '果香', 'Fruity', 'Frutal', 20),
 ('woody', '木质', 'Woody', 'Amaderado', 30),
 ('citrus', '柑橘', 'Citrus', 'Cítrico', 40),
 ('fresh', '清新', 'Fresh', 'Fresco', 50),
 ('sweet', '甜香', 'Sweet', 'Dulce', 60),
 ('vanilla', '香草', 'Vanilla', 'Vainilla', 70),
 ('oriental', '东方', 'Oriental', 'Oriental', 80),
 ('musk', '麝香', 'Musk', 'Almizcle', 90),
 ('aquatic', '水生', 'Aquatic', 'Acuático', 100),
 ('herbal', '草本', 'Herbal', 'Herbal', 110),
 ('spicy', '辛香', 'Spicy', 'Especiado', 120),
 ('earthy', '泥土', 'Earthy', 'Terroso', 130),
 ('green', '绿色', 'Green', 'Verde', 140),
 ('gourmand', '美食调', 'Gourmand', 'Gourmand', 150),
 ('amber', '琥珀', 'Amber', 'Ámbar', 160);

-- ── 种子：核心属性（规格/采购/香味/场景四组）────────────────────────────────
INSERT OR IGNORE INTO shop_attributes (code, attr_group, name_zh, name_en, name_es, type, unit, sort_order) VALUES
 ('capacity', 'spec', '容量', 'Capacity', 'Capacidad', 'number', 'ml', 10),
 ('material', 'spec', '材质', 'Material', 'Material', 'select', '', 20),
 ('bottle_shape', 'spec', '瓶型', 'Bottle Shape', 'Forma de Botella', 'select', '', 30),
 ('wax_type', 'spec', '蜡材', 'Wax Type', 'Tipo de Cera', 'select', '', 40),
 ('burn_time', 'spec', '燃烧时间', 'Burn Time', 'Tiempo de Quemado', 'number', 'h', 50),
 ('reed_type', 'spec', '藤条类型', 'Reed Type', 'Tipo de Varilla', 'select', '', 60),
 ('color', 'spec', '颜色', 'Color', 'Color', 'select', '', 70),
 ('weight', 'spec', '重量', 'Weight', 'Peso', 'number', 'g', 80),
 ('size', 'spec', '尺寸', 'Size', 'Tamaño', 'text', '', 90),
 ('moq', 'procurement', 'MOQ', 'MOQ', 'MOQ', 'number', 'pcs', 10),
 ('tiered_price', 'procurement', '阶梯价格', 'Tiered Price', 'Precio Escalonado', 'text', '', 20),
 ('ready_stock', 'procurement', '现货', 'Ready Stock', 'Stock Listo', 'select', '', 30),
 ('sample', 'procurement', '样品', 'Sample', 'Muestra', 'select', '', 40),
 ('private_label', 'procurement', 'Private Label', 'Private Label', 'Marca Privada', 'select', '', 50),
 ('oem_odm', 'procurement', 'OEM/ODM', 'OEM/ODM', 'OEM/ODM', 'select', '', 60),
 ('packaging_custom', 'procurement', '包装定制', 'Packaging Custom', 'Embalaje Personalizado', 'select', '', 70),
 ('logo_custom', 'procurement', 'Logo 定制', 'Logo Custom', 'Logo Personalizado', 'select', '', 80),
 ('lead_time', 'procurement', '交期', 'Lead Time', 'Tiempo de Entrega', 'text', '', 90),
 ('target_market', 'procurement', '目标市场', 'Target Market', 'Mercado Objetivo', 'multi_select', '', 100),
 ('fragrance_family', 'fragrance', '香味家族', 'Fragrance Family', 'Familia Olfativa', 'select', '', 10),
 ('primary_scent', 'fragrance', '主香味', 'Primary Scent', 'Aroma Principal', 'select', '', 20),
 ('secondary_scent', 'fragrance', '次香味', 'Secondary Scent', 'Aroma Secundario', 'select', '', 30),
 ('use_scene', 'scene', '使用场景', 'Use Scene', 'Escena de Uso', 'multi_select', '', 10),
 ('audience_festival', 'scene', '人群/节日', 'Audience / Festival', 'Audiencia / Festival', 'multi_select', '', 20);

-- ── 种子：采购场景 ──────────────────────────────────────────────────────────
INSERT OR IGNORE INTO shop_applications (slug, name_zh, name_en, name_es, sort_order) VALUES
 ('hotel', '酒店', 'Hotel', 'Hotel', 10),
 ('spa', 'SPA/水疗', 'Spa', 'Spa', 20),
 ('retail', '零售门店', 'Retail', 'Retail', 30),
 ('home', '家居', 'Home', 'Hogar', 40),
 ('office', '办公室', 'Office', 'Oficina', 50),
 ('car', '车载', 'Car', 'Auto', 60),
 ('restaurant', '餐厅', 'Restaurant', 'Restaurante', 70),
 ('gift', '礼品', 'Gift', 'Regalo', 80),
 ('wedding', '婚庆', 'Wedding', 'Boda', 90),
 ('seasonal', '节日季', 'Seasonal', 'Temporada', 100);
