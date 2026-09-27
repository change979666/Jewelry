/**
 * 属性归一化别名表 — 1688 原始属性（199 键）→ ~20 规范 key
 *
 * 双层写入：
 *   attributes JSON  → 199 个原始键值对全量保留（C 层备查 / AI 原材料）
 *   specifications JSON → 归一化后的规范 key（A 层前台展示）
 *
 * 每个规范 key 对应一个别名集合（真实出现在 Excel 中的属性名），
 * 匹配时忽略大小写 + trim。
 */

/** 规范 key → 别名列表（按出现频率降序） */
export const ATTRIBUTE_ALIASES: Record<string, string[]> = {
  brand: ["Brand", "品牌"],
  origin: ["Origin", "产地"],
  function: ["Function", "功能"],
  physical_form: ["Physical form", "Physical Form", "物理形态"],
  fragrance: ["Fragrance", "Fragrant type", "Fragrance type", "香型", "香味"],
  duration: ["Duration", "时长"],
  applicable_scene: ["Applicable objects", "Suitable for:", "适用对象", "适用场景"],
  sales_region: [
    "Main sales area",
    "Main sales areas",
    "Major sales areas",
    "主要销售地区",
    "主要销售区域",
  ],
  downstream_platform: ["Main downstream platforms", "Main downstream platform", "主要下游平台"],
  cross_border: [
    "Whether the source of cross-border export is exclusive",
    "Whether to exclusively supply for cross-border export",
    "是否跨境出口专供货源",
  ],
  private_label: ["There are licensable private brands", "有可授权的自有品牌"],
  material: ["Perfume holder material", "Material", "材质"],
  item_number: ["Item No.", "Item number", "货号"],
  packaging_type: ["Packaging type", "包装种类"],
  net_content: ["Net content", "净含量"],
  bulk_pack: ["Is it a bulk pack?", "Bulk pack?", "Bulk pack available?", "是否量贩装"],
  pcs_per_carton: [
    "Packing quantity",
    "Box quantity",
    "箱装数量",
    "Quantity packed in boxes",
    "装箱数",
  ],
  certification: ["Certificate type", "认证", "证书类型"],
  style: ["Style", "风格"],
  shelf_life: ["Shelf life", "保质期"],
};

/**
 * 构建反向索引：别名小写 → 规范 key
 * 用于 O(1) 查找某个原始属性名应映射到哪个规范 key
 */
const aliasToCanonical = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(ATTRIBUTE_ALIASES)) {
  for (const alias of aliases) {
    aliasToCanonical.set(alias.toLowerCase().trim(), canonical);
  }
}

/**
 * 归一化单个属性键值对。
 * 返回规范 key（如果在别名表中）或 null（低频属性，仅留 attributes JSON）。
 */
export function normalizeAttributeKey(rawKey: string): string | null {
  return aliasToCanonical.get(rawKey.toLowerCase().trim()) ?? null;
}

/**
 * 将 1688 原始属性数组归一化为 specifications JSON。
 *
 * @param rawAttributes - 原始属性数组，如 [{name: "Brand", value: "Zuo he"}, ...]
 * @returns 两个对象：
 *   - attributes: 全量原始键值对（199 个）
 *   - specifications: 归一化后的规范 key 子集（~20 个）
 */
export function normalizeAttributes(rawAttributes: Array<{ name: string; value: string }>): {
  attributes: Record<string, string>;
  specifications: Record<string, string>;
} {
  const attributes: Record<string, string> = {};
  const specifications: Record<string, string> = {};

  for (const attr of rawAttributes) {
    // 全量写入 attributes（原始 key + value）
    attributes[attr.name] = attr.value;

    // 尝试归一化写入 specifications
    const canonical = normalizeAttributeKey(attr.name);
    if (canonical) {
      // 如果已有同规范 key，用逗号追加（有些产品多个同名属性）
      if (specifications[canonical]) {
        specifications[canonical] += ", " + attr.value;
      } else {
        specifications[canonical] = attr.value;
      }
    }
  }

  return { attributes, specifications };
}

/**
 * 从归一化属性中提取装箱数（pcs_per_carton）。
 * 返回 number 或 null。
 */
export function extractPcsPerCarton(
  rawAttributes: Array<{ name: string; value: string }>,
): number | null {
  for (const attr of rawAttributes) {
    const canonical = normalizeAttributeKey(attr.name);
    if (canonical === "pcs_per_carton") {
      const num = parseInt(attr.value, 10);
      return Number.isFinite(num) && num > 0 ? num : null;
    }
  }
  return null;
}
