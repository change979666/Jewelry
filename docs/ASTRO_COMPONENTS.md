# Astro Component Spec — 组件规范

> 组件是 `.astro` 文件，位于 `src/components/`。遵循「展示型、无副作用、可组合」原则。

## Component Inventory 组件清单

| 组件 | 职责 | 关键 props |
|------|------|-----------|
| `BaseLayout.astro` | 全站 `<html>` 骨架、SEO head、字体、主题与语言初始化脚本、Header/Footer 插槽 | `title`, `description`, `locale`, `image?` |
| `Header.astro` | 响应式导航栏（logo、nav、移动汉堡菜单、ThemeToggle、LangToggle、Get a Quote CTA） | `locale` |
| `Footer.astro` | 页脚（品牌 + 导航列 + 联系方式 + 订阅框 + 社交 + 版权） | `locale` |
| `ThemeToggle.astro` | 浅/深/系统三态切换按钮，写入 `localStorage` + 切 `<html class="dark">` | `locale` |
| `LangToggle.astro` | EN/ES/ZH 切换，跳转到同页异语 URL | `locale` |
| `Icon.astro` | 线性 SVG 图标系统（统一 `stroke`，`currentColor`） | `name`, `class?`, `size?` |
| `SectionHeading.astro` | 区块标题：`eyebrow` + `title` + 可选 `subtitle` | `eyebrow`, `title`, `subtitle?`, `class?` |
| `FeatureCard.astro` | 图标卡：`icon` + `title` + `desc` | `icon`, `title`, `desc`, `class?` |

## Frontmatter Pattern 页面 frontmatter 模板

所有 `[lang]/` 下的页面统一结构：

```astro
---
import BaseLayout from "../../layouts/BaseLayout.astro";
import { t } from "../../i18n";
import type { Locale } from "../../i18n";
import { localeStaticPaths } from "../../i18n";

export const getStaticPaths = localeStaticPaths;

const { locale } = Astro.props as { locale: Locale };
// 取数组用 ta()，取字符串用 t()
const items = ta(locale, "products.list");
---
<BaseLayout title={t(locale, "nav.products")} description={t(locale, "products.desc")} locale={locale}>
  <!-- 内容 -->
</BaseLayout>
```

## Rules 规则

1. **Props 类型**：组件 props 用 `Astro.props` 解构，复杂对象显式标注类型。
2. **无全局副作用**：组件内 `<script>` 用 `is:inline` 仅做必要 DOM 操作；主题/语言逻辑集中在 `ThemeToggle` / `LangToggle` / `BaseLayout` 初始化脚本，避免重复。
3. **样式**：只用 `global.css` 的令牌工具类与语义类（`.btn`, `.eyebrow`, `.card-surface`, `.reveal`）。新增复用样式先加到 `global.css` 的 `@layer components`，不要在组件里写 `<style>` 散样式。
4. **图标**：统一走 `Icon.astro` 的 `name` 调用，新增图标在 `Icon.astro` 的 `icons` map 里加 SVG path，禁止内联裸 `<svg>`。
5. **可访问性**：交互元素用 `<button>`/`<a>`；图标按钮加 `aria-label`；图片加 `alt`；表单 `<label>` 关联 `input`。
6. **响应式**：移动优先；断点用 Tailwind 默认（`sm/md/lg/xl`）。导航在 `md` 以下切汉堡菜单。
7. **主题兼容**：任何新组件必须验证 light/dark 两种模式对比度。
8. **`reveal` 动画**：需要滚动渐显的元素加 `class="reveal"`，由 `BaseLayout` 的 IntersectionObserver 脚本加 `.is-visible`。**必须**保留该 class 的 `opacity:0` 初始态（JS 未加载时内容不可见是预期降级，但 JS 正常时必现）。

## Reusable Snippets 复用片段

区块标题：
```astro
<SectionHeading eyebrow={t(locale, "home.why_eyebrow")} title={t(locale, "home.why_title")} />
```

特性卡循环：
```astro
{ta(locale, "why.list").map((f) => (
  <FeatureCard icon="shield" title={f.title} desc={f.desc} />
))}
```

主按钮：
```astro
<a href={getRelativeLocaleUrl(locale, "/contact")} class="btn btn-primary">Get a Quote</a>
```
