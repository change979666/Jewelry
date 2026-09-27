# PHASE 4 DESIGN COMPLETION
## Gate 4 补齐设计：Unified Product View / 发布状态五态 / Batch item-level 幂等

日期：2026-08-29
状态：**DESIGN ONLY — 待人工批准。本文档不写业务代码、不创建 migration、不修改任何既有文档。**
依据（全部为封版材料 + 现有代码）：
- `V2_PHASE_PLAN.md §6`（Phase 4 范围）、`V2_DEVELOPMENT_GATES.md` Gate 4（前置检查与验收）
- `V2_MASTER_PLAN.md` Phase 4、`docs/v2-architecture/README.md` Phase 就绪状态表
- `V2_DATA_MIGRATION.md`（0052/0054/0055 DDL 与编号分配）、`Aromiso_CMS_V2_总体设计规范.md §5-7/§10`
- `V2_P0_FINAL_PRE_DEV_AUDIT.md` §4（Cross-Source Case E/F/G）、§5（Rollback SHA）、§10（Batch Partial Success）、§20 阻塞矩阵
- 现有代码：`functions/api/admin/save.ts`（V1 GitHub 发布链）、`functions/api/admin/faqs.ts`、`functions/api/admin/shared.ts`（ghGet/ghPut SHA 乐观锁）、迁移 0051（content_versions，已含 github_commit_sha）

**分层标注约定**（贯穿全文）：
- 【现有能力】= 今天就在生产运行的代码/机制，直接复用
- 【本阶段新增设计】= 本文档新增、待批准后在 Phase 4 实现
- 【后续实现】= 设计归属后面某个 Phase，本轮不动

---

## 0. 文档冲突与缺口清单（只指出，不自行裁决）

| # | 冲突/缺口 | 位置 | 影响 |
|---|---|---|---|
| X1 | **0052 copy_versions 无 DDL**：迁移清单表标记 ✅，但本文档来源 `V2_DATA_MIGRATION.md` 没有 `### 0052` DDL 章节；`V2_P0_DEEP_AUDIT.md` 也指出「有 version 号但无 restore API 设计」 | V2_DATA_MIGRATION.md L35 vs 全文 | Phase 4 文案资产版本依赖它。本文档 §4 给出**建议 DDL**（对齐 0051 模式），待批准 |
| X2 | **content_product_key 不存在**：总规范 §7 声明 Product Content ↔ Commerce Product 通过 `content_product_key` 关联，但全部 migrations / functions / src 中零命中 | 总规范 §7（L435-439） vs 代码 | Unified Product View 的关联基础缺失，见 §1.4 + DECISION A1 |
| X3 | **0054 目标表清单未定**：0054 DDL 写着「其他表在 Phase 0 P0-4 完成后确定精确清单」；P0-4（V2_DB_MAP_CURRENT）已完成但清单从未回填 | V2_DATA_MIGRATION.md L161-167 | Phase 4 实施前必须从 P0-4 裁定精确表清单；本文档 §5.2 给候选 |
| X4 | **迁移编号耗尽**：封版编号分配到 0064 为止；本设计若批准新增台账表，需要 0065+ 新编号，超出封版迁移列表（0052/0054/0055） | V2_DATA_MIGRATION.md 编号表 | 见 DECISION D1 |
| X5 | 0053 编号明确「保留但跳过（不使用）」 | V2_DATA_MIGRATION.md L178-182 | 新表不得使用 0053 |

---

# Part A — Unified Product View（STOP-01 补齐）

## A.1 页面定位

【本阶段新增设计】一个**只读聚合视图 + 编辑跳转入口**，不是新编辑器、不是新发布通道。

- 定位：总规范 §7 双对象模型（Product Content = 品牌展示/B2B 介绍/SEO 页面；Commerce Product = 现货/SKU/价格/物流）的「单一入口看全貌」页面，即 `V2_MASTER_PLAN.md` Phase 5 验收标准所写「统一产品视图（从一个入口看到 Product Content + Commerce + Copy + Media + SEO + AI）」。
- **实现归属：Phase 4.5**（Gate 4 PASS 后、Phase 5 前，与封版状态表一致）。Phase 4 代码范围**不含**本页面实现；Gate 4 的 STOP-01 检查要求的是「页面设计已完成」，本文档即该设计。

## A.2 数据来源与字段模型

| 数据块 | 来源 | 真源 | 现有能力 |
|---|---|---|---|
| 产品资料（Product Content） | `src/content/products/{key}.{locale}.md` | GitHub MD【现有能力】 | save.ts 读写、frontmatter 校验（title/excerpt/category/moq/leadTime/origin） |
| 现货商品（Commerce Product） | `commerce_products`（D1） | D1【现有能力】 | V1 商城 API（价格/阶梯价/MOQ/库存/封面/图集/视频/本地化状态） |
| 文案资产 | `copy_assets`（0055，Phase 4 建） | D1 | linked_entity_type='commerce_product' 关联 |
| 媒体 | R2 IMAGES + `video_assets`/`video_product_links` | R2 + D1【现有能力】 | V5.43 视频中心 |
| SEO | GSC `gsc_query_page`（只读展示） | D1【现有能力】 | V5.34 增长中心 |
| AI 建议 | growth_opportunities（只读，Phase 8 前仅展示） | D1 | 只读 |

列表字段模型（每行 = 1 个 Product Content key）：

```
缩略图 | 标题 | 三语状态（en/es/de 齐全度） | 关联现货数 | 文案资产数 |
视频状态 | SEO（近 28 天 impressions，可无数据显示 —） | 更新时间 | [打开编辑]
```

无数据的格子一律 `—/0/空态`（数据真实性红线，与 Phase 3 一致）。

## A.3 Product Content 与 GitHub MD 真源的关系

- **GitHub MD 永远是唯一真源**（ADR-11 方向不变）：统一视图的列表 = 扫描 `src/content/products/` 文件清单（构建期或 GitHub API 缓存），D1 只存聚合所需的只读索引（如需，见 A.6）。
- 统一视图**绝不反向写 GitHub**；所有写操作跳转回对应编辑器走各自发布链（内容 → §Part B 五态；商品 → D1 状态）。

## A.4 关联键（X2 的处置设计）

【本阶段新增设计】关联键 `content_product_key`：

- 语义：`commerce_products` 行 → 指向一个 Product Content 的 `key`（多对一：多个现货 SKU 可挂同一个产品资料页）。
- 存储选项见 **DECISION A1**。无论选哪种，关联只读展示 + 在商品编辑页维护，**不进入 Phase 4 代码**（随 Phase 4.5 实现）。

## A.5 列表/编辑/发布职责边界

| 职责 | 统一视图 | 说明 |
|---|---|---|
| 列表 | ✅ 聚合展示 | 服务端按调用者权限过滤数据块（见 A.7） |
| 编辑 | ❌ 不提供统一编辑器 | 跳转到：三栏内容编辑器（Phase 4）/ 商品编辑（Phase 5）/ 文案资产中心（Phase 4） |
| 发布 | ❌ 不提供统一发布按钮 | 每类对象走自己的发布链；避免与五态状态机冲突 |
| 删除 | ❌ | 各模块自行软删除 |

## A.6 与现有 5 类内容的关系

5 类内容中心（blog/products/guides/cases/faqs）的列表/编辑/发布职责**完全不变**；统一视图是叠加在「产品」这一个维度上的跨对象读视图。其余 4 类（博客/指南/案例/FAQ）不出现在统一视图中。

## A.7 权限与审计

- 服务端双闸：`content:view`（资料块）+ `commerce:view`（现货块）分别校验；缺某权限 → 该数据块返回 `{state:"NO_PERMISSION"}`，前端显示「无权限」空态（**服务端过滤，不靠前端隐藏**）。
- media/SEO/AI 块同样按 `media:view` / `growth:view` 门控。
- 审计：只读页面**不写** audit_logs（与 Dashboard 一致）。

---

# Part B — 发布状态五态（Cross-Source Case E/F 补齐）

## B.1 适用范围（沿用封版裁定，不扩大）

`V2_P0_FINAL_PRE_DEV_AUDIT.md` L106-121 已裁定：**五态仅适用于走 GitHub 发布管线的内容对象**：

| 对象 | 发布单元 | 真源路径 |
|---|---|---|
| blog / product_content / guide / case_study | (entity_type, entity_key, locale) | `src/content/{collection}/{key}.{locale}.md` |
| category_faqs | 整文件（三语同文件） | `src/data/category-faqs.json`（entity_key='category-faqs', locale='all'）【现有能力：faqs.ts】 |

Copy Asset / Video / Commerce Product / OEM **不套五态**（各有独立状态模型，封版裁定原话）。

## B.2 状态转换图

```
                    ┌────────────────────────────────────────────┐
                    │                publish 请求                 │
                    ▼                                            │
 Draft ──────────► Committing ──────────────────► Building ─────┼──► Deployed
   ▲               │  │                            │            │      │
   │  PUT 失败/校验失败 │  GitHub 409（SHA 冲突）      │ 构建失败/超时 │      │ 新的 publish
   └◄──────────────┘  └─► 重读最新 SHA 提示后重试      ▼            │      │
                                               BuildFailed ◄────┘      │
                                                    │   ▲              │
                                                    └───┴── 重试/重新发布 ┘
```

## B.3 进入/退出条件

| 状态 | 进入条件 | 退出条件 |
|---|---|---|
| Draft | 初始态；或 Committing 失败回退 | 发起 publish（通过 frontmatter 校验【现有能力：save.ts validateFrontmatter】+ 取得发布锁） |
| Committing | publish 记录创建，调用 GitHub Contents API | PUT 成功（返回新 commit SHA）→ Building；PUT 失败 → 回 Draft + 明确错误 |
| Building | GitHub commit 已创建，等待 CF Pages 自动构建【现有能力：push 即触发部署】 | 构建成功信号 → Deployed；构建失败信号 → BuildFailed；**超时 10 分钟无信号 → BuildFailed(reason=build_timeout)** |
| Deployed | 构建成功确认 | 该 (实体, locale) 的下一次 publish 创建时，旧记录保持 Deployed 作为历史，新记录开始流转（状态按发布记录，不按内容对象） |
| BuildFailed | 构建失败/超时 | 重试（同一内容重新进入 Committing，新记录 `retry_of` 指向失败记录） |

## B.4 GitHub commit / push 幂等键（验收标准「GitHub 发布 idempotency key 防重复 Publish」）

三层防重复：

1. **客户端防抖**：发布按钮提交后即禁用（现有 UI 模式）。
2. **KV 发布锁**【现有能力：DRAFTS namespace】：`pub:lock:{entity_type}:{entity_key}:{locale}` TTL 900s。锁存在 → **409 CONFLICT**「该语言版本正在发布中」。
3. **内容指纹去重**【本阶段新增设计】：`idempotency_key = SHA-256(entity_type | entity_key | locale | content_hash)`，其中 `content_hash = SHA-256(完整文件内容)`。相同指纹的进行中/最近（15 分钟内）发布记录存在时，直接返回该记录（200 + 既有 publish id），**不产生新 commit**。
4. GitHub 层【现有能力】：`ghPut` 携带 base SHA 乐观锁——并发写同一文件，第二个请求 409（防覆盖）。

## B.5 Cloudflare Build 如何关联一次发布（Case E：构建失败无感知）

关联键 = **GitHub commit SHA**（publish 记录创建时即写入）。构建结果信号来源（见 **DECISION B2**，推荐 ①）：

- **① GitHub commit status 轮询（推荐）**：仓库已接入 Cloudflare Pages GitHub App【现有能力】——每个 commit 会有 `Cloudflare Pages` check/status（success/failure）。用现有 `ADMIN_GITHUB_TOKEN` 读 `GET /repos/{owner}/{repo}/commits/{sha}/status`。**零新凭证、零新基础设施**。
- ② CF Pages Deployments API：`GET /accounts/{id}/pages/projects/{name}/deployments` 按触发信息匹配。需要 CLOUDFLARE_API_TOKEN 具备 Pages 读权限（AGENTS.md 记录该 token 权限有限，可能需 owner 在 CF 仪表板调整）。
- ③ 自建 Deploy Hook 回调端点：新增基础设施，违背「零新增」原则，不推荐。

**检测触发（零新 cron）**：
- 懒检测：打开内容列表/详情时，凡处于 Building 且 `updated_at` 超过 60s 的记录，服务端顺手查一次信号并更新状态；
- 超时兜底：任何读取发现 Building 超过 10 分钟 → 直接置 BuildFailed(build_timeout)。

## B.6 重试 / 超时 / BuildFailed 恢复

| 场景 | 处理 |
|---|---|
| Committing 失败（网络/校验） | 回 Draft，保留错误信息；用户修改后重新发布 |
| GitHub 409（SHA 冲突） | 提示「文件已被更新」，重读最新内容/SHA 后由用户再次确认发布（不自动覆盖） |
| BuildFailed（真实失败） | 列表红色状态 + 失败原因展示；「重新发布」= 新 publish 记录（`retry_of` 链），同一内容再走一遍五态 |
| BuildFailed（超时） | 同上；且先查一次真实状态避免误报（懒检测时若 check 已 success → 纠正为 Deployed） |
| 内容本身错误需回退 | 走回滚（B.8），不是重试 |

## B.7 并发发布

- 同一 (实体, locale)：KV 锁 + 活跃记录检查 → 第二个请求 409。
- 不同 locale 的同一内容：允许并行（独立发布单元，互不阻塞）。
- 不同实体：允许并行。
- 锁崩溃残留：TTL 900s 自动过期（与登录限流同一兜底哲学）。

## B.8 content_versions SHA 参与回滚

【现有能力】0051 `content_versions` 已有 `github_commit_sha` + `rollback_to_version_id`。

回滚流程【本阶段新增设计】：
1. 选定目标历史版本 v（取其 `github_commit_sha`）；
2. 通过 GitHub API 读取该 commit 时点的文件内容（ADR-11：body 走 GitHub，D1 只有 metadata）；
3. 以该内容发起一次 **`source='rollback'` 的新发布**——正常走五态（Committing→Building→Deployed）；
4. 写新 `content_versions` 行：`source='rollback'`、`rollback_to_version_id=v.id`、`github_commit_sha=新 commit`。

**不做 `git revert`**（内容文件可能被其他发布改过，revert 易冲突）；「读旧内容 → 写新 commit」语义清晰、与正向发布同一条链。回滚范围声明（审计要求）：五态与回滚**仅覆盖 GitHub 内容对象**；Commerce/R2 变更不可经此回滚（封版审计 §20 原话）。

## B.9 数据库字段需求（仅设计，不创建 migration）

发布台账【本阶段新增设计，存储方案见 DECISION B1】：

```
content_publishments（发布台账，一行 = 一次发布请求）
  id                 TEXT PRIMARY KEY
  entity_type        TEXT NOT NULL     -- 'blog'|'product_content'|'guide'|'case_study'|'category_faqs'
  entity_key         TEXT NOT NULL
  locale             TEXT NOT NULL     -- 'en'|'es'|'de'|'all'
  status             TEXT NOT NULL     -- 'committing'|'building'|'deployed'|'build_failed'
  content_hash       TEXT NOT NULL     -- 发布内容指纹（幂等去重）
  github_commit_sha  TEXT              -- Committing 成功后写入（= 构建关联键）
  build_signal       TEXT              -- 'pending'|'success'|'failure'|'timeout'
  attempt_count      INTEGER DEFAULT 1
  retry_of           TEXT              -- 重试链（指向被重试的发布记录 id）
  error_message      TEXT
  created_by         TEXT NOT NULL     -- V2 username
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP

索引：(entity_type, entity_key, locale, created_at DESC) — 「最新一次发布」查询
唯一性：无（幂等靠 content_hash + KV 锁，不靠 UNIQUE）
```

**内容当前状态 = 该 (实体, locale) 的最新一行**（内容对象在 GitHub 无 D1 行，不做冗余列；列表页按最新记录 JOIN 渲染五态徽章）。

每次发布同时写 `content_versions`（`source='publish'`，带 `github_commit_sha`）与 `audit_logs`（action='publish'）——复用现有中间件，不新增机制。

---

# Part C — Batch / Bulk item-level 幂等（Case G + Partial Success 补齐）

## C.1 设计目标（逐条对账审计 §10 的 7 个缺口）

| 审计缺口 | 本设计处置 |
|---|---|
| Selection → Preview Scope | 发布前强制 preview 步骤（C.4） |
| Preview 影响面展示 | preview API 返回 total + 抽样 + 预估（AI 类附成本预估，成本估算口径沿用 action-budget 模式【现有能力】） |
| Item-level idempotency key | `batch_items.idempotency_key` + UNIQUE + CAS 领取（C.3） |
| 成功 97 / 失败 3 | 每 item 独立状态，批次汇总计数（C.5） |
| 失败原因展示 | `batch_items.error_message` |
| 单项重试 | 单 item retry 端点（C.6） |
| Partial Publish | item 独立生效——成功即生效，天然支持（C.5） |

## C.2 对象模型（仅设计）

```
batch_jobs（批次，一行 = 一次批量操作）
  id            TEXT PRIMARY KEY        -- batch_id
  type          TEXT NOT NULL           -- 'content_publish'|'content_delete'|'content_translate'|...（Phase 4 先做 publish/delete）
  status        TEXT NOT NULL           -- 'pending'|'running'|'completed'|'completed_partial'|'failed'|'cancelled'
  total         INTEGER NOT NULL
  done_count    INTEGER DEFAULT 0       -- success+failed+skipped 汇总（冗余便于查询，真相在 items）
  params_json   TEXT                    -- 操作参数（不含敏感字段）
  created_by    TEXT NOT NULL
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  finished_at   DATETIME

batch_items（明细，一行 = 一个 item）
  id               TEXT PRIMARY KEY
  batch_id         TEXT NOT NULL REFERENCES batch_jobs(id)
  item_type        TEXT NOT NULL        -- 'blog'|'guide'|...
  item_id          TEXT NOT NULL        -- entity_key（内容）或行 id（D1 对象）
  locale           TEXT                 -- 内容类 item 的发布单元维度
  idempotency_key  TEXT NOT NULL        -- SHA-256(batch_id | item_type | item_id | locale)
  status           TEXT NOT NULL DEFAULT 'pending'
                   -- 'pending'|'running'|'success'|'failed'|'skipped'
  attempt_count    INTEGER DEFAULT 0
  error_message    TEXT
  started_at / finished_at  DATETIME
  UNIQUE(batch_id, idempotency_key)

索引：(batch_id, status)、(status) 孤儿扫描用
```

存储方案（D1 两表 vs KV 台账）见 **DECISION C1**。若 KV 方案：`batch:{batch_id}:meta` + `batch:{batch_id}:item:{idempotency_key}`，TTL 7 天，查询能力弱但零 migration。

## C.3 幂等键与防双执行

- `idempotency_key` 由服务端从 (batch, item) 恒等推导，**客户端不能提供/覆盖**（防注入，与权限红线一致）。
- item 领取用 CAS：`UPDATE batch_items SET status='running', started_at=? WHERE id=? AND status='pending'`，`changes=0` → 说明已被别的执行者领取/完成 → **跳过**（同一 item 永不被两个请求同时执行）。
- 重试不改 `idempotency_key`，只 `attempt_count+1` → 重复触发天然幂等。

## C.4 流程（含 Preview）

```
① POST /api/admin/v2/content/batch/preview
   { type, items:[{item_type,item_id,locale}] }
   → 服务端校验权限 + 逐项前置条件 → { total, valid, skipped:[原因], sample }
② POST /api/admin/v2/content/batch           （用户在 UI 确认后）
   → 创建 batch_jobs(pending) + 全部 batch_items(pending)；audit 一行（批次创建）
③ POST /api/admin/v2/content/batch/{id}/run  （前端循环调用，每次处理一个 chunk）
   → 服务端领取 ≤ chunk_size 个 pending item（CAS），逐个执行，写回状态
   → 返回 { processed, remaining, results:[...] }
④ remaining=0 → 服务端汇总 status：全成=completed / 有败=completed_partial / 全败=failed
   → audit 一行（批次结束，含计数）
```

**CF 10s 限制的拆分**：chunk 执行模型——每个 /run 请求只处理 `chunk_size`（默认 10，发布类涉及 GitHub 写可降至 5），单次请求预算内完成；前端串行驱动下一 chunk（V5.361 四阶段拆分 + V5.43 视频逐段上报的同构模式）。**不引入新 Worker、不引入队列基础设施。**

## C.5 部分成功与进度

- item 独立提交：成功的 item 立即生效（发布类 = GitHub commit 已产生），失败不影响已成功项 → Partial Publish 天然成立。
- 进度 = `COUNT(status IN success/failed/skipped) / total`，服务端 COUNT 为唯一真相；前端 2s 轮询 `GET /batch/{id}`。
- `skipped` 语义：preview 后用户剔除项 / 执行时发现前置条件已不满足（如内容已被他人删除）→ 记原因，不算失败。

## C.6 重试规则

| 层级 | 规则 |
|---|---|
| 单 item | `POST /batch/{id}/items/{item_id}/retry`：仅 `failed` 可重试；attempt+1，状态回 pending → 下个 chunk 执行 |
| 整批 | 「重试失败项」= 对所有 failed item 逐个执行单 item 重试（不提供「整批重跑」，避免重复执行已成功项） |
| 重试上限 | 单 item `attempt_count ≤ 3`，超限保持 failed + 提示人工 |

## C.7 中断与恢复

- **请求中断**（/run 被 10s 杀掉）：running 超 5 分钟的 item 视为孤儿 → 下一次 /run 开始前统一置 `failed(reason=execution_timeout)`（V5.415 孤儿任务恢复的同构规则）；用户可单项重试。
- **关页/断网**：批次在 D1（或 KV，按 C1）持久化；重新打开批次页 → 从剩余 pending/failed 继续，无需重建。
- **并发**：同一 batch 的 /run 可容忍并发（CAS 保证 item 不双执行）；批次本身无锁竞争问题。

## C.8 Audit 记录

- 批次创建 / 批次结束：各 1 行 `audit_logs`（action='create' / 'update'，resource_type='batch'，change_summary 含 `type + total/success/failed/skipped`）。
- **单 item 不额外写 batch 审计行**（量风险）；但每个 item 的业务操作本身走既有标准管线（发布写 publish audit、删除写 delete audit）——批次账本管「批」，业务审计管「件」，不重复。
- 禁止记录：密码/令牌/完整内容体（params_json 只存 id 列表与操作类型）。

## C.9 API 返回结构（V2 Envelope）

```
POST /api/admin/v2/content/batch/preview
  200 { success:true, data:{ total, valid, skipped:[{item_id,reason}], sample:[...] } }
POST /api/admin/v2/content/batch
  201 { success:true, data:{ batch_id, total } }
GET  /api/admin/v2/content/batch/{id}
  200 { success:true, data:{ id, type, status, progress:{ total, success, failed, skipped, running },
                             items:[{item_id, locale, status, attempt_count, error_message}] } }
POST /api/admin/v2/content/batch/{id}/run
  200 { success:true, data:{ processed, remaining, results:[{item_id, status, error?}] } }
POST /api/admin/v2/content/batch/{id}/items/{item_id}/retry
  200 { success:true, data:{ item_id, status:'pending' } }
错误：401 未登录 / 403 无权限 / 404 批次不存在 / 409 批次状态不允许该操作
```

## C.10 权限

- 批次类型 → 所需权限映射（服务端强制，先于一切数据操作）：`content_publish` → `content:publish`；`content_delete` → `content:delete`；`content_translate` → `content:edit`。
- 批量 = 逐个 item 复用单条操作的权限与业务校验，**不因批量而放宽**；不允许请求参数直接决定权限。

---

## 4. 0052 copy_versions 建议 DDL（补 X1 缺口，对齐 0051 模式，待批准）

```sql
CREATE TABLE copy_versions (
  id TEXT PRIMARY KEY,
  copy_asset_id TEXT NOT NULL,          -- → copy_assets.id
  version INTEGER NOT NULL,
  body_snapshot TEXT NOT NULL,          -- 文案短小，直接存正文（区别于内容走 GitHub）
  author TEXT NOT NULL,                 -- 'human:<username>' | 'ai:<role_name>'
  change_summary TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_copy_versions_asset ON copy_versions(copy_asset_id, version);
```

注：`V2_P0_DEEP_AUDIT.md` 指出的「历史版本恢复无 restore API」→ Phase 4 文案资产编辑器提供「查看历史」即可；「恢复」= 用旧 body 创建一次新编辑（不引入时间旅行机制）。**此 DDL 属设计建议，实际 migration 文件在 Phase 4 实施阶段按批准的编号创建。**

---

## 5. 与既有架构的复用总账

| 需求 | 复用的现有能力 |
|---|---|
| GitHub 写 + 防覆盖 | save.ts ghPut base-SHA 乐观锁 |
| 草稿 | DRAFTS KV（drafts 键） |
| 发布锁/幂等账本载体 | DRAFTS KV（与登录限流、吊销表同 namespace，零新增） |
| 构建信号 | Cloudflare Pages GitHub App commit status + ADMIN_GITHUB_TOKEN |
| 版本/回滚元数据 | content_versions（0051，SHA 已就位 → Rollback 检查 PASS） |
| 孤儿恢复/分阶段拆分/乐观锁 409 先例 | V5.415 / V5.361 / V5.42 已验证模式 |
| 审计 | logAction + audit_logs（0050） |
| 权限 | admin_permissions（0049）既有 content:* 权限行，**权限矩阵零变更** |

**零新增基础设施**：不新增 KV namespace、不新增 Worker/cron、不新增外部服务、不修改 V1。

---

## 6. DECISION REQUIRED（需 owner 产品决策，各附选项与影响）

### DECISION B1 — 发布台账存储
- **选项 ①（推荐）新建 `content_publishments` 表**（迁移编号见 D1）：关注点分离、可查询历史、与五态一一对应。影响：新增 1 个迁移（超出封版 0052/0054/0055 列表）。
- 选项 ② 扩展 `content_versions` 行（publish 行上加状态列）：零新表，但版本与发布两种关注点混在一张表，重试会产生版本噪音，且需给 0051 表加列（同样是 schema 变更）。

### DECISION B2 — 构建结果信号来源
- **选项 ①（推荐）GitHub commit status 轮询**：复用现有 token 与集成，零新基建；代价：懒检测（打开页面时才刷新），发布后不主动推送。
- 选项 ② CF Deployments API：更权威的 CF 侧状态；代价：需确认/提升 CLOUDFLARE_API_TOKEN 权限（owner 在 CF 仪表板操作）。
- 选项 ③ Deploy Hook + 自建回调端点：实时性最好；代价：新增端点与基础设施，违背本轮约束。

### DECISION C1 — 批量台账存储
- **选项 ①（推荐）D1 两表**（`batch_jobs` + `batch_items`）：可查询、可审计、断点恢复可靠。影响：新增迁移（见 D1）。
- 选项 ② KV 台账：零迁移、复用现有模式；代价：历史批次难查询、7 天 TTL 后无档案、进度统计靠键枚举（成本高）。

### DECISION A1 — content_product_key 存储（Phase 4.5 实施时生效）
- **选项 ①（推荐）`commerce_products` 加列 `content_product_key`**：与总规范 §7 字面一致、查询最直接。影响：一次 ALTER（归入 Phase 4.5/5 的迁移）。
- 选项 ② 独立关联表 `product_content_links(commerce_product_id, content_key)`：支持多对多扩展；代价：多一张表 + JOIN，当前业务只需多对一。

### DECISION D1 — 迁移编号（若 B1/C1 选 D1 方案）
- 封版编号只分配到 0064，且 0053 明确保留不用。新表需要 **0065（content_publishments）/ 0066（batch_jobs）/ 0067（batch_items）** 或 owner 指定的其他编号。
- 选项 ① 批准 0065-0067；选项 ② 复用 0052 同批（把新表并入 0052 一个文件多语句）；选项 ③ 其他编号方案。

---

## 7. Gate 4 重新审查

| 检查 | 结论 | 依据 |
|---|---|---|
| STOP-01 Unified Product View 页面设计已完成 | **PASS** | Part A 完成定位/数据模型/职责边界/权限设计；实现按封版归 Phase 4.5 |
| 发布状态五态已设计 | **PASS** | Part B 完成转换图/进出条件/幂等键/构建关联/重试超时/并发/回滚/字段设计（覆盖 Case E/F）；实施方案待 B1/B2 批准 |
| Rollback：content_versions 含 SHA | **PASS** | Phase 2 迁移 0051 已落地（本次推送已入库） |
| Batch item-level 幂等已设计 | **PASS** | Part C 完成 batch_id/item 状态/幂等键/重试/部分成功/进度/10s 拆分/中断恢复/审计/API 设计（覆盖 Case G + 审计 §10 全部 7 缺口）；存储方案待 C1 批准 |

**文档冲突**：X1–X5 已在 §0 列明，其中 X1 已附建议 DDL；X3（0054 精确表清单）须在 Phase 4 实施前从 V2_DB_MAP_CURRENT 回填确认，不属于本设计裁决范围。

---

## 8. 结论

Gate 4 四项检查全部 **PASS**（设计层面完备）。

**PHASE 4 READY FOR IMPLEMENTATION** — 附带前置条件：
1. DECISION B1 / B2 / C1 / A1 / D1 经 owner 批准（其中 B1×C1×D1 决定 Phase 4 迁移集合是「封版的 3 个」还是「3 + 最多 3 个新增」）；
2. X3 的 0054 精确表清单在实施前从 P0-4 确认。

批准后按 `V2_DEVELOPMENT_GATES.md` Gate 4 验收标准进入实施；本文档不产生任何代码、迁移或推送。
