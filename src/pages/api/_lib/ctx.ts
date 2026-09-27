// ---------------------------------------------------------------------------
//  Pages-Functions-compatible context adapter
//
//  These endpoints were originally Cloudflare Pages Functions
//  (`functions/api/**`), written against the Pages context shape:
//      { request, env, params, waitUntil, next }
//
//  Astro endpoints receive an APIContext instead, where bindings live at
//  `locals.runtime.env`. Rather than rewriting the body of every handler (and
//  risking behavioural drift across ~40 files), we adapt the Astro context back
//  to the Pages shape once, here, and wrap the handler with `endpoint()`.
//
//  Migration contract for a handler file:
//      1. rename the export to a local `async function handler<Method>(...)`
//         typed against `PagesCtx`
//      2. append `export const <METHOD> = endpoint(handler<Method>);`
//  The function body itself is left untouched.
// ---------------------------------------------------------------------------

import type { APIContext, APIRoute } from "astro";
import type { Env } from "@/lib/env";

/** The context shape Pages Functions handlers were written against. */
export interface PagesCtx {
  request: Request;
  env: Env;
  params: Record<string, string | undefined>;
  waitUntil: (promise: Promise<unknown>) => void;
}

/** Minimal view of the Cloudflare adapter's `locals.runtime`. */
interface RuntimeLocals {
  runtime?: {
    env?: unknown;
    ctx?: {
      waitUntil?: (promise: Promise<unknown>) => void;
      passThroughOnException?: () => void;
    };
  };
}

/** Adapt an Astro APIContext to the Pages-Functions context shape. */
export function toPagesCtx(ctx: APIContext): PagesCtx {
  const locals = ctx.locals as unknown as RuntimeLocals;
  const runtime = locals.runtime;
  return {
    request: ctx.request,
    // `env` is guaranteed by the Cloudflare adapter; fall back to an empty
    // object so a missing binding degrades to the handlers' own `env.DB`
    // guards instead of throwing a TypeError.
    env: (runtime?.env ?? {}) as Env,
    params: (ctx.params ?? {}) as Record<string, string | undefined>,
    waitUntil: (promise: Promise<unknown>) => {
      runtime?.ctx?.waitUntil?.(promise);
    },
  };
}

/**
 * Wrap a Pages-style handler as an Astro endpoint.
 *
 * `C` is inferred from the handler's parameter type, which is why migrated
 * handlers may keep destructuring only the fields they use
 * (`async function handlerGet({ request, env }: PagesCtx)`).
 */
export function endpoint<C>(handler: (ctx: C) => Response | Promise<Response>): APIRoute {
  return (ctx) => handler(toPagesCtx(ctx) as C);
}
