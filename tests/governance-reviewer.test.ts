// ---------------------------------------------------------------------------
//  V5.69 AI Governance Reviewer — 代码边界单测（mock lib/ai）
//  核心：白名单外 approve 被代码强制 escalate；AI 失败/非法输出 fail-closed=escalate；
//        白名单内 approve 生效。审核官无权扩权。
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../functions/lib/ai", () => ({
  aiJson: vi.fn(),
  loadRoleChecked: vi.fn(async () => ({ role: null, state: "not_found" })),
}));

import { aiJson } from "../functions/lib/ai";
import { reviewGovernance, AUTO_APPROVE_SCOPE } from "../functions/lib/governance-reviewer";

const mockedAiJson = vi.mocked(aiJson);
const env = {} as never;

beforeEach(() => {
  mockedAiJson.mockReset();
});

describe("reviewGovernance — 代码硬边界", () => {
  it("白名单内 + AI approve → approve", async () => {
    mockedAiJson.mockResolvedValue({
      decision: "approve",
      reasons: ["gates pass"],
      confidence: 90,
    });
    const r = await reviewGovernance(env, undefined, {
      action_type: "content_auto_publish",
      subject: "blog:x:en",
      summary: "publish x",
    });
    expect(r.decision).toBe("approve");
    expect(r.scope_allowed).toBe(true);
    expect(r.forced).toBe(false);
  });

  it("白名单外 + AI approve → 被代码强制 escalate（审核官无权扩权）", async () => {
    mockedAiJson.mockResolvedValue({ decision: "approve", reasons: ["ok"], confidence: 99 });
    const r = await reviewGovernance(env, undefined, {
      action_type: "product_price_change", // 不在 AUTO_APPROVE_SCOPE
      subject: "prod:1",
      summary: "change price",
    });
    expect(r.decision).toBe("escalate");
    expect(r.scope_allowed).toBe(false);
    expect(r.forced).toBe(true);
    expect(r.reasons.some((x) => x.includes("outside AUTO_APPROVE_SCOPE"))).toBe(true);
  });

  it("AI reject → reject（白名单内也尊重拒绝）", async () => {
    mockedAiJson.mockResolvedValue({
      decision: "reject",
      reasons: ["fabricated claim"],
      confidence: 80,
    });
    const r = await reviewGovernance(env, undefined, {
      action_type: "content_auto_publish",
      subject: "blog:y:en",
      summary: "publish y",
    });
    expect(r.decision).toBe("reject");
  });

  it("AI 抛错 → fail-closed escalate（绝不自动 approve）", async () => {
    mockedAiJson.mockRejectedValue(new Error("ai down"));
    const r = await reviewGovernance(env, undefined, {
      action_type: "content_auto_publish",
      subject: "blog:z:en",
      summary: "publish z",
    });
    expect(r.decision).toBe("escalate");
    expect(r.reasons.some((x) => x.includes("fail-closed"))).toBe(true);
  });

  it("AI 返回非法决策 → fail-closed escalate", async () => {
    mockedAiJson.mockResolvedValue({ decision: "maybe", reasons: [] });
    const r = await reviewGovernance(env, undefined, {
      action_type: "content_auto_publish",
      subject: "blog:w:en",
      summary: "publish w",
    });
    expect(r.decision).toBe("escalate");
  });

  it("AI 返回 null（预算/限流）→ fail-closed escalate", async () => {
    mockedAiJson.mockResolvedValue(null);
    const r = await reviewGovernance(env, undefined, {
      action_type: "content_auto_publish",
      subject: "blog:v:en",
      summary: "publish v",
    });
    expect(r.decision).toBe("escalate");
  });

  it("AUTO_APPROVE_SCOPE 仅含 content_auto_publish（默认最小授权）", () => {
    expect(AUTO_APPROVE_SCOPE).toEqual(["content_auto_publish"]);
  });
});
