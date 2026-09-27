# Internationalization Guide — 多语言规范

> 站点支持 **English / العربية（阿拉伯语）** 两种语言，英文为默认语言。
> 阿拉伯语为**原生 RTL**（由 `BaseLayout` 输出 `dir="rtl"`）。
> 界面文案必须进词典，禁止在组件/页面硬编码。

> 🚨 **历史陷阱（务必先读）**：本站曾用 `getStaticPaths = localeStaticPaths` + `Astro.props.locale`
> 传语言。在 `output: "server"` 下 `getStaticPaths` **完全不生效**、`Astro.props` **不注入**，
> 因此 `Astro.props.locale` 恒为 `undefined` → 回退 `"en"` → **整个阿拉伯语站渲染成英文**。
> 该 helper 已删除。详见 `src/lib/locale.ts` 的根因注释。

## Architecture 架构

```
astro.config.mjs
  i18n: {
    defaultLocale: "en",
    locales: ["en", "ar"],
    routing: "manual"     // 手工路由：[lang] 动态段拥有本地化路由
  }

src/i18n.ts
  type Locale = "en" | "ar"
  DEFAULT = "en"
  LOCALE_LIST = ["en", "ar"]
  t(locale, path)             // 取字符串，如 t("ar","hero.title")
  ta(locale, path)            // 取数组，如 ta("en","why.list")
  localeFromPath(pathname)    // 从 URL 反推 locale（替代 Astro.currentLocale）
  localizedUrl(locale, path)  // 生成带前缀 URL（en 也带前缀 + 尾斜杠）
  stripLocale(pathname)       // 剥离前缀，用于导航高亮/语言切换目标计算
  nextLocale(current)         // 语言切换的目标语言

src/lib/locale.ts
  requireLocale(seg)          // 校验 [lang] 段；非法 → Response(404)
```

## Page Setup 页面配置

每个 `[lang]/` 页面**都必须**显式校验语言段：

```astro
---
import { requireLocale } from "../../lib/locale";

const _locale = requireLocale(Astro.params.lang);
if (_locale instanceof Response) return _locale;   // 非法段 → 真实 404，不软回退
const locale = _locale;
---
```

**为什么必须**：`[lang]` 是动态段，任何单段路径（`/anything`）都能匹配到它。
不校验就会得到「HTTP 200 + 首页内容」的**软 404**，既烧抓取预算又稀释 canonical 权重。

**不要**这样做（SSR 下必然出错）：

```astro
export const getStaticPaths = localeStaticPaths;        // ❌ 不生效
const { locale } = Astro.props as { locale: Locale };   // ❌ undefined
```

## Adding a New String 新增文案

1. 在 `src/i18n.ts` 的 `dict.en` / `dict.ar` **两处都加**（缺译回退 `dict.en`）。
2. 组件里取用：`t(locale, "section.key")` 或数组 `ta(locale, "section.list")`。
3. **禁止** `t(locale, "foo") ?? "硬编码"` 这类 fallback 字面量——应回退字典默认值，缺键要补字典。

```ts
// 字典示例
en: { hero: { title: "Everyday fine jewelry, made for the Gulf." } }
ar: { hero: { title: "مجوهرات يومية فاخرة، مصنوعة لمنطقة الخليج." } }
```

## Links 链接

- **所有内部链接必须用 `localizedUrl(locale, "/path")`**（`src/i18n.ts`）：
  ```astro
  import { localizedUrl } from "../i18n";
  <a href={localizedUrl(locale, "/about")}>…</a>   // en → /en/about/   ar → /ar/about/
  ```
- **禁止**手写 `/en/about`（不随语言切换）；**禁止**用 `getRelativeLocaleUrl()` —
  它不给默认语言加前缀，会产生 `/about/` 这类没有对应路由的死链。
- 语言切换（`LangToggle.astro`）：`localizedUrl(targetLocale, stripLocale(Astro.url.pathname))`。
- 在 `.astro` 中**不要**用 `Astro.currentLocale` 取语言；用 `localeFromPath(Astro.url.pathname)`
  （或前述 `requireLocale` 的结果）。SSR 下 `Astro.currentLocale` 不可靠。

## Root Redirect 根路径跳转

`src/pages/index.astro` 处理 `GET /`：服务端读取 `Accept-Language`，命中 `ar` → `302 /ar`，
否则 `302 /en`。这是 **Astro server endpoint（SSR）**，不是边缘函数 ——
`astro dev` 与生产环境行为一致。

> 历史：此逻辑曾在 `functions/index.ts`（Pages Function）+ 客户端 meta-refresh 兜底。
> `functions/` 目录已随全量迁移删除（见 [01-项目说明.md](./01-项目说明.md)）。

## Quality Rules 质量规则

1. 双语文案**语义对等**，阿拉伯语须经**母语者评审**，不接受机翻直出。
2. 动态插值（如「共 N 件」）在字典里预留占位符，组件内拼接。
3. 日期/数字格式按语言习惯（`ar-SA-u-nu-latn` 保留拉丁数字，避免阅读障碍）。
4. 新增语言：同步改 `astro.config.mjs` 的 `locales`、`src/i18n.ts` 的 `Locale` 类型 /
   `LOCALE_LIST` / `dict`、以及 `LangToggle` 渲染——四处必须一致。
5. `<html lang>` / `dir` 由 `BaseLayout` 按 `locale` 输出；`hreflang` 备用链接与 `canonical`
   由 `BaseLayout` 按 `SITE.url`（`src/consts.ts`）生成。
