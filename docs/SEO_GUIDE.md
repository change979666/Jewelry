# SEO Guide — SEO 规范

> 静态站 + 多语言，SEO 重点在：正确的 `canonical` / `hreflang`、完整 sitemap、社交分享图、安全头。所有 meta 在 `BaseLayout.astro` 统一输出，页面只传 `title` / `description` / `locale`。

## On-page Meta 页面元信息

`BaseLayout.astro` 自动生成（按 `locale` 切换 `hreflang` 与 `canonical`）：

```html
<title>{title} · Aromiso</title>
<meta name="description" content={description}>
<link rel="canonical" href="https://aromiso.com/{lang}/{page}/" />
<!-- 每语言一条备用链接 -->
<link rel="alternate" hreflang="en" href="https://aromiso.com/en/products/" />
<link rel="alternate" hreflang="es" href="https://aromiso.com/es/products/" />
<link rel="alternate" hreflang="de" href="https://aromiso.com/de/products/" />
<link rel="alternate" hreflang="x-default" href="https://aromiso.com/en/products/" />
<html lang="{lang}">
```

规则：
- 每页 `title` 唯一且含品牌名；`description` 60–160 字符。
- `canonical` 必须带语言前缀（与路由一致），禁止指向无前缀 URL。
- `x-default` 指向英文版。

## Open Graph / Social 社交分享

`BaseLayout` 输出 OG/Twitter 标签；分享图统一用 `public/og.svg`（等效 1200×630）：

```html
<meta property="og:title" content={title}>
<meta property="og:description" content={description}>
<meta property="og:image" content="https://aromiso.com/og.svg">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
```

## Sitemap 站点地图

由 `@astrojs/sitemap` 集成自动生成（`astro.config.mjs` 已配置）。构建后产出：

- `dist/sitemap-index.xml` → 指向 `sitemap-0.xml`
- `sitemap-0.xml` 含全部 21 个语言路由（`/en/*` `/es/*` `/de/*`）

`public/robots.txt` 指向 `https://aromiso.com/sitemap-index.xml`。

## Technical SEO 技术 SEO

| 项 | 实现 | 位置 |
|----|------|------|
| 语义化结构 | `<header>/<main>/<footer>/<section>` + 跳转链接 skip-link | 各布局/组件 |
| 404 页面 | 品牌化 `src/pages/404.astro` | `dist/404.html` |
| 安全响应头 | HSTS / X-Frame-Options / Referrer-Policy / Permissions-Policy | `public/_headers` |
| 资源缓存 | `/_astro/*` `immutable` 长缓存 | `public/_headers` |
| 图片 alt | 所有 `<img>` 必须有 `alt` | 组件规范 |
| 性能 | 指纹化资源、关键 CSS 内联、图片 WebP/AVIF | Astro 默认 + 图片规范 |

## Quality Rules 质量规则

1. 新增页面必须传 `title` + `description` 给 `BaseLayout`，否则用站点默认值。
2. 改 `site` URL（`astro.config.mjs`）后必须重建——sitemap/canonical/OG 全部依赖它。
3. 部署后到 [bing/webmaster](https://www.bing.com/webmasters) 和 Google Search Console 提交 `sitemap-index.xml`。
4. `hreflang` 必须**互为引用且自洽**（每页列出全部语言 + x-default），否则 Google 会忽略。
5. 多语言内容避免机器翻译腔；同页三语应是等价本地化，利于 SEO 权重集中。
