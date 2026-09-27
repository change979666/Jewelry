import { ghGetChecked, ghPut, isAuthed, json } from "@/pages/api/admin/_shared";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

// Upload a binary asset (image or document) by committing it straight to the
// GitHub repo under public/. The client base64-encodes the raw file bytes and
// posts { path, contentB64 }; we pass that base64 directly to ghPut (which is
// content-agnostic). We deliberately do NOT use shared.b64encode here — that
// helper is UTF-8 text-only and would corrupt binary data.
//
// Body: { path: string, contentB64: string }
//   path       — repo-relative target, must start with public/images/ or public/docs/
//   contentB64 — standard base64 of the raw file bytes
const ALLOWED_EXT = /\.(png|jpe?g|webp|gif|svg|avif|pdf|docx?|xlsx?|csv)$/i;

async function handlerPost({ request, env }: PagesCtx): Promise<Response> {
  if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);

  let body: { path?: string; contentB64?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const { path, contentB64 } = body;

  if (!path || typeof path !== "string") return json({ error: "Missing path" }, 400);
  if (!contentB64 || typeof contentB64 !== "string")
    return json({ error: "Missing contentB64" }, 400);

  // Path safety: must live under public/images/ or public/docs/, no traversal.
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  const allowedRoot =
    normalized.startsWith("public/images/") || normalized.startsWith("public/docs/");
  if (!allowedRoot || normalized.includes("..") || normalized.includes("//")) {
    return json({ error: "Invalid path" }, 400);
  }
  if (!ALLOWED_EXT.test(normalized)) {
    return json({ error: "File type not allowed" }, 400);
  }
  // GitHub Contents API rejects files over 100MB; base64 inflates ~33%.
  if (contentB64.length > 100 * 1024 * 1024) {
    return json({ error: "File too large" }, 413);
  }

  const name = normalized.split("/").pop() || "asset";
  // S23/M1：读取已有 sha 用于乐观锁。error → 无锁提交（上传意图明确）但记日志，不静默。
  const existing = await ghGetChecked(normalized, env);
  if (existing.state === "error") {
    console.error(
      "[upload] existing-sha read failed, committing without optimistic lock:",
      existing.error,
    );
  }
  const baseSha = existing.state === "found" ? existing.item?.sha : undefined;
  const ok = await ghPut(normalized, contentB64, `assets: upload ${name}`, env, baseSha);
  if (!ok) return json({ error: "GitHub commit failed" }, 502);

  // Served URL: strip the leading "public/" (web root).
  const url = "/" + normalized.slice("public/".length);
  return json({ ok: true, url, path: normalized });
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const POST = endpoint(handlerPost);
