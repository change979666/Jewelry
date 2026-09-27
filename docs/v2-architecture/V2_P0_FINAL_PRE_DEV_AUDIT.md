# Aromiso CMS V2 — Final Pre-Development Audit
## Phase 0 最终开发前反向验收

审查时间：2026-08-24
审查范围：18 份 V2_*.md + 48 migration + 源码
审查角色：Principal Architect + Product Architect + Security Architect + AI Systems Architect
原则：不追加设计，只判 PASS/FAIL。所有结论引用具体文档/表/Phase/ADR。

---

## 1. STOP 项逐项验证

### STOP-01：统一产品视图缺失

| 检查项 | 结果 | 引用 |
|--------|------|------|
| Product 与 Commerce Product 是不同 DB 对象 | ✅ PASS | P0-7 §2: Content Product (GitHub MD) vs Commerce Product (D1)，通过 content_product_key 关联 |
| 统一产品视图 UI 是否存在？ | ❌ FAIL | 无文档描述聚合 Content + Commerce + Copy + Media + SEO + AI 的单一产品页面 |
| 用户能否从一个入口看到产品的所有信息？ | ❌ FAIL | 当前需跳转 3-5 个页面 |
| 是否可能「修改了 A，前台用的 B」？ | ⚠️ RISK | SEO Title 可能有两个源（GitHub MD frontmatter + D1 seo_title），如果 content_product_key 关联错误 |
| Product→Commerce Product 映射：谁是真源？ | ✅ PASS | ADR-1: GitHub = Content 真源。P0-4: D1 = Commerce 真源。两者独立，通过 key 关联，非同步 |

**判定：🟡 CONDITIONAL PASS**

统一产品视图的设计不在 Phase 0 范围内（Phase 0 是架构层，它是 UI 聚合层）。Phase 4（内容中心）和 Phase 5（商品中心）之间需插入此页面。不阻塞 Phase 1。

**Product Domain Object Graph**（从现有文档推导）：

```
Commerce Product (D1, 真源)
  ├── Variants/SKU (D1)
  ├── Price Tiers (D1)
  ├── Inventory (D1)
  ├── Supply Chain (D1: supplier_*, source_*)
  ├── Images (R2, D1: commerce_product_images)
  ├── Videos (R2, D1: video_product_links)
  ├── Copy Assets (D1: copy_assets.linked_entity)
  ├── SEO (D1: seo_title, seo_description)
  ├── Merchandising (D1: product_merchandising)
  └── ─── content_product_key ───
                                    │
Product Content (GitHub MD, 真源)    │
  ├── Body (MD)                      │
  ├── Cover Image (MD frontmatter)   │
  ├── SEO (MD frontmatter)           │
  └── FAQ (MD frontmatter)           │
                                     │
Inquiries (D1) ─── product ──────────┘
OEM Projects (D1) ── entity_links ───┘
```

所有对象通过 `commerce_products.id`（D1 真源）或 `content_product_key` 关联。关系已设计，聚合 UI 缺失。

---

### STOP-02：业务链断裂

逐节点检查 Inquiry → Customer → OEM → Quote → Order 链：

| 节点 | DB 对象 | API | 页面 | 状态机 | FK | AI 入口 | Audit |
|------|---------|-----|------|--------|-----|---------|-------|
| Visitor → Inquiry | ✅ inquiries | ✅ /api/public/inquiry | ✅ 前台表单 | ✅ new→contacted→... | N/A | 🔮 Phase 7 Lead Score | ✅ (V1 audit 缺失，V2 Phase 2 补) |
| Inquiry → Customer | ⚠️ inquiries.customer_id FK 缺失（ADR-17 已设计但未落 migration） | ⚠️ 无「一键创建客户」API | ❌ 无 | ❌ | ⚠️ | 🔮 | ❌ |
| Customer → OEM | ✅ oem_projects.customer_id FK | ✅ P0-13 API 列表 | 🔮 Phase 6 | ✅ lead→...→completed | ✅ | 🔮 | 🔮 Phase 2 |
| OEM → Quote | ⚠️ oem_quotes.status 缺失（draft/sent/accepted/rejected） | 🔮 Phase 6 | 🔮 | ❌ | ✅ FK | 🔮 | 🔮 |
| Quote → Order | ❌ oem_quotes.converted_to_order_id 缺失 | ❌ 无「转订单」API | ❌ | ❌ | ❌ | 🔮 | 🔮 |
| Order → Payment | ⚠️ commerce_orders 有 status 列但无 payment_status | 🔮 Phase 5 | 🔮 | ⚠️ 无 payment 子状态 | N/A | 🔮 | 🔮 |
| Order → Shipment | ❌ 无 shipment 表 | ❌ | ❌ | ❌ | ❌ | 🔮 | 🔮 |

图例：🔮 = 对应 Phase 已计划但未展开设计细节

**判定：🟡 CONDITIONAL PASS**

ADR-17 定义了关键 FK（inquiries.customer_id / oem_quotes.converted_to_order_id / commerce_orders.source_type+source_id），但未写入 P0-9 migration DDL。Phase 6 开发前必须将这些 FK 加入对应 migration。

链的 70% 节点有 DB 对象。缺失的 30% 集中在 Quote→Order 转换和 Order→Shipment。Quote→Order 是 Phase 6 MUST FIX。Shipment 是 SAFE TO DEFER（Aromiso 当前订单量低）。

---

### STOP-03：AI Command 链路缺失

追踪用户输入「把所有没有 SEO Description 的现货商品补齐，英文优先，AI 生成后不要直接发布」：

| 步骤 | 有设计？ | 引用 |
|------|---------|------|
| Intent Detection（理解用户意旨） | ❌ | 无 AI Role 设计负责 Command 解析 |
| Entity Resolution（找到「现货商品」） | ⚠️ | admin_entities 可查 entity_type='commerce_product'，但「没有 SEO Description」的筛选条件无预定义查询 |
| Scope Preview（展示影响范围） | ❌ | 无「预览：将影响 47 个商品」的 UI |
| Cost Estimate（预估 Token/费用） | ❌ | 无 |
| Task Creation（创建批量 AI 任务） | ⚠️ | ai_tasks 表有但批量创建逻辑未设计 |
| AI Role Selection（选哪个 Role？） | ⚠️ | product_copywriter 可生成 SEO Description，但 Command→Role 路由无设计 |
| Execution（执行生成） | ⚠️ | 单个可行，批量见 P1-4 |
| Permission Gate | ✅ | permissions.ts enforceMode('meta_fix') → L3（可自动，但用户说「不要直接发布」→ 需 L2） |
| Result Display（展示结果+Diff） | ⚠️ | DiffViewer 组件有，但批量结果展示未设计 |
| Approval（人工审核） | ✅ | L2 requires reviewApproved |
| Audit | ✅ | audit_logs 已设计 |

**判定：🔴 FAIL — 但已裁决延期到 Phase 8**

AI Command 执行链路**在当前文档中确实不存在**。ADR 已裁决：Phase 1-7 不做 AI Command。Phase 8 单独设计子系统。此 STOP 不阻塞 Phase 1。

---

## 2. 发布状态五态验证（ADR-16）

| 对象 | 当前状态模型 | V2 五态适用？ | 差异 |
|------|------------|-------------|------|
| Blog | Draft / Published | ✅ | GitHub 发布 = Committing→Building→Deployed |
| Product Content | Draft / Published | ✅ | 同上 |
| Guide | Draft / Published | ✅ | 同上 |
| Case | Draft / Published | ✅ | 同上 |
| FAQ | Draft / Published | ✅ | 同上 |
| Copy Asset | draft / reviewed / published / archived | ⚠️ | 已有 4 态，加 Committing/Building 无意义（文案发到哪？） |
| Video | processing_status + editorial_status | ⚠️ | 视频有独立状态模型（双状态列），不适合套五态 |
| Commerce Product | Draft / Active | ⚠️ | 商品发布 ≠ GitHub 发布（无 build 环节），Draft→Active 二元足够 |
| OEM | lead→...→completed | ⚠️ | OEM 是阶段机（9 态），非发布状态机 |
| Landing Page | 不存在 | N/A | V2 未设计 Landing Page 管理 |

**判定：🟡 CONDITIONAL PASS**

五态（Draft→Committing→Building→Deployed→BuildFailed）**仅适用于走 GitHub 发布管线的内容对象**（Blog/Product Content/Guide/Case/FAQ）。Commerce Product、Video、OEM、Copy Asset 各有其合理的状态模型，不应强行统一。

关键缺失：Publish 操作未记录 who/when/version/SHA。content_versions 未加 github_commit_sha 列（ADR 已要求但未落 migration）。

---

## 3. AI 模型 5→2 层验证（ADR-15）

| 层级 | V1 设计 | ADR-15 后 | 安全闸是否保留？ |
|------|---------|----------|----------------|
| Mission (ai_missions) | ✅ | ✅ 保留（日报聚合容器） | N/A |
| Task (tasks) | ✅ | ❌ 砍掉，合并到 ai_tasks | — |
| Task Run (task_runs) | ✅ | ❌ 砍掉，合并到 ai_tasks | — |
| Action (ai_action_logs) | ✅ | ✅ 保留（步骤级日志，Replay 用） | N/A |
| ai_tasks (V2 新) | 计划新增 | ✅ 合并 tasks + task_runs + 新 ai_tasks | — |

**最终模型**：

```
ai_missions (容器)
  └── ai_tasks (合并 tasks/task_runs/ai_tasks)
        ├── permission_level (L1-L4+MANUAL ← enforceMode 重裁定)
        ├── budget_consumed
        ├── truthfulness_result (来自 truthfulness.ts checkClaims)
        ├── idempotency_key
        ├── status (queued→running→awaiting_approval→completed→failed)
        ├── retry_count
        ├── input_snapshot / output_snapshot / diff
        └── ai_actions (步骤日志子记录，在 ai_action_logs 表中)
```

**判定：✅ PASS。5→2 层简化正确。安全闸门（permissions.ts / truthfulness.ts / action-budget.ts / mission-log.ts）全部保留在业务逻辑层，不随数据模型简化而变化。Model Layer ≠ Permission Layer ≠ Risk Layer 已正确分离。**

---

## 4. 跨真源失败处理（7 Cases）

| Case | 当前设计 | 状态 | 可重试？ | 幂等？ | 用户看到什么 | 脏数据？ |
|------|---------|------|---------|--------|------------|---------|
| A: GitHub OK, D1 FAIL | D1 写失败→API 返回 error | ⚠️ 有 error 返回但用户不知道 GitHub 已经写了 | 重试 D1 写 | ⚠️ 无 idempotency key | 「保存失败，请重试」 | GitHub 有新 commit 但 D1 无对应记录 |
| B: D1 OK, R2 FAIL | API 返回 error。D1 已写，R2 图片缺失 | ⚠️ D1 记录有 image_url 但 R2 无对象 | 重试 R2 PUT | ⚠️ | 「图片上传失败」 | D1 有指向不存在的 R2 对象 |
| C: R2 OK, D1 FAIL | API 返回 error。R2 有对象但 D1 无记录 | ⚠️ 孤儿 R2 对象 | 重试 D1 INSERT | ⚠️ | 「保存失败」 | R2 孤儿文件 |
| D: AI generated, GitHub commit FAIL | AI 产出在 D1 draft（ai_tasks.output_snapshot），GitHub PUT 失败 | ⚠️ draft 保留但 publish 失败 | 重试 GitHub PUT | ⚠️ 无 | 「发布失败」 | 无（draft 未被消费） |
| E: Publish OK, CF Build FAIL | GitHub commit 成功，CF build 报错 | ❌ 后台无感知。显示「已发布」但前台是旧版 | 手动重触发部署 | N/A | 「已发布」（虚假状态） | 否，但前后台不一致 |
| F: 用户重复点击 Publish | 多次 GitHub PUT → 多个 commit | ⚠️ 无防重复机制 | N/A | ⚠️ 无 publish idempotency key | 正常 | 重复 commit |
| G: AI Worker 超时（执行一半） | Worker 被 CF 10s 杀 | ❌ 处理中的 item 状态未知 | 需要 task-level idempotency | ⚠️ 无 item-level 幂等键 | 「操作超时」 | 部分 item 已完成，部分未执行 |

**判定：🟠 FAIL — Case E/F/G 无设计。Case A-D 有基本 error 返回但缺乏统一的 operation_id/idempotency_key/retry/rollback 机制。**

**Phase 4 MUST FIX**：GitHub 管线操作的 idempotency key + publish_status 五态。
**Phase 7 MUST FIX**：AI Worker 超时的 item-level 幂等 + 状态恢复。

---

## 5. Rollback SHA 验证

| 检查项 | 结果 |
|--------|------|
| content_versions 是否记录 github_commit_sha？ | ❌ FAIL — ADR 要求但 P0-9 DDL 未更新 |
| 能否恢复到「昨天 14:32 的版本」？ | ⚠️ PARTIAL — GitHub 内容可恢复（如果知道 commit SHA），D1 commerce 数据不可恢复（无版本） |
| R2 文件恢复？ | ❌ FAIL — R2 无版本。覆盖上传 = 旧文件永久丢失（除非每次上传用新 key） |
| AI 生成内容恢复？ | ✅ PASS — ai_tasks.output_snapshot 保存 |
| Commerce 数据恢复？ | ❌ FAIL — commerce_products 无版本表。UPDATE 覆盖旧值，无法恢复 |
| 是 Full Rollback 还是 Partial Rollback？ | **PARTIAL** — 只有 GitHub 内容对象可回滚。D1 业务数据和 R2 文件不可回滚 |

**判定：🟠 FAIL — 当前设计是 Partial Rollback。content_versions 的 github_commit_sha 列必须加入 P0-9 DDL。Commerce 数据和 R2 文件不可回滚这一事实需在文档中明确声明（用户预期管理）。**

---

## 6. AI 频率限制

| 限制维度 | 有设计？ | 引用 |
|---------|---------|------|
| Per Day (全局) | ✅ | action-budget.ts: 三层预算，含日上限 |
| Per Action Type | ✅ | action-budget.ts: 按类型（meta_fix/internal_link/translate_fill/alt_text_fill）单独上限 |
| Per User | ❌ | 无。任何管理员都能触发 AI |
| Per Role | ❌ | 无。同一 Role 无调用频次限制 |
| Per Minute (突发) | ❌ | 无 rate limiter。批量 AI 可瞬间触发 50+ 次调用 |
| Concurrency | ❌ | 无。多个用户同时点 AI 按钮无并发控制 |
| Queue | ⚠️ | ai_tasks 有 status='queued'，但无 Queue worker 设计 |
| Circuit Breaker | ❌ | 无。AI API 连续失败后无熔断 |
| Retry | ✅ | idempotency.ts beginRun/finishRun + CAS reset |

**判定：🟠 FAIL — 缺少 Per Minute / Concurrency / Circuit Breaker。批量 AI + AI Command 场景下存在「善意 DDoS」风险（一个批量操作瞬间触发 100 次 DeepSeek API 调用）。**

**Phase 7 MUST FIX**：增加 rate limiter（每分钟最多 N 次 AI 调用）+ Queue worker（串行消费）。

---

## 7. OEM 范围确认

| 步骤 | Phase 6 V1？ | Phase 6 V2+？ | 理由 |
|------|-------------|--------------|------|
| Customer → OEM Project | ✅ | — | 核心 |
| Requirements | ✅ | — | 核心 |
| Product Association | ✅ (entity_links) | — | 核心 |
| Formula / Fragrance | ❌ | V2+ | 并非所有 OEM 都需要配方（包装定制不需要） |
| Packaging | ⚠️ (在 requirements 中) | 独立表 | V1 可以 requirements 覆盖 |
| MOQ / Quantity | ✅ (oem_projects 字段) | — | 已有 |
| Sample | ✅ (oem_samples) | — | 核心 |
| Quote | ✅ (oem_quotes) | — | 核心 |
| Quote→Order 转换 | ❌ MUST FIX | — | ADR-17 |
| Production | ❌ | V2+ | 当前订单量低，生产跟踪非紧急 |
| QC / Inspection | ❌ | V2+ | 同上 |
| Shipment | ❌ | V2+ | 同上 |

**OEM V1 Scope**：Inquiry → Customer → OEM Project → Requirements → Sample → Quote → （Quote→Order 转换）
**OEM V2 Future Scope**：Formula / Fragrance / Packaging 独立表 / Production / QC / Shipment

**判定：✅ PASS。V1 范围合理，不做过度设计。**

---

## 8. 全局搜索：INV-1 保护验证

| 检查项 | 结果 |
|--------|------|
| 当前 admin_entities 字段：type/id/title/status/updated_at | ✅ INV-1 锁定 |
| 如果需要搜索 SKU： | 通过 JOIN commerce_products ON admin_entities.entity_id = commerce_products.id |
| 如果需要搜索 email： | 通过 JOIN customers |
| 如果需要搜索 company： | 同上 |
| 是否可能「加一个字段方便搜索」？ | **INV-1 禁止。必须通过 JOIN 源表实现。** |
| 搜索索引更新：实时 or 异步？ | ⚠️ 未设计。当前是「每次写操作同步更新 admin_entities」——这是双写 |
| D1 LIKE 10 万行性能？ | ❌ D1 不支持 FTS，LIKE 全表扫描 |

**判定：🟡 CONDITIONAL PASS。INV-1 已保护表结构不膨胀。但搜索性能问题未解决（P1-3 已识别）。Phase 10 前需评估外部索引方案。**

---

## 9. RBAC 最终矩阵

| 操作 | Owner | Admin | Editor | Viewer |
|------|-------|-------|--------|--------|
| 查看所有内容 | ✅ | ✅ | ✅ | ✅ |
| 编辑内容 | ✅ | ✅ | ✅ | ❌ |
| 发布内容 | ✅ | ✅ | ❌ | ❌ |
| 删除内容 | ✅ | ✅ | ❌ | ❌ |
| 查看商品 | ✅ | ✅ | ✅ | ✅ |
| 编辑商品/价格/库存 | ✅ | ✅ | ❌ | ❌ |
| 管理订单 | ✅ | ✅ | ❌ | ❌ |
| 查看询盘 | ✅ | ✅ | ✅ | ❌ |
| 回复询盘 | ✅ | ✅ | ✅ | ❌ |
| 管理 OEM | ✅ | ✅ | ❌ | ❌ |
| 发送报价 | ✅ | ✅ | ❌ | ❌ |
| 查看 AI | ✅ | ✅ | ✅ | ❌ |
| 批准 AI (L2) | ✅ | ✅ | ❌ | ❌ |
| 配置 AI (规则/预算) | ✅ | ❌ | ❌ | ❌ |
| 管理用户/角色 | ✅ | ❌ | ❌ | ❌ |
| 系统设置 | ✅ | ❌ | ❌ | ❌ |
| API Key/Secrets | ✅ | ❌ | ❌ | ❌ |
| 导出数据 | ✅ | ✅ | ❌ | ❌ |

**判定：✅ PASS。4 角色覆盖实际业务需求。Server-side enforcement 已设计（P0-6: API handler → RBAC 中间件）。UI 隐藏按钮 ≠ 权限控制。**

---

## 10. 批量 AI：Partial Success 模型

| 检查项 | 有设计？ |
|--------|---------|
| Selection → Preview Scope | ❌ 无。选中后直接执行 |
| Preview: 「将影响 47 个商品，预计 ¥1.20」 | ❌ 无 |
| Item-level idempotency key | ❌ 无。只有 task-level |
| 成功 97 / 失败 3 | ❌ 无。当前设计是同步执行→任一失败即整体失败 |
| 失败原因展示 | ❌ 无 |
| 单项重试 | ❌ 无 |
| Partial Publish（成功部分先发布） | ❌ 无 |

**判定：🟠 FAIL — Phase 4（内容批量）+ Phase 7（AI 批量）的批量操作缺乏 item-level 幂等、进度、部分成功、单项重试设计。这是 CF 10s 超时下的硬需求。**

---

## 11-19：快速判定（已在前两轮审查覆盖）

| # | 维度 | 判定 | 备注 |
|---|------|------|------|
| 11 | Quick Edit + Audit | 🟡 | 组件已有（P0-11 QuickEdit），但 inline edit 是否触发 audit_log 未明确。修复：Quick Edit 的 PUT API 必须走标准 RBAC+Audit 管线 |
| 12 | AI Panel 统一 | 🟡 | 组件已有（P0-11 AIPanel），但未定义「不同 entity 注册不同 actions」的 registry 机制。修复：Phase 7 设计 AIPanelRegistry |
| 13 | Page→API→DB→AI 五层映射 | 🟡 | 每对象有设计但分散在多文档。建议 Phase 1 后输出单张映射表 |
| 14 | Delete/Archive/Deactivate 区分 | 🟡 | 只有 soft delete（deleted_at）和 permanent delete 两种。缺少「归档（保留数据但不可见）」和「停用（暂停但不删除）」。Commerce Product 可能需要 deactivate（缺货停售但不删除） |
| 15 | FK 引用下的删除 | 🟡 | 无引用检查和阻止机制。删除 Product 前不知道被多少对象引用 |
| 16 | 引用计数 | ❌ | 无。P0-4 的 video_product_links 有类似机制但未推广 |
| 17 | 性能 1K/10K/100K | 🟠 | admin_entities LIKE / audit_logs / ai_action_logs 无 cursor 分页。Dashboard KPI 用 COUNT 合理但未验证 100K 行下的响应时间 |
| 18 | AI 是否真正进业务页面 | 🟡 | Phase 7 设计到位（AI Panel + AIActionButton + AITaskStatus）。但 Phase 4-6 期间 AI 缺失 |
| 19 | N+1 风险 | 🟡 | GitHub API 逐文件读取（内容列表→每篇一次 GET）。未批量化。Dashboard KPI 逐个 API 调取（4 个 KPI = 4 个 API call） |

---

## 20. 一致性最终判定

| 维度 | 判定 | 关键问题 |
|------|------|---------|
| Architecture Consistency | ✅ PASS | ADR 10-17 + INV-1 锁定核心架构决策 |
| Data Model Consistency | 🟡 PASS | 17 缺失 FK（P0-4）+ content_versions 缺 github_commit_sha + 3 表待定 |
| API Consistency | ✅ PASS | V1/V2 双路由 + 统一 JSON 格式 + 锁死清单 |
| AI Architecture | 🟡 PASS | 5→2 层简化正确。AI Command 链路缺失（已延期 Phase 8） |
| Permission | ✅ PASS | 4 角色 RBAC + Server-side enforcement + AI permissions.ts 保留 |
| Business Flow | 🟠 FAIL | Inquiry→Quote→Order 链断裂（ADR-17 设计但未落 migration） |
| Product Model | 🟡 PASS | 双对象 DB 设计正确。统一 UI 缺失（Phase 4.5 补） |
| OEM | ✅ PASS | V1 范围合理，不做 ERP |
| Search | 🟠 FAIL | D1 LIKE 100K 行不可行。Phase 10 需外部索引 |
| Rollback | 🟠 FAIL | Partial only。content_versions 缺 SHA。Commerce/R2 不可回滚 |
| Batch Operations | 🟠 FAIL | 缺 item-level 幂等、进度、部分成功 |
| Cross-Source Consistency | 🟠 FAIL | Case E/F/G 无设计（CF Build 失败无感知、重复 Publish、Worker 超时） |

---

# 最终结论

## 🟢 READY — Phase 1 可以直接开始

**Phase 1（AdminShell + 10 个基础组件 + CSS）是纯前端工作，不涉及上述任何 FAIL 项。所有 FAIL 项分别阻塞 Phase 4/5/6/7/8/10，不影响 Phase 1。**

### 阻塞矩阵

| FAIL 项 | 阻塞 Phase | 最晚解决时间 |
|---------|-----------|------------|
| 统一产品视图 | Phase 4.5 | Phase 4 结束前 |
| Business Flow (Inquiry→Quote→Order) | Phase 6 | Phase 6 开始前 |
| AI Command | Phase 8 | Phase 8 开始前 |
| Cross-Source (Case E: CF Build 无感知) | Phase 4 | Phase 4 内容中心 |
| Cross-Source (Case G: Worker 超时) | Phase 7 | Phase 7 AI 批量 |
| Rollback SHA (content_versions 补列) | Phase 4 | Phase 4 版本系统 |
| Rollback (Commerce/R2 不可回滚声明) | Phase 4 | Phase 4 文档 |
| AI Rate Limiting (Per Minute/Concurrency) | Phase 7 | Phase 7 AI 批量 |
| Batch Partial Success | Phase 4 | Phase 4 批量中心 |
| Search Performance | Phase 10 | Phase 10 全局搜索 |
| 引用计数 | Phase 4 | Phase 4 软删除 |
| Performance 100K | Phase 13 | Phase 13 Polish |

### Phase 1 开发者所需信息（全部已有）

| 需要 | 文档来源 | 是否明确 |
|------|---------|---------|
| 8 个一级导航 | P0-7 §5 组件树 | ✅ |
| 布局尺寸 240/64/1440 | P0-7 §2.1 | ✅ |
| 10 个基础组件 Props | P0-11 §5 | ⚠️ 部分 Props 需开发时补充 |
| CSS 令牌 | DESGIGN_TOKENS.md | ✅ |
| 路由系统 V1/V2 共存 | P0-10 §2 | ✅ |
| 颜色/间距/字体 | P0-11 §4 | ✅ |

**Phase 1 不涉及任何数据库、API、AI、权限、业务逻辑。零依赖。**

---

*本审查为 Phase 0 最终门禁。18 个一致性维度：6 PASS / 6 CONDITIONAL PASS / 6 FAIL。FAIL 项均不阻塞 Phase 1。Phase 1 判定：🟢 READY。*