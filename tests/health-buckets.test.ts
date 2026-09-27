// ---------------------------------------------------------------------------
//  V5.69 — 健康分「失败信号分桶」诊断器测试
//
//  覆盖：
//    ① classifySignal 纯函数五桶判定 + first-match 优先级（孤儿 > 外部 > 自有 > 真失败）
//    ② slow_success vs false_fail 由「窗口内是否有成功拉取」决定
//    ③ classifyHealthBuckets 聚合 + 每源独立容错（表缺失/查询抛错不阻断）
//    ④ clean_of_own_faults 语义（external-only 的红不该算自有故障）
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { classifySignal, classifyHealthBuckets } from "../functions/lib/health-buckets";
import { MockD1 } from "./helpers";

describe("classifySignal — 五桶判定", () => {
  it("孤儿扫描产物 + 窗口内有成功拉取 → slow_success", () => {
    const r = classifySignal("startMission 孤儿任务扫描自动清理：running 超 30 分钟", true);
    expect(r.bucket).toBe("slow_success");
    expect(r.matched).toBeTruthy();
  });

  it("孤儿扫描产物 + 窗口内无成功拉取 → false_fail", () => {
    const r = classifySignal("超时未完成（running 超 90 分钟，自动标记）", false);
    expect(r.bucket).toBe("false_fail");
  });

  it("GA4/GSC/403/timeout/quota 等 → external", () => {
    expect(classifySignal("GA4 2026-09-01 返回 0 行", true).bucket).toBe("external");
    expect(classifySignal("HTTP 403 PERMISSION_DENIED from Google API", true).bucket).toBe(
      "external",
    );
    expect(classifySignal("Resend send timeout", true).bucket).toBe("external");
    expect(classifySignal("AI budget exhausted / 余额不足", true).bucket).toBe("external");
  });

  it("D1/KV/R2/SQL/迁移/no such column → system", () => {
    expect(classifySignal("D1 prepare failed: no such column: cover_image", true).bucket).toBe(
      "system",
    );
    expect(classifySignal("KV put threw", true).bucket).toBe("system");
    expect(classifySignal("migration 未跑导致 schema 缺列", true).bucket).toBe("system");
  });

  it("孤儿标记优先于外部关键词（first-match-wins）", () => {
    // 同时含 orphan 标记与 ga4：应归 slow_success/false_fail，而非 external
    expect(classifySignal("cron-pull ga4 孤儿任务扫描自动清理", true).bucket).toBe("slow_success");
  });

  it("无法归类的失败 → true_fail", () => {
    const r = classifySignal("AI 未产出有效发现，本轮不入库", true);
    expect(r.bucket).toBe("true_fail");
    expect(r.matched).toBe("");
  });

  it("大小写不敏感", () => {
    expect(classifySignal("SQLITE_CONSTRAINT unique violation", true).bucket).toBe("system");
    expect(classifySignal("Rate Limit exceeded (429)", true).bucket).toBe("external");
  });
});

describe("classifyHealthBuckets — 聚合与容错", () => {
  it("db 缺失返回 null（不阻断）", async () => {
    expect(await classifyHealthBuckets(undefined, 7)).toBeNull();
  });

  it("空库：0 信号，clean_of_own_faults=true，摘要为无失败", async () => {
    const db = new MockD1();
    const r = await classifyHealthBuckets(db as unknown as D1Database, 7);
    expect(r).not.toBeNull();
    expect(r!.signal_count).toBe(0);
    expect(r!.clean_of_own_faults).toBe(true);
    expect(r!.summary).toContain("无失败信号");
  });

  it("聚合多源信号并正确分桶 + degraded 源单列", async () => {
    const db = new MockD1();
    // 窗口内有成功拉取 → 孤儿归 slow_success
    db.onFirst(/FROM pull_state WHERE status = 'ok'/, { c: 3 });
    db.onAll(/FROM pull_state WHERE status = 'degraded'/, [{ source: "ga4", date: "2026-09-05" }]);
    db.onAll(/FROM task_runs/, [
      {
        idempotency_key: "cron-pull:2026-09-06",
        detail: "孤儿任务扫描自动清理：running 超 90 分钟",
      },
      { idempotency_key: "os-daily:strategist", detail: "D1 no such column: payload" },
    ]);
    db.onAll(/FROM ai_missions/, [
      {
        mission_type: "opportunity_scan",
        agent_name: "Analyst",
        blocked_reason: "GA4 API 403 PERMISSION_DENIED",
        error_message: null,
      },
    ]);
    db.onAll(/FROM ai_action_logs/, [
      { action_type: "ai_analysis", tool_used: "aiJson", error_message: "AI 无有效产出" },
    ]);

    const r = await classifyHealthBuckets(db as unknown as D1Database, 7);
    expect(r).not.toBeNull();
    // degraded(ga4→external) + GA4 403 mission(external) = 2
    expect(r!.totals.external).toBe(2);
    // cron-pull 孤儿 = slow_success
    expect(r!.totals.slow_success).toBe(1);
    // D1 no such column = system
    expect(r!.totals.system).toBe(1);
    // AI 无产出 = true_fail
    expect(r!.totals.true_fail).toBe(1);
    expect(r!.degraded_sources).toContain("ga4/2026-09-05");
    expect(r!.clean_of_own_faults).toBe(false);
    expect(r!.summary).toContain("需优先排查");
  });

  it("external-only 的红：clean_of_own_faults=true，摘要提示不必改代码", async () => {
    const db = new MockD1();
    db.onFirst(/FROM pull_state WHERE status = 'ok'/, { c: 0 });
    db.onAll(/FROM ai_missions/, [
      {
        mission_type: "x",
        agent_name: "A",
        blocked_reason: "Resend 502 upstream",
        error_message: null,
      },
    ]);
    const r = await classifyHealthBuckets(db as unknown as D1Database, 7);
    expect(r!.totals.external).toBe(1);
    expect(r!.totals.system).toBe(0);
    expect(r!.totals.true_fail).toBe(0);
    expect(r!.clean_of_own_faults).toBe(true);
    expect(r!.summary).toContain("非自有代码故障");
  });

  it("单表查询抛错不阻断其余分桶（每源独立容错）", async () => {
    const db = new MockD1();
    db.onFirst(/FROM pull_state WHERE status = 'ok'/, { c: 1 });
    // task_runs 查询注入故障
    db.onError(/FROM task_runs/);
    db.onAll(/FROM ai_missions/, [
      { mission_type: "m", agent_name: "A", blocked_reason: "KV put failed", error_message: null },
    ]);
    const r = await classifyHealthBuckets(db as unknown as D1Database, 7);
    expect(r).not.toBeNull();
    // task_runs 挂了但 ai_missions 的 system 信号仍被统计
    expect(r!.totals.system).toBe(1);
  });
});

describe("classifyHealthBuckets — PHASE E 调参建议（仅建议，不自动改阈值）", () => {
  it("无信号 → advisories 为空", async () => {
    const db = new MockD1();
    const r = await classifyHealthBuckets(db as unknown as D1Database, 7);
    expect(r!.advisories).toEqual([]);
  });

  it("slow_success ≥3 → 建议上调 ORPHAN_SEC", async () => {
    const db = new MockD1();
    db.onFirst(/FROM pull_state WHERE status = 'ok'/, { c: 1 }); // pullOk → 孤儿归 slow_success
    db.onAll(/FROM task_runs/, [
      { idempotency_key: "a", detail: "孤儿任务扫描自动清理：running 超 90 分钟" },
      { idempotency_key: "b", detail: "孤儿任务扫描自动清理：running 超 90 分钟" },
      { idempotency_key: "c", detail: "超时未完成（running 超 90 分钟，自动标记）" },
    ]);
    const r = await classifyHealthBuckets(db as unknown as D1Database, 7);
    expect(r!.totals.slow_success).toBe(3);
    expect(r!.advisories.some((a) => a.includes("ORPHAN_SEC"))).toBe(true);
  });

  it("降级源存在 → 建议核对第三方权限/密钥", async () => {
    const db = new MockD1();
    db.onAll(/FROM pull_state WHERE status = 'degraded'/, [{ source: "ga4", date: "2026-09-05" }]);
    const r = await classifyHealthBuckets(db as unknown as D1Database, 7);
    expect(r!.degraded_sources).toContain("ga4/2026-09-05");
    expect(r!.advisories.some((a) => a.includes("摄取降级"))).toBe(true);
  });
});
