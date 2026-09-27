// ---------------------------------------------------------------------------
//  Controlled, CONTEXT-AWARE localization for PUBLIC PDP specification labels/values.
//  (Specifications CJK 专项治理 — FINAL one-shot batch. Supersedes the Batch-1 value-only map.)
//
//  HARD RULES (task instruction — read before editing):
//   • Context-aware (§7): a value is localized based on its KEY/field semantics, never by a
//     blind global value→English replace. 产地=浙江 → Origin: Zhejiang, but 品牌=攀潮 stays 攀潮.
//   • Deterministic only (§1/§4): controlled dictionary (unique 1:1 mapping) + a strict
//     duration parser. NO LLM, NO guessing, NO fabrication.
//   • Preserve when unsure (§9): brands / commercial scent names / numeric Chinese expressions /
//     technical or business ambiguity / OEM promises → returned UNCHANGED (OWNER-C / UNKNOWN).
//     "宁可保留中文，也不制造错误英文."
//   • RENDER-TIME ONLY (§10): display layer. commerce_products.specifications / import source /
//     D1 are NEVER mutated. No migration, no new table.
//   • Exact whole-string match (no partial/substring replacement) → compounds like "玻璃/陶瓷/塑料"
//     are left intact rather than half-translated.
//   • Auditable: this dictionary is the single source of truth, version-controlled + unit-tested.
// ---------------------------------------------------------------------------

/** CJK detection: ideographs + CJK/fullwidth punctuation (【】、。 etc). */
const CJK_RE = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;

export function hasCJK(s: unknown): boolean {
  return CJK_RE.test(String(s ?? ""));
}

function has(map: Readonly<Record<string, string>>, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, k);
}

// ── Specification KEY (field label) localization — all 55 distinct CJK keys. ──────────
// Field labels assert no product fact (the VALUE does), so a deterministic 1:1 label is safe.
export const SPEC_KEY_LOCALIZATION: Readonly<Record<string, string>> = Object.freeze({
  货号: "Item No.",
  品牌: "Brand",
  功能: "Function",
  是否进口: "Imported",
  产品类别: "Product Category",
  香型: "Scent Type",
  时长: "Duration",
  物理形态: "Physical Form",
  产地: "Origin",
  是否跨境出口专供货源: "Cross-border Export Supply",
  规格类型: "Specification Type",
  箱装数量: "Carton Quantity",
  适用对象: "Suitable For",
  是否量贩装: "Bulk Pack",
  香味: "Scent",
  原料成分: "Ingredients",
  包装种类: "Packaging Type",
  调香师: "Perfumer",
  净含量: "Net Content",
  主要销售地区: "Main Sales Region",
  主要下游平台: "Main Downstream Platform",
  有可授权的自有品牌: "Licensable Own Brand",
  是否IP授权: "IP Authorized",
  适用场景: "Application Scene",
  材质: "Material",
  加工工艺: "Craftsmanship",
  容量: "Capacity",
  使用方式: "Usage Method",
  颜色: "Color",
  是否专利货源: "Patented Supply",
  支持小批量定制: "Small-Batch Customization",
  适合节日: "Suitable Festivals",
  加工定制: "Customization",
  外形: "Appearance",
  香味强度: "Scent Intensity",
  香调: "Scent Note",
  香水座材质: "Holder Material",
  摆放方式: "Placement Method",
  挥发时长: "Diffusion Duration",
  分类类型: "Category Type",
  保质期: "Shelf Life",
  形状: "Shape",
  尺寸: "Size",
  适用场所: "Suitable Places",
  执行质量标准: "Quality Standard",
  工艺: "Craftsmanship",
  加印LOGO: "Logo Printing",
  使用场所: "Usage Place",
  蜡烛种类: "Candle Type",
  是否属于礼品: "Gift Item",
  香味表现: "Scent Performance",
  规格: "Specification",
  适合场所: "Suitable Places",
  香料: "Fragrance",
  适用节日: "Suitable Festivals",
  // ── residual long-tail standard field labels (freq ≤3 each; still deterministic 1:1) ──
  包装: "Packaging",
  功效: "Efficacy",
  产品编号: "Product No.",
  IP授权类型: "IP License Type",
  IP名称: "IP Name",
  风格: "Style",
  适用送礼场合: "Gift Occasion",
  适用送礼关系: "Gift Recipient",
  送礼用途: "Gift Purpose",
  视觉效果: "Visual Effect",
  系列: "Series",
  燃烧特性: "Burn Characteristics",
  填充物类型: "Filling Type",
  功能特性: "Features",
  制作工艺: "Craftsmanship",
  使用稳定性: "Stability",
  使用场景: "Usage Scene",
  蜡烛分类: "Candle Category",
  线香粗细: "Incense Thickness",
  精油含量: "Essential Oil Content",
  类别: "Category",
  分类: "Category",
  物理状态: "Physical State",
  灯芯类型: "Wick Type",
  溶解性: "Solubility",
  服务: "Service",
  容器类型: "Container Type",
  受众人群: "Target Audience",
});

// ── VALUE localization ────────────────────────────────────────────────────────────────

// (1) GENERIC — unambiguous materials / scenes / forms; same meaning in any field → global.
const GENERIC_VALUES: Readonly<Record<string, string>> = Object.freeze({
  "家居/室内": "Home / Indoor",
  "礼品/节庆": "Gift / Festival",
  "玻璃/陶瓷": "Glass / Ceramic",
  "车载/汽车": "Car / Automotive",
  "玻璃+藤条": "Glass + Rattan",
  "石膏/晶石": "Plaster / Crystal",
  "酒店/商业": "Hotel / Commercial",
  "植物蜡/石蜡": "Plant Wax / Paraffin",
  液体: "Liquid",
  固体: "Solid",
  颗粒: "Granules",
  玻璃: "Glass",
  陶瓷: "Ceramic",
  石膏: "Plaster",
  纸质: "Paper",
  塑料: "Plastic",
  香薰: "Aromatherapy",
  香熏: "Aromatherapy",
  香薰精油: "Aromatherapy Essential Oil",
  大豆蜡: "Soy Wax",
  是: "Yes",
  否: "No",
  其它: "Other",
  其他: "Other",
});

// (2) GEOGRAPHIC — only under origin/region keys (so a brand that looks like a place is safe).
//     Data-confirmed: the same fields already carry "Zhejiang"/"Middle East"/"Wuxi" in English.
const GEO_KEYS = new Set([
  "产地",
  "主要销售地区",
  "Origin",
  "Main Sales Region",
  "Place of Origin",
]);
const GEO_VALUES: Readonly<Record<string, string>> = Object.freeze({
  浙江: "Zhejiang",
  中东: "Middle East",
  无锡: "Wuxi",
});

// (3) SCENT — generic botanical note families only, and only under scent keys. Poetic/commercial
//     scent names (北国雪松（雪落松间）, 蓝风铃（大牌香水味）…) are NOT here → preserved (OWNER-C).
const SCENT_KEYS = new Set([
  "香味",
  "香型",
  "香调",
  "Scent",
  "Scent Type",
  "Scent Note",
  "Fragrance",
]);
const SCENT_VALUES: Readonly<Record<string, string>> = Object.freeze({
  花香: "Floral",
  玫瑰香: "Rose",
  薰衣草香: "Lavender",
  熏衣草香: "Lavender",
  栀子花香: "Gardenia",
  小苍兰香: "Freesia",
  檀香: "Sandalwood",
  桂花香: "Osmanthus",
  桂花味: "Osmanthus",
  木质香: "Woody",
  松木香: "Pine",
  铃兰香: "Lily of the Valley",
  鼠尾草香: "Sage",
  香茅草味: "Lemongrass",
});

// (4) FUNCTION — under 功能 only.
const FUNCTION_KEYS = new Set(["功能", "Function", "Functions"]);
const FUNCTION_VALUES: Readonly<Record<string, string>> = Object.freeze({
  空气清新: "Air Freshening",
  增添香氛: "Adds Fragrance",
  除异味: "Removes Odor",
});

// (5) PACKAGING — under 包装种类 only.
const PACKAGING_KEYS = new Set(["包装种类", "Packaging Type", "Packaging"]);
const PACKAGING_VALUES: Readonly<Record<string, string>> = Object.freeze({
  盒装: "Boxed",
  礼盒装: "Gift Box",
  简装: "Simple Packaging",
});

// (6) AUDIENCE — under 适用对象 only.
const AUDIENCE_KEYS = new Set(["适用对象", "Suitable For", "Applicable Objects"]);
const AUDIENCE_VALUES: Readonly<Record<string, string>> = Object.freeze({
  全家适用: "Whole Family",
  母婴家庭: "Mother & Baby Family",
  烟民家庭: "Smoker Family",
});

// (7) CATEGORY — under 产品类别 only.
const CATEGORY_KEYS = new Set(["产品类别", "Product Category", "Category"]);
const CATEGORY_VALUES: Readonly<Record<string, string>> = Object.freeze({
  无火扩香: "Flameless Diffuser",
  香薰蜡烛: "Aromatherapy Candle",
});

// (8) INTENSITY — under 香味强度 only (中等 = "medium" intensity, not "medium size").
const INTENSITY_KEYS = new Set(["香味强度", "Scent Intensity", "Intensity"]);
const INTENSITY_VALUES: Readonly<Record<string, string>> = Object.freeze({
  中等: "Medium",
});

// (9) DURATION — deterministic parser (§4). Digit-based only, anchored to the WHOLE value, so
//     pure numbers / SKU / model / Chinese-numeral durations (三年) are NEVER touched. Numbers and
//     range preserved exactly; unit 天→days / 小时→hours; range separator normalized to en-dash.
const DURATION_KEYS = new Set(["时长", "挥发时长", "Duration", "Diffusion Duration"]);
// 天 and 日 both mean "day". Two input structures occur in the data:
//   unit-after-each:  "120天-180天"  → "120 days–180 days"  (§4 example, en-dash)
//   unit-at-end:      "61-90日"      → "61-90 days"         (matches existing English data form)
const DUR_RANGE_UNIT_EACH = /^(\d+)\s*[天日]\s*[-–~]\s*(\d+)\s*[天日]$/;
const DUR_RANGE_UNIT_END = /^(\d+)\s*[-–~]\s*(\d+)\s*[天日]$/;
const DUR_SINGLE_DAY = /^(\d+)\s*[天日]$/;
const DUR_RANGE_HOUR_EACH = /^(\d+)\s*小时\s*[-–~]\s*(\d+)\s*小时$/;
const DUR_RANGE_HOUR_END = /^(\d+)\s*[-–~]\s*(\d+)\s*小时$/;
const DUR_SINGLE_HOUR = /^(\d+)\s*小时$/;

function parseDuration(value: string, key: string): string | null {
  if (!DURATION_KEYS.has(key)) return null; // context gate (§7)
  const v = value.trim();
  let m = v.match(DUR_RANGE_UNIT_EACH);
  if (m) return `${m[1]} days\u2013${m[2]} days`;
  m = v.match(DUR_RANGE_UNIT_END);
  if (m) return `${m[1]}-${m[2]} days`;
  m = v.match(DUR_SINGLE_DAY);
  if (m) return `${m[1]} days`;
  m = v.match(DUR_RANGE_HOUR_EACH);
  if (m) return `${m[1]} hours\u2013${m[2]} hours`;
  m = v.match(DUR_RANGE_HOUR_END);
  if (m) return `${m[1]}-${m[2]} hours`;
  m = v.match(DUR_SINGLE_HOUR);
  if (m) return `${m[1]} hours`;
  return null;
}

/**
 * Localize a specification VALUE for public display — CONTEXT-AWARE.
 * `key` is the RAW specification key (CJK or English) providing the field semantics.
 * Returns the English display value only when a deterministic, context-appropriate rule applies;
 * otherwise returns the original UNCHANGED (brands / commercial scent names / numeric Chinese /
 * ambiguous / technical → preserved for owner review). Never mutates input, never fabricates.
 * Idempotent: an English result is not a dictionary key / duration pattern → returned as-is.
 */
export function localizeSpecValue(value: unknown, key?: unknown): string {
  const v = String(value ?? "");
  const k = String(key ?? "");
  if (has(GENERIC_VALUES, v)) return GENERIC_VALUES[v];
  if (GEO_KEYS.has(k) && has(GEO_VALUES, v)) return GEO_VALUES[v];
  if (SCENT_KEYS.has(k) && has(SCENT_VALUES, v)) return SCENT_VALUES[v];
  if (FUNCTION_KEYS.has(k) && has(FUNCTION_VALUES, v)) return FUNCTION_VALUES[v];
  if (PACKAGING_KEYS.has(k) && has(PACKAGING_VALUES, v)) return PACKAGING_VALUES[v];
  if (AUDIENCE_KEYS.has(k) && has(AUDIENCE_VALUES, v)) return AUDIENCE_VALUES[v];
  if (CATEGORY_KEYS.has(k) && has(CATEGORY_VALUES, v)) return CATEGORY_VALUES[v];
  if (INTENSITY_KEYS.has(k) && has(INTENSITY_VALUES, v)) return INTENSITY_VALUES[v];
  const dur = parseDuration(v, k);
  if (dur) return dur;
  return v; // preserve original (OWNER-C / UNKNOWN)
}

/**
 * Localize a specification KEY/label. `fallback` is the caller's existing label transform
 * (underscore→space + title-case) used when the key is not a controlled term.
 */
export function localizeSpecKey(key: string, fallback: string): string {
  const k = String(key ?? "");
  return has(SPEC_KEY_LOCALIZATION, k) ? SPEC_KEY_LOCALIZATION[k] : fallback;
}
