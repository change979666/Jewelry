// ---------------------------------------------------------------------------
//  Aromiso V5.1 — /api/admin/ai-provider
//
//  AI provider switching endpoint (SiliconFlow ⇄ DeepSeek).
//    GET  — current provider, key status and model mapping
//    POST — switch active provider { provider: "siliconflow" | "deepseek" }
//
//  Auth: admin cookie
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { readCookie, verifySession } from "./shared";
import {
  KV_PROVIDER_KEY,
  PROVIDER_LABELS,
  resolveProvider,
  type ProviderId,
} from "../../lib/ai-provider";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const token = readCookie(request);
  if (!(await verifySession(token, env.ADMIN_PASSWORD || ""))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const method = request.method.toUpperCase();

  // ---- GET: status ----
  if (method === "GET") {
    let configured: string | null = null;
    try {
      configured = (await env.DRAFTS?.get(KV_PROVIDER_KEY)) ?? null;
    } catch {
      // KV unavailable
    }
    const resolved = await resolveProvider(env);
    return Response.json({
      ok: true,
      configured: configured || null,
      active: resolved?.id || null,
      active_label: resolved?.label || null,
      model_map: {
        "deepseek-v4-pro": "deepseek-ai/DeepSeek-V4-Pro",
        "deepseek-v4-flash": "deepseek-ai/DeepSeek-V4-Flash",
      },
      providers: [
        {
          id: "siliconflow",
          label: PROVIDER_LABELS.siliconflow,
          has_key: !!env.SILICONFLOW_API_KEY,
          is_default: true,
        },
        {
          id: "deepseek",
          label: PROVIDER_LABELS.deepseek,
          has_key: !!env.DEEPSEEK_API_KEY,
          is_default: false,
        },
      ],
    });
  }

  // ---- POST: switch ----
  if (method === "POST") {
    let body: { provider?: string };
    try {
      body = (await request.json()) as { provider?: string };
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const id = body.provider;
    if (id !== "siliconflow" && id !== "deepseek") {
      return Response.json(
        { error: "Invalid provider (expected siliconflow | deepseek)" },
        { status: 400 },
      );
    }
    if (!env.DRAFTS) {
      return Response.json({ error: "KV not available" }, { status: 503 });
    }
    await env.DRAFTS.put(KV_PROVIDER_KEY, id as ProviderId);
    return Response.json({ ok: true, active: id, label: PROVIDER_LABELS[id as ProviderId] });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};
