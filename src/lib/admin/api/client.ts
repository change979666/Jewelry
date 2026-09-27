// V2 API client — Phase 1 bootstrap
// Wraps fetch() with V2 unified envelope parsing and V1 fallback normalization

import type { ApiEnvelope } from "./types";

const BASE = "/api/admin";

async function request<T = unknown>(path: string, opts?: RequestInit): Promise<ApiEnvelope<T>> {
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  // V2 format: { success, data, error, meta }
  if (json && typeof json === "object" && "success" in json) {
    return json as unknown as ApiEnvelope<T>;
  }

  // V1 format fallback: normalize
  if (json && typeof json === "object" && json.error) {
    return {
      success: false,
      data: null,
      error: {
        code: "UNKNOWN" as const,
        message: typeof json.error === "string" ? json.error : "Unknown error",
      },
      meta: null,
    };
  }

  return {
    success: res.ok,
    data: json as T,
    error: null,
    meta: null,
  };
}

export const api = {
  get: <T = unknown>(path: string) => request<T>(`${BASE}${path}`),
  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>(`${BASE}${path}`, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>(`${BASE}${path}`, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  del: <T = unknown>(path: string) => request<T>(`${BASE}${path}`, { method: "DELETE" }),
};
