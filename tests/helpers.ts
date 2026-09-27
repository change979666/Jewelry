// ---------------------------------------------------------------------------
//  Test helpers — mock KV, Env, and Request factories for Pages Function tests.
// ---------------------------------------------------------------------------

import type { Env } from "../functions/types";

/**
 * In-memory KV mock that implements the subset of KVNamespace used by the
 * admin functions (get / put / delete / list).
 */
export class MockKV {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null>;
  async get<T = unknown>(key: string, type: "json"): Promise<T | null>;
  async get<T = unknown>(key: string, type?: "text" | "json"): Promise<string | T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    if (type === "json") {
      try {
        return JSON.parse(entry.value) as T;
      } catch {
        return null;
      }
    }
    return entry.value;
  }

  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    const expiresAt = opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(opts?: {
    prefix?: string;
    cursor?: string;
  }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }> {
    const prefix = opts?.prefix || "";
    const keys = [...this.store.keys()]
      .filter((k) => k.startsWith(prefix))
      .map((name) => ({ name }));
    return { keys, list_complete: true };
  }

  /** Test utility: inspect raw store size. */
  get size(): number {
    return this.store.size;
  }
}

/**
 * In-memory D1 mock implementing the subset of D1Database used by OS 2.0
 * endpoints (prepare → bind → first/run/all). It records every run() call so
 * tests can assert that forbidden/unapproved executions produce ZERO side
 * effects. first()/all() resolve via registered regex matchers.
 */
export class MockD1 {
  /** Every run() call, in order — used to assert zero side effects on 403. */
  runCalls: { sql: string; args: unknown[] }[] = [];
  /** Every all() call with its bound args — used to assert clamped LIMIT/OFFSET. */
  allCalls: { sql: string; args: unknown[] }[] = [];
  /** Every first() call with its bound args — used to assert query source/predicates. */
  firstCalls: { sql: string; args: unknown[] }[] = [];
  /** Every batch() call — records the statement count of each atomic batch. */
  batchCalls: { count: number }[] = [];
  private firstMatchers: { match: RegExp; value: unknown }[] = [];
  private allMatchers: { match: RegExp; rows: unknown[] }[] = [];
  private runMatchers: { match: RegExp; value: unknown }[] = [];
  private errorMatchers: RegExp[] = [];

  /** Register a first() result for statements whose SQL matches `re`. */
  onFirst(re: RegExp, value: unknown): this {
    this.firstMatchers.push({ match: re, value });
    return this;
  }

  /** Register an all() result set for statements whose SQL matches `re`. */
  onAll(re: RegExp, rows: unknown[]): this {
    this.allMatchers.push({ match: re, rows });
    return this;
  }

  /** Register a run() result (e.g. { meta: { changes } }) for SQL matching `re`. */
  onRun(re: RegExp, value: unknown): this {
    this.runMatchers.push({ match: re, value });
    return this;
  }

  /** V5.415 fault injection: make first()/run()/all() THROW for SQL matching `re`. */
  onError(re: RegExp): this {
    this.errorMatchers.push(re);
    return this;
  }

  private fault(sql: string): void {
    for (const re of this.errorMatchers) {
      if (re.test(sql)) throw new Error(`Injected D1 fault (V5.415 test): ${re.source}`);
    }
  }

  prepare(sql: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    let boundArgs: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        boundArgs = args;
        return stmt;
      },
      async first<T = unknown>(): Promise<T | null> {
        self.fault(sql);
        self.firstCalls.push({ sql, args: boundArgs });
        for (const m of self.firstMatchers) if (m.match.test(sql)) return m.value as T;
        return null;
      },
      async run() {
        self.fault(sql);
        self.runCalls.push({ sql, args: boundArgs });
        for (const m of self.runMatchers) if (m.match.test(sql)) return m.value;
        return { success: true, meta: {} };
      },
      async all<T = unknown>(): Promise<{ results: T[] }> {
        self.fault(sql);
        self.allCalls.push({ sql, args: boundArgs });
        for (const m of self.allMatchers) if (m.match.test(sql)) return { results: m.rows as T[] };
        return { results: [] as T[] };
      },
    };
    return stmt;
  }

  /**
   * Minimal D1 batch(): records the statement count and resolves each statement
   * as a successful run. Fault injection is honored when a matcher targets the
   * literal token "batch" (rarely used). Real SQL strings live on the prepared
   * statements, which this mock does not introspect.
   */
  async batch(stmts: unknown[]): Promise<unknown[]> {
    this.fault("batch");
    this.batchCalls.push({ count: Array.isArray(stmts) ? stmts.length : 0 });
    return (Array.isArray(stmts) ? stmts : []).map(() => ({ success: true, meta: {} }));
  }
}

/**
 * Build a mock Env suitable for admin function tests.
 * DRAFTS is a real MockKV; other bindings are stubs.
 */
export function mockEnv(overrides?: Partial<Env>): Env {
  return {
    DRAFTS: new MockKV() as unknown as KVNamespace,
    ADMIN_PASSWORD: "test-password-123",
    ADMIN_GITHUB_TOKEN: "ghp_fake_token",
    ADMIN_GITHUB_REPO: "test/repo",
    ...overrides,
  };
}

/**
 * Build a mock Request for Pages Function handlers.
 */
export function mockRequest(body: unknown, opts?: { ip?: string; method?: string }): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (opts?.ip) headers.set("CF-Connecting-IP", opts.ip);
  return new Request("https://aromiso.com/api/admin/test", {
    method: opts?.method || "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/**
 * Build a minimal PagesFunction context object.
 */
export function mockContext(env: Env, request: Request) {
  return { request, env, params: {}, waitUntil: () => {}, data: {} };
}
