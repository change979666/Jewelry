# V2 Phase 0.5-B — 逆向压力审查
## Contrarian Architecture / UX / Performance Stress Test

日期：2026-08-24
角色：假设我是接手此项目的资深架构师，对现有设计不满意
目标：尽可能证明 V2 是错的

---

# 一、总体判断

**V2 不是一份差设计。但它是一份「工程师觉得优雅、用户会觉得烦」的设计。**

核心问题不是技术正确性——技术栈选型、API 标准化、组件化、安全网保留，这些都对。

核心问题是：

> **V2 加了太多层抽象，但没有减少用户的操作步骤。**
>
> **V2 为「AI 未来能做到的」建了基础设施，但今天的 AI 其实还用不上这么多。**
>
> **V2 为「数据完整性」加了表，但这些表本身会成为新的数据不一致源。**

如果让我接手这个项目，我会先把下面这些东西砍掉或大幅简化，然后再开始写代码。

---

# 二、🔴 应该砍掉的设计

## 1. admin_entities — 最危险的「统一对象层」

**当前设计**：P0-9 migration 0064 建一张 `admin_entities` 表，记录 entity_type/entity_id/source/status/owner/title/locale/created_at/updated_at，作为 V2 的「统一对象注册表」。

**为什么应该砍掉**：

这是一个**镜像表（mirror table）**。它不从源表派生数据——它复制数据。每张源表（blogs、commerce_products、customers、oem_projects、videos...）都已经有自己的 status/created_at/updated_at。`admin_entities` 只是把这些字段又抄了一遍。

**这会引入新的数据不一致源**：

```
用户创建产品
  → commerce_products INSERT (status='draft', created_at=T1)
  → admin_entities INSERT (status='draft', created_at=T1)  ← 如果这步失败？
  
用户发布产品
  → commerce_products UPDATE (status='published', updated_at=T2)
  → admin_entities UPDATE (status='published', updated_at=T2)  ← 如果这步失败？
```

每一步写操作现在需要**双写**。没有事务（D1 不支持跨表事务）。任何一步失败 = admin_entities 与源表不一致。

**Dashboard 的「本月询盘 8」到底读 admin_entities 还是源表？** 如果读 admin_entities（因为「统一对象层」嘛），那数据可能比源表旧（同步延迟）。如果读源表，那 admin_entities 根本没用。

**10,000 个对象 × 3 locale = 30,000 行**。全局搜索 `SELECT * FROM admin_entities WHERE title LIKE '%lavender%'` 在 30,000 行上跑 LIKE——D1 没有 FTS，这就是一个全表扫描。

**建议**：砍掉 `admin_entities`。全局搜索用各源表 UNION 查询（或 Elasticsearch/Meilisearch 外部索引）。Dashboard KPI 直接从源表 COUNT。不需要中间表。

---

## 2. content_versions — 与 GitHub commit history 重复

**当前设计**：P0-9 migration 0051 建 `content_versions` 表，每次编辑保存一份 body_snapshot。

**为什么应该砍掉（或大幅简化）**：

GitHub 已经保存了每次 commit 的完整文件快照。`git log -- src/content/blog/essential-oil-guide.en.md` 可以列出所有历史版本。`git diff` 可以对比任意两个版本。

`content_versions` = 在 D1 里又存了一份 GitHub 已经存了的东西。

**这会导致**：
- 每个博客编辑 → GitHub commit（已有）+ D1 INSERT（新增）。两次写操作。
- 版本恢复 → 从 content_versions 读旧 body → 写回 GitHub。但 GitHub 那个 commit 还在——用户看 GitHub history 会看到「恢复了旧版本」的 commit，但看不到「旧版本本身」的 diff（因为那是从 D1 恢复的，不是 git revert）。
- 如果 content_versions 和 GitHub commit history 不一致——哪个是真的？

**建议**：砍掉 `content_versions` 的 body_snapshot。只保留 metadata（version/author/source/change_summary/created_at），变成一个「版本说明表」而非「版本内容表」。body 恢复走 GitHub API（读历史 commit 的 blob sha→读文件内容）。

---

## 3. recycle_bin 独立表 — 过度设计

**当前设计**：P0-9 migration 0053 建 `recycle_bin` 表，记录 entity_type/entity_id/deleted_at/original_data 等。

**为什么应该砍掉**：

`deleted_at` 列已经实现了软删除。查询 `WHERE deleted_at IS NULL` 过滤已删除数据。恢复 = `UPDATE SET deleted_at = NULL`。

`recycle_bin` 表是**多余的第二个删除标记**。它增加了：
- 删除时双写（源表 UPDATE deleted_at + recycle_bin INSERT）
- 恢复时双写（源表 UPDATE deleted_at=NULL + recycle_bin UPDATE restored_at）
- 永久删除时双写（源表 DELETE + recycle_bin UPDATE permanent_deleted_at）

**回收站 UI 完全可以直接查源表**：`SELECT * FROM commerce_products WHERE deleted_at IS NOT NULL`。不需要 join recycle_bin。

**original_data 快照**：删除时保存一份 JSON 快照到 recycle_bin。但如果源表在删除后又被人改了（比如有人绕过软删除直接 UPDATE），快照就和源表不一致——而用户恢复时用的是快照还是源表的当前数据？如果是快照，那恢复 = 覆盖了删除后的修改。

**建议**：砍掉 `recycle_bin` 表。回收站 UI 直接查各源表的 `WHERE deleted_at IS NOT NULL`。如果担心永久删除后无法恢复，保留 original_data 快照到 `content_versions`（已经有 version 表了）。

---

## 4. entity_links — 在 SQLite 里做图数据库

**当前设计**：P0-9 migration 0059 建 `entity_links` 表（entity_type_a/entity_id_a/entity_type_b/entity_id_b），用于通用对象关联。

**为什么应该砍掉或约束**：

这是经典的 EAV（Entity-Attribute-Value）反模式。在关系型数据库里用行来模拟边。

**问题**：
- 不能做 FK 约束（entity_id_a 可能是 commerce_products 的 ID 也可能是 blogs 的 ID，无法 FOREIGN KEY 到具体表）
- 查询「产品 X 关联了哪些视频」需要：`SELECT * FROM entity_links WHERE (entity_type_a='commerce_product' AND entity_id_a='X' AND entity_type_b='video') OR (entity_type_b='commerce_product' AND entity_id_b='X' AND entity_type_a='video')`。每次查询都是双向 OR。
- 删除产品时，需要手动清理 entity_links 中的相关行（无 CASCADE）。
- 如果 entity_links 中有一条 `(blog, 'guide-1', commerce_product, 'prod-123')`，但 `commerce_products` 表中根本没有 `prod-123`——没有任何约束能阻止这种孤儿行。

**更好的方案**：用具体的关联表。

```
video_product_links   — 已有（P0-4 确认），专门做 video↔product
product_guide_links   — 新增，专门做 product↔guide
product_case_links    — 新增，专门做 product↔case
oem_product_links     — 新增，专门做 oem↔product
```

每张关联表都有 FK 约束。删除时 CASCADE 自动清理。查询简单（单表 JOIN）。

**建议**：砍掉通用 `entity_links`。为每个具体关联建专用表。初期只建 Phase 4-6 实际需要的关联（video↔product 已有、product↔content、oem↔product、customer↔inquiry）。其他关联以后再建——不要提前抽象。

---

## 5. copy_assets 表上的「AI 所有字段」——违反范式

**当前设计**：copy_assets 表有 ai_role_used、ai_model_used、ai_cost_cents、ai_prompt（建议新增）、ai_input_snapshot（建议新增）。

**问题**：

这不是文案资产表。这是「AI 调用日志 + 文案资产」的混合体。

如果一条文案被 AI 生成 → 人工修改 → 另一个 AI 再次优化 → 又人工修改，`ai_role_used` 字段到底记录哪个？最后一个 AI？第一个 AI？都需要保留。

`ai_prompt` 字段存 2000+ token 的 prompt 文本。1000 条文案 × 2000 token = 2MB 的 prompt 文本存在 D1 里。这是存储浪费。

**建议**：copy_assets 只保留 `created_by_source`（human:<name> / ai:<role_name>）和一个 `source_ai_action_id`（指向 ai_action_logs 的 FK）。prompt、model、cost、input 全部在 ai_action_logs 里查。文案表不需要存 AI 的完整调用痕迹。

---

# 三、🟠 应该重新思考的设计

## 6. Product Content vs Commerce Product — 用户永远会觉得烦

**事实**：V2 明确了 Content Product（GitHub MD，品牌展示页）和 Commerce Product（D1/R2，现货 SKU/价格/库存）是两个东西。通过 content_product_key 关联。

**但用户看到的是**：

```
后台：
  内容 → 产品资料 → "Essential Oil 100ml"（品牌页，有描述、SEO、图片）
  商品 → 现货商品 → "Essential Oil 100ml"（现货，有 MOQ、价格、库存）
```

用户：「为什么同一个产品有两个页面？我应该改哪个？」

你：「它们是不同的对象——一个是内容一个是商品——」

用户：「我不在乎。我只想改 Essential Oil 的标题。现在告诉我应该点哪里。」

**这是 V2 最大的 UX 债务**。技术架构上的分离（GitHub vs D1）是对的，但 UX 上没有给用户一个「统一产品视图」。

**现在要改一个产品的完整信息，用户需要**：
1. 去「内容 → 产品资料」改标题、描述、SEO
2. 去「商品 → 现货商品」改 MOQ、价格、库存
3. 去「内容 → 文案资产」改产品文案
4. 去「媒体 → 视频」关联视频
5. 去「增长 → SEO」检查 SEO Score

**5 个地方，5 次页面跳转。**

**建议**：给每个 Commerce Product 一个「统一产品视图」入口。在这个视图里，用一个页面聚合：基础信息（来自 Commerce）+ 内容描述（来自 Content Product）+ 文案（来自 Copy Assets）+ SEO Score + 视频 + 关联内容。不是「合并两个表」，而是「一个 UI 聚合多个源」。

---

## 7. OEM 12 Tab — 信息过载

**当前设计**：OEM 详情页有 12 个 Tab：客户/需求/产品/配方/香型/包装/打样/报价/文件/沟通/AI/时间线。

**问题**：

12 个 Tab = 用户需要点 12 次才能看完全部信息。大部分 Tab 在大部分时间是空的。

「配方」和「香型」——对蜡/藤条/蜡烛产品重要，对包装定制项目完全没用。但 Tab 永远显示。

「AI」Tab — 如果 AI 什么都没分析出来，这个 Tab 就是空白页。

**实际使用场景**：
- 用户打开 OEM 项目 → 想快速看「报价发了没、样品寄了没、客户最后说了什么」
- 12 个 Tab 里，只有 3 个 Tab（报价/打样/沟通）是每次都要看的
- 其余 9 个 Tab 偶尔需要

**建议**：把 OEM 详情改为「概览页 + 分段滚动」，不是 12 个 Tab。概览页顶部显示：项目状态条 + 最近沟通 + 待办（报价发了没？样品寄了没？）+ AI 摘要。详细内容按需展开（手风琴或锚点跳转），不默认全部展示。

---

## 8. AI Panel ✨ 按钮无处不在 — 视觉噪音

**当前设计**：V2 规范 §44：任何对象右上角必须有 ✨ AI 按钮。

**问题**：

每个页面都有 ✨ 按钮 = 用户学会了忽略它。

如果一个产品已经有完整的 SEO、文案、图片 Alt、翻译，AI 没什么可做的——✨ 按钮还在，点开是「AI 没有新建议」。两次点击的浪费。

**建议**：✨ 按钮只在 AI 有实质性建议时才显示（带角标数字或脉冲动画）。AI Score 低于阈值（如 <80）时显示「AI 有 N 条建议」。Score 高于阈值时按钮静默。不是「AI 永远在线」，而是「AI 在需要时出现」。

---

## 9. 三栏编辑器 — 过度设计 90% 的编辑场景

**当前设计**：内容编辑器 V2 = 左栏（内容导航）+ 中栏（编辑区域）+ 右栏（SEO Score / AI Assistant）。

**问题**：

大多数内容编辑是改几行文字、修一个拼写错误。不需要 SEO Score 面板和 AI Assistant 同时可见。

三栏 = 屏幕宽度被切成三份。在 1440px 屏幕上：240px 导航 + 720px 编辑 + 480px AI/SEO。编辑区只有 720px——比现在的全宽 Modal 还窄。

**建议**：默认两栏（导航 + 编辑）。右栏（SEO/AI）作为**可折叠面板**（toggle 按钮），需要时才展开。90% 的编辑在两栏模式下完成。

---

## 10. 全局搜索 LIKE 查询 — 10,000 条就慢

**当前设计**：Cmd+K 全局搜索，搜 product/blog/guide/case/inquiry/customer/oem/order/video/copy/faq/task/ai_mission。

**D1 不支持 FTS（全文搜索）**。`WHERE title LIKE '%keyword%'` 是全表扫描。

10,000 products + 5,000 blogs + 3,000 videos + 100,000 inquiries = 118,000 行。每个 LIKE 查询扫描 118,000 行。用户输入每个字符都触发一次搜索（debounce 350ms），结果是 350ms 延迟 + 扫描 118,000 行。

**建议**：Phase 1 不做全局搜索后端（只做 UI 壳）。Phase 3 用简单的 `LIKE` + LIMIT 20 作为过渡。Phase 10 评估 D1 是否已支持 FTS，如果未支持则使用 KV 缓存搜索索引（定时重建）或外部搜索服务。

---

# 四、🟡 未来一定会出问题的地方

## 11. 批量 AI 操作在 CF 10s 超时下不可靠

**场景**：用户选择 20 个产品，点「AI 翻译成西班牙语」。

**当前设计的缓解**：R1 建议「上限 5 条，异步 Queue」。

**现实**：用户有 100 个产品需要翻译。上限 5 条 = 用户需要操作 20 次。每次等待 5 个产品的 AI 翻译完成（可能需要 30-60 秒）。20 次 × 30 秒 = 10 分钟。

**CF Workers 的 10s CPU 限制是硬伤**。D1-based AI Task Queue 的 worker 也必须在 10s 内完成。如果单个 AI 翻译调用需要 3-5 秒（DeepSeek API 延迟），一个 worker 最多翻译 2-3 个产品就要返回。处理 100 个产品需要 30-50 个 worker 调用。

**如果 worker 处理到一半超时了——哪些翻译完成了？哪些没有？idempotency key 能保证不会重复翻译同一个产品吗？**

V1 有 idempotency key（P0-5 确认），但那是针对「同一个任务重复触发」的幂等，不是针对「一批 100 个产品中每个产品的幂等」。

**建议**：批量 AI 操作的每个 item 独立幂等键（如 `translate:product:123:es:2026-08-24`）。Queue worker 处理单 item 而非整批。前端显示 item-level 进度（23/100 completed）。失败 item 单独重试。

---

## 12. audit_logs 存 full JSON snapshot — 100 万行 = 存储炸弹

**当前设计**：audit_logs 表有 before_state TEXT 和 after_state TEXT（JSON snapshot）。

**如果 commerce_products 有 66 列**（P0-4 确认），每次修改任何一列，before_state 和 after_state 各存一份 66 列的完整 JSON。每条 audit_log 行 ≈ 5-10KB。

每天 100 次修改（保守估计：编辑 20 博客 + 改 30 产品 + 10 订单操作 + 40 AI 自动修改）= 每天 500KB-1MB。

一年 = 180-365MB。D1 免费额度 5GB 存储。audit_logs 两年后可能占满。

**而且这些 JSON snapshot 大部分永远不会被查看。** 用户偶尔查一次「谁改了标题」，但 99% 的 snapshot 永远不读。

**建议**：before_state/after_state 只存**变更字段的 diff**，不是完整对象。例如 `{"title": {"old": "Essential Oil", "new": "Pure Essential Oil"}}`。存储量减少 90%+。或者，只存 change_summary（人类可读的变更描述），不要存完整 JSON。

---

## 13. 软删除 + recycle_bin + content_versions = 数据永远不会被清理

**设计**：删除 = SET deleted_at（软删除）。永久删除 = 从回收站删。但 `content_versions` 和 `audit_logs` 可能还保留着这个对象的快照。

**结果**：一个用户可以：
1. 创建产品
2. AI 修改 3 次（content_versions 3 行）
3. 用户修改 2 次（content_versions 2 行）
4. 删除（deleted_at + recycle_bin 1 行）
5. 永久删除（recycle_bin 标记 permanent_deleted_at）

产品本身被永久删除了。但 `content_versions` 还有 5 行（含完整 body_snapshot）、`audit_logs` 还有 6 行（create + 3 AI + 2 human + delete）。**数据并没有真正消失。** 如果产品描述里包含敏感信息（如供应商成本价）——永久删除后这些信息仍然在 versions 和 audit 里。

**建议**：GDPR/合规视角：永久删除时应该清理该 entity 相关的 versions 和 audit_logs。或者，content_versions 只保留 metadata（不存 body_snapshot），audit_logs 只保留 change_summary（不存完整 before/after JSON）。这样永久删除后才真正「删干净了」。

---

## 14. 8 张表在 Phase 14 废弃——但 30 天观察期根本不够

**P0-4 建议废弃 8 张表**：knowledge_base、daily_recs、experiments、ai_opportunities、ai_daily_briefs、ai_usage、ai_reports、decisions。

**P0-10 设计**：旧 API 保留 30 天观察期后下线。

**问题**：这些表可能是 cron 写入的（如 ai_daily_briefs）。cron 不是 API——它直接写 D1。30 天「API 调用量观察」检测不到 cron 的写入。

如果 cron-pull.ts 还在写 `ai_daily_briefs`（而你没注意到），Phase 14 DROP TABLE 后 cron 开始报错——但 cron 的报错被 try/catch 吞了（P0-5 确认 mission-log 「永不阻断主流程」）。**你永远不会知道 cron 在报错，直到某天发现日报数据不更新。**

**建议**：废弃表之前，在 cron 代码中搜索每张表的表名（grep）。确认没有写入后，先把表 RENAME TO _deprecated_xxx（保留数据），观察一周 cron 无报错，再 DROP。不是 30 天 API 观察——是搜索源码 + 重命名观察。

---

## 15. 多语言扩展到 10 种语言时，硬编码 locale 会裂开

**当前设计**：locale 在表里是 TEXT，扩展性好。但 `src/i18n.ts` 是 2,500 行硬编码字典。

**如果加 zh/fr/it/pt/ar/ja**：需要给 2,500 行字典逐行加 5 种新语言的翻译。这是翻译项目，不是开发任务。而且 `i18n.ts` 是 TypeScript 文件——翻译人员不能直接编辑（需要开发者介入）。

**建议**：i18n 字典从 `src/i18n.ts` 迁移到 D1 表 `i18n_strings`（key/locale/value）。翻译人员通过后台 UI 编辑。开发者不需要参与翻译。Phase 11 做这个迁移。

---

# 五、🔴 AI 特有的风险

## 16. AI 可能静默执行比 P0-3 更危险的操作

**P0-3 关注的是「Prompt Injection」——恶意文本被 AI 当成指令。** 这个 V1 已有防线（permissions.ts enforceMode + FORBIDDEN_TASK_TYPES + truthfulness.ts）。

**但还有一个更隐蔽的风险**：AI 正常操作但**累积效应**导致灾难。

**场景**：
```
Step 1: AI 自动修改 50 个产品的 meta description（L3，允许自动）
Step 2: 每个修改创建 content_version 行
Step 3: 每个修改触发 GitHub commit（50 个 commit）
Step 4: 50 个 commit 触发 50 次 CF build
Step 5: GitHub API rate limit 耗尽（5000 req/hour 中内容保存占 50+）
Step 6: 用户手动发布博客 → GitHub API 返回 403 rate limited → 发布失败
```

这不是 AI 恶意。这是 AI 正常执行 L3 允许的操作，但**规模效应**导致服务降级。

**当前设计没有「AI 操作频率限制」**——只限制了「能不能做」（permissions）和「花多少钱」（budget），没限制「每小时最多做多少次」。

**建议**：增加 AI 操作频率限制（rate limiter）：每小时最多 N 次自动执行（跨所有类型）。超过限制 → 进入队列延迟执行。不让 AI 的善意操作压垮 GitHub API 或 CF build。

---

## 17. AI 的「成功」不等于「有效」

**当前设计**：AI 执行 → 记录 mission/action → 标记 status='success'。

**但**：
```
AI: "成功优化了产品 X 的 SEO Description"
实际情况: AI 把 "Essential Oil Supplier" 改成了 "Essential Oil Manufacturer in China"
          → 对 SEO 没有提升（GSC 数据显示排名无变化）
          → AI 浪费了 ¥0.02 预算
          → 用户不知道这次「成功」是无效的
```

V1 的 Growth Experiment 有 before/after 对比和 outcome 三态（positive/no_effect/negative）。但这个闭环只用于 Growth 场景，不用于日常 AI 操作。

**建议**：对 L2/L3 AI 操作加入「有效性回检」：AI 操作 T+7 天后自动检查相关指标（GSC 排名/CTR/询盘量），标记 `outcome: positive | no_effect | negative`。no_effect/negative 的操作 → 降低该 AI 角色的置信度，减少未来同类操作的自动执行权限。

---

## 18. AI 可以生成「看起来正确但实际违法」的合规文案

**场景**：
```
用户点「AI 生成产品文案」
AI 在 description 中写:
"This product is FDA approved and certified organic by USDA."

实际情况:
- 产品没有 FDA 认证
- 产品没有 USDA Organic 认证
- AI 自己编的（LLM 幻觉）
```

**V1 防线**：truthfulness.ts 的 5 条红线中包括「未经基线确认的认证承诺」。但 truthfulness 是**事后扫描**——在 AI 生成之后检查输出文本。如果检查漏了（比如认证名称不在已知的违规词列表中），这段文案就进入了草稿，等待人工审核。

**但人工审核可能也会漏。** 用户看到「AI 生成的内容」，可能信任 AI 而快速通过审核。

**V2 设计未明确**：AI 生成的内容在进入人工审核之前，是否有**二次自动检查**？如果有，检查失败后是标记给用户还是直接拦截？

**建议**：AI 生成的内容经过 truthfulness check → 如果 WARNING 级别（非 FAIL），在审核 UI 中**高亮标记可疑文本**（红色下划线），强制用户逐条确认后才能发布。不信任用户的「快速审核」。

---

# 六、「我每天用 8 小时，会在哪些地方觉得烦？」

## 烦 #1：搜索一个东西，出来两个结果

我在全局搜索里输入 "Lavender Oil"：
- 结果 1：内容 → 产品资料 → "Lavender Essential Oil"（品牌展示页）
- 结果 2：商品 → 现货商品 → "Lavender Essential Oil 100ml"（可售现货）

我应该点哪个？我想改价格——应该点结果 2。我想改产品描述——应该点结果 1。但我需要先**理解 V2 的架构**才能做出正确选择。

**每搜索一个产品，我都要做一次「这是内容还是商品」的判断。每天重复 50 次。**

---

## 烦 #2：点「发布」，然后等 2 分钟

我写完一篇博客，点「发布」。
- 10 秒后：提示「已保存到 GitHub」
- 1-2 分钟后：CF build + deploy 完成
- 如果 build 失败：**我不知道。** 我看到的仍然是「已发布」。直到我打开前台发现文章没出现——或者 Google 搜不到。

**我每天发布 3-5 篇内容。每次都要等 1-2 分钟才能确认「真的发出去了」。**

---

## 烦 #3：改一个简单的东西要跳 3 个页面

我收到一个客户邮件：「Essential Oil 100ml 的 MOQ 能不能改成 50？」

我需要：
1. 去「商品 → 现货商品」→ 搜索 "Essential Oil" → 找到产品 → 编辑 → 改 MOQ → 保存
2. 如果产品资料页上也写了 MOQ（在 description 正文里），我需要去「内容 → 产品资料」→ 搜索 → 编辑 → 手动改正文中的 MOQ 数字
3. 如果有产品文案引用了 MOQ，我还需要去「内容 → 文案资产」→ 搜索 → 编辑

**一个 MOQ 修改 = 3 个页面跳转。每天可能发生 2-3 次。**

---

## 烦 #4：AI 给的修改，我不敢直接接受

AI 说：「我优化了产品 SEO Title，建议改成 "Private Label Essential Oil Manufacturer China | Wholesale Bulk Supply"。」

我需要在脑子里验证：
- 「Private Label」——这个产品支持贴牌吗？我得去商品编辑页检查 `private_label` 字段。
- 「Manufacturer」——我们是工厂还是贸易商？Aromiso 的定位是「连接买家与中国工厂」——不是 Manufacturer。
- 「China」——对，工厂在中国。
- 「Wholesale Bulk Supply」——听起来 SEO 不错，但太泛了。

**AI 给我 5 条建议。每条我需要花 30 秒验证。5 条 = 2.5 分钟。然后我可能只接受 2 条。** 如果 AI 能告诉我「为什么这样改」和「改了之后预期影响是什么」，我会更快做出判断。

---

## 烦 #5：侧边栏太长

```
A. 首页
B. 内容    ▼
   - 博客
   - 产品资料
   - 指南
   - 案例
   - FAQ
   - 文案资产
   - 内容回收站
   - 内容批量中心
C. 商品与商城  ▼
   - 现货商品
   - SKU / 变体
   - 订单
   - 运营位
   - 1688 导入
   - 商品数据质量
   - 商城分析
D. 客户与业务  ▼
   ... 7 个子项
E. 媒体  ▼
   ... 4 个子项
F. 增长  ▼
   ... 6 个子项
G. AI 中心  ▼
   ... 8 个子项
H. 知识与系统  ▼
   ... 6 个子项
```

**8 个一级 × 平均 5 个子项 = 40+ 个导航目标。**

我每天常用的只有 5 个：Dashboard、博客列表、现货商品列表、询盘列表、AI 总控台。但它们在 4 个不同的一级菜单下。每次切换都要先展开一级、再点子项、再等页面加载。

---

## 烦 #6：回收站让我不安

我删了一个产品。它从列表里消失了。我知道它在回收站里，但我总觉得「万一回收站出 bug 或者我误点了永久删除呢？」

我在编辑产品时，Delete 按钮旁边有没有「这个产品被 3 个询盘引用了」的提示？没有。我删了之后才发现一个客户正在询盘这个产品。

**删除前没有影响分析。删除后需要去回收站确认。回收站是另一个页面——我又跳了一次。**

---

## 烦 #7：Dashboard 的「需要我处理」列表不智能

Dashboard 显示：「4 个询盘超过 24h 未回复」「3 个产品缺 SEO」「2 个页面 SEO 异常」。

但是：
- 哪 4 个询盘？我需要点进去看——这是一个列表页跳转。
- 哪个最紧急？金额大的？客户等级高的？还是什么都没标注。
- 「3 个产品缺 SEO」——缺什么？缺 Title？缺 Description？我需要点进去每个产品才能知道。

**Dashboard 告诉了我「有问题」，但没有告诉我「应该先处理哪个」。**

---

## 烦 #8：版本历史太多，找不到「那个好的版本」

一个产品被 AI 修改了 6 次、人工修改了 3 次。版本历史列表显示 9 行。

哪一行是「SEO title 最好的版本」？哪一行是「被 AI 改坏了被我撤销了」？

我需要点开每个版本看 diff。9 个版本 = 9 次点击。

**如果版本历史能显示 AI Score 变化曲线（每次修改后 SEO Score 是升了还是降了），我一眼就知道哪个版本最好。**

---

# 七、最终判断

**V2 是一份「架构师会觉得好的设计」，但不是一份「用户会觉得好的产品」。**

**它加了**：
- 1 张统一对象表（admin_entities）——会制造数据不一致
- 1 张版本表（content_versions）——与 GitHub 重复
- 1 张回收站表（recycle_bin）——与 deleted_at 重复
- 1 张通用关联表（entity_links）——没有 FK 约束
- 1 张文案表（copy_assets）——字段太多（应拆分 AI 元数据）
- 多个 AI 字段散落在各业务表中——范式混乱

**它没有减少**：
- 修改一个产品信息需要的页面跳转次数（仍然是 3-5 次）
- 搜索到正确目标需要的判断次数（仍然需要区分「内容 vs 商品」）
- 等待内容发布生效的时间（仍然是 1-2 分钟）
- AI 建议验证需要的心智负担

**如果我接手这个项目，我会先做的事**：
1. 砍掉 admin_entities ——用 UNION 查询代替
2. 砍掉 content_versions 的 body_snapshot ——只保留 metadata
3. 砍掉 recycle_bin ——用 deleted_at + WHERE 过滤
4. 砍掉 entity_links ——用具体关联表
5. 砍掉 copy_assets 上的 AI 字段 ——用 FK 指向 ai_action_logs
6. 给 Commerce Product 加一个「统一产品视图」——一个页面聚合所有信息
7. OEM 详情从 12 Tab 改为概览页 + 按需展开
8. ✨ AI 按钮改为「有条件显示」（有建议时才亮）
9. 三栏编辑器默认两栏，右栏可折叠
10. 增加 AI 操作频率限制（防善意 DDoS）
11. 增加废弃表的重命名观察期（非直接 DROP）
12. i18n 从硬编码 ts 迁移到 D1

**这些砍掉之后，V2 的核心骨架仍然是成立的**——AdminShell、RBAC、Audit、Version、Soft Delete、API 标准化、组件化、AI 安全网。只是去掉了过度抽象和重复数据。

---

*本审查以「接手项目的资深架构师」视角，目标不是赞美设计，而是找出会被未来维护者骂的地方。每一项都有具体文件/表/API 引用。*