// ---------------------------------------------------------------------------
//  Permission four-level gate tests (OS 2.0 / V5.20)
//  Verifies: enforceMode re-derives the true level from task_type (code-level
//  policy), so a prompt-injected execution_mode CANNOT escalate privilege.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  enforceMode,
  canAutoExecute,
  FORBIDDEN_TASK_TYPES,
  L4_EXECUTOR_ALLOWLIST,
} from "../functions/lib/permissions";

describe("enforceMode — code-level re-derivation", () => {
  it("maps L1 read-only analysis types to L1", () => {
    expect(enforceMode("analysis")).toBe("L1");
    expect(enforceMode("audit")).toBe("L1");
    expect(enforceMode("monitor")).toBe("L1");
    expect(enforceMode("report")).toBe("L1");
  });

  it("maps generate types to L2", () => {
    expect(enforceMode("content_refresh")).toBe("L2");
    expect(enforceMode("faq_append")).toBe("L2");
    expect(enforceMode("meta_rewrite")).toBe("L2");
  });

  it("maps low-risk reversible patch types to L3", () => {
    expect(enforceMode("meta_fix")).toBe("L3");
    expect(enforceMode("internal_link")).toBe("L3");
    expect(enforceMode("translate_fill")).toBe("L3");
    expect(enforceMode("alt_text_fill")).toBe("L3");
  });

  it("maps sitemap_ping to L4", () => {
    expect(enforceMode("sitemap_ping")).toBe("L4");
  });

  it("forces all forbidden/high-risk types to MANUAL", () => {
    for (const t of FORBIDDEN_TASK_TYPES) {
      expect(enforceMode(t)).toBe("MANUAL");
    }
  });

  it("defaults unknown or empty task types to MANUAL (fail-safe)", () => {
    expect(enforceMode("")).toBe("MANUAL");
    expect(enforceMode(null)).toBe("MANUAL");
    expect(enforceMode(undefined)).toBe("MANUAL");
    expect(enforceMode("some_new_unregistered_type")).toBe("MANUAL");
  });
});

describe("canAutoExecute — anti-injection privilege gate", () => {
  it("L1 executes automatically", () => {
    const d = canAutoExecute({ task_type: "analysis", execution_mode: "L1" });
    expect(d.allowed).toBe(true);
    expect(d.enforcedMode).toBe("L1");
    expect(d.forbidden).toBe(false);
  });

  it("L3 executes automatically", () => {
    const d = canAutoExecute({ task_type: "meta_fix", execution_mode: "L3" });
    expect(d.allowed).toBe(true);
    expect(d.enforcedMode).toBe("L3");
  });

  it("L2 requires human review — not allowed until approved", () => {
    const denied = canAutoExecute({ task_type: "meta_rewrite" });
    expect(denied.allowed).toBe(false);
    expect(denied.requiresReview).toBe(true);
    const approved = canAutoExecute({ task_type: "meta_rewrite" }, { reviewApproved: true });
    expect(approved.allowed).toBe(true);
  });

  it("L4 only auto-executes for allowlisted executors", () => {
    const allow = canAutoExecute({ task_type: "sitemap_ping", executor: "sitemap_ping" });
    expect(allow.allowed).toBe(true);
    expect(allow.enforcedMode).toBe("L4");
    // L4 with a non-allowlisted executor falls back to human review
    const review = canAutoExecute({ task_type: "sitemap_ping", executor: "rogue_executor" });
    expect(review.allowed).toBe(false);
    expect(review.requiresReview).toBe(true);
    expect(review.allowed).toBe(false);
    expect(L4_EXECUTOR_ALLOWLIST.has("sitemap_ping")).toBe(true);
  });

  it("MANUAL / forbidden is never allowed — even if AI claims a low mode (injection)", () => {
    // Prompt-injection attempt: a delete task disguised with execution_mode "L3".
    const d = canAutoExecute({
      task_type: "delete_page",
      execution_mode: "L3", // AI-tampered value — must be ignored
      executor: "sitemap_ping", // even a whitelisted executor must not help
    });
    expect(d.allowed).toBe(false);
    expect(d.forbidden).toBe(true);
    expect(d.enforcedMode).toBe("MANUAL");
  });

  it("MANUAL cannot be escalated via review approval", () => {
    const d = canAutoExecute(
      { task_type: "price_change", execution_mode: "L1" },
      { reviewApproved: true },
    );
    expect(d.allowed).toBe(false);
    expect(d.forbidden).toBe(true);
    expect(d.enforcedMode).toBe("MANUAL");
  });

  it("unknown task type is treated as MANUAL (not auto-executed)", () => {
    const d = canAutoExecute({ task_type: "totally_made_up", execution_mode: "L4" });
    expect(d.allowed).toBe(false);
    expect(d.forbidden).toBe(true);
    expect(d.enforcedMode).toBe("MANUAL");
  });
});
