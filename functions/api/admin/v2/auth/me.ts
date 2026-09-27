// Phase 2 Auth — V2 /me endpoint
// Returns current authenticated user + role + permissions

import type { AdminEnv } from "../../../admin/shared";
import { authenticateRequest } from "../../../../lib/admin/rbac";

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;
  const user = await authenticateRequest(request, env);

  if (!user) {
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        meta: null,
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        role_id: user.role_id,
        role_name: user.role_name,
        status: user.status,
        permissions: [...user.permissions],
      },
      error: null,
      meta: null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
