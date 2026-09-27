/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type D1Database = import("@cloudflare/workers-types").D1Database;
type R2Bucket = import("@cloudflare/workers-types").R2Bucket;
type KVNamespace = import("@cloudflare/workers-types").KVNamespace;

declare namespace App {
  interface Locals {
    runtime: {
      env: {
        DB: D1Database;
        IMAGES: R2Bucket;
        DRAFTS: KVNamespace;
      };
    };
  }
}
