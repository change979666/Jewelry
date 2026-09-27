// Cloudflare Pages Function — handles footer newsletter opt-ins.
// Collect only: stores the email in D1 (binding `DB`) for admin review and
// manual outreach. NO automatic email is sent to subscribers.
//
// POST /api/subscribe  { email, locale?, source?, website? (honeypot) }
//
// Protections: honeypot field, per-IP rate limiting (KV w/ TTL), email
// validation, and case-insensitive de-duplication (UNIQUE email).

import type { Env } from "../types";

interface SubscribeBody {
  email?: string;
  locale?: string;
  source?: string;
  website?: string; // honeypot — real users leave this empty
}

const LIMITS = { email: 200, locale: 8, source: 100 };
const RATE_LIMIT_WINDOW = 3600; // seconds (1 hour)
const MAX_PER_IP = 5; // subscribing is rare — keep the ceiling low

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  locale     TEXT NOT NULL DEFAULT '',
  source     TEXT NOT NULL DEFAULT 'footer',
  created_at TEXT NOT NULL
)`;

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

// Per-IP rate limiting backed by KV (auto-expires via TTL). Fail open if KV is
// unavailable so a KV hiccup never blocks a genuine subscriber.
async function rateLimitOk(env: Env, ip: string): Promise<boolean> {
  const kv = env.DRAFTS;
  if (!kv || !ip) return true;
  const key = `rl:sub:${ip}`;
  try {
    const cur = Number((await kv.get(key)) || "0");
    if (cur >= MAX_PER_IP) return false;
    await kv.put(key, String(cur + 1), { expirationTtl: RATE_LIMIT_WINDOW });
    return true;
  } catch {
    return true;
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let body: SubscribeBody;
  try {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      body = await request.json();
    } else {
      const fd = await request.formData();
      body = Object.fromEntries(fd.entries()) as unknown as SubscribeBody;
    }
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  // Honeypot: bots fill hidden fields. Pretend success, store nothing.
  if ((body.website || "").toString().trim() !== "") {
    return Response.json({ ok: true, exists: false });
  }

  const email = clip((body.email || "").toString().trim(), LIMITS.email).toLowerCase();
  const locale = clip((body.locale || "").toString().trim(), LIMITS.locale);
  const source = clip((body.source || "").toString().trim(), LIMITS.source) || "footer";

  if (!email)
    return Response.json({ ok: false, error: "Please enter your email." }, { status: 422 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { ok: false, error: "That email address looks invalid." },
      { status: 422 },
    );
  }

  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (!(await rateLimitOk(env, ip))) {
    return Response.json(
      { ok: false, error: "Too many attempts. Please try again later." },
      { status: 429 },
    );
  }

  const db = env.DB;
  if (!db) {
    return Response.json(
      { ok: false, error: "Subscription storage is not configured." },
      { status: 500 },
    );
  }

  try {
    // Defensive create keeps the endpoint working even before the migration is
    // formally applied to the production database (idempotent + cheap).
    await db.prepare(CREATE_TABLE).run();
    const res = await db
      .prepare(
        `INSERT INTO subscribers (email, locale, source, created_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(email) DO NOTHING`,
      )
      .bind(email, locale, source, new Date().toISOString())
      .run();
    const isNew = (res.meta.changes || 0) > 0;
    return Response.json({ ok: true, exists: !isNew });
  } catch (e) {
    console.error("[subscribe] D1 save failed:", e);
    return Response.json(
      { ok: false, error: "Could not save your subscription." },
      { status: 500 },
    );
  }
};

// Reject anything that isn't a POST.
export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  return onRequestPost(context);
};
