// Shared helpers for /api/cart/* Pages Functions (anonymous session cart).
import type { Env } from "@/lib/env";

export const SESSION_COOKIE = "session_id";

export function getSessionId(request: Request): string | null {
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)session_id=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function json(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}

export function requireDb(env: Env): D1Database | null {
  return env.DB ?? null;
}
