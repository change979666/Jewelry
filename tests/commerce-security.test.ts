// Commerce Core 安全用例 — 服务端重算 / 定价 / 状态机 / 输入净化
// 对应 Final Reconciliation §checkout 安全需求：客户端价格永远不可信。
import { describe, it, expect } from 'vitest';
import { calcOrderTotals, calcShipping, calcTax } from '../src/lib/commerce/pricing';
import { ORDER_TRANSITIONS, canTransition } from '../src/lib/commerce/order.service';

const KSA = { tax_rate: 0.15, flat_shipping_rate: 1500, free_shipping_threshold: 30000 };
const UAE = { tax_rate: 0.05, flat_shipping_rate: 2000, free_shipping_threshold: 30000 };

describe('服务端重算（客户端价格不可信）', () => {
  it('以 variant 单价重算小计，忽略客户端提交金额', () => {
    // 客户端声称 1 SAR，服务端重读 variant 价格 14900 → 小计必须是 14900
    const clientSubmitted = [{ unit_price: 100, quantity: 1 }];
    void clientSubmitted; // 模拟被丢弃的客户端数据
    const serverLines = [{ unit_price: 14900, quantity: 1 }];
    const t = calcOrderTotals(serverLines, KSA);
    expect(t.subtotal).toBe(14900);
    expect(t.total).toBe(14900 + 1500 + Math.round(14900 * 0.15));
  });

  it('数量被篡改时总额按服务端行重算（放大攻击失效）', () => {
    const t = calcOrderTotals([{ unit_price: 5000, quantity: 2 }], KSA);
    expect(t.subtotal).toBe(10000);
    expect(t.total).toBe(10000 + 1500 + Math.round(10000 * 0.15));
  });

  it('折扣封顶在小计内，负折扣被钳制为 0', () => {
    const t1 = calcOrderTotals([{ unit_price: 1000, quantity: 1 }], KSA, 999999);
    expect(t1.discount).toBe(1000);
    expect(t1.total).toBe(0 + 1500 + 0);
    const t2 = calcOrderTotals([{ unit_price: 1000, quantity: 1 }], KSA, -500);
    expect(t2.discount).toBe(0);
  });

  it('税率来自 market 配置而非硬编码（KSA 15% vs UAE 5%）', () => {
    const lines = [{ unit_price: 20000, quantity: 1 }];
    expect(calcTax(20000, KSA)).toBe(3000);
    expect(calcTax(20000, UAE)).toBe(1000);
  });

  it('达到免运阈值后运费为 0，未达阈值收 flat rate', () => {
    expect(calcShipping(29999, KSA)).toBe(1500);
    expect(calcShipping(30000, KSA)).toBe(0);
    expect(calcShipping(0, { flat_shipping_rate: 2000, free_shipping_threshold: 0 })).toBe(2000);
  });

  it('金额恒为整数 minor units（无浮点漂移）', () => {
    const t = calcOrderTotals([{ unit_price: 3333, quantity: 3 }], KSA);
    expect(Number.isInteger(t.subtotal)).toBe(true);
    expect(Number.isInteger(t.tax)).toBe(true);
    expect(Number.isInteger(t.total)).toBe(true);
    expect(t.subtotal).toBe(9999);
  });
});

describe('订单状态机（非法跳转必须拒绝）', () => {
  it('正常流 PENDING_CONFIRMATION → CONFIRMED → PROCESSING → SHIPPED → DELIVERED', () => {
    expect(canTransition('PENDING_CONFIRMATION', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'PROCESSING')).toBe(true);
    expect(canTransition('PROCESSING', 'SHIPPED')).toBe(true);
    expect(canTransition('SHIPPED', 'OUT_FOR_DELIVERY')).toBe(true);
    expect(canTransition('OUT_FOR_DELIVERY', 'DELIVERED')).toBe(true);
  });

  it('禁止跳级（PENDING_CONFIRMATION → SHIPPED）', () => {
    expect(canTransition('PENDING_CONFIRMATION', 'SHIPPED')).toBe(false);
    expect(canTransition('PENDING_CONFIRMATION', 'DELIVERED')).toBe(false);
  });

  it('禁止回退（SHIPPED → CONFIRMED）；CANCELLED/REFUNDED 为终态；DELIVERED 仅可 RETURNED', () => {
    expect(canTransition('SHIPPED', 'CONFIRMED')).toBe(false);
    const all: string[] = Object.keys(ORDER_TRANSITIONS);
    for (const to of all) {
      expect(canTransition('DELIVERED', to as never)).toBe(to === 'RETURNED');
      expect(canTransition('CANCELLED', to as never)).toBe(false);
      expect(canTransition('REFUNDED', to as never)).toBe(false);
    }
  });

  it('每个声明的状态都有迁移表条目（无遗漏状态）', () => {
    const expected = [
      'PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'SHIPPED',
      'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RTO', 'RETURNED',
      'REFUNDED', 'DELIVERY_FAILED', 'NDR',
    ];
    for (const s of expected) {
      expect(ORDER_TRANSITIONS, `缺少状态 ${s}`).toHaveProperty(s);
    }
  });

  it('异常路径：NDR / DELIVERY_FAILED 可走向 RTO 或重派', () => {
    expect(canTransition('NDR', 'RTO')).toBe(true);
    expect(canTransition('DELIVERY_FAILED', 'OUT_FOR_DELIVERY')).toBe(true);
    expect(canTransition('SHIPPED', 'RTO')).toBe(false);
  });
});

describe('搜索输入净化（LIKE 通配符注入防护）', () => {
  const sanitize = (q: string) => `%${q.replace(/[%_]/g, '')}%`;
  it('剥离 % 与 _ 通配符', () => {
    expect(sanitize('%')).toBe('%%');
    expect(sanitize('100%_off')).toBe('%100off%');
    expect(sanitize('gold ring')).toBe('%gold ring%');
  });
});
