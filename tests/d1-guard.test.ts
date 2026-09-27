import { describe, expect, it } from "vitest";
import {
  d1HealthCheck,
  getGuardState,
  isDailyExhaustion,
  recordQuotaFailure,
} from "../functions/lib/d1-guard";
import { MockD1, MockKV, mockEnv } from "./helpers";

describe("D1 guard recovery", () => {
  it("classifies daily rows-read exhaustion separately from transient limits", () => {
    expect(isDailyExhaustion("D1 daily row read limit exceeded")).toBe(true);
    expect(isDailyExhaustion("429 rate limit")).toBe(false);
    expect(isDailyExhaustion("network timeout")).toBe(false);
  });

  it("does not reopen a daily-exhausted guard after SELECT 1 succeeds", async () => {
    const drafts = new MockKV();
    const db = new MockD1().onFirst(/SELECT 1 AS ok/i, { ok: 1 });
    const env = mockEnv({
      DRAFTS: drafts as unknown as KVNamespace,
      DB: db as unknown as D1Database,
    });

    await recordQuotaFailure(env, "D1 daily row read limit exceeded");
    const result = await d1HealthCheck(env);

    expect(result).toEqual({ healthy: true, state: "WARNING", quota: true });
    expect((await getGuardState(env)).state).toBe("WARNING");
  });

  it("reopens a transiently limited guard after the database probe succeeds", async () => {
    const drafts = new MockKV();
    const db = new MockD1().onFirst(/SELECT 1 AS ok/i, { ok: 1 });
    const env = mockEnv({
      DRAFTS: drafts as unknown as KVNamespace,
      DB: db as unknown as D1Database,
    });

    await recordQuotaFailure(env, "429 rate limit");
    const result = await d1HealthCheck(env);

    expect(result).toEqual({ healthy: true, state: "NORMAL", quota: true });
    expect((await getGuardState(env)).state).toBe("NORMAL");
  });
});
