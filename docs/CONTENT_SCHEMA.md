# Aromiso Content Schema（内容字段标准）

> ⚠️ **历史快照 — 非当前文档。** 本文描述的是前身项目 **Aromiso（香薰 B2B）** 时期的实现，
> 其中的 `functions/` 目录、`commerce_*` 表、en/es/de 三语、`/admin`（V1）等均**已不存在**。
> 保留此文仅作迁移对照与决策留痕。**当前架构与约定以 [`README.md`](../README.md) 与
> [`docs/01-项目说明.md`](./01-项目说明.md) 为准。**

> 版本：v1.0 · 2026-08-10
> 用途：Phase 2 Content Factory 的地基。AI 角色只输出符合本 Schema 的 JSON，模板只管渲染。
> 本文随仓库走，是 Content Factory 生成器、质量闸、模板三方共同的字段契约。
> §10「逻辑字段 ↔ 代码字段对照表」由 dev agent 依据真实代码字段维护（§8 委托项）。

---

## 0. 设计原则

1. **AI 填 JSON，模板渲染**——AI 不需要懂 Astro/Tailwind，只需产出字段。
2. **空状态隐藏**——任何数组/可选字段为空时，模板将整个 section（含 padding）隐藏：`{data && data.length>0 && <section>…</section>}`。
3. **显示层与 SEO 层分离**——凡有"给用户看的短文案"和"给搜索引擎的完整文案"之分，一律拆两个字段。
4. **三语同源**——同一逻辑字段在 `en/es/de` 各存一份，字段名一致，值按语言。
5. **可追溯**——AI 生成内容带 `idempotency_key` + `_meta`（生成角色/模型/时间/质量分），落库可复盘。

---

## 1. 全局字段（所有内容页共享）

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| `slug` | string | ✅ | `^[a-z0-9-]+$`，全站唯一 | URL 路径段 |
| `lang` | enum | ✅ | `en` / `es` / `de` | 语言 |
| `meta_title` | string | ✅ | ≤60 字符 | `<title>`，SEO 层，可含关键词 |
| `meta_desc` | string | ✅ | 120–160 字符 | meta description |
| `display_title` | string | ✅ | ≤60 字符 | 页面 H1，**显示层，干净不堆砌** |
| `hero_image` | object | 建议 | `{src, alt}`；alt ≤125 字符 | 主图；空则隐藏 hero 区 |
| `breadcrumb` | array | ✅ | `[{label, href}]` | 面包屑；模板自动输出 BreadcrumbList JSON-LD |
| `faq` | array | 可选 | `[{q, a}]`，q≤120 / a≤400 字符 | 有值则输出 FAQPage JSON-LD；空则隐藏 FAQ 区 |
| `cta` | object | 建议 | `{title, desc, button_text, button_href}` | 底部统一 CTA；空则用默认组件 |
| `_meta` | object | AI 生成必填 | `{agent, model, generated_at, quality_score, idempotency_key}` | 溯源与质量闸挂钩 |

---

## 2. Blog Post（博客文章）

> 对应 `/en/blog/{slug}/`。用于 SEO 长尾 + 内容营销。

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| `category` | enum | ✅ | 站内分类（如 `product-knowledge` / `cost-breakdown` / `market-insight`） | 卡片标签 |
| `excerpt` | string | ✅ | ≤160 字符 | 列表页卡片摘要 |
| `author` | string | 建议 | — | 默认 "Aromiso Editorial" |
| `published_at` | date | ✅ | ISO 8601 | 发布日期 |
| `read_time` | int | 建议 | 分钟 | 阅读时长 |
| `body` | markdown | ✅ | 800–2500 词 | 正文；支持 h2/h3/列表/表格/图片 |
| `toc` | array | 自动 | 从 body 的 h2 提取 | 目录；模板生成 |
| `tags` | array | 建议 | ≤6 个 | 标签 |
| `related_products` | array | 建议 | ≤3 个 `product_id` | 底部推荐商品卡（链到 PDP） |
| `related_guides` | array | 建议 | ≤3 个 guide `slug` | 相关指南 |
| `related_posts` | array | 建议 | ≤3 个 blog `slug` | 相关文章 |
| **JSON-LD** | — | 自动 | `BlogPosting` + `BreadcrumbList` (+`FAQPage` 若有 faq) | 模板输出 |

---

## 3. Guide（买家指南）

> 对应 `/en/resources/{slug}/`。深度长文，偏"教学/避坑"。

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| `excerpt` | string | ✅ | ≤160 字符 | 列表卡片摘要 |
| `body` | markdown | ✅ | 1200–3000 词 | 正文 |
| `toc` | array | 自动 | 从 h2 提取 | 目录 |
| `steps` | array | 可选 | `[{title, desc}]` | 步骤型指南用（HowTo schema） |
| `related_products` | array | 建议 | ≤3 个 `product_id` | 关联商品 |
| `related_guides` | array | 建议 | ≤3 个 guide `slug` | 相关指南 |
| **JSON-LD** | — | 自动 | `Article` + `BreadcrumbList` (+`FAQPage` / `HowTo`) | 模板输出 |

---

## 4. Solutions Detail（行业方案页）

> 对应 `/en/solutions/{industry}/`。按行业切入，建信任 + 导转化。

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| `industry` | enum | ✅ | `hotels` / `spa-wellness` / `retail` / `amazon-sellers` / `supermarkets` / `brand-owners` / `wholesalers` / `distributors` | 行业标识 |
| `subtitle` | string | ✅ | ≤120 字符 | H1 下副标题 |
| `challenges` | array | ✅ | 3 个 `{icon, title, desc}`；desc≤120 字符 | "Challenges We Solve" 卡 |
| `recommended_products` | array | ✅ | 3 个 `{product_id, note}` | 推荐商品（**链到 PDP**，note 为行业适配一句话） |
| `popular_products` | array | 建议 | ≤3 个 `product_id` | 更多商品 |
| `why_us` | array | ✅ | 3–4 个 `{title, desc}` | "Why Work With Us" |
| `guides` | array | 建议 | ≤3 个 guide `slug` | 行业相关指南 |
| **JSON-LD** | — | 自动 | `Service` + `BreadcrumbList` (+`FAQPage`) | 模板输出 |

---

## 5. Export Detail（出口国别页）

> 对应 `/en/export/{country}/`。合规 + 物流 + 市场，按国家切入。

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| `country` | enum | ✅ | `usa` / `germany` / `france` / `spain` / `canada`（后续可扩） | 国家标识 |
| `subtitle` | string | ✅ | ≤120 字符 | 副标题 |
| `badges` | array | ✅ | ≤4 个 `{label, value}` | 合规徽章行（如 FDA ✓ / 15-20 days） |
| `compliance` | array | ✅ | 3–4 个 `{title, desc}` | 合规要求卡（FDA/ASTM/Labeling/TSCA…） |
| `popular_products` | array | ✅ | 3 个 `product_id` | 该市场热门商品 |
| `shipping` | array | ✅ | 3–4 个 `{method, desc, eta}` | 物流方式卡（Sea/Air/DDP/FBA） |
| **JSON-LD** | — | 自动 | `WebPage` + `BreadcrumbList` (+`FAQPage`) | 模板输出 |

---

## 6. PDP（商品详情页）

> 对应 `/en/shop/{short_id}/`。B2B 商品页。数据来自 D1/CMS，AI 仅清洗不改价。

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| `short_id` | string | ✅ | 10 位 hex | 紧凑 PDP URL（已存在） |
| `short_name` | string | ✅ | **≤60 字符，干净** | **H1 显示层**（A1 新增字段，去堆砌去重） |
| `full_name` | string | ✅ | 原值不动 | `<title>`/JSON-LD/meta，SEO 层保留完整关键词 |
| `price_min` / `price_max` | number | ✅ | >0 | 价格区间（USD） |
| `currency` | string | ✅ | 默认 `USD` | — |
| `moq` | int | ✅ | >0 | 最小起订量 |
| `images` | array | ✅ | ≥1 个 `{src, alt}` | 主图+缩略图 |
| `specs` | object | 建议 | `{key: value}` | 规格表 |
| `highlights` | array | 建议 | ≤6 条，每条≤80 字符 | 卖点 |
| `packaging` | object | 可选 | `{desc, carton, cbm}` | **无箱规数据则不显示 CBM**（不编造） |
| `shipping` | object | 可选 | `{methods, eta}` | 物流 |
| `tags` | array | 建议 | 如 `Curated & Verified` / `OEM` | 标签徽章 |
| **JSON-LD** | — | 自动 | `Product` + `AggregateOffer`（真实价/InStock）+ `BreadcrumbList` | 中间件注入 |

---

## 7. 列表页（聚合页，AI 少碰）

`/en/blog/`、`/en/resources/`、`/en/solutions/`、`/en/shop/` 为聚合页，内容来自上述详情页的 `display_title`/`excerpt`/`hero_image`/`category`。**AI 不直接生成列表页**，列表由详情页数据自动聚合渲染。

---

## 8. 命名与对齐规范（交给 dev agent 校验）

- 逻辑字段统一 **snake_case**；映射到代码实际字段时由 dev agent 建一张「逻辑字段 ↔ 代码字段」对照表（见 §10）。
- `product_id` 一律用 `short_id`（10 位 hex），保证推荐/关联链接指向有效 PDP。
- 所有 `*_products` 关联字段，模板渲染前需校验 `product_id` 在 D1 存在且 active，否则跳过该卡（防空链）。

---

## 9. 与 100 分质量闸门挂钩

以下字段完整性直接进 Content Factory 的质量评分（D3 评分维度的输入）：

| 评分项 | 依赖字段 | 及格信号 |
|--------|----------|----------|
| meta 完整 | `meta_title` + `meta_desc` | 长度达标、含目标关键词 |
| 显示层干净 | `display_title` / `short_name` | ≤60 字符、无堆砌重复 |
| 正文质量 | `body` | 词数达标、无 markdown 泄漏 |
| 内链 | `related_*` / `recommended_products` | ≥2 个有效内链 |
| 结构化数据 | `faq` / `breadcrumb` | 有 FAQ 则出 FAQPage |
| 图片可访问 | `hero_image` / `images` | 有 alt、无破图 |
| 溯源 | `_meta` | 六要素齐全 |

---

## 10. 逻辑字段 ↔ 代码字段对照表（dev agent 维护）

> Schema §8 委托项。本表把上文的**逻辑字段**对齐到仓库里**真实存在**的存储字段，
> 供 Content Factory 生成器写入、模板读取时不跑偏。表中"存储位置"决定内容如何落地：
>
> - **Content Collection（文件）**：`src/content/{blog,guides,caseStudies}/<key>.<locale>.md` 的 frontmatter（schema 见 `src/content/config.ts`）。经 `save.ts` ghPut 提交到 GitHub → 触发 Pages 重建。
> - **D1 表**：`commerce_products` / `commerce_product_variants` / `commerce_price_tiers`（PDP 数据）。
> - **硬编码 i18n**：`src/i18n-content.ts`（Solutions / Export 详情页）——**当前非 `save.ts` 可写**，AI 生成需人工搬运或后续单开写入通道（见 §10.4 缺口）。

### 10.1 全局字段映射

| 逻辑字段 | Blog/Guide 代码字段（frontmatter） | PDP 代码字段（D1 列） | 备注 |
|----------|-----------------------------------|----------------------|------|
| `slug` | `key`（locale-agnostic 标识，非 Astro 保留的 slug） | `short_id` / `slug` | 路由用 `key`；PDP 规范 URL 用 `short_id` |
| `lang` | `locale`（`en`/`es`/`de`） | 商品当前单语存 D1，无 locale 列 | 三语博客=三个文件同 `key` |
| `meta_title` | `seoTitle`（可选，空则回退 `title`） | `seo_title` | SEO 层 |
| `meta_desc` | `seoDescription` | `seo_description` | SEO 层 |
| `display_title` | `title` | `short_name`（A1 新增，clean H1） | 显示层 |
| `hero_image` | `cover`（string src） | `cover_image` / `gallery[]` | frontmatter 无独立 alt，alt 取 `title` |
| `breadcrumb` | 模板生成（非 frontmatter） | 中间件 `_middleware.ts` 生成 | BreadcrumbList JSON-LD 自动 |
| `faq` | ⚠️ 缺口：blog/guide frontmatter 无 faq 字段 | `faq`（D1，JSON 字符串） | 见 §10.4 |
| `cta` | 模板默认组件（非 frontmatter） | PDP 询盘面板固定 | — |
| `_meta` | ⚠️ 缺口：无 frontmatter 溯源字段 | `ai_usage` 表 + task payload | 溯源目前落在 Task/ai_usage，不进内容体 |

### 10.2 Blog / Guide 专属映射

| 逻辑字段 | 代码字段（`src/content/config.ts`） | 备注 |
|----------|-------------------------------------|------|
| `category` | `category`（blog: default "Insights"；guide: default "Guides"） | 一致 |
| `excerpt` | `excerpt` | 一致 |
| `author` | `author`（default "Aromiso Team"） | Schema 建议 "Aromiso Editorial"，代码默认 "Aromiso Team"（保持代码默认，勿造作者名） |
| `published_at` | `pubDate`（`z.coerce.date()`） | 一致 |
| `read_time` | ⚠️ 缺口：无字段（模板按词数估算或省略） | — |
| `body` | Markdown 正文（frontmatter 之外的文件体） | — |
| `tags` | `tags`（default []） | 一致 |
| `keywords` | `keywords`（default []，代码额外字段） | Schema 未列，SEO 关键词数组 |
| `related_products` / `related_guides` / `related_posts` | ⚠️ 缺口：无 frontmatter 字段 | 见 §10.4，内链暂靠正文 + 分类聚合 |
| Guide `order` | `order`（number，hub 手动排序） | Schema 未列，代码已有 |
| Guide `steps` | ⚠️ 缺口：无字段（HowTo 暂不出） | — |

### 10.3 PDP 映射（D1 `commerce_products`）

| 逻辑字段 | D1 列 | 备注 |
|----------|-------|------|
| `short_id` | `short_id` | 10 位 hex |
| `short_name` | `short_name` | A1 新增，clean ≤60 H1 |
| `full_name` | `title` | SEO 完整名，`<title>`/JSON-LD 用 |
| `price_min` / `price_max` | `commerce_price_tiers.unit_price`（MIN/MAX 聚合） | 非商品表直接列 |
| `currency` | `commerce_price_tiers.currency`（default USD） | — |
| `moq` | `moq` | — |
| `images` | `cover_image` + `gallery`（JSON 数组） | alt 取 `title` |
| `specs` | `specifications`（JSON） | — |
| `highlights` | `product_highlights` / `key_features`（JSON） | — |
| `packaging` | `shipping_info`（JSON）+ 变体 | **无箱规不编 CBM** |
| `tags` | `tags`（JSON） | — |
| `video`（扩展） | `video_url`（V5.18） | 有则 PDP 优先播放 |

> ⚠️ **前台隔离红线**：`source_product_key` / `source_sku_id` / `supplier_*` / `cost_price` / `source_url` 等供应链字段**绝不出前台**，一律经 `sanitizeProduct()` / `sanitizeVariant()` 过滤（见 `functions/api/commerce/products.ts`）。生成器/模板不得引用这些列。

### 10.4 已知缺口与处置（Content Factory 排期依据）

1. **blog/guide frontmatter 无 `faq` / `related_*` / `_meta` 字段**：Schema 建议但 `config.ts` 未定义。
   - 处置：Content Factory **首版只生成 `config.ts` 已存在的字段**（title/excerpt/category/tags/keywords/seoTitle/seoDescription + body），`faq`/`related_*`/`_meta` 待后续给 `blog`/`guides` collection 扩 schema 后再启用。**不生成模板读不到的字段**（避免脏 frontmatter 构建失败）。
2. **Solutions / Export 存在 `src/i18n-content.ts`（硬编码），非 `save.ts` 可写路径**：`save.ts` 的 ghPut 白名单只覆盖 `src/content/`、`public/images|docs/` 等，`i18n-content.ts` 不在内。
   - 处置：Content Factory **首版不自动生成 Solutions/Export**，这两类作为人工/半自动搬运，或后续单开受控写入通道后再纳入自动化。
3. **`_meta` 溯源目前落在 `ai_usage` 表 + Task payload**，不进内容体。质量分（quality_score）随 Task Memory / knowledge 记录，符合"可复盘"原则；无需强塞进 frontmatter。

> **HISTORICAL（V5.69 已 supersede）**：下述「KV 草稿 → L2 REVIEW → 人工审批 → ghPut」为**首版**链路描述。V5.69 起内容生产已升级为无人值守：`Creator → Gates(Fact/Quality/Safety) → Governance Reviewer → Auto Publisher → Verifier`（每日成功发布上限 10、Gate 优先于数量、Verify 失败不计成功；`site_settings.content_auto_publish` 可关回人工）。见 `docs/AI_DEVELOPMENT_HANDOFF.md §4.5`。本节保留作历史记录。
> 结论：Content Factory 首版**只碰 Blog（可选 Guide）**，写 `src/content/blog/<key>.<locale>.md` 的既有 frontmatter 字段 + 正文，走 **KV 草稿 → L2 REVIEW 任务 → 人工审批 → ghPut** 链路。PDP 由 A1 清洗 + 现有 D1 通道覆盖，不进本轮生成器。Solutions/Export 待写入通道打通再纳入。
