import type { Env } from "../../types";
import {
  ghGetChecked,
  ghPut,
  saveDraft,
  getDraft,
  deleteDraft,
  isAuthed,
  json,
  b64encode,
  b64decode,
} from "./shared";

interface SaveBody {
  collection?: string;
  key?: string;
  locale?: string;
  frontmatter?: Record<string, unknown>;
  content?: string;
  status?: string;
}

// ---------------------------------------------------------------------------
//  Server-side validation — mirrors src/content/config.ts schemas.
//  Catches missing/invalid fields BEFORE they hit GitHub and break the build.
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = [
  "essential-oils",
  "fragrance-oils",
  "reed-diffusers",
  "candles",
  "home-fragrance",
  "packaging",
] as const;

const VALID_LOCALES = ["en", "es", "de"] as const;

type CollectionName = "blog" | "products" | "guides" | "caseStudies";

function validateFrontmatter(collection: CollectionName, fm: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;

  // Common required fields
  if (!str(fm.title)) errors.push("title is required");
  if (!str(fm.excerpt)) errors.push("excerpt is required");

  switch (collection) {
    case "blog":
    case "guides":
      if (!fm.pubDate) errors.push("pubDate is required (e.g. 2026-07-29)");
      else if (isNaN(Date.parse(String(fm.pubDate)))) errors.push("pubDate must be a valid date");
      break;

    case "products":
      if (!str(fm.category)) errors.push("category is required");
      else if (!VALID_CATEGORIES.includes(fm.category as (typeof VALID_CATEGORIES)[number]))
        errors.push(`category must be one of: ${VALID_CATEGORIES.join(", ")}`);
      if (!str(fm.moq)) errors.push("moq is required (e.g. '500 pcs')");
      if (!str(fm.leadTime)) errors.push("leadTime is required (e.g. '15-20 days')");
      if (!str(fm.origin)) errors.push("origin is required (e.g. 'Zhejiang, China')");
      break;

    case "caseStudies":
      if (!str(fm.country)) errors.push("country is required");
      if (!str(fm.region)) errors.push("region is required");
      if (!str(fm.clientType)) errors.push("clientType is required");
      if (!str(fm.productCategory)) errors.push("productCategory is required");
      else if (!VALID_CATEGORIES.includes(fm.productCategory as (typeof VALID_CATEGORIES)[number]))
        errors.push(`productCategory must be one of: ${VALID_CATEGORIES.join(", ")}`);
      if (!str(fm.moq)) errors.push("moq is required");
      if (!str(fm.leadTime)) errors.push("leadTime is required");
      if (!str(fm.packaging)) errors.push("packaging is required");
      if (!str(fm.challenge)) errors.push("challenge is required");
      if (!str(fm.solution)) errors.push("solution is required");
      if (!str(fm.result)) errors.push("result is required");
      if (!fm.pubDate) errors.push("pubDate is required");
      else if (isNaN(Date.parse(String(fm.pubDate)))) errors.push("pubDate must be a valid date");
      break;
  }

  return errors;
}

// Minimal YAML value serializer for frontmatter (strings, bools, numbers,
// arrays, and plain objects — the latter covers faq entries like {q, a}).
function yamlVal(v: unknown): string {
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return "[" + v.map(yamlVal).join(", ") + "]";
  if (v && typeof v === "object") {
    // Escape hatch: preserve a raw YAML value verbatim. Used to round-trip
    // complex structures (e.g. faq object arrays) parsed from existing files.
    const raw = (v as Record<string, unknown>).__rawYaml;
    if (typeof raw === "string") return raw;
    // Flow-style mapping: { k: v, k2: v2 }.
    const parts = Object.entries(v as Record<string, unknown>).map(
      ([k, val]) => `${k}: ${yamlVal(val)}`,
    );
    return "{ " + parts.join(", ") + " }";
  }
  const s = String(v ?? "");
  if (s === "" || /[:#[\]{}"',&*?|<>=!%@`\n]/.test(s) || /^\s|\s$/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}

// Parse a YAML flow-style array like [a, "b, c", d] respecting quoted strings.
function parseFlowArray(s: string): string[] {
  const trimmed = s.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return [s];
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  const items: string[] = [];
  let cur = "";
  let inQ: string | null = null;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (inQ) {
      cur += c;
      if (c === inQ) inQ = null;
    } else if (c === '"' || c === "'") {
      inQ = c;
      cur += c;
    } else if (c === ",") {
      items.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur.trim()) items.push(cur.trim());
  return items.map((it) => {
    if ((it.startsWith('"') && it.endsWith('"')) || (it.startsWith("'") && it.endsWith("'")))
      return it.slice(1, -1);
    return it;
  });
}

// Parse frontmatter from an existing .md file. Returns the parsed key-value
// pairs and the markdown body separately. Handles flow arrays [a, b] and
// block arrays (- item), quoted strings, booleans, numbers.
function parseExistingFrontmatter(raw: string): {
  fm: Record<string, unknown>;
  body: string;
} {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const lines = m[1].split(/\r?\n/);
  const fm: Record<string, unknown> = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const idx = line.indexOf(":");
    if (idx === -1) {
      i++;
      continue;
    }
    const k = line.slice(0, idx).trim();
    if (!k) {
      i++;
      continue;
    }
    const rawVal = line.slice(idx + 1).trim();

    // Flow-style array: [a, b, c] or object array [{ q, a }, ...],
    // possibly spanning multiple lines.
    if (rawVal.startsWith("[")) {
      let buf = rawVal;
      const balanced = (s: string): boolean => {
        let depth = 0;
        let inQ: string | null = null;
        for (const c of s) {
          if (inQ) {
            if (c === inQ) inQ = null;
          } else if (c === '"' || c === "'") inQ = c;
          else if (c === "[" || c === "{") depth++;
          else if (c === "]" || c === "}") depth--;
        }
        return depth <= 0;
      };
      while (!balanced(buf) && i + 1 < lines.length) {
        i++;
        buf += "\n" + lines[i];
      }
      // Object-flow arrays (faq) can't be split like string arrays; preserve
      // them verbatim so buildFrontmatter re-emits them unchanged.
      fm[k] = buf.includes("{") ? { __rawYaml: buf } : parseFlowArray(buf);
      i++;
      continue;
    }

    // Block-style array: next lines start with "  - "
    if (rawVal === "" && i + 1 < lines.length && /^\s+-\s/.test(lines[i + 1])) {
      const items: string[] = [];
      i++;
      while (i < lines.length && /^\s+-\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s+-\s/, "").trim());
        i++;
      }
      fm[k] = items;
      continue;
    }

    // Scalar values
    let v: unknown = rawVal;
    if (
      typeof v === "string" &&
      v.length >= 2 &&
      ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    ) {
      try {
        v = JSON.parse(v);
      } catch {
        v = (v as string).slice(1, -1);
      }
    } else if (v === "true") v = true;
    else if (v === "false") v = false;
    else if (v === "" || v === undefined) v = "";
    fm[k] = v;
    i++;
  }
  return { fm, body: m[2] };
}

function buildFrontmatter(merged: Record<string, unknown>, key: string, locale: string): string {
  const lines = ["---", `key: ${key}`, `locale: ${locale}`];
  for (const [k, v] of Object.entries(merged)) {
    if (k === "key" || k === "locale") continue;
    // Skip empty optional fields to keep frontmatter clean
    if (v === "" || v === null || v === undefined) continue;
    lines.push(`${k}: ${yamlVal(v)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);

  let body: SaveBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const { collection, key, locale, frontmatter, content, status } = body;

  const validCollections: CollectionName[] = ["blog", "products", "guides", "caseStudies"];
  if (!collection || !validCollections.includes(collection as CollectionName)) {
    return json({ error: "Unknown collection" }, 400);
  }
  if (!locale || !VALID_LOCALES.includes(locale as (typeof VALID_LOCALES)[number])) {
    return json({ error: "Unknown locale" }, 400);
  }
  if (!key || !/^[a-z0-9-]+$/.test(key)) {
    return json({ error: "Key must be lowercase letters, numbers, hyphens" }, 400);
  }

  const fm = frontmatter && typeof frontmatter === "object" ? frontmatter : {};

  // Validate against schema BEFORE writing anything (draft or publish).
  const validationErrors = validateFrontmatter(collection as CollectionName, fm);
  if (validationErrors.length > 0) {
    return json({ error: "Validation failed", fields: validationErrors }, 422);
  }

  const path = `src/content/${collection}/${key}.${locale}.md`;

  // ---- Merge frontmatter across three layers -------------------------------
  // Base:   existing published file — preserves fields the form doesn't manage.
  // Middle: current KV draft — carries AI-generated rich fields (faq,
  //         relatedProducts, relatedGuides) that the CMS form doesn't render.
  // Top:    submitted form frontmatter — user edits always win on conflicts.
  // S05/S23：GitHub 读取失败 ≠「文件不存在」。读不到真实基线就拒绝保存/发布，
  // 否则会用「仅草稿+表单」的残缺 frontmatter 覆盖线上、静默丢字段。
  const existing = await ghGetChecked(path, env);
  if (existing.state === "error") {
    return json(
      {
        ok: false,
        error:
          "Failed to read the current published file from GitHub; save refused to avoid losing fields",
        detail: existing.error,
        code: "BASE_READ_ERROR",
      },
      502,
    );
  }
  let existingFm: Record<string, unknown> = {};
  let baseSha: string | undefined;
  if (existing.state === "found" && existing.item?.content) {
    existingFm = parseExistingFrontmatter(b64decode(existing.item.content)).fm;
    baseSha = existing.item.sha;
  }
  let draftFm: Record<string, unknown> = {};
  const draftRaw = await getDraft(env, collection, key, locale);
  if (draftRaw) {
    draftFm = parseExistingFrontmatter(draftRaw).fm;
  }
  const mergedFm: Record<string, unknown> = { ...existingFm, ...draftFm, ...fm };

  const full = `${buildFrontmatter(mergedFm, key, locale)}\n\n${content || ""}\n`;

  // ---- Save as draft (KV) ----
  if (status === "draft") {
    // S22：草稿未真正写入绝不能报 ok。KV 未绑定/put 失败 → 503，明确「未保存」。
    const saved = await saveDraft(env, collection, key, locale, full);
    if (!saved) {
      return json(
        {
          ok: false,
          error:
            "Draft NOT saved (draft storage unavailable). Your changes were not persisted — please retry.",
          code: "DRAFT_SAVE_FAILED",
        },
        503,
      );
    }
    return json({ ok: true, status: "draft" });
  }

  // ---- Publish (commit to GitHub → triggers redeploy) ----
  const ok = await ghPut(
    path,
    b64encode(full),
    `content(${collection}): ${key} (${locale})`,
    env,
    baseSha,
  );
  if (!ok) return json({ error: "GitHub commit failed" }, 502);

  await deleteDraft(env, collection, key, locale);
  return json({ ok: true, status: "published" });
};
