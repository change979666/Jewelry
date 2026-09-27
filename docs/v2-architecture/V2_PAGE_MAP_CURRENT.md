# Aromiso CMS 管理后台 — 完整页面地图 V2

> **生成日期**：2026-08-20 | **来源**：源码扫描 `src/pages/admin/` 全部 5 个 Astro 文件  
> **总代码量**：约 19,017 行（5 文件合计）

---

## 一、总览表（Overview Table）

| # | 页面/视图 | 中文名 | 英文名 | URL 路由 | Astro 文件 | 行数（约） | 页面类型 | 核心 JS 函数数 | API 端点 |
|---|----------|--------|--------|----------|-----------|----------|---------|-------------|----------|
| 1 | Dashboard | 仪表盘 | Dashboard | `/admin` (default view) | `index.astro` | ~10,381 (shared) | 内嵌视图 | 5 | `/api/admin/stats?type=dashboard` |
| 2 | SEO | SEO | SEO Analytics | `/admin` (#view-seo) | `index.astro` | — | 内嵌视图 | 1 | `/api/admin/stats?type=seo` |
| 3 | Analytics | Analytics | Analytics (GA4) | `/admin` (#view-analytics) | `index.astro` | — | 内嵌视图 | 1 | `/api/admin/stats?type=ga` |
| 4 | Behavior | Behavior | User Behavior | `/admin` (#view-behavior) | `index.astro` | — | 内嵌视图 | 1 | `/api/admin/stats?type=behavior` |
| 5 | Shop Analytics | 商城分析 | Shop Analytics | `/admin` (#view-shop-analytics) | `index.astro` | — | 内嵌视图 | 1 | `/api/admin/stats?type=shop` |
| 6 | Blog | 博客文章 | Blog Posts | `/admin` (#view-blog) | `index.astro` | — | 内嵌视图 | 10+ | `/api/admin/load?collection=blog`, `/api/admin/save`, `/api/admin/delete`, `/api/admin/ai-assist` |
| 7 | Products | 产品 | Products (CMS) | `/admin` (#view-products) | `index.astro` | — | 内嵌视图 | 10+ | `/api/admin/load?collection=products`, `/api/admin/save`, `/api/admin/delete` |
| 8 | Guides | 指南 | Guides | `/admin` (#view-guides) | `index.astro` | — | 内嵌视图 | 5 | `/api/admin/load?collection=guides` |
| 9 | Case Studies | 案例 | Case Studies | `/admin` (#view-caseStudies) | `index.astro` | — | 内嵌视图 | 5 | `/api/admin/load?collection=caseStudies` |
| 10 | Inquiries | 询盘管理 | Inquiries | `/admin` (#view-inquiries) | `index.astro` | — | 内嵌视图 | 8 | `/api/admin/inquiries`, `/api/admin/email-thread`, `/api/admin/email-send` |
| 11 | Commerce Products | 现货商品 | Commerce Products | `/admin` (#view-commerce-products) | `index.astro` | — | 内嵌视图 | 15+ | `/api/admin/commerce-products`, `/api/admin/ai-product`, `/api/admin/upload-video` |
| 12 | Product Edit | 商品编辑 | Product Edit | `/admin` (#view-product-edit) | `index.astro` | — | 内嵌子视图 | 20+ | `/api/admin/commerce-products`, `/api/admin/ai-product`, `/api/admin/upload-video` |
| 13 | Commerce Orders | 现货订单 | Commerce Orders | `/admin` (#view-commerce) | `index.astro` | — | 内嵌视图 | 5 | `/api/admin/commerce-orders` |
| 14 | Shop Merchandising | 商城运营位 | Shop Merchandising | `/admin` (#view-shop-merchandising) | `index.astro` | — | 内嵌视图 | 5 | `/api/admin/merchandising` |
| 15 | Reviews | 评价管理 | Reviews & Q&A | `/admin` (#view-reviews) | `index.astro` | — | 内嵌视图 | 5 | `/api/admin/commerce-reviews` |
| 16 | 1688 Import | 1688 导入 | 1688 Import | `/admin` (#view-import1688) | `index.astro` | — | 内嵌视图 | 8 | `/api/admin/import-1688` |
| 17 | Subscribers | 订阅者 | Subscribers | `/admin` (#view-subscribers) | `index.astro` | — | 内嵌视图 | 5 | `/api/admin/subscribers` |
| 18 | Knowledge | 知识库 | Knowledge Base | `/admin` (#view-knowledge) | `index.astro` | — | 内嵌视图 | 12 | `/api/admin/knowledge` |
| 19 | Settings | 站点设置 | Site Settings | `/admin` (#view-settings) | `index.astro` | — | 内嵌视图 | 4 | `/api/admin/settings` |
| 20 | AI Command Center | AI 控制塔 | AI Control Tower | `/admin/command-center` | `command-center.astro` | 1,192 | **独立页面** | 18 | `/api/admin/ai-command-center`, `/api/admin/autonomy` |
| 21 | AI Growth Center | AI 增长中心 | AI Growth / OS | `/admin/os` | `os.astro` | 1,572 | **独立页面** | 30+ | 13 个端点（见详细） |
| 22 | Video Center | 视频内容 | Video Center | `/admin/video-center` | `video-center.astro` | 1,976 | **独立页面** | 40+ | `/api/admin/video-center`, `/api/admin/video-content-package/` |
| 23 | FAQ Manager | FAQ 管理 | FAQ Manager | `/admin/faqs` | `faqs.astro` | 466 | **独立页面** | 10 | `/api/admin/faqs` |

---

## 二、导航结构图（Navigation Structure）

```
/login → 密码验证 → /admin (主页/仪表盘)
│
├─ 📊 数据中心 (Data)
│   ├─ 仪表盘 (Dashboard)        [view=dashboard]        ← 默认首页
│   ├─ SEO                        [view=seo]
│   ├─ Analytics                  [view=analytics]
│   ├─ Behavior                   [view=behavior]
│   └─ 商城分析 (Shop Analytics)  [view=shop-analytics]
│
├─ 📝 内容管理 (Content)
│   ├─ 博客文章 (Blog)           [view=blog]
│   ├─ 产品 (Products)           [view=products]
│   ├─ 指南 (Guides)             [view=guides]
│   └─ 案例 (Case Studies)       [view=caseStudies]
│
├─ 💬 询盘与客户 (Customers)
│   ├─ 询盘管理 (Inquiries)      [view=inquiries]
│   ├─ 评价管理 (Reviews)        [view=reviews]
│   └─ 订阅者 (Subscribers)      [view=subscribers]
│
├─ 🛒 商城运营 (Shop)
│   ├─ 现货商品 (Commerce Products) [view=commerce-products]
│   ├─ 现货订单 (Commerce Orders)   [view=commerce]
│   ├─ 商城运营位 (Merchandising)   [view=shop-merchandising]
│   ├─ 🎬 视频内容 (Video Content)   → /admin/video-center (独立页)
│   └─ 1688 导入                    [view=import1688]
│
├─ ⚙️ 系统 (System)
│   ├─ 知识库 (Knowledge)          [view=knowledge]
│   └─ 站点设置 (Settings)         [view=settings]
│
└─ 🤖 AI 运营中心 (AI Ops)
    ├─ AI 控制塔 (Control Tower)   → /admin/command-center (独立页)
    ├─ AI 增长中心 (Growth OS)     → /admin/os (独立页)
    └─ FAQ 管理 (FAQ Manager)      → /admin/faqs (独立页)
```

### Quick Access 快捷栏（侧边栏顶部 grid）
- 📥 询盘管理 → `[view=inquiries]`
- 📦 现货商品 → `[view=commerce-products]`
- 🤖 AI 控制塔 → `/admin/command-center`
- 📊 AI 增长中心 → `/admin/os`

---

## 三、逐页详细说明

---

### 1. Dashboard（仪表盘·内嵌视图）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin`（默认 view，`#view-dashboard` 可见） |
| **文件** | `index.astro` line 631–1035 (section) + line 4182–4986 (JS) |
| **中文名** | 仪表盘 |
| **英文名** | Dashboard |
| **类型** | 内嵌视图 |

**JS 函数**：`updateDashboard()`, `loadAiStatus()`, `startAiStatusRefresh()`, `updateBadges()`, `renderRecent()`, `loadDashboardInquiries()`, `updateInquiryStats()`, `renderRecentInquiries()`, `loadDashboardData()`

**API 调用**：
- `GET /api/admin/load?collection=blog|products|guides|caseStudies`（启动时）
- `GET /api/admin/stats?type=dashboard&range=28d`
- `GET /api/admin/ai-command-center`（AI 状态微型卡）
- `GET /api/admin/inquiries`（最近询盘）

**用户操作**：查看网站内容全貌（博客/产品/指南/案例数量）、已发布/草稿统计、最近内容、最近询盘、AI 运营建议、SEO 机会、异常告警、Hot Score 产品、AI 微型状态卡（健康分/日报/任务/需确认）

**AI 角色**：无直接调用；消费 AI 日报 & 运营建议数据

---

### 2. SEO（SEO·内嵌视图）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin`（`#view-seo`） |
| **文件** | `index.astro` line 1036–1092 (section) + line 4988–5081 (JS) |
| **中文名** | SEO 数据分析 |
| **英文名** | SEO Analytics |
| **类型** | 内嵌视图 |

**JS 函数**：`loadStats("seo", "seo")`, `renderSeo()`, `makeDatePicker()`, `lineChart()`, `statCard()`, `tableRow()`

**API 调用**：`GET /api/admin/stats?type=seo&from=...&to=...`（来自 GSC 数据）

**推断 DB**：`gsc_data`（Google Search Console 拉取结果存储）

**用户操作**：查看 GSC 关键词排名、点击量、展示量、CTR、位置分布；时间范围筛选；折线图；Top Queries / Top Pages 表格

---

### 3. Analytics（Analytics·内嵌视图）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin`（`#view-analytics`） |
| **文件** | `index.astro` line 1093–1154 (section) + line 5082–5164 (JS) |
| **中文名** | Analytics（GA4 数据） |
| **英文名** | Analytics |
| **类型** | 内嵌视图 |

**JS 函数**：`loadStats("analytics", "ga")`, `renderAnalytics()`

**API 调用**：`GET /api/admin/stats?type=ga&from=...&to=...`

**推断 DB**：`ga4_data`（Google Analytics 4 拉取结果）

**用户操作**：GA4 流量/会话/用户/转化数据；Top Countries / Top Devices / Top Pages 表格；时间范围筛选；折线图

---

### 4. Behavior（Behavior·内嵌视图）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin`（`#view-behavior`） |
| **文件** | `index.astro` line 1155–1211 (section) + line 5165–5309 (JS) |
| **中文名** | 用户行为分析 |
| **英文名** | User Behavior |
| **类型** | 内嵌视图 |

**JS 函数**：`loadStats("behavior", "behavior")`, `renderBehavior()`

**API 调用**：`GET /api/admin/stats?type=behavior&from=...&to=...`

**推断 DB**：`behavior_events`（埋点行为数据）

**用户操作**：查看用户行为事件（scroll/click/download）、Top Events、时间筛选

---

### 5. Shop Analytics（商城分析·内嵌视图）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin`（`#view-shop-analytics`） |
| **文件** | `index.astro` line 1212–1283 (section) + line 5310–5412 (JS) |
| **中文名** | 商城分析 |
| **英文名** | Shop Analytics |
| **类型** | 内嵌视图 |

**JS 函数**：`loadStats("shop-analytics", "shop")`, `renderShop()`

**API 调用**：`GET /api/admin/stats?type=shop`

**用户操作**：商城转化漏斗、订单概览、商品浏览排名

---

### 6–9. 内容管理四视图（Blog / Products / Guides / Case Studies）

| 字段 | Blog | Products | Guides | Case Studies |
|------|------|----------|--------|--------------|
| **URL** | `#view-blog` | `#view-products` | `#view-guides` | `#view-caseStudies` |
| **JS 函数** | `renderBlogTable()`, `getFilteredBlogGroups()`, `openEditor()`, `save()`, `delete()`, `previewDraft()`, etc. | `renderProductTable()`, `getFilteredProductGroups()`, 共享编辑器 | `renderGuidesTable()` | `renderCaseStudiesTable()` |
| **API** | `/api/admin/load?collection=blog`, `/api/admin/save`, `/api/admin/delete`, `/api/admin/ai-assist`, `/api/admin/upload` | `/api/admin/load?collection=products` | `/api/admin/load?collection=guides` | `/api/admin/load?collection=caseStudies` |
| **操作** | CRUD + AI 辅助写作 + 三语编辑 + 草稿/发布 + 图片上传 | CRUD + 三语编辑 + 草稿/发布 + 图片上传 | CRUD + 三语编辑 | CRUD + 三语编辑 |

**共享编辑器**（`openEditor()`）：支持 Markdown frontmatter 编辑、三语切换（en/es/de）、草稿/已发布状态、SEO title/description、图片上传画廊、AI 辅助写作（仅 blog）；编辑器在四个内容视图中复用。

---

### 10. Inquiries（询盘管理·内嵌视图）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin`（`#view-inquiries`） |
| **文件** | `index.astro` line 1556–1631 (section) + line 6586–7052 (JS) |
| **中文名** | 询盘管理 |
| **英文名** | Inquiries |
| **类型** | 内嵌视图 |

**JS 函数**：`loadInquiries()`, `renderInquiries()`, `openEmailThread()`, `closeEmailThread()`, `loadEmailThread()`, `sendEmailReply()`, `previewEmailReply()`, `closeEmailPreview()`, `updateInquiryBadge()`, `exportInquiriesCsv()`

**API 调用**：
- `GET /api/admin/inquiries`
- `POST /api/admin/inquiries`（状态更新/备注）
- `PUT /api/admin/inquiries?id=...`（软删除）
- `GET /api/admin/email-thread?inquiry_id=...`
- `POST /api/admin/email-send`（Resend 发邮件）

**推断 DB**：`inquiries` 表（包含 name/email/company/product/message/status）

**用户操作**：查看/搜索/筛选询盘（全部/新询盘/已联系/洽谈中/成交/流失/垃圾）、状态流转、添加备注、邮件对话（slide-over）、回复/发送邮件、预览邮件、导出 CSV

**AI 角色**：无直接调用；邮件通过 Resend 服务人工发送

---

### 11. Commerce Products（现货商品·内嵌视图）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin`（`#view-commerce-products`） |
| **文件** | `index.astro` line 1634–1874 (section) + line 7053–7984 (JS) |
| **中文名** | 现货商品管理 |
| **英文名** | Commerce Products |
| **类型** | 内嵌视图 |

**JS 函数**：`loadCommerceProducts()`, `renderCommerceProductCard()`, `updateCommerceProductTabs()`, `updateCommerceQualityChips()`, `updateCommerceProductsPagination()`

**API 调用**：`GET /api/admin/commerce-products?limit=...&offset=...`

**推断 DB**：`commerce_products` 表

**用户操作**：商品列表（卡片视图）、按状态筛选（全部/已上架/草稿箱/已下架）、数据质量快速筛选（缺描述/亮点/规格/中文标题/无封面）、搜索（ID/标题/Slug）、分页、点击进入编辑

---

### 12. Product Edit（商品编辑·内嵌子视图）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin`（`#view-product-edit`） |
| **文件** | `index.astro` line 2011–2064 (section) + 大量 JS (line 7882+) |
| **中文名** | 商品编辑页 |
| **英文名** | Product Edit |
| **类型** | 内嵌子视图（从 commerce-products 触发） |

**JS 函数（核心）**：`renderProductForm()`, `attachProductFormEvents()`, `recalcPricePreview()`, `renderDataHealth()`, `renderGalleryThumbs()`, `initGalleryDnd()`, `renderVariantRows()`, `renderPriceRows()`, `collectProductContext()`, `callAiProduct()`, `setAiButtonsDisabled()`

**API 调用**：
- `GET /api/admin/commerce-products?id=...`
- `POST /api/admin/commerce-products`（保存/状态变更）
- `POST /api/admin/ai-product`（AI 一键填充商品信息）
- `POST /api/admin/upload-video`（视频上传）

**AI 角色**：`POST /api/admin/ai-product` — **AI 商品填充**：根据已有信息（1688 标题/图片），AI 一键生成：中文标题、英文标题、SEO title/description、卖点（highlights）、规格（specs）、亮点（selling_points）

**用户操作**：编辑商品全部字段（中英文标题/描述/SKU/价格/规格/卖点/图片/视频/1688来源链接）、AI 一键填充、图片拖拽排序、数据健康检查（缺失字段提示）、变体管理、价格阶梯、保存/发布/下架

---

### 13. Commerce Orders（现货订单·内嵌视图）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin`（`#view-commerce`） |
| **文件** | `index.astro` line 2067–2129 (section) + line 7293–7823 (JS) |
| **中文名** | 现货订单管理 |
| **英文名** | Commerce Orders |
| **类型** | 内嵌视图 |

**JS 函数**：`loadCommerceOrders()`, `openCommerceDetail()`, `closeCommerceDetail()`

**API 调用**：
- `GET /api/admin/commerce-orders?limit=50`
- `GET /api/admin/commerce-orders?id=...`（订单详情 slide-over）
- `POST /api/admin/commerce-orders`（状态变更、备注）

**推断 DB**：`commerce_orders` 表

**用户操作**：订单列表、按状态筛选（新订单/审核中/已报价/已付款/处理中/已发货/已完成/已取消）、搜索、订单详情 slide-over、状态流转

---

### 14. Shop Merchandising（商城运营位·内嵌视图）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin`（`#view-shop-merchandising`） |
| **文件** | `index.astro` line 1875–2010 (section) + line 10148–10370 (JS) |
| **中文名** | 商城运营位管理 |
| **英文名** | Shop Merchandising |
| **类型** | 内嵌视图 |

**JS 函数**：`loadMerchandising()`, `renderMerchList()`, `merchHideResults()`

**API 调用**：
- `GET /api/admin/merchandising?type=...`（hero_featured / category_featured / sidebar_banner）
- `POST /api/admin/merchandising`（创建/更新运营位商品）
- `POST /api/admin/merchandising?id=...`（删除）

**推断 DB**：`merchandising_slots` 表

**用户操作**：管理首页精选区（Hero Featured）、分类页精选（Category Featured）、侧边栏 Banner；配置展示商品、排序、生效时间；搜索并关联现货商品

---

### 15. Reviews（评价管理·内嵌视图）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin`（`#view-reviews`） |
| **文件** | `index.astro` line 2280–2330 (section) + line 7371–7560 (JS) |
| **中文名** | 评价与问答管理 |
| **英文名** | Reviews & Q&A |
| **类型** | 内嵌视图 |

**JS 函数**：`loadReviews()`, `renderReviewCard()`, `renderQuestionCard()`, `rvStars()`, `rvDate()`

**API 调用**：
- `GET /api/admin/commerce-reviews?kind=reviews`
- `GET /api/admin/commerce-reviews?kind=questions`
- `POST /api/admin/commerce-reviews`（审核/拒绝/回答）

**推断 DB**：`commerce_reviews` 表（含 reviews 和 questions 两种 kind）

**用户操作**：评价审核（通过/拒绝 + 回复）、问答管理（回答客户提问 + 发布/隐藏）；Tab 切换评价/问答；按状态筛选

---

### 16. 1688 Import（1688 导入·内嵌视图）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin`（`#view-import1688`） |
| **文件** | `index.astro` line 2333–2431 (section) + line 9280–9611 (JS) |
| **中文名** | 1688 商品导入 |
| **英文名** | 1688 Product Import |
| **类型** | 内嵌视图 |

**JS 函数**：`loadImport1688()`, `loadImportHistory()`, `uploadImportZip()`, `renderImportDrafts()`

**API 调用**：全部 `GET/POST /api/admin/import-1688`（上传 ZIP、查询进度、确认创建、删除草稿、查询历史）

**用户操作**：拖拽/选择 ZIP 上传（1688 插件导出）、查看识别进度、预览识别结果、确认创建为草稿商品、导入历史查看

---

### 17. Subscribers（订阅者·内嵌视图）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin`（`#view-subscribers`） |
| **文件** | `index.astro` line 2434–2528 (section) + line 9622–9728 (JS) |
| **中文名** | 订阅者管理 |
| **英文名** | Subscribers |
| **类型** | 内嵌视图 |

**JS 函数**：`loadSubscribers()`, `renderSubscribers()`, `updateSubscriberBadge()`, `exportSubscribersCsv()`

**API 调用**：`GET /api/admin/subscribers`, `PUT /api/admin/subscribers?id=...`（软删除）

**推断 DB**：`subscribers` 表

**用户操作**：查看页脚 newsletter 订阅邮箱列表、搜索、软删除、导出 CSV

---

### 18. Knowledge（知识库·内嵌视图）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin`（`#view-knowledge`） |
| **文件** | `index.astro` line 2531–2671 (section) + line 9860–10150 (JS) |
| **中文名** | AI 知识库 |
| **英文名** | Knowledge Base |
| **类型** | 内嵌视图 |

**JS 函数**：`loadKnowledge()`, `preloadKnowledgeStats()`, `renderKbStatus()`, `renderKbStats()`, `renderKbStorePills()`, `renderKbPills()`, `renderKbEntries()`, `openKbAdd()`, `closeKbAdd()`, `submitKbAdd()`, `kbSync()`, `filterKb()`

**API 调用**：
- `GET /api/admin/knowledge`（加载条目）
- `POST /api/admin/knowledge`（手动添加/Sync 到 R2）
- `PUT /api/admin/knowledge?id=...`（更新/删除）

**推断 DB**：`knowledge_base`（R2 · aromiso-kb 统一知识库）+ D1 运行时知识（自动镜像归档）

**用户操作**：查看所有知识条目（按存储/分类/来源筛选）、手动添加知识、同步 D1→R2、查看条目详情

**AI 角色**：消费方 — AI 在运行时从知识库读取（Cron 自动提取、AI 自动沉淀）

---

### 19. Settings（站点设置·内嵌视图）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin`（`#view-settings`） |
| **文件** | `index.astro` line 2674–... (section) + line 9731–9860 (JS) |
| **中文名** | 站点设置 |
| **英文名** | Site Settings |
| **类型** | 内嵌视图 |

**JS 函数**：`loadSettings()`, `saveSettings()`, `previewSettingImg()`

**API 调用**：`GET /api/admin/settings`, `POST /api/admin/settings`

**推断 DB**：`site_settings`（KV 存储 + GitHub `_data/site.json`）

**用户操作**：编辑站点名称/标语/邮箱/WhatsApp、社交媒体链接（LinkedIn/Facebook/Instagram/YouTube/X/Pinterest）、Logo/favicon/OG 图片上传预览、Google Analytics ID、发布（触发站点重建）

---

### 20. AI Control Tower（AI 控制塔·独立页面）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin/command-center` |
| **文件** | `command-center.astro`（1,192 行） |
| **中文名** | AI 控制塔 |
| **英文名** | AI Control Tower |
| **类型** | 独立页面 |

**JS 函数（18 个）**：`loadAll()`, `renderStats()`, `renderHealth()`, `renderOutcomes()`, `renderFindings()`, `renderBudget()`, `renderMiniBudget()`, `renderNow()`, `renderActions()`, `renderWeekPlan()`, `renderPlan()`, `renderReport()`, `renderNeeds()`, `renderAutonomy()`, `renderDataHealth()`, `openReplay()`, `closeReplay()`, plus `runModule()`（V5.415 模块隔离包装器）

**API 调用**：
- `GET /api/admin/ai-command-center`（全部状态数据）
- `GET /api/admin/ai-command-center?mission_id=...`（任务回放 Replay）
- `POST /api/admin/autonomy`（安全动作自动化开关）

**推断 DB**：`ai_missions`, `ai_action_logs`, `ai_daily_report`, `ai_mission_plan`, `growth_opportunities`, `tasks`

**AI 角色（显式消费）**：不直接调用 AI；消费 AI 运行产生的全部数据库记录

**用户操作**：
1. **AI 今日状态**：执行任务数/完成/跳过/拦截/待审核/成本
2. **AI 正在做什么**：当前运行任务详情（步骤/工具/状态）
3. **当前阶段任务**：今日/明日/未来 7 天计划
4. **今日行动时间轴**：可排序表格（时间/AI 角色/任务类型/摘要/耗时/结果/模型），点击行打开 Replay Modal 查看完整步骤回放
5. **动作预算**：按任务类型预算使用量进度条 + 生产写入总量
6. **今日成果**：发现机会/创建任务/自动执行/待审核/拦截/事实违规
7. **AI 今日发现**：Top Findings（P0/P1/P2 优先）
8. **需要老板确认**：待审核增长机会 + 待批准任务（链接到 OS 增长中心）
9. **AI 日报** 与 **七日计划预览**
10. **数据健康与新鲜度**（V5.415）：四态信封（HAS_DATA/REAL_ZERO/NO_DATA/ERROR/PENDING）+ 数据集信任矩阵（来源/行数/最新日期/状态）
11. **自治边界与关口**：L0–L3 自治等级 + 事实红线 + **安全动作自动化开关**（autofix on/off → internal_link/alt_text_fill/meta_fix）
12. **Replay Modal**：按 mission_id 回放任务全部步骤（input/output/error）
13. **30 秒自动刷新**

---

### 21. AI Growth Center（AI 增长中心·独立页面）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin/os` |
| **文件** | `os.astro`（1,572 行） |
| **中文名** | AI 增长中心 / Aromiso OS |
| **英文名** | AI Growth Center |
| **类型** | 独立页面 |

**JS 函数（30+ 个）**：`loadTab()`, `loadCeo()`, `loadKnowledge()`, `loadTasks()`, `loadReports()`, `loadAudit()`, `loadRoles()`, `loadUsage()`, `loadTimeline()`, `loadGrowth()`, `renderBrief()`, `renderBoard()`, `executeTask()`, `taskAction()`, `rejectTask()`, `feedbackTask()`, `taskMemory()`, `genReport()`, `fixIssue()`, `runAudit()`, `saveRole()`, `testRole()`, `switchProvider()`, `generateBrief()`, `syncGrowth()`, `runDaily()`, `setKbLevel()`

**API 端点（13 个）**：
1. `GET /api/admin/os-data?view=ceo` — CEO 首页数据
2. `GET /api/admin/os-data?view=knowledge&level=...` — 知识库
3. `GET /api/admin/os-data?view=tasks` — 任务列表
4. `GET /api/admin/os-data?view=taskmemory&task_id=...` — 任务记忆/执行流水
5. `GET /api/admin/os-data?view=usage` — 费用记账
6. `GET /api/admin/os-data?view=timeline` — 时间线
7. `GET /api/admin/os-reports?limit=10` — 报告列表
8. `POST /api/admin/os-reports` — 生成周报/月报
9. `GET /api/admin/os-audit?status=open` — 审计问题
10. `POST /api/admin/os-audit` — 运行审计（轻量/深度 AI）
11. `PUT /api/admin/os-audit` — 标记问题已修复
12. `GET /api/admin/ai-roles` — AI 角色注册表
13. `PUT /api/admin/ai-roles` — 修改角色 Prompt/Model/Reasoning Effort
14. `POST /api/admin/ai-roles` — 测试角色
15. `GET /api/admin/ai-provider` — AI Provider 状态
16. `POST /api/admin/ai-provider` — 切换 Provider
17. `GET /api/admin/ai-brief` — AI 经营简报
18. `POST /api/admin/ai-brief` — 生成今日简报
19. `GET /api/admin/growth-board` — 增长看板数据
20. `POST /api/admin/growth-sync` — 同步增长智能
21. `POST /api/admin/os-daily` — 运行今日分析 Pipeline
22. `POST /api/admin/task-execute` — 执行任务
23. `POST /api/admin/os-tasks` — 更新任务状态（完成/拒绝）
24. `POST /api/admin/ai-feedback` — 用户反馈（👍/👎）

**推断 DB**：`ai_missions`, `ai_action_logs`, `ai_daily_report`, `ai_mission_plan`, `growth_opportunities`, `tasks`, `audit_issues`, `knowledge_base`

**AI 角色（直接调用）**：Aromiso OS 的 4+ 角色体系 — Strategist, Analyst, Writer, SEO Agent 等；可通过 Role Center 编辑 Prompt/Model/Reasoning Effort

**Tab 导航（9 个面板）**：

| Tab | 中文名 | 面板 ID | 核心内容 |
|-----|--------|---------|----------|
| CEO | CEO 首页 | `panel-ceo` | AI CEO 日报、Top 优先行动（按 ROI/Impact 排序）、知识资产统计、待处理审计概览、月度 AI 花费预算 |
| Knowledge | 知识库 | `panel-knowledge` | 统一知识条目列表，按 level 筛选（observation/finding/hypothesis/experiment/validated/deprecated/rule/principle/preference），置信度显示 |
| Tasks | 任务 | `panel-tasks` | 任务看板（按状态统计）、任务卡片（P0-P3/执行模式 L1-L4-MANUAL/前置后置指标/执行流水/记忆）、执行/完成/拒绝/反馈操作、任务记忆（为什么/幂等键/执行流水） |
| Reports | 报告 | `panel-reports` | 历史报告列表（周报/月报）、手动生成周报/月报（使用 Pro 模型） |
| Audit | 审计 | `panel-audit` | 审计问题列表（P0/P1 严重度）、轻量扫描 / 深度 AI 审计、标记问题已修复 |
| Roles | Role Center | `panel-roles` | AI Provider 切换（DeepSeek / 备用）、各 AI 角色启用/停用状态、Prompt 编辑（textarea）、Model 选择（flash/pro）、Reasoning Effort（low/medium/high）、角色测试、月度花费按角色/模型展示 |
| Usage | 记账 | `panel-usage` | 月度 AI 总花费 + 预算进度条、按角色分组（调用次数+费用）、按模型分组（tok in/out + 费用） |
| Timeline | Timeline | `panel-timeline` | 系统事件时间线（任务/知识/报告/决策），中文日期格式 |
| Growth | 增长中心 | `panel-growth` | **最复杂面板**：AI 经营简报（含 unified health score）、V5.35 增长执行层简介、转化漏斗（机会→任务→执行→结果）、KPI 阶梯（8 指标：曝光/点击/CTR/排名/非品牌/商业词/第一页/询盘 + SEO ROI）、机会表格（级别/类型/页面/关键词/原因/建议动作/执行级/状态 + Growth Score + Intent）、索引问题列表、Shopping 齐备度、**增长实验复盘表**（页面→动作→前/后指标→T+14 验证→三态结果）、生成今日简报（AI Brief）、同步增长智能（Growth Sync）、运行今日分析 Pipeline |

---

### 22. Video Center（视频内容·独立页面）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin/video-center` |
| **文件** | `video-center.astro`（1,976 行） |
| **中文名** | 视频内容管理 |
| **英文名** | Video Content Center |
| **类型** | 独立页面 |

**JS 函数（40+ 个）**：`load()`, `renderStats()`, `renderList()`, `openEditor()`, `renderLangs()`, `renderProducts()`, `renderAiDraft()`, `renderRunsAndSuggestions()`, `renderPublish()`, `doGenerate()`, `doApply()`, `startTimer()`, `api()`, `apiWithRetry()`, `switchTab()`, `defaultTab()`, `renderHeaderState()`, `renderFlowStrip()`, `gateChecks()`, `gateOk()`, `gateFailedCount()`, `fileToB64()`, `currentAsset()`, 以及众多事件处理

**API 调用**：
- `GET/POST /api/admin/video-center` — 视频资产 CRUD、状态变更、发布、翻译请求
- `GET /api/admin/video-content-package/{id}/status` — 内容包状态
- `POST /api/admin/video-content-package/{id}/generate` — AI 生成草稿
- `POST /api/admin/video-content-package/{id}/apply` — 应用 AI 草稿到正式内容
- `POST /api/admin/commerce-products?search=...` — 搜索关联商品

**推断 DB**：`video_assets`, `video_translations`, `video_publications`, `video_content_packages`, `video_transcripts`, `video_runs`

**AI 角色**：`video_content_editor` — AI 阅读 Transcript + 公开商品标题，生成英文标题/描述/SEO/category/tags；AI 翻译 ES/DE

**用户操作**：
1. **资产列表**：视频卡片列表（封面/VID/标题/分类/关联商品/语言状态/审核状态/发布状态），6 个统计筛（总数/草稿/已审核/已发布/归档/需补翻译）
2. **编辑器（6 个 Tab）**：
   - **媒体（Media）**：原始/成品 URL、封面上传、分辨率、宽高比自动推导
   - **内容（Content）**：内部标题/分类/描述/标签（≤12个）/精选/排序/来源/备注
   - **语言（Languages）**：三语独立编辑（EN/ES/DE），每语标题+SEO标题+描述+SEO描述，AI 翻译按钮（ES/DE 从 EN 翻译），人工审核勾选
   - **AI 草稿（AI Draft）**：内容包状态、Transcript 预览/来源、AI 生成草稿/重新生成、按字段勾选 Apply、证据引用、AI 推荐关联商品
   - **关联商品（Products）**：搜索并关联现货商品（0..N，可选）
   - **发布与预览（Publish）**：审核通过/退回草稿、发布闸门检查（7 项清单，✗ → 一键跳修复）、按语言发布（EN-first）、一次性发布全部三语、PDP 发布、归档/恢复/删除、预览链接
3. **V5.48 工作流进度条**：Media → Content → Languages → Review → Publish（每步 ✓/✗，点击直达修复）
4. **播放器 Modal**：点击视频卡片播放
5. **安全边界**：AI 永不发布、永不改审核状态、永不自动关联商品；人工改过的字段 Apply All 跳过

---

### 23. FAQ Manager（FAQ 管理·独立页面）

| 字段 | 内容 |
|------|------|
| **URL** | `/admin/faqs` |
| **文件** | `faqs.astro`（466 行） |
| **中文名** | FAQ 管理 |
| **英文名** | Category FAQ Manager |
| **类型** | 独立页面 |

**JS 函数（10 个）**：`load()`, `renderTabs()`, `renderList()`, `render()`, `openEditor()`, `faqCat()`, `faqEdit()`, `faqDel()`

**API 调用**：
- `GET /api/admin/faqs` — 从 GitHub 加载 `_data/faqs.json`
- `POST /api/admin/faqs` — 发布（提交到 GitHub → 触发站点重建，约 1–2 分钟上线）

**推断 DB**：无数据库；文件为 GitHub repo 中的 `_data/faqs.json`

**AI 角色**：无

**用户操作**：
- **6 个分类 Tab**：精油/香薰油/藤条/蜡烛/家居香氛/包装（每个显示 FAQ 数量）
- **FAQ 列表**：按分组排序（产品/批发/OEM/物流合规），每项显示分组 + 英文问题 + priority + 状态
- **新建/编辑 FAQ**：三语 Q&A（EN 必填，ES/DE 留空时前台回退 EN）、分组、排序、状态（显示/隐藏）
- **发布上线**：写入 GitHub `_data/faqs.json` + sha → 触发 CF Pages 重建，三语同步生效
- **有未发布修改警告**（dirtyBadge）

---

## 四、AI 角色汇总（AI Roles Used）

以下角色从源码中可识别的 AI 调用推断：

| AI 角色 | 使用位置 | 调用方式 | 用途 |
|---------|---------|---------|------|
| `video_content_editor` | Video Center | `POST /api/admin/video-content-package/{id}/generate` | 读取 Transcript → 生成英文标题/描述/SEO/Category/Tags |
| AI Translate | Video Center | 语言 Tab 中 `🤖 AI 翻译` 按钮 | EN → ES/DE 翻译 |
| `ai-product` (商品填充) | Commerce Product Edit | `POST /api/admin/ai-product` | 根据 1688 信息填充中英文标题/SEO/卖点/规格 |
| `ai-assist` (写作辅助) | Blog Editor | `POST /api/admin/ai-assist` | AI 辅助写作 |
| Strategist / Analyst / Writer / SEO 等 | OS 增长中心 | Role Center → `POST /api/admin/ai-roles` (test) | 多角色体系，Prompt 可编辑 |
| AI Brief | OS 增长中心 | `POST /api/admin/ai-brief` | AI 分析近 7 天数据生成经营简报 |
| AI Audit | OS 增长中心 | `POST /api/admin/os-audit` (deep=true) | AI 深度站点审计 |
| AI Daily Pipeline | OS 增长中心 | `POST /api/admin/os-daily` | 运行每日分析流水线 |
| Growth Sync | OS 增长中心 | `POST /api/admin/growth-sync` | 增长机会扫描+技术审计+实验捕获 |

---

## 五、汇总统计（Summary Statistics）

| 维度 | 数量 |
|------|------|
| **独立页面** | 4 个（command-center, os, video-center, faqs） |
| **SPA 内嵌视图** | 19 个（dashboard + seo + analytics + behavior + shop-analytics + blog + products + guides + caseStudies + inquiries + commerce-products + commerce + shop-merchandising + reviews + import1688 + subscribers + knowledge + settings + product-edit） |
| **Slide-over 面板** | 2 个（订单详情、邮件对话）+ 1 个 Replay Modal |
| **总视图/面板** | **25 个** |
| **总代码行数** | **约 19,017 行**（5 文件） |
| **唯一 API 端点** | **约 31 个**（`/api/admin/*`） |
| **AI 角色** | 至少 7 个（Video Editor, AI Translate, Product Fill, AI Assist, Strategist, Analyst, Writer/SEO 等） |
| **推断 DB 表** | 约 15–18 个（见各视图） |

---

## 六、视图切换逻辑（Main SPA）

`index.astro` 的 `switchView(name)` 函数（line 4114）是 SPA 核心导航：

```js
function switchView(name) {
  state.currentView = name;
  $$('[id^="view-"]').forEach(el => el.classList.add("hidden"));
  $(`#view-${name}`).classList.remove("hidden");
  // 更新 sidebar nav-item active 状态
  // 触发对应 load/render 函数
}
```

- 所有 `<section id="view-*">` 首次加载均为 `class="hidden"`（除 dashboard）
- 侧边栏 `<button data-view="...">` 绑定 click → `switchView(dataset.view)`
- 4 个独立页面通过 `<a href="/admin/...">` 完全导航跳出 SPA
- `view-product-edit` 不是侧边栏项，由 `switchView("product-edit")` 代码触发（line 7882）

---

*文档生成方法：源码 grep + 全文分段阅读，不依赖猜测。`[NOT FOUND IN SOURCE]` 标记未使用。*