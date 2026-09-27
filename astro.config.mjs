// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  // TODO: replace with the purchased production domain before deploy.
  site: "https://example.com",
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
    routing: { prefixDefaultLocale: true },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
