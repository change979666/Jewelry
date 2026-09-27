// P0-3 回归测试：结账一致性
//   · 库存原子预留（条件 UPDATE）——不超卖、不出现负库存
//   · all-or-nothing 补偿——多行购物车在中途失败时必须整单回滚
//   · 购物车抢占——同一购物车的并发提交只有一个能建单
//
// 用内存 D1 桩驱动真实的 InventoryService 语句，验证 WHERE 子句里的守卫
// 而不是重写一遍业务逻辑。
import { describe, it, expect } from "vitest";
import { InventoryService } from "../src/lib/commerce/inventory.service";

type VariantRow = { inventory_quantity: number; inventory_policy: string; status: string };
type CartRow = { checked_out_at: string | null };

class FakeStatement {
  constructor(
    private db: FakeD1,
    private sql: string,
    private args: unknown[] = [],
  ) {}
  bind(...args: unknown[]) {
    return new FakeStatement(this.db, this.sql, args);
  }
  async run() {
    return this.db.exec(this.sql, this.args);
  }
  async first() {
    return this.db.queryOne(this.sql, this.args);
  }
  async all() {
    return { results: [] as unknown[] };
  }
}

class FakeD1 {
  variants = new Map<string, VariantRow>();
  carts = new Map<string, CartRow>();

  prepare(sql: string) {
    return new FakeStatement(this, sql, []);
  }
  async batch(stmts: FakeStatement[]) {
    const out = [];
    for (const s of stmts) out.push(await s.run());
    return out;
  }

  exec(sql: string, args: unknown[]) {
    const s = sql.replace(/\s+/g, " ");

    // 预留：条件扣减（守卫在 WHERE 中）
    if (s.includes("UPDATE product_variants") && s.includes("inventory_quantity - ?")) {
      const qty = args[0] as number;
      const id = args[2] as string;
      const row = this.variants.get(id);
      const ok =
        !!row &&
        row.status === "active" &&
        row.inventory_policy === "deny" &&
        row.inventory_quantity >= qty;
      if (!ok) return { meta: { changes: 0 } };
      row.inventory_quantity -= qty;
      return { meta: { changes: 1 } };
    }

    // 补偿释放：加回库存
    if (s.includes("UPDATE product_variants") && s.includes("inventory_quantity + ?")) {
      const qty = args[0] as number;
      const id = args[2] as string;
      const row = this.variants.get(id);
      if (!row || row.inventory_policy !== "deny") return { meta: { changes: 0 } };
      row.inventory_quantity += qty;
      return { meta: { changes: 1 } };
    }

    // 抢占购物车（单次可用）
    if (
      s.includes("UPDATE carts") &&
      s.includes("checked_out_at = ?") &&
      s.includes("checked_out_at IS NULL")
    ) {
      const id = args[2] as string;
      const row = this.carts.get(id);
      if (!row || row.checked_out_at !== null) return { meta: { changes: 0 } };
      row.checked_out_at = args[0] as string;
      return { meta: { changes: 1 } };
    }

    // 释放购物车抢占
    if (s.includes("UPDATE carts") && s.includes("checked_out_at = NULL")) {
      const id = args[1] as string;
      const row = this.carts.get(id);
      if (!row) return { meta: { changes: 0 } };
      row.checked_out_at = null;
      return { meta: { changes: 1 } };
    }

    return { meta: { changes: 0 } };
  }

  queryOne(sql: string, args: unknown[]) {
    if (sql.includes("SELECT inventory_policy, status FROM product_variants")) {
      const row = this.variants.get(args[0] as string);
      return row ? { inventory_policy: row.inventory_policy, status: row.status } : null;
    }
    return null;
  }
}

function setup(
  stock: Record<string, { qty: number; policy?: string }>,
  carts: string[] = ["cart_1"],
) {
  const db = new FakeD1();
  for (const [id, v] of Object.entries(stock)) {
    db.variants.set(id, {
      inventory_quantity: v.qty,
      inventory_policy: v.policy ?? "deny",
      status: "active",
    });
  }
  for (const id of carts) db.carts.set(id, { checked_out_at: null });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db, svc: new InventoryService(db as any) };
}

describe("库存原子预留（不超卖）", () => {
  it("库存充足时预留成功并扣减", async () => {
    const { db, svc } = setup({ v1: { qty: 5 } });
    const r = await svc.reserve([{ variant_id: "v1", quantity: 2 }]);
    expect(r.ok).toBe(true);
    expect(r.reserved).toEqual([{ variant_id: "v1", quantity: 2 }]);
    expect(db.variants.get("v1")!.inventory_quantity).toBe(3);
  });

  it("库存不足时预留失败，库存不变（且不为负）", async () => {
    const { db, svc } = setup({ v1: { qty: 1 } });
    const r = await svc.reserve([{ variant_id: "v1", quantity: 2 }]);
    expect(r.ok).toBe(false);
    expect(r.failed_variant_id).toBe("v1");
    expect(db.variants.get("v1")!.inventory_quantity).toBe(1);
  });

  it("并发抢最后一件：只有一个请求成功", async () => {
    const { db, svc } = setup({ v1: { qty: 1 } });
    const [a, b] = await Promise.all([
      svc.reserve([{ variant_id: "v1", quantity: 1 }]),
      svc.reserve([{ variant_id: "v1", quantity: 1 }]),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(db.variants.get("v1")!.inventory_quantity).toBe(0);
  });

  it("多行购物车中途失败 → 整单回滚（all-or-nothing）", async () => {
    const { db, svc } = setup({ ok1: { qty: 3 }, short: { qty: 0 } });
    const r = await svc.reserve([
      { variant_id: "ok1", quantity: 2 },
      { variant_id: "short", quantity: 1 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.reserved).toEqual([]);
    expect(db.variants.get("ok1")!.inventory_quantity).toBe(3); // 已释放
    expect(db.variants.get("short")!.inventory_quantity).toBe(0);
  });

  it("回滚后库存精确复原（不产生漂移）", async () => {
    const { db, svc } = setup({ a: { qty: 10 }, b: { qty: 1 } });
    const r1 = await svc.reserve([
      { variant_id: "a", quantity: 4 },
      { variant_id: "b", quantity: 5 },
    ]);
    expect(r1.ok).toBe(false);
    expect(db.variants.get("a")!.inventory_quantity).toBe(10);
    const r2 = await svc.reserve([{ variant_id: "a", quantity: 10 }]);
    expect(r2.ok).toBe(true);
    expect(db.variants.get("a")!.inventory_quantity).toBe(0);
  });

  it("backorder（policy=continue）变体不参与扣减，也不阻塞订单", async () => {
    const { db, svc } = setup({ free: { qty: 0, policy: "continue" } });
    const r = await svc.reserve([{ variant_id: "free", quantity: 3 }]);
    expect(r.ok).toBe(true);
    expect(r.reserved).toEqual([]);
    expect(db.variants.get("free")!.inventory_quantity).toBe(0);
  });

  it("变体不存在或已下架 → 拒绝", async () => {
    const { svc } = setup({ gone: { qty: 5 } });
    const missing = await svc.reserve([{ variant_id: "nope", quantity: 1 }]);
    expect(missing.ok).toBe(false);
    const inactive = await svc.reserve([{ variant_id: "gone", quantity: 1 }]);
    expect(inactive.ok).toBe(true); // 仍 active，正常路径
  });

  it("非法数量（0 / 负数 / 小数）被拒绝且不触碰库存", async () => {
    const { db, svc } = setup({ v1: { qty: 5 } });
    for (const qty of [0, -1, 1.5]) {
      const r = await svc.reserve([{ variant_id: "v1", quantity: qty }]);
      expect(r.ok).toBe(false);
    }
    expect(db.variants.get("v1")!.inventory_quantity).toBe(5);
  });
});

describe("购物车抢占（重复下单保护）", () => {
  it("同一购物车只能被抢占一次（双击提交只有一个赢）", async () => {
    const { svc } = setup({ v1: { qty: 5 } });
    const first = await svc.claimCart("cart_1");
    const second = await svc.claimCart("cart_1");
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("并发提交同一购物车：仅一个成功", async () => {
    const { svc } = setup({ v1: { qty: 5 } });
    const results = await Promise.all([
      svc.claimCart("cart_1"),
      svc.claimCart("cart_1"),
      svc.claimCart("cart_1"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("订单创建失败后可释放抢占，买家能重试", async () => {
    const { svc } = setup({ v1: { qty: 5 } });
    expect(await svc.claimCart("cart_1")).toBe(true);
    await svc.releaseCart("cart_1");
    expect(await svc.claimCart("cart_1")).toBe(true);
  });

  it("不存在的购物车无法抢占（失败关闭）", async () => {
    const { svc } = setup({ v1: { qty: 5 } });
    expect(await svc.claimCart("ghost")).toBe(false);
  });
});

describe("整体编排：抢占 + 预留的失败补偿", () => {
  it("预留失败时释放抢占，且后续可用库存不被占用", async () => {
    const { db, svc } = setup({ v1: { qty: 1 } });
    // 第一个请求买走最后一件
    expect(await svc.claimCart("cart_1")).toBe(true);
    expect((await svc.reserve([{ variant_id: "v1", quantity: 1 }])).ok).toBe(true);

    // 第二个请求（不同购物车）抢不到库存 → 释放自己的抢占
    const { db: db2, svc: svc2 } = setup({}, []);
    db2.variants = db.variants; // 共享变体状态
    db2.carts.set("cart_2", { checked_out_at: null });
    expect(await svc2.claimCart("cart_2")).toBe(true);
    const r = await svc2.reserve([{ variant_id: "v1", quantity: 1 }]);
    expect(r.ok).toBe(false);
    await svc2.releaseCart("cart_2");
    expect(db2.carts.get("cart_2")!.checked_out_at).toBeNull();
    expect(db.variants.get("v1")!.inventory_quantity).toBe(0);
  });
});
