# Internationalization Guide — 多语言规范

> 站点支持 **English / Español / Deutsch** 三种语言，使用 Astro 官方 i18n 路由（前缀模式）。**所有用户可见文案必须进入字典，禁止在组件/页面硬编码字符串。**

## Architecture 架构

```
astro.config.mjs
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es', 'de'],
    routing: { prefixDefaultLocale: true }   // 所有语言带前缀：/en /es /de
  }

src/i18n.ts
  dict = { en: {...}, es: {...}, de: {...} }  // 嵌套对象，点路径访问
  LOCALE_LIST = ['en','es','de']
  t(locale, path)        // 取字符串，如 t('de','hero.title')
  ta(locale, path)       // 取数组，如 ta('en','why.list')
  localeStaticPaths()    // 供 getStaticPaths 生成三语路由
  stripLocale(path)      // 剥离前缀，用于导航高亮/语言切换目标计算
```

## Page Setup 页面配置

每个 `[lang]/` 页面：

```astro
---
import { localeStaticPaths } from "../../i18n";
export const getStaticPaths = localeStaticPaths;   // 生成 /en /es /de 三套
const { locale } = Astro.props as { locale: Locale };
---
```

## Adding a New String 新增文案

1. 在 `src/i18n.ts` 的 `dict.en` / `dict.es` / `dict.de` **三处都加**（缺译会回退到 `dict.en` 对应路径，但务必补译）。
2. 组件里取用：`t(locale, "section.key")` 或数组 `ta(locale, "section.list")`。
3. **禁止** `t(locale, "foo") ?? "硬编码"` 这种 fallback 字面量——未翻译应回退字典默认值，缺失键要补。

```ts
// 字典示例
en: { hero: { title: "Premium scent, sourced with confidence." } }
es: { hero: { title: "Aroma premium, con confianza." } }
de: { hero: { title: "Premium-Duft, sicher bezogen." } }
```

## Links 链接

- **所有内部链接必须用 `getRelativeLocaleUrl(locale, href)`**（来自 `astro:i18n`），自动加当前语言前缀：
  ```astro
  import { getRelativeLocaleUrl } from "astro:i18n";
  <a href={getRelativeLocaleUrl(locale, "/products")}>…</a>  // → /en/products
  ```
- **禁止**手写 `/en/products` 或 `/products`——前者不随语言切换，后者在 `prefixDefaultLocale:true` 下 404。
- 语言切换（`LangToggle.astro`）：`getRelativeLocaleUrl(targetLocale, stripLocale(Astro.url.pathname))` 跳转到同页异语。

## Root Redirect 根路径跳转

`functions/index.ts` 处理 `GET /`：读取 `Accept-Language`，命中 `de` → `/de`，命中 `es` → `/es`，否则 `/en`。**这是边缘函数，仅在 Cloudflare 运行**（`astro dev` 不触发，根路径由 `src/pages/index.astro` 的 meta-refresh 兜底）。

## Quality Rules 质量规则

1. 三语文案**语义对等**，不只是机翻；德语用正式商务语气。
2. 动态插值（如「共 N 个工厂」）用占位符在字典里预留，组件内拼接。
3. 日期/数字格式按语言习惯（es/de 用各自本地化格式）。
4. 新增语言：改 `astro.config.mjs` 的 `locales` + `src/i18n.ts` 的 `dict` + `LangToggle` 渲染，三处同步。
5. `<html lang>` 由 `BaseLayout` 按 `locale` 输出；`hreflang` 备用链接与 `canonical` 由 `BaseLayout` 按语言生成（SEO 友好）。
