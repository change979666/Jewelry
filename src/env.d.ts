/// <reference types="astro/client" />
// Load the Workers runtime globals (D1Database / R2Bucket / KVNamespace / …)
// as a SINGLE source of truth.
//
// Do NOT reintroduce `type D1Database = import("@cloudflare/workers-types")...`
// aliases here: that module-view import resolves the same global script through
// a second identity, and types such as R2ObjectBody / Headers then become
// mutually unassignable (ts 2322 / 2345) across files.
/// <reference types="@cloudflare/workers-types" />

declare namespace App {
  interface Locals {
    runtime: {
      env: {
        DB: D1Database;
        IMAGES: R2Bucket;
        DRAFTS: KVNamespace;
      };
      /**
       * ExecutionContext provided by @astrojs/cloudflare.
       * Used by src/middleware.ts and src/pages/api/_lib/ctx.ts.
       */
      ctx: {
        waitUntil(promise: Promise<unknown>): void;
        passThroughOnException(): void;
      };
      cf?: unknown;
    };
  }
}
