# Image Spec — 图片规范

> 当前站点图片区为 CSS 占位（米色渐变块）。上线前需替换为真实摄影。本规范定义尺寸、格式、命名与接入方式。

## Formats & Compression 格式与压缩

| 用途 | 推荐格式 | 说明 |
|------|---------|------|
| 照片 / Hero / 产品图 | **WebP**（首选）或 **AVIF** | 比 JPEG 小 25–50%；Astro 构建可自动优化 |
| 图标 / Logo / 装饰 | **SVG** | 矢量、可主题化（`currentColor`） |
| 社交分享图 (og) | SVG 或 1200×630 PNG | 当前 `public/og.svg` 已就绪 |

- 一律走 `<img>` + `loading="lazy"`（首屏 hero 用 `loading="eager"` + `fetchpriority="high"`）。
- 提供 `width` / `height` 防止布局抖动（CLS）。
- 文件体积：单张照片 ≤ 200KB（WebP）；Hero ≤ 300KB。

## Dimensions 推荐尺寸

| 位置 | 尺寸 (px) | 比例 |
|------|----------|------|
| Hero 背景 / 主视觉 | 1600×900 | 16:9 |
| 产品图（方） | 800×800 | 1:1 |
| 产品场景图 | 1200×800 | 3:2 |
| 工厂 / 团队照片 | 1200×800 | 3:2 |
| 博客封面 | 1200×630 | ≈ 社交图比例 |
| 头像（团队） | 400×400 | 1:1 |
| Favicon | 32×32（SVG 矢量，无需固定） | — |
| OG 图 | 1200×630 | 1.91:1 |

## Naming 命名

```
public/images/
  hero-factory.jpg
  products/essential-oils.webp
  products/scented-candles.webp
  products/reed-diffusers.webp
  about/team-zhang.webp
  about/facility-line.webp
  blog/<slug>-cover.webp
```

- 小写、连字符分隔、语义化；不要 `img1.jpg` / `微信图片_xxx.png`。
- 多语言共用同一张图（不按语言分文件），除非确有必要本地化。

## Integration 接入

1. 放入 `public/images/`（构建时原样拷贝，引用用 `/images/xxx.webp`）。
2. 组件内：
   ```astro
   <img src="/images/hero-factory.webp" alt="Aromiso 上海工厂产线"
        width="1600" height="900" loading="eager" fetchpriority="high" />
   ```
3. 产品卡图：在 `consts.ts` 的 `PRODUCTS` 加 `image` 字段，组件渲染。
4. **替代文本**：每张图必须 `alt`，描述内容（利于 SEO 与无障碍）；装饰性图用 `alt=""`。

## Quality Bar 质量线

- 真实摄影，非图库拼凑感；统一暖色自然光，契合「White / Warm Beige / Dark Gray」调性。
- 人像需授权；工厂图展示真实产线/质检场景。
- 严禁低分辨率拉伸、水印、与品牌调性冲突的强饱和色。
