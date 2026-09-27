# Design Tokens — 设计令牌规范

> 所有颜色、字体、间距、圆角集中定义于 `src/styles/global.css` 的 `:root` 与 `.dark`，并通过 `@theme inline` 映射到 Tailwind v4 工具类。**新增任何颜色都必须先加令牌，禁止在组件里写硬编码色值。**

## Color Palette 调色板

### Light 浅色（`:root`）

| Token | Hex | Tailwind utility | 用途 |
|-------|-----|-----------------|------|
| `--paper` | `#fbf9f4` | `bg-paper` / `text-paper` | 页面主背景（暖白） |
| `--beige` | `#efe7d8` | `bg-beige` | 暖米色区块背景 |
| `--sand` | `#e5dac8` | `bg-sand` | 更深米色装饰/分隔 |
| `--ink` | `#211f1b` | `text-ink` / `bg-ink` | 主文字 / 反白按钮底色（深灰） |
| `--stone` | `#6e675c` | `text-stone` | 次要/弱化文字 |
| `--line` | `rgba(33,31,27,0.10)` | `border-line` | 描边/分隔线 |
| `--accent` | `#9a6a45` | `text-accent` / `bg-accent` | 陶土色强调（eyebrow、链接 hover） |
| `--accent-soft` | `#b98a63` | `bg-accent-soft` | 浅强调（::selection 背景） |
| `--card` | `#ffffff` | `bg-card` | 卡片表面 |

### Dark 深色（`.dark`）

| Token | Hex | 用途 |
|-------|-----|------|
| `--paper` | `#16140f` | 页面背景 |
| `--beige` | `#1f1c16` | 区块背景 |
| `--sand` | `#2a261e` | 装饰 |
| `--ink` | `#ece6da` | 主文字（浅） |
| `--stone` | `#a39b8c` | 次要文字 |
| `--line` | `rgba(236,230,218,0.12)` | 描边 |
| `--accent` | `#c79a76` | 强调（深底上提亮） |
| `--accent-soft` | `#b98a63` | 浅强调 |
| `--card` | `#1c1913` | 卡片表面 |

> 主题切换由 `<html class="dark">` 驱动。`.dark` 下的色值自动覆盖 `:root`。`body` 有 `transition: background-color/color 0.4s`，切换平滑。

## Typography 字体

| Token | Value | 用途 |
|-------|-------|------|
| `--font-sans` | `"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` | 全站正文字体 |

- 标题字重 `600`，字距 `-0.02em`（`h1–h4`）
- 正文抗锯齿开启（`-webkit-font-smoothing: antialiased`）
- 德语复用 Inter（拉丁字母），无需额外 Web 字体（如未来加中文再引入 Noto Sans SC）

## Spacing & Radius 间距与圆角

| Token | Value | Tailwind utility | 用途 |
|-------|-------|-----------------|------|
| `--radius-xl` | `1.25rem` | `rounded-xl` | 卡片/输入框 |
| `--radius-2xl` | `1.75rem` | `rounded-2xl` | 大区块/玻璃卡 |

- 页面最大宽度容器：`.container-x` → `max-width: 76rem`（1216px），左右 padding `1.25rem`
- 区块垂直节奏：桌面 `py-20`~`py-28`（5–7rem），移动端减半
- 间距刻度遵循 Tailwind 默认 4px 栅格（1 = 0.25rem）

## Semantic Utility Classes 语义类（组件层）

定义在 `@layer components`：

| Class | 作用 |
|-------|------|
| `.btn` | 圆角胶囊按钮基底（`rounded-full px-6 py-3`，300ms 过渡） |
| `.btn-primary` | 实底按钮（`bg-ink text-paper`，hover 上浮 + 阴影） |
| `.btn-ghost` | 描边按钮（`border-line`，hover 米色底） |
| `.eyebrow` | 小标签（`text-xs uppercase tracking-[0.18em]`，accent 色） |
| `.card-surface` | 卡片表面（`bg-card border-line`） |
| `.reveal` / `.reveal.is-visible` | 滚动渐显（默认 `opacity:0`，加 `.is-visible` 显现；`prefers-reduced-motion` 下直接显示） |
| `.container-x` | 居中最大宽度容器 |

## Usage Rules 使用规则

1. **永远用令牌工具类**（`bg-paper` `text-ink` `text-accent` …），不要写 `#211f1b` 之类的裸色值。
2. **新增颜色**：先在 `:root` 和 `.dark` 各加一对 `--xxx`，再在 `@theme inline` 里加 `--color-xxx: var(--xxx)`。
3. **主题一致性**：任何新组件必须同时验证 light / dark 两种模式下的对比度（正文 ≥ WCAG AA）。
4. **圆角**：卡片用 `rounded-xl`，大区块用 `rounded-2xl`，按钮用 `rounded-full`，不要混用随意数值。
5. **动效**：过渡统一 `duration-300`~`0.4s`，曲线 `ease-out` / `cubic-bezier(0.16,1,0.3,1)`；必须尊重 `prefers-reduced-motion`。
