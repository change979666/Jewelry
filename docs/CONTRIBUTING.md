# Contributing — 贡献指南

> 本项目为私有仓库，部署于 Cloudflare Pages。以下为本地开发与提交规范。

## Prerequisites 环境

- **Node.js 20**（仓库含 `.nvmrc`，`nvm use` 自动切换）
- npm（随 Node 附带）
- Git

## Local Dev 本地开发

```bash
git clone https://github.com/change979666/Aromiso.git
cd Aromiso
npm install
npm run dev          # http://localhost:4321
```

> ⚠️ 询盘 Function（`functions/api/inquiry.ts`）在 `astro dev` 下**不运行**。本地测发信用：
> ```bash
> npm run build
> npx wrangler pages dev dist
> ```

## Build & Preview 构建与预览

```bash
npm run build        # 输出 dist/
npm run preview      # 预览生产构建
npm run check        # Astro 类型检查（可选）
```

## Branch & Commit 分支与提交

- 主分支 `main`，受保护；功能开发用 feature 分支：`git checkout -b feat/xxx`
- 提交信息用 Conventional Commits 风格：
  - `feat:` 新功能 / `fix:` 修复 / `docs:` 文档 / `style:` 样式 / `refactor:` 重构 / `chore:` 杂项
- 示例：`feat: add product detail page` / `docs: add SEO guide`

## Coding Standards 编码规范

1. **新页面**放 `src/pages/[lang]/`，含 `getStaticPaths = localeStaticPaths`，接收 `locale` prop（见 [ASTRO_COMPONENTS.md](./ASTRO_COMPONENTS.md)）。
2. **文案**全部进 `src/i18n.ts`（en/es/de 三语），组件用 `t()` / `ta()`，禁止硬编码用户可见字符串（见 [I18N_GUIDE.md](./I18N_GUIDE.md)）。
3. **颜色/间距**只用 `global.css` 令牌工具类，禁止裸色值（见 [DESIGN_TOKENS.md](./DESIGN_TOKENS.md)）。
4. **内部链接**用 `getRelativeLocaleUrl(locale, href)`，禁止手写前缀。
5. 组件/页面默认通过 `BaseLayout` 输出 SEO meta；新增页面传 `title` + `description`。
6. 双主题（light/dark）必须都验证；尊重 `prefers-reduced-motion`。

## Deploy 部署

推送 `main` 即触发 Cloudflare Pages 自动部署（详见 [CLOUDFLARE_DEPLOY.md](../CLOUDFLARE_DEPLOY.md)）。Preview 分支自动出预览环境。

## File Locations 关键文件

| 改什么 | 改哪里 |
|--------|--------|
| 站点文案 | `src/i18n.ts` |
| 导航/产品/联系方式数据 | `src/consts.ts` |
| 颜色/字体/间距 | `src/styles/global.css` |
| 页面结构 | `src/pages/[lang]/` |
| 后端逻辑 | `functions/` |
| 部署配置 | `astro.config.mjs` / `wrangler.toml` / `public/_headers` |
| 文档 | `docs/` |
