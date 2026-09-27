// ---------------------------------------------------------------------------
//  Save endpoint tests
//  Verifies: server-side validation (422), frontmatter merge (preserves fields).
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { onRequestPost } from "../functions/api/admin/save";
import { newSession } from "../functions/api/admin/shared";
import { mockEnv, mockContext, MockKV } from "./helpers";
import type { Env } from "../functions/types";
import { parse as parseYaml } from "yaml";

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

const PASSWORD = "test-password-123";

/** Build an authenticated request with a valid session cookie. */
async function authedRequest(body: unknown): Promise<Request> {
  const token = await newSession(PASSWORD);
  const headers = new Headers({
    "Content-Type": "application/json",
    Cookie: `jewelry_admin=${encodeURIComponent(token)}`,
  });
  return new Request("https://jewelry.com/api/admin/save", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** Encode a markdown string as base64 (like GitHub Contents API returns). */
function b64(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64");
}

/** A minimal valid blog frontmatter for testing. */
const VALID_BLOG_FM = {
  title: "Test Post",
  excerpt: "A test excerpt",
  pubDate: "2026-07-29",
};

// ---------------------------------------------------------------------------
//  Tests: validation (422)
// ---------------------------------------------------------------------------

describe("save — server-side validation", () => {
  let env: Env;

  beforeEach(() => {
    env = mockEnv({ ADMIN_PASSWORD: PASSWORD });
    // Mock fetch so ghGet returns null (no existing file) and ghPut succeeds
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blog without pubDate returns 422 with field error", async () => {
    const req = await authedRequest({
      collection: "blog",
      key: "test-post",
      locale: "en",
      frontmatter: { title: "Hello", excerpt: "World" },
      content: "Body text",
      status: "draft",
    });
    const ctx = mockContext(env, req) as any;
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.fields).toContain("pubDate is required (e.g. 2026-07-29)");
  });

  it("blog without title returns 422", async () => {
    const req = await authedRequest({
      collection: "blog",
      key: "test-post",
      locale: "en",
      frontmatter: { excerpt: "World", pubDate: "2026-07-29" },
      content: "",
      status: "draft",
    });
    const ctx = mockContext(env, req) as any;
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fields).toContain("title is required");
  });

  it("products without category returns 422", async () => {
    const req = await authedRequest({
      collection: "products",
      key: "test-product",
      locale: "en",
      frontmatter: {
        title: "Product",
        excerpt: "Desc",
        moq: "500 pcs",
        leadTime: "15 days",
        origin: "China",
      },
      content: "",
      status: "draft",
    });
    const ctx = mockContext(env, req) as any;
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fields).toContain("category is required");
  });

  it("products with invalid category returns 422", async () => {
    const req = await authedRequest({
      collection: "products",
      key: "test-product",
      locale: "en",
      frontmatter: {
        title: "Product",
        excerpt: "Desc",
        category: "invalid-category",
        moq: "500 pcs",
        leadTime: "15 days",
        origin: "China",
      },
      content: "",
      status: "draft",
    });
    const ctx = mockContext(env, req) as any;
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fields[0]).toContain("category must be one of");
  });

  it("caseStudies missing required fields returns multiple errors", async () => {
    const req = await authedRequest({
      collection: "caseStudies",
      key: "test-case",
      locale: "en",
      frontmatter: { title: "Case", excerpt: "Study" },
      content: "",
      status: "draft",
    });
    const ctx = mockContext(env, req) as any;
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    // Should have errors for country, region, clientType, productCategory, moq, leadTime, packaging, challenge, solution, result, pubDate
    expect(body.fields.length).toBeGreaterThanOrEqual(10);
  });

  it("valid blog passes validation (draft save succeeds)", async () => {
    const req = await authedRequest({
      collection: "blog",
      key: "valid-post",
      locale: "en",
      frontmatter: VALID_BLOG_FM,
      content: "Hello world",
      status: "draft",
    });
    const ctx = mockContext(env, req) as any;
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("draft");
  });

  it("unknown collection returns 400", async () => {
    const req = await authedRequest({
      collection: "nonexistent",
      key: "x",
      locale: "en",
      frontmatter: { title: "X" },
      content: "",
      status: "draft",
    });
    const ctx = mockContext(env, req) as any;
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
  });

  it("unauthenticated request returns 401", async () => {
    const req = new Request("https://jewelry.com/api/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection: "blog", key: "x", locale: "en" }),
    });
    const ctx = mockContext(env, req) as any;
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
//  Tests: frontmatter merge (preserves fields not in the form)
// ---------------------------------------------------------------------------

describe("save — frontmatter merge", () => {
  let env: Env;
  let kv: MockKV;

  const EXISTING_MD = [
    "---",
    "key: my-post",
    "locale: en",
    "title: Original Title",
    "excerpt: Original excerpt",
    "pubDate: 2026-01-15",
    "updatedDate: 2026-06-01",
    "customField: should-survive",
    'tags: [seo, "b2b, wholesale"]',
    "---",
    "",
    "Original body content",
  ].join("\n");

  beforeEach(() => {
    kv = new MockKV();
    env = mockEnv({ ADMIN_PASSWORD: PASSWORD, DRAFTS: kv as unknown as KVNamespace });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves fields not in the form (updatedDate, customField)", async () => {
    // Mock ghGet to return existing file content
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            name: "my-post.en.md",
            path: "src/content/blog/my-post.en.md",
            sha: "abc123",
            type: "file",
            content: b64(EXISTING_MD),
            encoding: "base64",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const req = await authedRequest({
      collection: "blog",
      key: "my-post",
      locale: "en",
      frontmatter: {
        title: "Updated Title",
        excerpt: "Updated excerpt",
        pubDate: "2026-07-29",
      },
      content: "New body",
      status: "draft", // Save as draft so we can inspect KV
    });
    const ctx = mockContext(env, req) as any;
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);

    // Read the draft from KV and verify merged frontmatter
    const draft = await kv.get("draft:blog:my-post:en");
    expect(draft).not.toBeNull();
    expect(draft).toContain("updatedDate: 2026-06-01");
    expect(draft).toContain("customField: should-survive");
    expect(draft).toContain("title: Updated Title");
    expect(draft).not.toContain("title: Original Title");
  });

  it("form values override existing values on conflict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            name: "my-post.en.md",
            path: "src/content/blog/my-post.en.md",
            sha: "abc123",
            type: "file",
            content: b64(EXISTING_MD),
            encoding: "base64",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const req = await authedRequest({
      collection: "blog",
      key: "my-post",
      locale: "en",
      frontmatter: {
        title: "Brand New Title",
        excerpt: "New excerpt",
        pubDate: "2026-07-29",
      },
      content: "Body",
      status: "draft",
    });
    const ctx = mockContext(env, req) as any;
    await onRequestPost(ctx);

    const draft = await kv.get("draft:blog:my-post:en");
    expect(draft).toContain("title: Brand New Title");
    expect(draft).not.toContain("Original Title");
  });

  it("parses flow arrays with quoted commas correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            name: "my-post.en.md",
            path: "src/content/blog/my-post.en.md",
            sha: "abc123",
            type: "file",
            content: b64(EXISTING_MD),
            encoding: "base64",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const req = await authedRequest({
      collection: "blog",
      key: "my-post",
      locale: "en",
      frontmatter: VALID_BLOG_FM,
      content: "Body",
      status: "draft",
    });
    const ctx = mockContext(env, req) as any;
    await onRequestPost(ctx);

    const draft = await kv.get("draft:blog:my-post:en");
    // The tags array [seo, "b2b, wholesale"] should survive the round-trip
    expect(draft).toContain("tags:");
    expect(draft).toContain("seo");
    expect(draft).toContain("b2b, wholesale");
  });

  it("new file (no existing) saves without merge errors", async () => {
    // ghGet returns 404 (no existing file)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const req = await authedRequest({
      collection: "blog",
      key: "brand-new",
      locale: "en",
      frontmatter: VALID_BLOG_FM,
      content: "Fresh content",
      status: "draft",
    });
    const ctx = mockContext(env, req) as any;
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);

    const draft = await kv.get("draft:blog:brand-new:en");
    expect(draft).toContain("title: Test Post");
    expect(draft).toContain("Fresh content");
  });
});

// ---------------------------------------------------------------------------
//  Tests: faq object-array pipeline (D4)
//  faq is an array of {q, a} objects. Verifies it serializes to valid YAML in
//  the KV draft and survives publish even when the CMS form omits it.
// ---------------------------------------------------------------------------

describe("save — faq object-array pipeline", () => {
  let env: Env;
  let kv: MockKV;

  const FAQ = [
    { q: "What is the MOQ?", a: "It's 100 units, and it's flexible: negotiable per SKU." },
    { q: 'Does it ship "fast"?', a: "Yes — 48h dispatch, no delays." },
  ];

  beforeEach(() => {
    kv = new MockKV();
    env = mockEnv({ ADMIN_PASSWORD: PASSWORD, DRAFTS: kv as unknown as KVNamespace });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serializes a faq object array into the KV draft as YAML that round-trips", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const req = await authedRequest({
      collection: "blog",
      key: "faq-post",
      locale: "en",
      frontmatter: { ...VALID_BLOG_FM, faq: FAQ },
      content: "Body",
      status: "draft",
    });
    const ctx = mockContext(env, req) as any;
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);

    const draft = await kv.get("draft:blog:faq-post:en");
    expect(draft).not.toBeNull();
    // Parse the frontmatter with a real YAML parser and confirm faq round-trips.
    const fmText = (draft as string).match(/^---\n([\s\S]*?)\n---/)![1];
    const parsed = parseYaml(fmText) as { faq: { q: string; a: string }[] };
    expect(parsed.faq).toHaveLength(2);
    expect(parsed.faq[0].q).toBe("What is the MOQ?");
    expect(parsed.faq[0].a).toBe("It's 100 units, and it's flexible: negotiable per SKU.");
    expect(parsed.faq[1].q).toBe('Does it ship "fast"?');
    expect(parsed.faq[1].a).toBe("Yes — 48h dispatch, no delays.");
  });

  it("preserves faq and relatedGuides from the KV draft on publish when the form omits them", async () => {
    const DRAFT_MD = [
      "---",
      "key: faq-post",
      "locale: en",
      "title: Draft Title",
      "excerpt: Draft excerpt",
      "pubDate: 2026-07-29",
      'faq: [{ q: "What is the MOQ?", a: "100 units, negotiable." }, { q: "Ship fast?", a: "48h dispatch." }]',
      "relatedGuides: [essential-oil-buying-guide, ifra-compliance-guide]",
      "---",
      "",
      "Draft body",
    ].join("\n");
    await kv.put("draft:blog:faq-post:en", DRAFT_MD);

    // Capture the publish PUT body; GET (ghGet) returns 404 (no existing file).
    const puts: { content: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: { method?: string; body?: string }) => {
        if (init?.method === "PUT") {
          puts.push(JSON.parse(init.body as string));
          return Promise.resolve(new Response(JSON.stringify({ content: {} }), { status: 200 }));
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      }),
    );

    const req = await authedRequest({
      collection: "blog",
      key: "faq-post",
      locale: "en",
      // Form omits faq and relatedGuides — the CMS form can't render them.
      frontmatter: { title: "Published Title", excerpt: "Pub excerpt", pubDate: "2026-07-29" },
      content: "Body",
      status: "publish",
    });
    const ctx = mockContext(env, req) as any;
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("published");
    expect(puts).toHaveLength(1);

    const committed = Buffer.from(puts[0].content, "base64").toString("utf-8");
    const fmText = committed.match(/^---\n([\s\S]*?)\n---/)![1];
    const parsed = parseYaml(fmText) as {
      title: string;
      faq: { q: string; a: string }[];
      relatedGuides: string[];
    };
    // Form field wins on conflict.
    expect(parsed.title).toBe("Published Title");
    // KV-draft-only rich fields survive publish.
    expect(parsed.faq).toHaveLength(2);
    expect(parsed.faq[0].q).toBe("What is the MOQ?");
    expect(parsed.relatedGuides).toEqual(["essential-oil-buying-guide", "ifra-compliance-guide"]);

    // Draft is cleaned up after publish.
    expect(await kv.get("draft:blog:faq-post:en")).toBeNull();
  });
});
