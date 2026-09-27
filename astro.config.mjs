// @ts-check
import { defineConfig } from "astro/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

/** Absolute path to ./src, used for the "@/*" alias below. */
const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "src");

// https://astro.build/config
export default defineConfig({
  // Production origin. Set PUBLIC_SITE_URL in the Pages build environment —
  // `src/consts.ts` reads the same variable, so canonical URLs, hreflang,
  // sitemaps and robots.txt all stay in sync from a single setting.
  // Fallback is the placeholder below; replace the variable, not this string.
  site: process.env.PUBLIC_SITE_URL || "https://example.com",
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  i18n: {
    defaultLocale: "en",
    // Jewelry V1 ships English + Arabic (Arabic is rendered native RTL).
    locales: ["en", "ar"],
    // Astro's automatic i18n routing wraps user middleware and rejects any
    // path without a locale prefix — which turned every /admin-v2/** page into
    // a 404 (correct body, wrong status). Routing is fully manual here: the
    // [lang]/ dynamic segment owns localized routes, and non-localized surfaces
    // (/admin-v2/**, /api/**) are served as-is.
    routing: "manual",
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // Mirror the tsconfig `@/*` -> `src/*` alias so imports resolve identically
      // in type-check and in the Vite/Workers build.
      alias: { "@": srcDir },
    },
  },
});
