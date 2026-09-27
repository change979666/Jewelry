import type { Env } from "../../types";
import { ghDelete, deleteDraft, isAuthed, json } from "./shared";

interface DeleteBody {
  collection?: string;
  key?: string;
}

// Delete a piece of content (all of its locale variants) by key.
// Removes the published .md files from GitHub (triggering a redeploy) and clears
// any KV drafts. Body: { collection: string, key: string }.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);

  let body: DeleteBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const { collection, key } = body;

  const validCollections = ["blog", "products", "guides", "caseStudies"];
  if (!collection || !validCollections.includes(collection)) {
    return json({ error: "Unknown collection" }, 400);
  }
  if (!key || !/^[a-z0-9-]+$/.test(key)) {
    return json({ error: "Key must be lowercase letters, numbers, hyphens" }, 400);
  }

  const locales = ["en", "es", "de"] as const;
  let deleted = 0;
  for (const locale of locales) {
    const path = `src/content/${collection}/${key}.${locale}.md`;
    const ok = await ghDelete(path, `content(${collection}): delete ${key} (${locale})`, env);
    if (ok) deleted += 1;
    // Clear any pending draft for this locale as well.
    await deleteDraft(env, collection, key, locale);
  }

  return json({ ok: true, deleted });
};
