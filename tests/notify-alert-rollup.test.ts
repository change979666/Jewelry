// ---------------------------------------------------------------------------
//  notify 告警汇总测试（V5.83 邮件收敛）
//
//  Owner 反馈「每天收到多封日报/告警邮件太繁琐」。V5.83 起：
//    🟡 警告 → 不再即时发信，写入日内汇总（KV notify:rollup:<北京日期>），
//              由当日唯一一封日报的「⚠️ 需要关注」板块统一呈现；
//    🔴 高危 → 仍即时发信（6h 冷却），同时落一份到汇总供日报留档。
//  本测试锁定上述契约，防止回退成「每类告警一封邮件」。
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";
import { sendAlert } from "../functions/lib/notify";
import { mockEnv, MockKV } from "./helpers";
import type { Env } from "../functions/types";

interface ResendCall {
  url: string;
  payload: Record<string, unknown>;
}

/** 捕获 Resend 调用；其余请求返回空 200。 */
function stubResend(calls: ResendCall[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("api.resend.com")) {
        calls.push({ url: u, payload: JSON.parse(String(init?.body ?? "{}")) });
        return new Response(JSON.stringify({ id: "re_test" }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }),
  );
}

function baseEnv(kv: MockKV): Env {
  return mockEnv({
    DRAFTS: kv as unknown as KVNamespace,
    RESEND_API_KEY: "test-key",
    RESEND_TO: "owner@aromiso.com",
    RESEND_FROM: "Aromiso AI <sales@aromiso.com>",
  });
}

const bjToday = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendAlert — V5.83 邮件收敛（🟡 汇总 / 🔴 即时）", () => {
  it("🟡 warn → 不即时发信，写入日内汇总并返回 rolled", async () => {
    const kv = new MockKV();
    const env = baseEnv(kv);
    const calls: ResendCall[] = [];
    stubResend(calls);

    const result = await sendAlert(env, {
      level: "warn",
      code: "blocked:growth_sync",
      title: "Growth 阶段出现异常",
      lines: ["今日累计 1 次；其余阶段不受影响"],
    });

    expect(result).toBe("rolled");
    expect(calls).toHaveLength(0); // 关键：warn 不再产生独立邮件

    const raw = await kv.get(`notify:rollup:${bjToday()}`);
    expect(raw).toBeTruthy();
    const rolled = JSON.parse(String(raw)) as { code: string; level: string; title: string }[];
    expect(rolled).toHaveLength(1);
    expect(rolled[0].code).toBe("blocked:growth_sync");
    expect(rolled[0].level).toBe("warn");
    expect(rolled[0].title).toContain("Growth");
  });

  it("同 code 重复 warn → 汇总内去重（只保留最新一条）", async () => {
    const kv = new MockKV();
    const env = baseEnv(kv);
    const calls: ResendCall[] = [];
    stubResend(calls);

    await sendAlert(env, { level: "warn", code: "budget_cap", title: "旧标题", lines: ["a"] });
    await sendAlert(env, { level: "warn", code: "budget_cap", title: "新标题", lines: ["b"] });
    await sendAlert(env, { level: "warn", code: "other_code", title: "另一类", lines: ["c"] });

    const rolled = JSON.parse(String(await kv.get(`notify:rollup:${bjToday()}`))) as {
      code: string;
      title: string;
    }[];
    expect(rolled).toHaveLength(2);
    const budget = rolled.find((r) => r.code === "budget_cap");
    expect(budget?.title).toBe("新标题"); // 保留最新
    expect(calls).toHaveLength(0);
  });

  it("🔴 critical → 仍即时发信，且同时落汇总留档", async () => {
    const kv = new MockKV();
    const env = baseEnv(kv);
    const calls: ResendCall[] = [];
    stubResend(calls);

    const result = await sendAlert(env, {
      level: "critical",
      code: "truthfulness",
      title: "真实性闸拦截",
      lines: ["内容含未经基线确认的认证声明"],
      needHuman: true,
    });

    expect(result).toBe("sent");
    expect(calls).toHaveLength(1); // 高危仍即时送达
    expect(String(calls[0].payload.subject)).toContain("高危");

    const rolled = JSON.parse(String(await kv.get(`notify:rollup:${bjToday()}`))) as {
      code: string;
      level: string;
    }[];
    expect(rolled.some((r) => r.code === "truthfulness" && r.level === "critical")).toBe(true);
  });
});
