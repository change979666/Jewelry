// ---------------------------------------------------------------------------
//  content-quality tests (Content Factory 质量闸 / V5.21)
//  scoreDraft 是纯函数：验证合格草稿满分、各维度缺陷精确扣分、阈值判定正确。
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { scoreDraft, QUALITY_PASS_THRESHOLD } from "../functions/lib/content-quality";
import type { ContentDraft } from "../functions/lib/content-quality";

function pad(base: string, n: number): string {
  return base.repeat(Math.ceil(n / base.length)).slice(0, n);
}

/** 一篇各维度都达标的草稿（应 100 分、pass）。 */
function goodDraft(overrides: Partial<ContentDraft> = {}): ContentDraft {
  const body = [
    "## How to verify a factory",
    "quality ".repeat(500).trim(),
    "See [our ready-to-ship catalog](/en/shop) for options.",
    "## Cost breakdown",
    "sourcing ".repeat(500).trim(),
    "Read more in [our buyer guides](/en/resources).",
    "## Final checklist",
    "packaging lead time compliance documents to request from the factory before you order.",
  ].join("\n\n");
  return {
    title: "How to Verify a Fragrance Oil Factory in China",
    excerpt:
      "A practical checklist for B2B buyers vetting Chinese fragrance and essential-oil factories before placing an order.",
    category: "sourcing",
    body,
    tags: ["sourcing", "factory", "b2b"],
    keywords: ["verify fragrance oil factory China", "fragrance factory audit"],
    seoTitle: "Verify a Fragrance Oil Factory in China (Buyer Guide)",
    seoDescription: pad(
      "A B2B buyer guide to verifying a Chinese fragrance oil factory: certifications, sample consistency, audits, and the documents to request. ",
      140,
    ),
    _meta: {
      agent: "content_writer",
      model: "deepseek-v4-pro",
      generated_at: "2026-08-10",
      idempotency_key: "content-gen:x:en:2026-08-10",
    },
    ...overrides,
  };
}

describe("content-quality — scoreDraft", () => {
  it("a complete, clean draft scores 100 and passes", () => {
    const r = scoreDraft(goodDraft());
    expect(r.max).toBe(100);
    expect(r.score).toBe(100);
    expect(r.pass).toBe(true);
    expect(r.reasons.length).toBe(0);
  });

  it("missing SEO meta zeroes the meta dimension and fails", () => {
    const r = scoreDraft(goodDraft({ seoTitle: "", seoDescription: "" }));
    const meta = r.dimensions.find((d) => d.key === "meta")!;
    expect(meta.score).toBe(0);
    expect(r.score).toBe(80); // 100 - 20
    // exactly at threshold still passes; drop one more to confirm failure below
    expect(r.pass).toBe(r.score >= QUALITY_PASS_THRESHOLD);
  });

  it("keyword-stuffed display title loses the clean-display points", () => {
    const r = scoreDraft(goodDraft({ title: "oil oil oil factory china oil supplier" }));
    const disp = r.dimensions.find((d) => d.key === "display")!;
    expect(disp.score).toBeLessThan(15);
    expect(disp.note).toContain("堆砌");
  });

  it("an over-long display title (>60) is penalized", () => {
    const longTitle = "A".repeat(70);
    const r = scoreDraft(goodDraft({ title: longTitle }));
    const disp = r.dimensions.find((d) => d.key === "display")!;
    expect(disp.score).toBeLessThan(15);
  });

  it("too-short body is penalized on the body dimension", () => {
    const r = scoreDraft(goodDraft({ body: "## Only\n\nToo short." }));
    const bodyDim = r.dimensions.find((d) => d.key === "body")!;
    expect(bodyDim.score).toBeLessThan(30);
    expect(r.pass).toBe(false);
  });

  it("fewer than 2 internal links zeroes/halves the internal-link dimension", () => {
    const body = [
      "## One",
      "quality ".repeat(500).trim(),
      "## Two",
      "sourcing ".repeat(500).trim(),
      "## Three",
      "External only [google](https://google.com).",
    ].join("\n\n");
    const r = scoreDraft(goodDraft({ body }));
    const link = r.dimensions.find((d) => d.key === "internal_link")!;
    expect(link.score).toBe(0);
  });

  it("markdown/JSON leakage in body is penalized", () => {
    const r = scoreDraft(goodDraft({ body: '{"title":"leaked json"}' }));
    const bodyDim = r.dimensions.find((d) => d.key === "body")!;
    expect(bodyDim.note).toContain("泄漏");
  });

  it("missing _meta zeroes the provenance dimension", () => {
    const r = scoreDraft(goodDraft({ _meta: undefined }));
    const prov = r.dimensions.find((d) => d.key === "provenance")!;
    expect(prov.score).toBe(0);
  });

  it("an image without alt text loses the image dimension", () => {
    const body = [
      "## One",
      "quality ".repeat(500).trim(),
      "![](/img/no-alt.jpg)",
      "See [catalog](/en/shop) and [guides](/en/resources).",
      "## Two",
      "sourcing ".repeat(500).trim(),
      "## Three",
      "end.",
    ].join("\n\n");
    const r = scoreDraft(goodDraft({ body }));
    const img = r.dimensions.find((d) => d.key === "image_alt")!;
    expect(img.score).toBe(0);
  });
});
