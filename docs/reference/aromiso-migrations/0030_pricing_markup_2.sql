-- V5.326 定价加价倍数调整：3 倍 → 2 倍（owner 决策：人民币成本加一倍再折美元，例 ¥10 → ¥20 ÷ 7.1）
-- 1) 全局默认加价倍数改 2.0
UPDATE commerce_settings SET value = '2.0' WHERE key = 'default_markup';

-- 2) 存量 USD 阶梯价全库重算：×2/3（等价于加价倍数 3→2），保留 $0.99 下限
UPDATE commerce_price_tiers
SET unit_price = MAX(0.99, ROUND(unit_price * 2.0 / 3.0, 2))
WHERE currency = 'USD' AND unit_price > 0;
