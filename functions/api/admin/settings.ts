// GET  /api/admin/settings — load current settings from GitHub (src/data/settings.json)
// POST /api/admin/settings — save settings (commit to GitHub, triggers rebuild)

import type { Env } from "../../types";
import { isAuthed, json, ghGetChecked, ghPut, b64encode, b64decode } from "./shared";
import { parseJsonBody } from "../../lib/safe";

const SETTINGS_PATH = "src/data/settings.json";

// The settings document is edited free-form in the admin UI; we only require
// the two sections the site depends on. Everything else passes through.
interface SettingsDoc {
  site?: unknown;
  social?: unknown;
  page?: unknown;
  [field: string]: unknown;
}

// Defaults are ONLY legitimate when the file genuinely does not exist yet
// (ghGetChecked → "missing"). They must NEVER be used to mask a GitHub read
// error (S02) — that previously showed defaults as if they were the real config.
const DEFAULT_SETTINGS = {
  site: {
    name: "Aromiso",
    tagline: "Premium scent, sourced with confidence.",
    email: "sales@aromiso.com",
    whatsapp: "",
    address: "Yiwu, Zhejiang, China",
    hours: "Mon–Fri 9:00 – 18:00 CST",
    footerNote: "Connecting international buyers with verified aroma manufacturers.",
    mapEmbed: "",
  },
  social: {
    linkedin: "",
    facebook: "",
    messenger: "",
    instagram: "",
    pinterest: "",
    youtube: "",
    tiktok: "",
    x: "",
    whatsapp: "",
  },
  page: {
    heroImage: "/images/hero-aroma.png",
    factoryImage: "/images/factory-campus.png",
    oemImage: "/images/oem-factory.png",
    stats: [
      { num: "10+", label: "Years Experience" },
      { num: "500+", label: "OEM Projects" },
      { num: "30+", label: "Export Countries" },
      { num: "24h", label: "Response Time" },
    ],
  },
};

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (request.method === "GET") {
    const got = await ghGetChecked(SETTINGS_PATH, env);

    // S02：读取失败 ≠ 使用默认值。GitHub 故障/无 token → 502，绝不回落默认值伪装成真实配置。
    if (got.state === "error") {
      return json(
        {
          ok: false,
          error: "Failed to read settings from GitHub",
          detail: got.error,
          code: "SETTINGS_READ_ERROR",
        },
        502,
      );
    }

    // 文件确实还不存在（首次）→ 返回默认值，但明确 exists:false，前端据此提示「尚未创建」。
    if (got.state === "missing") {
      return json({ ok: true, settings: DEFAULT_SETTINGS, sha: null, exists: false });
    }

    const content = b64decode(got.item?.content ?? "");
    let settings: unknown;
    try {
      settings = JSON.parse(content);
    } catch {
      return json({ error: "Failed to parse settings file", code: "SETTINGS_PARSE_ERROR" }, 500);
    }
    return json({ ok: true, settings, sha: got.item?.sha ?? null, exists: true });
  }

  if (request.method === "POST") {
    const parsed = await parseJsonBody<{ settings?: SettingsDoc; sha?: string }>(request);
    if (!parsed.ok) {
      return json(
        {
          error: parsed.code === "INVALID_JSON" ? "Invalid JSON" : "Empty request body",
          code: parsed.code,
        },
        400,
      );
    }

    const { settings, sha } = parsed.body || {};
    if (!settings || !settings.site || !settings.social) {
      return json({ error: "Invalid settings structure" }, 422);
    }

    // S03：写前确认真实版本，杜绝「sha=null 盲写覆盖真实配置」。
    const current = await ghGetChecked(SETTINGS_PATH, env);
    if (current.state === "error") {
      return json(
        {
          error: "Cannot verify current settings version (GitHub read failed); write refused",
          detail: current.error,
          code: "SETTINGS_VERIFY_ERROR",
        },
        502,
      );
    }
    if (current.state === "found") {
      const realSha = current.item?.sha ?? null;
      if (!sha) {
        // 客户端拿着默认值（无 sha）却要覆盖已存在的真实配置 → 拒绝。
        return json(
          {
            error:
              "Settings already exist on GitHub but no base sha was provided. Reload the settings page before saving (refusing to overwrite real config with defaults).",
            code: "SHA_REQUIRED",
          },
          409,
        );
      }
      if (realSha && sha !== realSha) {
        return json(
          {
            error:
              "Settings were changed by someone else since you loaded them. Reload before saving.",
            code: "SHA_CONFLICT",
          },
          409,
        );
      }
    }

    const content = JSON.stringify(settings, null, 2) + "\n";
    const contentB64 = b64encode(content);
    const ok = await ghPut(
      SETTINGS_PATH,
      contentB64,
      "settings: update site settings & social links",
      env,
      sha || undefined,
    );

    if (!ok) {
      return json(
        { error: "Failed to save settings to GitHub", code: "SETTINGS_WRITE_ERROR" },
        502,
      );
    }
    return json({ ok: true, message: "Settings published. Site will rebuild shortly." });
  }

  return json({ error: "Method not allowed" }, 405);
};
