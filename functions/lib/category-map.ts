/**
 * 类目映射表 — 1688 类目 → Aromiso 分类
 *
 * 实测只有 7 种组合（234 产品中），一张死表即可。
 * category_l1 / category_l3 同时存原始中文备查。
 */

export interface CategoryMapping {
  l1: string;
  l3: string;
  aromisoCategory: string;
}

/** 1688 类目 → Aromiso category 映射（按 l1 > l3 匹配） */
export const CATEGORY_MAP: CategoryMapping[] = [
  { l1: "个护/家清", l3: "香薰", aromisoCategory: "Home Fragrance" },
  { l1: "汽车用品", l3: "车用香水香薰", aromisoCategory: "Car Fragrance" },
  { l1: "办公、文化", l3: "蜡烛", aromisoCategory: "Scented Candles" },
  { l1: "家用电器", l3: "香薰机", aromisoCategory: "Aroma Diffusers" },
  { l1: "办公、文化", l3: "创意礼品套装", aromisoCategory: "Gift Sets" },
];

/** 兜底分类（无法匹配时） */
const FALLBACK_CATEGORY = "Home Fragrance";

/**
 * 根据 1688 一级/三级类目中文名映射到 Aromiso 分类。
 *
 * @param l1 - 一级类目中文名
 * @param l3 - 三级类目中文名
 * @returns Aromiso category 字符串
 */
export function mapCategory(l1: string, l3: string): string {
  // 精确匹配 l1 + l3
  for (const mapping of CATEGORY_MAP) {
    if (mapping.l1 === l1 && mapping.l3 === l3) {
      return mapping.aromisoCategory;
    }
  }

  // 模糊匹配：只匹配 l3（三级类目更具区分度）
  for (const mapping of CATEGORY_MAP) {
    if (mapping.l3 === l3) {
      return mapping.aromisoCategory;
    }
  }

  // 模糊匹配：只匹配 l1
  for (const mapping of CATEGORY_MAP) {
    if (mapping.l1 === l1) {
      return mapping.aromisoCategory;
    }
  }

  // 兜底
  return FALLBACK_CATEGORY;
}

/**
 * Aromiso 全部 12 分类（供前台导航使用）。
 */
export const AROMISO_CATEGORIES = [
  "Essential Oils",
  "Fragrance Oils",
  "Reed Diffusers",
  "Home Fragrance",
  "Car Fragrance",
  "Scented Candles",
  "Aroma Diffusers",
  "Gift Sets",
  "Body Care",
  "Packaging",
  "Raw Materials",
  "Equipment",
] as const;

export type AromisoCategory = (typeof AROMISO_CATEGORIES)[number];
