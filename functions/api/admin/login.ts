import type { Env } from "../../types";
import { newSession, sessionCookie, json } from "./shared";

interface LoginBody {
  password?: unknown;
}

// Brute-force protection: max 5 attempts per IP per 15-minute window.
const RATE_LIMIT_WINDOW = 900; // seconds
const MAX_ATTEMPTS = 5;

async function loginRateLimitOk(env: Env, ip: string): Promise<boolean> {
  const kv = env.DRAFTS;
  if (!kv || !ip) return true;
  const key = `rl:login:${ip}`;
  try {
    const cur = Number((await kv.get(key)) || "0");
    if (cur >= MAX_ATTEMPTS) return false;
    await kv.put(key, String(cur + 1), { expirationTtl: RATE_LIMIT_WINDOW });
    return true;
  } catch {
    return true; // fail open — availability over lockout
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const pw = env.ADMIN_PASSWORD;
  if (!pw) return json({ error: "Server misconfigured: ADMIN_PASSWORD is not set." }, 500);

  // Rate limiting must run before password check to prevent brute-force.
  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (!(await loginRateLimitOk(env, ip))) {
    return json({ error: "Too many login attempts. Please wait 15 minutes and try again." }, 429);
  }

  let body: LoginBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  if (String(body?.password || "") !== pw) {
    return json({ error: "Invalid password" }, 401);
  }

  const token = await newSession(pw);
  const res = json({ ok: true });
  res.headers.set("Set-Cookie", sessionCookie(token));
  return res;
};
