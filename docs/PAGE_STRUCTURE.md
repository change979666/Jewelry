# Aromiso 全站页面结构盘点

> ⚠️ **历史快照 — 非当前文档。** 本文描述的是前身项目 **Aromiso（香薰 B2B）** 时期的实现，
> 其中的 `functions/` 目录、`commerce_*` 表、en/es/de 三语、`/admin`（V1）等均**已不存在**。
> 保留此文仅作迁移对照与决策留痕。**当前架构与约定以 [`README.md`](../README.md) 与
> [`docs/01-项目说明.md`](./01-项目说明.md) 为准。**

> 盘点时间：2026-08-10 · 用途：重大改版前的全量结构参考
> 范围：前台公开页面（三语去重）、后台 admin 页面、全部 API 端点、公共函数库
> 技术栈：Astro 5.18 + Tailwind v4 + TypeScript · Cloudflare Pages（静态 + Functions + D1 + KV + R2）

---

## 一、总览

### 1.1 源文件规模

| 类别 | 数量 | 说明 |
|---|---|---|
| 前台页面（src/pages/[lang]/） | 34 个 .astro | en/es/de 三语同构，每页只描述一次 |
| 根级页面 | 2 个 | index（语言重定向）、404 |
| 构建期 TS 端点 | 7 个 | search-index + sitemap ×5 + admin-manifest |
| 后台页面 | 2 个 | admin/index.astro（8940 行）、admin/os.astro（1179 行） |
| functions 端点文件 | 47 个 | 公开 API + 后台 API + 定时/AI 端点 |
| 公共函数库 | 15 个 | lib/*.ts + shared/guard/google/deepseek/types |

### 1.2 三语同构机制（全站统一）

- 所有 `[lang]/` 页面以 `getStaticPaths = localeStaticPaths`（或内容笛卡尔积扩展）为 en/es/de 各生成一份静态 HTML，**结构完全同构**，仅文案来源不同。
- 文案三层体系：
  1. `t()` / `ta()`（src/i18n）— 界面型文案（导航、按钮、表单标签）；
  2. `c()`（src/i18n-content）— 内容型文案（FAQ、solutions、oemServices、countryPages、factoryPages、comparePages、categories 等）；
  3. 内容集合 `getCollection("products" | "blog" | "guides" | "caseStudies")`（locale + key 字段，es/de 缺失时回退 en，页面可显示回退提示）。
- `src/lib/content.ts` 封装 `getProducts/getBlogPosts/getGuides/getCaseStudies/*EntryResolved`；`src/lib/topic-cluster.ts` 提供博客↔产品↔指南↔解决方案交叉链接。

### 1.3 BaseLayout（src/layouts/BaseLayout.astro）— 全站 SEO 底座

- `<html lang={locale}>`；title = `{title} · {SITE.name}`；canonical = `SITE.url + pathname`。
- hreflang：自动对 stripLocale(pathname) 生成 en/es/de alternate + x-default（指向 en）。
- OG/Twitter：og:type=website、summary_large_image，默认 `/og.svg`。
- Organization JSON-LD 全站固定注入（name/url/logo/email/义乌地址/三语 contactPoint/sameAs）。
- GA4（G-0WP0DJJGGE）head 内联。
- body 尾部三段全站内联脚本：
  - `.reveal` 滚动显现（IntersectionObserver，暴露 `window.__initReveal`）；
  - `[data-count]` 数字滚动计数器；
  - **自建埋点**（无 PII）：localStorage `_aro_sid` 会话 → sendBeacon `/api/track`；自动 page_view、`/products/*` view_product、blog/guides/case-studies 30s 后 blog_read、滚动深度 25/50/75/100、copy_email、`[data-track]` 委托点击；暴露 `window.__aroTrack`。

### 1.4 数据层双轨

- **营销/内容页**：Astro 内容集合 + src/i18n-content（构建期静态）。
- **Shop/Cart/Workspace**：运行时 API — `/api/commerce/products`、`/api/commerce/orders`、`/api/inquiry`（honeypot + Turnstile + session_id 归因）、`/api/buyer/workspace`。
- **本地购物车**：localStorage key `"aromiso_cart"`，跨 shop/PDP/compare/cart 共享，条目带快照（名称/价格/图/变体）。
- **CMS 内容**：markdown 存于 `src/content/{collection}/{key}.{locale}.md`，后台经 GitHub API 写回，发布触发 CF Pages 重新部署；KV 存草稿。

### 1.5 Shop PDP 路由机制（重要）

`public/_redirects`：`/{lang}/shop/* → /{lang}/shop/product/ 200`（重写而非跳转，compare/listing 路径豁免）。任何 `/en/shop/<slug 或 short_id>` 都由 `shop/product.astro` 这个 **shell** 承接，JS `getSlug()` 从 URL 末段读取标识，再 fetch API 渲染。

---

## 二、前台公开页面（三语共用，各述一次）

### 2.1 根级页面

| 路由 | 文件 | 说明 |
|---|---|---|
| `/` | index.astro（21 行） | 语言落地重定向：meta refresh + JS 双保险 → `/en`；canonical 指向 /en |
| `/404` | 404.astro | Hero + 三按钮 → Popular Products（前 3）→ Latest Insights（前 3）→ Helpful Guides（前 3） |

构建期 TS 端点：

| 端点 | 说明 |
|---|---|
| `/search-index.json` | 三语全站搜索索引（产品/博客/指南/案例 + FAQ 条目带 `#faq-N` 深链），供 SearchModal 消费 |
| `/sitemap-index.xml` | 索引，引用 4 个子 sitemap |
| `/sitemap-products.xml` `/sitemap-blog.xml` `/sitemap-guides.xml` | 各自 getCollection 按 key 去重 × locale（es/de 仅当译文存在） |
| `/sitemap-pages.xml` | 静态页 + 8 solutions + 20 国家页 + caseStudies。⚠️ 遗留 bug：国家页仍输出旧路径 `/countries/`，实际已迁 `/export/` |
| `/admin-manifest.json` | 四集合 frontmatter 摘要清单，供后台一次拉取（规避 CF 50 子请求上限），构建期生成 |

### 2.2 首页 `/[lang]/`（index.astro，669 行）

用途：品牌门户 + 首屏询盘转化。区块从上到下：

1. Hero：eyebrow / h1 / subtitle / `.lanes` 三卡片 / cta_note；右侧 hero 图 + card_points 浮层
2. Stats strip（data-count 计数器）
3. Trust bar
4. Why Aromiso（FeatureCard）
5. Customer feedback（ReviewCard）
6. Featured Products：getProducts() 前 8，Request Quote → `contact?product=<key>`
7. OEM 区块
8. How we work（6 步流程）
9. Factory preview
10. China Sourcing
11. Export markets（WorldMap 组件）
12. Blog（getBlogPosts() 前 3）
13. CtaBand
14. **Inquiry 表单**：POST /api/inquiry，hidden `source=homepage`，honeypot `website`，Turnstile，WhatsApp 备选入口

脚本：fetch POST JSON；成功/失败状态切换；字段级 `data-invalid` 错误高亮。SEO：BaseLayout 默认，无页面级 JSON-LD。

### 2.3 产品体系（内容型）

**`/[lang]/products`（目录页）**：Hero → `#product-search` + `.category-btn`（7 类）→ `#product-count` → `#product-grid`（article 卡片 data-category/data-search）→ 空态 → Catalog 下载卡 → CtaBand。脚本：`apply()` 类目+文本组合过滤。

**`/[lang]/products/[slug]`（双形态路由，575 行）**：
- getStaticPaths 两种 kind 混合：`kind:"product"`（全部 products key × locale，es/de 回退 en 带 isFallback 标记）与 `kind:"category"`（7 个类目 slug）。
- 类目页形态：Breadcrumbs → Hero（catHero 图）→ Applications → Gallery（3 图）→ FAQ → CTA。
- 商品页形态：Breadcrumbs → Header（cert 徽章 + scentNotes）→ 回退提示条（es/de）→ ProductGallery → Key Features → Specs（6 项 + packaging + customization + samplePolicy）→ Markdown 正文 → DocsList（sds/coa/ifra/reach/clp）→ 类目 FAQ → Related products → Related guides（topic-cluster）→ CTA。
- SEO：**JSON-LD Product + AggregateOffer**，批发价区间按类目查表（规避 GSC missing price）。

### 2.4 博客体系

**`/[lang]/blog`**：Hero → 最新一篇大卡 → `#blog-search` + `.blog-cat-btn` → `#blog-count` → `#blog-grid` → 空态。过滤逻辑与 products 页同构。

**`/[lang]/blog/[slug]`**：header（分类/日期/作者/阅读时长 200wpm）→ 回退提示 → 封面 → 正文 + sticky 侧栏（TableOfContents 扫 h2 + ShareBar）→ tags → AuthorCard → 移动端 ShareBar → BlogInternalLinks（内链产品+指南）→ Prev/Next → RelatedPosts → CtaBand。SEO：**JSON-LD BlogPosting**。

### 2.5 Shop 与购物车（运行时 API 驱动）

**`/[lang]/shop`（列表，1436 行）**：
- 区块：Hero → `#shop-search` + `.shop-cat-btn`（13 类）→ 属性筛选（MOQ/价格/库存 `#shop-filter-*`）→ Shop by Application（7 pill）→ `#shop-category-filter`（JS 生成）→ By Business Need（6 pill）→ `#shop-count` → `#shop-product-grid`（5 列 JS 渲染）→ `#shop-pagination`（30/页）→ 骨架/空态（含 OEM + guides 卡）→ OEM Banner → CtaBand → `#shop-modal`（快速查看）→ `#shop-compare-bar`（≤4 件）→ `#shop-inquiry-modal`（Turnstile）→ `#shop-toast` → `#shop-cart-fab`。
- 数据：fetch `/api/commerce/products`。
- 脚本（约 40 函数）：购物车（getCart/saveCart/updateCartFab/addToCart）、过滤（matchesMoq/Price/Availability/Application/BusinessNeed/ProductCategory + applyFilters + buildCategoryFilter）、渲染（renderGrid/loadProducts/updateShopPagination/shopGoPage）、对比（toggleCompare/updateCompareBar/goCompare）、询盘弹窗（openInquiry/submitInquiry）、快速查看（openModal/renderModal）、showToast。GA4：shop_view、add_to_cart、generate_lead。

**`/[lang]/shop/product`（PDP shell，3085 行，全站最长）**：
- 状态容器：`#pdp-loading` / `#pdp-not-found` / `#pdp-content`。
- 区块：① `#pdp-breadcrumb` ② 左栏画廊（`#pdp-main-image` / `#pdp-main-video` 视频优先 / `#pdp-thumbnails` / `#pdp-hero-packaging` / `#pdp-hero-features` / 快速联系卡）③ 右栏购买面板（标题/短描述/徽章/`#pdp-price-display`/MOQ·库存·样品·OEM 四信息卡/`#pdp-axis-selector` 变体轴选择/数量±/阶梯价表/批量量提示/三层 CTA（加购琥珀主按钮 + 社媒联系 + Bulk Quote + Sample + OEM）/`#pdp-order-summary` 实时报价（明示非支付）/信任条）④ Key Specifications（折叠全规格）⑤ Product Highlights ⑥ Product Details ⑦ Packaging & Shipping（4 物流卡 + Shipping Estimator + Packaging Options）⑧ Supply Information（仅露客户可见编码，供应链字段不外泄）⑨ Why Choose Aromiso（4 卡）⑩ FAQ ⑪ Reviews & Questions（评论/问答表单）⑫ Why Source Through Aromiso（深色 8 项）⑬ Recommendations（similar/crosssell/oem-cta 三组）⑭ Learn More（指南）⑮ Social CTA → 移动端吸底 bar → toast → `#pdp-jsonld`（客户端填充）。
- SEO：JSON-LD Product+Offer 由 `renderJsonLd()` 客户端注入（数据来自运行时 API）。
- 内嵌脚本 44 个函数（含行号）：

| 函数 | 作用 | 函数 | 作用 |
|---|---|---|---|
| getSlug(969) | URL 末段解析 slug/short_id | renderHeroFeatures(1825) | 左栏特性卡 |
| esc(981) | HTML 转义 | renderSocialButtons(1886) | 社交联系按钮 |
| formatPrice(987) | 价格格式化 | renderHighlights(1951) | 亮点 |
| trackEvent(993) | GA4 封装 | renderDescription(1987) | 详情正文 |
| getCart/saveCart(998/1005) | 购物车读写 | renderPackaging(2007) | 包装选项 |
| addToCart(1008) | 加购（带快照） | populateShippingPackaging(2033) | 物流估算填充 |
| showToast(1029) | 轻提示 | renderFaq(2140) | FAQ |
| dedupeTiers(1042) | 阶梯价去重 | renderRelated(2239) | 推荐组 |
| lowestTierPrice(1053) | 最低阶梯价 | renderGuides(2349) | Learn More |
| tierUnitPriceForQty(1062) | 按数量取单价 | starsHtml(2414) | 星级渲染 |
| buildSnapshot(1071) | 购物车条目快照 | revealReviewsSection(2421) | 评论区展开 |
| updateOrderSummary(1088) | 实时报价汇总 | renderReviews(2426) | 评论列表 |
| showNotFound(1140) | 404 态 | renderQuestions(2533) | 问答列表 |
| isShortId(1151) | short_id 判定 | renderJsonLd(2610) | JSON-LD 注入 |
| fetchProduct(1155) | API 拉取 | renderAxisSelector(2680) | 多变体轴选择器 |
| renderPage(1185) | 总渲染入口 | onAxisSelectionChanged(2904) | 轴选择联动（价格/库存/图） |
| renderBreadcrumb(1221) | 面包屑 | populateSupplyInfo(2955) | 供货信息 |
| __pdpMainFallback(1250) | 主图失败回退 | bindEvents(2997) | qty±/加购/各 CTA 带参链接 |
| renderGallery(1262) | 画廊（addImg/showVideo/markActive） | | |
| renderHeroPackaging(1379) | 左栏包装展示 | | |
| renderPurchasePanel(1450) | 右栏购买面板 | | |
| updateVolumeHint(1653) | 批量量提示文案 | | |
| renderSpecs(1705) | 规格表 | | |

**`/[lang]/shop/compare`（465 行）**：`?products=a,b,c`（去重 ≤4）→ fetch `?compare=...` → renderTable（Category/Price(from)/MOQ/Lead Time/Unit/Stock/OEM/Sample/Materials/Certifications + 每行加购）。

**`/[lang]/cart`（643 行）**：页头 → `#cart-empty`/`#cart-items` + sticky `#cart-summary`（行数/小计/总重/去下单/清空）→ `#order-section`（客户信息 + 运输方式 radio + 备注 + Turnstile）→ `#order-success`（订单号）。脚本：localStorage 购物车；items 只传 id+qty，**服务端重算阶梯价**；POST /api/commerce/orders。

### 2.6 解决方案 / OEM / 工厂 / 出口（国家页）/ 对比页

| 页面 | 结构要点 |
|---|---|
| `/[lang]/solutions` + `[slug]` | 枢纽页 8 个 SOLUTION_SLUGS 卡片；详情页：Hero → Challenges → 推荐产品（静态配置）→ 真实产品（topic-cluster）→ Benefits → 相关指南 → FAQ → CTA。**JSON-LD Service** |
| `/[lang]/oem` + `[slug]` | 枢纽页：Hero → Capabilities → Process steps → OEM 子页卡（OEM_SLUGS）→ OEM-Capable Products（3 类目过滤前 6）→ Case Studies（前 3）→ OEM Guides（前 4）→ CTA；子页：Hero → Process（4 步）→ Specs → FAQ → CTA。**JSON-LD Service** |
| `/[lang]/factory/` + `[slug]` | 枢纽页：Hero → sections 卡 → capacityStats → 子页导航（FACTORY_SLUGS）→ Certificates → Timeline → Gallery（8 张实拍 + 三语图注）→ 视频/验厂 CTA → CtaBand；子页（quality-control/laboratory/raw-material/warehouse/production-capacity）：Hero + 图 → Stats → Highlights → FAQ → CTA。**JSON-LD WebPage** |
| `/[lang]/export/` + `[slug]`（原国家页） | 枢纽页 COUNTRY_SLUGS（20 国）卡片；详情页：Hero → Stats → Regulations → Popular Products → Shipping & Logistics → FAQ → CTA。**JSON-LD WebPage（about Place）** |
| `/[lang]/compare/` + `[slug]`（内容型） | 枢纽页 COMPARE_SLUGS 卡片；详情页：对比表（criterion/A/B）→ Verdict → FAQ → CTA。**JSON-LD Article**。⚠️ 与 /shop/compare（commerce 动态对比）是两套系统，命名易混 |

### 2.7 资源 / 案例 / Sourcing / 下载中心

| 页面 | 结构要点 |
|---|---|
| `/[lang]/resources` | Hero → Catalog 卡 → Guides 列表 → Featured products（前 4）→ Help CTA |
| `/[lang]/resources/[slug]`（指南详情） | **JSON-LD Article**；header（作者/阅读时长）→ 回退提示 → 封面 → 正文 + 侧栏（TOC/ShareBar/SocialContactButtons）→ Other guides → Related products → CtaBand |
| `/[lang]/case-studies` + `[slug]` | 列表：Hero → `.region-pill` 区域筛选 → `.case-card` 网格（国家徽章/clientType/region/MOQ/leadTime）；详情：**JSON-LD Article**，手写面包屑 → 徽章头 → 21/9 封面 → 正文 + sticky 侧栏（Key details dl + CTA + Testimonial + 相关产品/指南） |
| `/[lang]/sourcing`（337 行） | Hero → Services（4 卡）→ How it works（4 步）→ 深色 stats bar（40+/300+/12yr/98%）→ Products We Source（前 6）→ Success Stories（案例 3）→ Sourcing Guides（物流类 4）→ 底部 CTA |
| `/[lang]/downloads/index` | 4 下载卡（catalog/certificates/oem-guide/packaging-guide）→ Catalog Preview（前 6）→ Compliance & Packaging Guides → CtaBand |
| `/[lang]/downloads/catalog` | **打印即 PDF**：@media print + sticky 工具条 window.print()（download_catalog 埋点）、封面、按 CATEGORY_SLUGS 分组产品卡 |
| `/[lang]/downloads/certificates` | 打印式；认证卡（factory.certs）→ **6 份真实合规 PDF**（/documents/ 下 MSDS×2、REACH-CLP、运输安全报告、2 份 2026 运输报告，三语名称 + 大小，`<a download>`）→ 证书图廊（ISO 9001/14001/45001、FSC，防另存水印 + 禁右键/拖拽/Ctrl+S） |
| `/[lang]/downloads/oem-guide` `packaging-guide` | 打印式；分别展示 OEM_SLUGS specs 卡 / CATEGORY_SLUGS packaging + customization 卡 |

### 2.8 联系 / FAQ / 关于 / Workspace / 法务

| 页面 | 结构要点 |
|---|---|
| `/[lang]/contact`（570 行） | Hero → `.inquiry-form`（name/company/country/email/whatsapp/product 下拉/quantity/message + Turnstile + honeypot）→ `.form-success` → 侧栏（Office 信息、社媒、地图 mapEmbed、证言、Quick nav）。脚本：`prefillFromQuery` 支持 `?subject=factory-tour\|factory-visit\|shipping-quote&product&qty`、`?product=`、`?from&context`；POST /api/inquiry 附 `_aro_sid`，成功后 `__aroTrack("inquiry_submit")` |
| `/[lang]/faq` | Breadcrumbs → Hero → `details#faq-N.faq-item` 列表 → CtaBand。**JSON-LD FAQPage**；自动展开 URL `#faq-N` 锚点（配合搜索深链） |
| `/[lang]/about` | Hero → Who we help → Values → Facility preview → Team（首字母头像）→ Client success stories → What we make（前 6）→ CTA。⚠️ 遗留 bug：案例卡链接 `/cases/<key>` 应为 `/case-studies/<key>`（死链） |
| `/[lang]/workspace`（206 行） | 买家自助查询（邮件免密）：`#ws-login` → fetch `/api/buyer/workspace?email=` → `#ws-results` 双 Tab（My RFQs / My Orders） |
| `/[lang]/privacy` `terms` | 结构相同：Breadcrumbs → article → h1 + Last updated → 6–7 个 {h,p} section（legal[locale] 内联三语，不走 i18n-content）。无页面级 JSON-LD |

---

## 三、后台 admin 页面

架构要点：页面为**纯静态 Astro 壳 + 单个巨型内联 `<script is:inline>` IIFE**（原生 JS，innerHTML 渲染，无框架）。**无独立登录页**，登录是 /admin 页内覆盖层。内容写回经 GitHub Contents API（发布即触发重新部署），KV 存草稿。

### 3.1 `/admin` 主后台（admin/index.astro，8940 行）

**鉴权**：密码 → POST /api/admin/login → 会话 Cookie；启动时尝试 loadAllEntries()，失败显示 `#loginOverlay`。登出 POST /api/admin/logout。

**侧边栏 16 个导航**（data-view + 计数徽章）：

dashboard / seo / analytics / behavior / blog / products / guides / caseStudies / inquiries / commerce-products / commerce（现货订单）/ reviews / import1688 / subscribers / knowledge / settings；系统组：链接 /admin/os、主题切换、登出。

**18 个视图面板要点**：

| 视图 | 内容 |
|---|---|
| dashboard | 5 统计卡（博客/产品/已发布/草稿/询盘）+ 4 个新建按钮 + recentList + recentInquiries + AI 区（dashRecs 建议 / dashOpportunities SEO 机会 / dashAnomalies 异常 / dashStatsRow / dashHotProducts / dashDownloads / dashScroll） |
| seo | 时间范围（7d/28d/90d）+ seoTotals + seoQueries 查询词表 + seoPages + seoOpportunities |
| analytics | gaRange + gaTotals + gaCountries（国家分布）+ gaDevices + gaSources + gaAnomalies |
| behavior | bhRange + bhFunnel（6 卡漏斗）+ bhEvents + bhProducts + bhDownloads + bhScroll + bhBlogReads |
| blog / products / guides / caseStudies | 搜索 + 语言/状态/类目过滤 + 表格（按 key 分组三语 chips）；列分别为：标题/分类/日期/翻译/状态、标题/分类/产地·起订量/翻译/状态、标题/分类/状态、标题/国家/品类/状态 |
| inquiries | 刷新/搜索/状态过滤（New/Contacted/Negotiating/Won/Lost/Spam）/CSV 导出；卡片可开邮件对话 overlay、改状态、删除 |
| commerce-products | 状态 Tab（全部/active/draft/archived 带计数）+ 质量 chips（no_desc/no_highlights/no_specs/cn_title/no_cover）+ ID 搜索 + 关键词搜索 + 12 类目过滤 + 表格（图/商品信息/SKU/价格/MOQ/状态/操作）+ 分页（jump/首末页） |
| product-edit | 见下方「商品编辑表单」 |
| commerce（订单） | 刷新/搜索/8 状态过滤；列表点开订单详情 overlay |
| reviews | 双 Tab（评价/问答）+ 状态过滤；审核通过/拒绝、问答回复 |
| import1688 | ZIP 上传区（≤200MB 拖拽）+ 进度 + 结果摘要 + 草稿列表 + 确认条 + 历史任务 |
| subscribers | 刷新/搜索/CSV 导出；表格：邮箱/语言/订阅时间/删除 |
| knowledge | 分类 pills + 统计（total/ai/manual/cron）+ 条目列表（来源/重要度/置信度） |
| settings | 站点字段（name/tagline/email/whatsapp/address/hours/footerNote/mapEmbed/turnstileSiteKey）+ 社交 9 项 + 页面资源（heroImage/factoryImage/oemImage 带预览上传 + stats）+ settingsSha 防冲突保存 |

**商品编辑表单 `#view-product-edit`（8 大分区）**：

1. 📷 商品图片：封面上传替换；画廊（HTML5 拖拽排序 + 上传 + URL 添加 + 计数）；**视频块**（cpVideoUrl/cpVideoUpload/cpVideoClear/cpVideoPreview，R2 直传）
2. 📋 基本信息：title（+AI）/slug/category/status/displayProductCode/shortDesc/desc/moq/stock/unit + oem/sample/privateLabel 复选框
3. 📦 变体规格：variantRows（图/SKU/名称/货号/供应商SKU/库存/重量kg/删除）
4. 💰 定价引擎：成本 CNY + 汇率 + 加价率 + 手动覆盖 + 计算按钮 + 阶梯价行（min/max/price）
5. 🏷️ 属性规格：keyFeatures（+AI）/materials/highlights（+AI）/faq
6. 🚚 物流包装：6 个 logiField（各带来源选择）+ packagingType
7. 🔗 供应链溯源：sourceProductKey/sourceSkuId/supplierName/supplierProductCode/supplierSkuCode/sourcePlatform/sourceUrl/sourceLastVerified/healthStatus
8. 🔍 SEO & AI：seoTitle（+AI）/seoDesc + 8 维数据健康 + 5 个 AI 按钮（analyze/copy/pricing/missing/quality）+ Danger zone 删除

**6 个 Overlay/Modal**：commerceDetailOverlay（订单详情：状态流转、复制 Offer ID/打开 1688/复制供应商 SKU、运费/备注、时间线）、emailThreadOverlay（邮件会话 + 撰写回复）、emailPreviewModal（srcdoc 预览）、editorModal（内容编辑器：动态字段 + Markdown 正文 + AI 优化助手 5 动作 + 预览/存草稿/发布）、newEntryModal（新建条目）、kbAddModal（新增知识）。

**编辑器字段 Schema**：BLOG_FIELDS（14 项）、PRODUCT_FIELDS（约 25 项，含合规文件 sds/coa/ifra/reach/clp type:file）、GUIDE_FIELDS（12 项）、CASE_STUDY_FIELDS（约 20 项）；FIELD_GROUPS = 内容/合规文档/项目信息/案例详情/SEO/发布。

**内嵌脚本按模块分组（M1-M21）**：M1 状态与 Schema · M2 基础设施（api/bufToB64/uploadFile）· M3 鉴权启动（boot/showApp/showLogin/loadAllEntries）· M4 导航（switchView/closeSidebar/主题）· M5 仪表盘 · M6 数据统计（renderSeo/renderAnalytics/renderBehavior + statCard/tableRow）· M7 询盘与邮件（loadInquiries/renderInquiries/exportInquiriesCsv/openEmailThread/sendEmailReply/previewEmailReply）· M8 内容表格（4 个 render*Table + getFiltered*Groups）· M9 内容编辑器（openEditor/buildFields/pickFile/galleryRead/galleryWrite/renderGalleryStrip/bindGallery/collectFrontmatter/parseFrontmatter/previewDraft）· M10 AI 助手（aiAssist 5 动作）· M11 新建条目 · M12 通用渲染辅助（escHtml/escJs/localeLabel/groupByKey/localeChips/statusBadges 等）· M13 现货商品列表（renderCommerceProductCard/loadCommerceProducts/分页系列）· M14 现货订单 · M15 评价管理 · M16 商品编辑表单（renderProductForm/attachProductFormEvents/recalcPricePreview/renderDataHealth/initGalleryDnd/renderVariantRows/renderPriceRows/saveCommerceProduct）· M17 AI 商品能力（collectProductContext/callAiProduct/aiFillProduct 等）· M18 1688 导入（uploadImportZip/renderImportDrafts/confirm/cancel/reviewImportJob）· M19 订阅者 · M20 站点设置 · M21 知识库。

**调用的全部 API**：/api/admin/login、logout、load、get、save、delete、upload、upload-video、stats（type=seo|ga|behavior|dashboard）、inquiries、email-thread、email-send、commerce-products、commerce-orders、commerce-reviews、import-1688、subscribers、settings、knowledge、ai-assist、ai-product。

### 3.2 `/admin/os` — AI 增长中心（admin/os.astro，1179 行）

**鉴权**：无登录 UI，依赖同一会话 Cookie，失败提示回 /admin 登录。Header：`#budgetBadge`（预算/花费）+ `#runDailyBtn`（一键跑每日流水线）。

**9 个 Tab**：

| Tab | 内容 |
|---|---|
| ceo CEO 首页 | 预算徽章 + AI CEO 日报 + 今日 Top 优先行动 + 知识资产 + 待处理审计 |
| knowledge 知识库 | level 筛选 pills + 条目卡（level/category/importance/confidence） |
| tasks 任务 | 4 状态计数卡 + 任务卡（完成/拒绝/👍/👎） |
| reports 报告 | 生成周报/月报 |
| audit 审计 | 轻量扫描/深度审计（AI）；已修复项标记 |
| roles Role Center | AI 供应商切换 + 本月花费 + 角色卡（测试 + Prompt textarea + model 下拉 + reasoning_effort + 保存） |
| usage 记账 | 本月花费进度条 + 按角色 + 按模型 |
| timeline 时间线 | 事件流（带图标） |
| growth 增长中心 | 生成今日简报（健康分/top 行动/问题/信号）+ 扫描增长机会（确认/忽略） |

函数：loadCeo/loadKnowledge/setKbLevel/loadTasks/taskAction/rejectTask/feedbackTask/loadReports/genReport/loadAudit/fixIssue/runAudit/loadRoles/saveRole/testRole/switchProvider/loadUsage/loadTimeline/loadGrowth/renderBrief/renderOpps/generateBrief/scanOpportunities/setOppStatus/runDaily。

调用的 API：/api/admin/os-data（view=ceo|knowledge|tasks|usage|timeline）、os-tasks、ai-feedback、os-reports、os-audit、ai-provider、ai-roles、os-daily、ai-brief、ai-opportunities。

### 3.3 admin 样式层

`src/styles/admin-styles.css`（249 行）：@layer components 定义卡片表面、9 类状态徽章、骨架屏、表格、按钮、栅格、分页、搜索框、徽章、暗色变体、移动端适配、滚动条、fadeIn 动画。⚠️ 目前两个 admin 页面只 import global.css，**未显式 import 此文件**——改版时需确认注入路径或是否闲置。

---

## 四、API 端点清单（functions/）

绑定总览：env.DB（D1）、env.DRAFTS（KV：草稿/限流/配置/token 缓存）、env.IMAGES（R2）。全部端点**无动态路由段**，按 ID 查询均走 query 参数。

### 4.1 根路由与公开 API（买家侧）

| 路由 | 方法 | 鉴权/防护 | 功能 |
|---|---|---|---|
| `/` | onRequest | 无 | 精确根路径按 Accept-Language 302 到 /en /es /de |
| `/api/subscribe` | POST | honeypot + IP 5 次/时 | 页脚订阅 → subscribers 表 |
| `/api/track` | POST | IP 100 事件/时 | 自建埋点（17 种白名单事件）→ behavior_events，恒 204 |
| `/api/search` | GET | 无 | 运行时商品搜索（LIKE，仅 active，60s 缓存头） |
| `/api/inquiry` | POST | Turnstile + honeypot + IP 10/时 + 邮件风控闸门 | 询盘：写 D1（KV 兜底）→ Resend 站长通知 + 客户自动回复 |
| `/api/r2-img` | GET | 无 | R2 图片代理（1 年 immutable 缓存头） |
| `/api/commerce/products` | GET | 无 | 多模式：列表（category/limit/offset + 最低价聚合）、单品（slug/id）、对比（compare≤4）、相关（related）。**服务端剔除供应链字段**（cost_price、1688 ID、供应商货号、source_url） |
| `/api/commerce/orders` | POST | Turnstile + IP 5 单/时 + 幂等键 + 每邮箱 ≤3 未结订单 | 下单：只传 items id+qty，**服务端重算阶梯价**、校验 MOQ/库存/health，写订单三表 + 双邮件 |
| `/api/commerce/reviews` | GET/POST | 无 | GET 已审核评论（≤20）+ 平均分；POST 提交待审（completed 订单标 verified_buyer） |
| `/api/commerce/questions` | GET/POST | 无 | 商品问答 |
| `/api/buyer/workspace` | GET | IP 10/时 | 买家工作台：按邮箱返回询盘 + 订单历史（各 50 条） |

### 4.2 后台管理 API（默认 admin cookie 鉴权）

**会话与 CMS**：

| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/admin/login` | POST | 密码登录（IP 5 次/15 分钟防爆破）→ Set-Cookie（HMAC-SHA256，7 天） |
| `/api/admin/logout` | POST | 清 cookie |
| `/api/admin/load` | GET | 读 admin-manifest.json + 叠加 KV 草稿（?collection=） |
| `/api/admin/get` | GET | GitHub API 读单文件（限 src/content、src/data）；?draft=1 读 KV 草稿 |
| `/api/admin/save` | POST | 服务端校验 frontmatter（镜像 content schema）；draft 存 KV，否则提交 GitHub 触发部署 |
| `/api/admin/delete` | POST | 按 key 删全部语言版本（GitHub 删文件 + 清草稿） |
| `/api/admin/settings` | GET/POST | settings.json 读取/提交 GitHub |
| `/api/admin/upload` | POST | 图片/文档 base64 直提交 GitHub public/images/ 或 public/docs/（白名单扩展名、禁目录穿越、≤100MB） |
| `/api/admin/upload-video` | POST | 视频上传 R2（mp4/webm/ogg/m4v，≤50MB，不进 git）→ images.aromiso.com |

**询盘/订阅/邮件**：

| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/admin/inquiries` | GET/POST/DELETE | 列表（status/search/export=csv）、改状态、删除；D1 优先 KV 兜底 |
| `/api/admin/subscribers` | GET/DELETE | 列表（search/export=csv）、删除 |
| `/api/admin/email-thread` | GET | 询盘完整会话线程 |
| `/api/admin/email-send` | POST | 回复邮件（Resend 品牌模板）→ 写 email_messages → New 转 Contacted |

**商城管理**：

| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/admin/commerce-products` | GET/POST/DELETE | 列表（status/category/search/pid/qf 质量快筛/分页/价格聚合）或 ?id= 详情；POST 创建/更新；DELETE |
| `/api/admin/commerce-orders` | GET/POST | 订单列表/详情；POST 状态流转（8 态）/运费/备注 + 事件 |
| `/api/admin/commerce-reviews` | GET/POST | ⚠️ **鉴权缺陷：isAuthed 未 await，Promise 恒真，鉴权实际失效**，需修复。评论/问答审核 |

**1688 供应链导入**：

| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/admin/import-1688` | GET/POST | 插件导出 ZIP（≤200MB multipart）→ 解析图片/SKU/去重 → 草稿；confirm/cancel/excel-match；图片传 R2；中文 SKU 名 AI 翻译（失败开放） |
| `/api/admin/import-excel` | GET/POST | 1688 Excel（≤50MB，4 sheet）→ 草稿；中文属性 AI 翻译；自动算售价 |
| `/api/admin/translate-products` | POST | 翻译补填残留中文（title/attributes/specifications/变体名），幂等可断点（translated 标记） |
| `/api/admin/migrate-images` | POST | alicdn 图下载（防盗链 UA/Referer + 空 body 防护）→ R2 → 更新 D1 URL |

**数据看板与知识库**：

| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/admin/stats` | GET | type=dashboard\|seo\|ga\|behavior\|products\|inquiries + range；含 SEO 机会分析（位置 5-15 高曝光词）、GA 异常检测、产品热度分、询盘 session 归因 |
| `/api/admin/knowledge` | GET/POST/DELETE | 统一知识库（V5.30）：GET 合并 R2 档案 `aromiso-kb` + D1 `knowledge` + `knowledge_base` 三仓 + stats；POST 手动添加（同写 D1+R2）或 `action=sync` 回填；DELETE 按 `store=r2\|os\|legacy` 分仓删除 |

### 4.3 定时任务 / AI 增长中心端点

| 路由 | 方法 | 鉴权 | 功能 |
|---|---|---|---|
| `/api/admin/cron-pull` | POST | **仅 Bearer CRON_SECRET** | 拉 T-2 数据：GSC（query/page/country）+ GA4（country/device/source/page）→ upsert gsc_daily/ga_daily；AI 生成每日建议写 daily_recs |
| `/api/admin/os-daily` | POST | cookie 或 Bearer | 每日 AI 流水线 Analyst→Librarian→Strategist→Executor 四角色；step=all\|单角色；prompt 取 ai_roles 表 |
| `/api/admin/os-reports` | GET/POST | cookie 或 Bearer | 报告列表；POST weekly\|monthly\|quarterly（pro + thinking，180s 超时） |
| `/api/admin/os-audit` | GET/POST/PUT | cookie 或 Bearer | 审计问题列表（P0-P3）；POST 规则审计 + deep 时 AI 分级；PUT 标已修复 |
| `/api/admin/os-data` | GET | cookie | 增长中心统一读取：view=ceo\|knowledge\|tasks\|decisions\|usage\|timeline |
| `/api/admin/os-tasks` | PUT/POST | cookie | 任务状态更新（done 记决策）；采纳/拒绝反馈 |
| `/api/admin/ai-brief` | GET/POST | cookie | 每日简报（health_score/top_3_actions/issues/opportunities/signals） |
| `/api/admin/ai-feedback` | GET/POST | cookie | AI 输出反馈闭环（up/down/edited/executed/rejected/star），Librarian 次日蒸馏 |
| `/api/admin/ai-lead-score` | GET/POST | cookie | 询盘启发式评分（高价值国家 +20、企业邮箱 +15 等） |
| `/api/admin/ai-opportunities` | GET/POST/PUT | cookie | 机会扫描（高曝光低 CTR 关键词）与状态管理 |
| `/api/admin/ai-assist` | POST | cookie | CMS 编辑器 AI 助手（optimize_title/optimize_desc/optimize_body/suggest_links/full_audit） |
| `/api/admin/ai-product` | POST | cookie | 单品文案一键生成（title/short_desc/seo/key_features/highlights） |
| `/api/admin/ai-batch-generate` | POST | cookie | 批量补全缺 desc/highlights/specs 的 active 商品（limit≤50/offset/dryRun）；V5.181 起入 ai_usage 账 |
| `/api/admin/ai-roles` | GET/PUT/POST | cookie | 角色中心：列表 + 月支出；PUT 更新 prompt/model/reasoning_effort/enabled；POST 试运行 |
| `/api/admin/ai-provider` | GET/POST | cookie | 供应商切换（siliconflow⇄deepseek，KV config:ai_provider） |

### 4.4 公共函数库（非端点）

| 文件 | 提供 |
|---|---|
| functions/types.ts | Env 接口（全部绑定/密钥单一事实来源） |
| functions/api/_lib/guard.ts | 反滥用守卫：Turnstile 校验、KV 黑名单、内容哈希去重、Resend 日预算熔断（≥80 仅发站长、≥95 全停）、evaluateMailGate |
| functions/api/admin/shared.ts | HMAC 会话 cookie、GitHub Contents API 封装（ghGet/ghPut/ghDelete）、KV 草稿 CRUD、json/b64 工具 |
| functions/api/admin/google.ts | Service Account JWT → access_token（KV 缓存 55 分钟）、fetchGsc、fetchGa4 |
| functions/api/admin/deepseek.ts | 旧 AI 路径：deepseekChat/deepseekJson（thinking/多轮/知识库注入）；V5.181 起支持 db+role opt-in 入账；loadKnowledgeContext/extractAndSaveInsights |
| functions/lib/ai.ts | 统一 AI 层：多供应商路由、PRICING 计价（flash ¥1/2、pro ¥3/6 每百万 token）、trackUsage、月预算硬顶 ¥100 四级降级、aiCall/aiJson、ai_roles 加载、saveKnowledge/recordDecision 等 |
| functions/lib/ai-provider.ts | 供应商抽象：SiliconFlow ⇄ DeepSeek 官方，KV 偏好 → 有 key 者优先 → 互为兜底 |
| functions/lib/email-template.ts | 品牌 HTML 邮件模板 wrapEmailTemplate |
| functions/lib/import-parser.ts | 1688 ZIP 解析（fflate）：图片分类、SKU 名提取、SHA-256 去重 |
| functions/lib/import-excel.ts | 1688 Excel 解析（xlsx 4 sheet） |
| functions/lib/category-map.ts | 1688 中文类目 → Aromiso 分类映射 |
| functions/lib/attribute-normalizer.ts | 属性归一化（199 键 → ~20 规范 key，双层写入） |
| functions/lib/spec-parser.ts | SKU 规格轴解析（中文规格 → 结构化 options_json） |
| functions/lib/price-parser.ts | 1688 阶梯价解析 + calcSellingPriceUsd + generateDisplayTiers |

另有独立项目 `email-worker/`（不在 functions/ 内），处理收件路由。

---

## 五、改版前必须注意的问题清单

1. **sitemap-pages.xml.ts 仍输出旧路径 `/countries/`**——页面已迁 `/export/`，sitemap 与路由不一致。
2. **about.astro 案例卡链接 `/cases/<key>` 是死链**——真实路由 `/case-studies/<key>`。
3. **commerce-reviews 端点鉴权失效**——`isAuthed` 返回 Promise 未 await，恒真通过，任何人可访问评论审核数据。建议改版时顺手修复。
4. **downloads 打印页与法务页用 `hello@aromiso.com`**——与对外统一 `sales@aromiso.com` 约定不一致。
5. **两套 compare 系统**：/shop/compare（commerce 动态）与 /compare/[slug]（内容型静态），命名易混。
6. **PDP JSON-LD 为客户端注入**（数据来自运行时 API），爬虫依赖 JS 渲染；内容页 JSON-LD 为构建期静态。
7. **购物车价格信任链**：展示价来自 API + 本地快照，下单服务端重算——动价格展示必须保持此约束。
8. **BaseLayout 埋点约定**（`window.__aroTrack`、`__initReveal`、`data-track` 属性）是运营数据基础，重构组件时勿丢失。
9. **admin 单文件巨石**：index.astro 8940 行、一个 IIFE 承载 21 个功能模块，任何拆分/组件化都是重大收益点；admin-styles.css 未被显式引入需确认。
10. **admin-manifest.json 为构建期产物**，引入实时索引需改走 API。
11. **escHtml 属性嵌入坑**（V5.18 已根治）：凡 escHtml 结果嵌入 HTML 属性需额外 `replace(/"/g,"&quot;")`，重构时勿回退。
12. **无 RSS 端点**（部分任务书提及，实际不存在）。

---

*本文档由全站源码盘点生成（2026-08-10），覆盖 34 个前台页面 + 2 个后台页面 + 47 个 API 端点 + 15 个公共库。*
