# Contributing — 贡献指南

> 本项目为私有仓库，部署于 Cloudflare Pages。以下为本地开发与提交规范。

## Prerequisites 环境

- **Node.js 22**（仓库含 `.nvmrc` **和** `.node-version`，`nvm use` 自动切换；Cloudflare Workers Builds 也读 `.node-version`）
- npm（随 Node 附带）
- Git

## Local Dev 本地开发

```bash
git clone https://github.com/change979666/Jewelry.git
cd Jewelry
npm install
npm run dev          # http://localhost:4321
```

### 本地数据库

D1 绑定为 `jewelry-db`，迁移位于 `migrations/`：

```bash
npm run db:migrate:local    # 应用 migrations/*.sql 到本地 D1
npm run db:console -- "SELECT COUNT(*) FROM products"
```

`wrangler.toml` 已开启 `platformProxy`，因此 `npm run dev` 下的 `Astro.locals.runtime.env`
可直接访问 D1 / R2 / KV 绑定，无需先 `wrangler pages dev`。

> ⚠️ `npm run build` **不会**清理 `dist/`。若删过页面或路由，请先清空再构建，
> 否则旧页面的编译产物与 `manifest_*.mjs` 会残留在 `dist/` 并被一起部署。
> 沙箱环境下 `rm -rf dist` 可能被安全守卫拦截，可用 `git clean -xdqf dist`。

## Build & Preview 构建与预览

```bash
npm run build        # 输出 dist/（含 _worker.js）
npm run preview      # 预览生产构建
npm run check        # Astro 类型检查
npm run lint         # ESLint
npm run test         # Vitest
npm run ci           # check + lint + format:check + test + build（提交前请本地跑通）
```

## Branch & Commit 分支与提交

- 主分支 `main`，受保护；功能开发用 feature 分支：`git checkout -b feat/xxx`
- 提交信息用 Conventional Commits 风格：
  - `feat:` 新功能 / `fix:` 修复 / `docs:` 文档 / `style:` 样式 / `refactor:` 重构 / `chore:` 杂项
- 示例：`feat: add product detail page` / `docs: add SEO guide`

## Coding Standards 编码规范

1. **新页面**放 `src/pages/[lang]/`。**不要**写 `getStaticPaths`、**不要**从 `Astro.props` 读 `locale`
   —— 本站在 `output: "server"` 下所有 `[lang]/*` 路由都是 SSR，`getStaticPaths` 不生效、
   props 不注入。正确写法：

   ```astro
   ---
   import { requireLocale } from "../../lib/locale";
   const _locale = requireLocale(Astro.params.lang);
   if (_locale instanceof Response) return _locale;   // 非法语言段 → 真实 404
   const locale = _locale;
   ---
   ```

   详见 [ASTRO_COMPONENTS.md](./ASTRO_COMPONENTS.md) 与 `src/lib/locale.ts` 的根因说明。

2. **文案**：界面词典在 `src/i18n.ts`（**仅 en / ar**），组件用 `t()` / `ta()`；
   页面级内容文案（FAQ、CTA、Footer 集合名）随组件内联。禁止硬编码用户可见字符串
   （见 [I18N_GUIDE.md](./I18N_GUIDE.md)）。

3. **颜色/间距**只用 `global.css` 令牌工具类，禁止裸色值（见 [DESIGN_TOKENS.md](./DESIGN_TOKENS.md)）。

4. **内部链接**统一用 `localizedUrl(locale, "/path")`（`src/i18n.ts`），**en 也带前缀 + 尾斜杠**。
   禁止手写 `/en/...`、禁止用 `getRelativeLocaleUrl()`（默认语言不产前缀，会造成死链）。

5. 组件/页面默认通过 `BaseLayout` 输出 SEO meta；新增页面传 `title` + `description`。

6. 双主题（light/dark）必须都验证；尊重 `prefers-reduced-motion`。

7. **域名/邮箱**不得硬编码。一律取 `SITE_CFG.url` / `SITE_CFG.email`（`src/consts.ts`）；
   robots.txt 由 `src/pages/robots.txt.ts` 在构建期生成。

## Deploy 部署

推送 `main` 即触发 Cloudflare Pages 自动部署（Cloudflare 侧配置，无仓库内文档）。
Preview 分支自动出预览环境。上线前必须设置的构建变量见
[01-项目说明.md §7 上线前必改清单](./01-项目说明.md)。

## File Locations 关键文件

| 改什么 | 改哪里 |
|--------|--------|
| 界面文案（en/ar） | `src/i18n.ts` |
| 品牌/联系方式/导航 | `src/consts.ts`、`src/data/settings.json` |
| 生产域名 | `PUBLIC_SITE_URL` 构建变量（见 `src/consts.ts` 顶部说明） |
| 颜色/字体/间距 | `src/styles/global.css` |
| 门店页面 | `src/pages/[lang]/` |
| 后端逻辑（API） | `src/pages/api/` |
| 请求级中间件 | `src/middleware.ts` |
| 数据库 schema | `migrations/`（唯一事实源，**只增不改**已应用的迁移） |
| 部署配置 | `astro.config.mjs` / `wrangler.toml` / `public/_headers` / `public/_redirects` |
| 文档 | `docs/` |
