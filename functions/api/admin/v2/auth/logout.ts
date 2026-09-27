// Phase 2 Auth — V2 Logout endpoint
// F2: Revokes the V2 token via KV blacklist (revoked_token:{sha256}, TTL 7 days),
// then clears the cookie. KV failure policy (owner-approved 2026-08-27): fail-safe —
// logout still succeeds and cookie is cleared; changing ADMIN_PASSWORD invalidates all tokens.

import type { AdminEnv } from "../../../admin/shared";
import { logAction } from "../../../../lib/admin/audit";
import { sha256Hex, verifyV2Token } from "./login";

const REVOCATION_TTL_SECONDS = 604800; // 7 days = token lifetime

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;

  // Finding 3: POST-only — no GET side effects per architecture contract.
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" },
        meta: null,
      }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/aromiso_admin_v2=([^;]+)/);

  // Finding 4: malformed percent-encoding → treat as invalid cookie (not 500).
  let token: string | null = null;
  if (match) {
    try {
      token = decodeURIComponent(match[1]);
    } catch {
      token = null;
    }
  }

  // Only a verified token needs blacklisting (invalid/expired ones can't authenticate).
  const payload = token ? await verifyV2Token(token, env) : null;
  if (token && payload) {
    try {
      await env.DRAFTS?.put(`revoked_token:${await sha256Hex(token)}`, "1", {
        expirationTtl: REVOCATION_TTL_SECONDS,
      });
    } catch (_) {
      /* fail-safe: don't block logout */
    }
    await logAction(env, {
      actor_type: "human",
      username: payload.username,
      action: "logout",
      resource_type: "auth",
      change_summary: "logout",
    });
  }

  const v2Clear = `aromiso_admin_v2=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

  return new Response(JSON.stringify({ success: true, data: null, error: null, meta: null }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": v2Clear,
    },
  });
}
