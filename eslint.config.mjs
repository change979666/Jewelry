// ESLint flat config — Astro + TypeScript.
// 规则分层：全仓库 warn 起步（渐进收严），functions/ 边缘函数 any 直接 error，
// 因为这里是鉴权、限流、询盘等资金安全相关逻辑，类型必须完备。
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginAstro from "eslint-plugin-astro";

export default [
  {
    ignores: [
      "dist/",
      "**/dist/",
      "node_modules/",
      ".astro/",
      ".wrangler/",
      "public/",
      "tmp/",
      "scripts/", // 一次性内容生成脚本，随 P2 归档后移除
      ".husky/",
      ".r2/",
      "mcp/", // MCP server (third-party tooling)
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // 边缘函数：鉴权 / 限流 / 询盘 / CMS 发布链——禁止 any，类型必须完备。
    files: ["functions/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];
