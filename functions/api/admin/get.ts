import type { Env } from "../../types";
import { ghGetChecked, getDraft, isAuthed, json, b64decode } from "./shared";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "";
  const isDraft = url.searchParams.get("draft") === "1";

  if (isDraft) {
    const m = path.match(
      /^src\/content\/(blog|products|guides|caseStudies)\/(.+)\.(en|es|de)\.md$/,
    );
    if (!m) return json({ error: "Bad path" }, 400);
    const [, collection, key, locale] = m;
    const raw = await getDraft(env, collection, key, locale);
    if (raw == null) return json({ error: "Draft not found" }, 404);
    return json({ content: raw });
  }

  // Restrict non-draft reads to content and data directories only
  if (!path.startsWith("src/content/") && !path.startsWith("src/data/")) {
    return json({ error: "Access denied: path outside allowed directories" }, 403);
  }

  // S23/M1：GitHub 读取失败 ≠「文件不存在」。error → 502，绝不用 404 掩盖故障。
  const got = await ghGetChecked(path, env);
  if (got.state === "error") {
    return json(
      { error: "Failed to read file from GitHub", detail: got.error, code: "UPSTREAM_READ_ERROR" },
      502,
    );
  }
  if (got.state !== "found" || !got.item?.content) return json({ error: "Not found" }, 404);
  return json({ content: b64decode(got.item.content), sha: got.item.sha });
};
