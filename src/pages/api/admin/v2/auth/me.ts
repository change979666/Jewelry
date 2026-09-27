// Phase 2 Auth — V2 /me endpoint
// Returns current authenticated user + role + permissions

import { authenticateRequest } from "@/lib/admin/rbac";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

async function handlerAll(context: PagesCtx): Promise<Response> {
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

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const ALL = endpoint(handlerAll);
