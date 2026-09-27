// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  // TODO: replace with the purchased production domain before deploy.
  site: "https://example.com",
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
