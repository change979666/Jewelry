// ---------------------------------------------------------------------------
//  Login rate limiting tests
//  Verifies: 5 attempts allowed per IP per 15-min window, 6th returns 429.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from "vitest";
import { onRequestPost } from "../functions/api/admin/login";
import { mockEnv, mockRequest, mockContext } from "./helpers";

describe("login rate limiting", () => {
  let env: ReturnType<typeof mockEnv>;
  const IP = "203.0.113.42";

  beforeEach(() => {
    env = mockEnv();
  });

  async function attemptLogin(password: string) {
    const req = mockRequest({ password }, { ip: IP });
    const ctx = mockContext(env, req) as any;
    return onRequestPost(ctx);
  }

  it("allows up to 5 attempts then returns 429", async () => {
    // First 5 attempts (wrong password) should return 401
    for (let i = 1; i <= 5; i++) {
      const res = await attemptLogin("wrong-password");
      expect(res.status, `attempt ${i}`).toBe(401);
    }

    // 6th attempt should be rate-limited regardless of password
    const res = await attemptLogin("test-password-123");
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("Too many");
  });

  it("rate limit is per-IP — different IPs are independent", async () => {
    // Exhaust IP-A
    for (let i = 0; i < 5; i++) {
      await attemptLogin("wrong");
    }
    const blocked = await attemptLogin("test-password-123");
    expect(blocked.status).toBe(429);

    // IP-B should still work
    const reqB = mockRequest({ password: "test-password-123" }, { ip: "198.51.100.7" });
    const ctxB = mockContext(env, reqB) as any;
    const resB = await onRequestPost(ctxB);
    expect(resB.status).toBe(200);
  });

  it("successful login within limit returns 200 + session cookie", async () => {
    const res = await attemptLogin("test-password-123");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(res.headers.get("Set-Cookie")).toContain("jewelry_admin=");
  });

  it("wrong password returns 401", async () => {
    const res = await attemptLogin("definitely-wrong");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid password");
  });

  it("missing ADMIN_PASSWORD returns 500", async () => {
    const noPassEnv = mockEnv({ ADMIN_PASSWORD: undefined });
    const req = mockRequest({ password: "x" }, { ip: IP });
    const ctx = mockContext(noPassEnv, req) as any;
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(500);
  });

  it("no IP header still allows (fail-open on missing IP)", async () => {
    const req = mockRequest({ password: "test-password-123" });
    // No CF-Connecting-IP header
    const ctx = mockContext(env, req) as any;
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
  });

  it("KV unavailable fails open (allows login)", async () => {
    const noKvEnv = mockEnv({ DRAFTS: undefined });
    const req = mockRequest({ password: "test-password-123" }, { ip: IP });
    const ctx = mockContext(noKvEnv, req) as any;
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
  });
});
