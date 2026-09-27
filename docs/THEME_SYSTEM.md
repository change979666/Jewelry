# Theme System — 主题系统规范

> 站点支持 **浅色 / 深色 / 跟随系统** 三态。基于 Tailwind v4 令牌 + `<html class="dark">` 切换，无 FOUC（首屏闪烁）。

## How It Works 原理

1. **状态存储**：用户选择存 `localStorage.theme`（`'light'` / `'dark'` / `'system'`）。
2. **首屏初始化**：`BaseLayout.astro` 在 `<head>` 内联一段 `is:inline` 脚本，**在 paint 前**读取 localStorage / `prefers-color-scheme` 并给 `<html>` 加 `dark` class，避免闪烁。
3. **切换交互**：`ThemeToggle.astro` 三态循环按钮，更新 class + localStorage。
4. **令牌切换**：`.dark` 下的 `--paper/--ink/...` 覆盖 `:root` 值，`body` 有 `transition: background-color/color 0.4s` 平滑过渡。

```js
// BaseLayout 内联初始化（伪代码）
const saved = localStorage.getItem('theme');           // light|dark|system|null
const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
const dark = saved === 'dark' || ((!saved || saved === 'system') && sysDark);
document.documentElement.classList.toggle('dark', dark);
```

## Tailwind Integration Tailwind 集成

`src/styles/global.css`：

```css
@custom-variant dark (&:where(.dark, .dark *));   /* 让 dark: 工具类响应 .dark class */
@theme inline {
  --color-paper: var(--paper);
  /* … 所有令牌映射到工具类 … */
}
```

> 关键：用 `@custom-variant dark` 把 `dark:` 前缀绑定到 `.dark` class（而非媒体查询），这样切换 class 即切主题。

## Toggle Component 切换组件

`ThemeToggle.astro`：三态循环 `light → dark → system → light`，图标随状态变（太阳/月亮/系统）。点击即生效，写入 localStorage。

## Accessibility 无障碍

- 切换按钮加 `aria-label`（如 "Toggle dark mode"）+ `aria-pressed` 反映当前态。
- 过渡时长 ≤ 0.4s；`@media (prefers-reduced-motion: reduce)` 下 `body` 过渡与 `.reveal` 动画全部关闭（直接显示）。
- 两种模式对比度均满足 WCAG AA（正文 ≥ 4.5:1）。

## Rules 规则

1. **新增颜色必须成对**：`:root` 与 `.dark` 各一个值，并在 `@theme inline` 注册。
2. **禁止媒体查询强行定色**：一切靠 `.dark` class，保证用户手动选择优先于系统。
3. **首屏脚本必须 `is:inline` 且在 `<head>`**：否则会 FOUC。
4. **所有组件验证双模式**：在 light 与 dark 下各看一遍，禁止出现「深色模式文字消失/对比不足」。
5. 不要给 `html` 或 `body` 写 `background` 硬编码——统一走 `--paper`。
