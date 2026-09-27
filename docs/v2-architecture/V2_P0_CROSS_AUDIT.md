# V2 Phase 0 — 深度交叉审查报告
## Cross-Audit Findings

> 审查范围：14 份 V2_*.md 全部交叉对照
> 审查日期：2026-08-24
> 审查方法：逐项对照承诺、数字、命名、依赖关系，找出矛盾/遗漏/不一致

---

## 概览

| 类别 | 数量 |
|------|------|
| 🔴 矛盾（文档间互相冲突） | 2 |
| 🟠 缺口（V2 规范要求未落地） | 3 |
| 🟡 不一致（数字/命名不统一） | 3 |
| 🟢 已确认一致 | 7 |

**结论**：没有阻塞性问题，全部可修。修完后 P0 即可通过。

---

## 🔴 矛盾

### 1. 废弃表数量：P0-4 说 8 张，P0-8 说 7 张

**冲突点**：
- `V2_DB_MAP_CURRENT.md` §5-6 明确列出 **8 张**废弃表：`knowledge_base`, `daily_recs`, `experiments`, `ai_opportunities`, `ai_daily_briefs`, `ai_usage`, `ai_reports`, `decisions`
- `V2_MIGRATION_MAP.md` §3.4 说「V1 孤表（**7 张**）」
- `V2_MASTER_PLAN.md` §2.2 说「**7 张**疑似孤表」

**根因**：`V2_MASTER_PLAN` 写于 P0-4 完成之前，引用了旧审计 `CMS_AUDIT_DATABASE.md`（当时只标注了 2 张 likely orphaned + 笼统说 7 张）。P0-4 逐表分析后确认是 8 张。P0-8 直接从 MASTER_PLAN 抄了「7」。

**修复**：
- `V2_MIGRATION_MAP.md` §3.4：「7 张」→「8 张」，列出具体表名
- `V2_MASTER_PLAN.md` §2.2：「7 张疑似孤表」→「8 张废弃/被取代表（P0-4 核查确认）」

**影响**：低。只影响废弃决策的精确性。用户审查时需确认这 8 张是否真的可废弃。

---

### 2. 废弃表未出现在任何 V2 迁移或下线计划中

**冲突点**：
- P0-4 建议废弃 8 张表，但 P0-9（数据迁移策略）**没有为这 8 张表设计 DROP migration**
- P0-8（新旧对应）没有这 8 张表的下线计划
- P0-13（阶段计划）没有包含「废弃旧表」的任务

**根因**：P0-9 只设计了新增 migration（0049-0063），未设计清理 migration。废弃表是 DROP 操作，需要单独的 migration 编号。

**修复**：
- P0-9 追加 migration 0064：DROP 8 deprecated tables（附验证检查清单）
- 该 migration 放在 Phase 14（最终验证阶段），确保在废弃前确认无 API 仍读取
- P0-8 补上这 8 张表的「下线时机：Phase 14」

**影响**：中。不处理的话旧表永远留在数据库里，增加维护负担但不影响功能。

---

## 🟠 缺口（V2 规范要求未落地到设计）

### 3. V2 §36 统一对象层 `admin_entities` 表未出现在架构设计中

**缺口**：
- V2 规范 §36 明确要求：「新增统一对象层：`admin_entities`，记录 entity_type/entity_id/source/status/owner/updated_at」
- P0-7（目标架构）和 P0-9（数据迁移）**都未包含此表**
- P0-7 只有 `entity_links`（0059），用于关系映射，但这不是 §36 的 `admin_entities`
- `V2_MASTER_PLAN` 的兼容层数据流图中提到了 `admin_entities`，但后续设计文档都丢失了它

**`admin_entities` vs `entity_links` 的区别**：
| | admin_entities (V2 §36) | entity_links (已设计) |
|---|---|---|
| 用途 | 统一对象注册表（每行=一个业务对象） | 对象间关系表（每行=一个关联边） |
| 字段 | entity_type, entity_id, source, status, owner, updated_at | entity_type_a, entity_id_a, entity_type_b, entity_id_b |
| 查询 | 「这个对象存在吗？状态是什么？谁负责？」 | 「A 关联了哪些 B？」 |
| 示例 | blog-essential-oil-guide → source:github, status:published | blog-X → product-Y, product-Y → video-Z |

两者是互补的，不是替代关系。

**修复**：
- P0-7 在数据库扩展中追加 `admin_entities` 表
- P0-9 追加 migration 0065：`admin_entities`（放在 Phase 2-3 之间，早期建立对象注册）
- P0-13 Phase 2 或 Phase 3 补充此 migration

**影响**：中高。这直接关系到 V2 规范要求的「统一对象层」是否真正实现。没有它，Dashboard 的「可以点、可以查」的跨模块 KPI 就需要 join 多张表，数据源不可靠。

---

### 4. 文案资产中心未被充分建模

**缺口**：
- V2 规范 §10 定义了完整的文案资产中心：13 个分类（产品标题/卖点/描述/SEO Title/SEO Description/广告文案/社交媒体/视频标题/视频描述/FAQ/CTA/OEM 文案/邮件模板），每条含名称/类型/语言/关联对象/版本/创建者/AI人工/状态/更新时间，支持 AI 重写、版本对比、关联对象
- P0-9 只有一张 `copy_assets` 表（0055），表中字段设计未展开
- P0-7 提到了「文案资产中心」但未展开数据模型
- P0-11 未设计文案资产管理专用组件（如 CopyAssetCard, CopyVersionCompare）

**修复**：
- P0-9 展开 `copy_assets` 表的完整字段设计（至少：name/type/locale/linked_entity_type/linked_entity_id/current_body/status/created_by_source/created_at/updated_at）
- P0-11 追加 `CopyAssetCard` 和 `CopyVersionCompare` 组件到 form/ 或内容专区

**影响**：中。当前设计方向正确但细节不足，开发 Phase 4 时会遇到「表建了但不知道字段该有什么」。

---

### 5. 「全局 Command Bar / AI 快捷操作」未设计

**缺口**：
- 你在审查中建议：「Ctrl+K → 搜索 + AI 快捷操作 → 直接输入自然语言指令」
- P0-7 的 Topbar 只设计了 GlobalSearch（Cmd+K），但只做对象搜索
- 未设计 AI 自然语言命令解析（如「找出最近 30 天流量下降最大的 5 个产品」）
- P0-11 的 GlobalSearch 组件也未包含 AI Command 模式

**修复**：
- P0-7 Topbar 设计补充：GlobalSearch 支持双模式——① 对象搜索（现有）② AI 命令（`>` 或 `/ai` 前缀触发）
- P0-11 补充 CommandBar 组件设计（或扩展现有 SearchBox）
- 这可以作为 Phase 7 的 AI Command 子功能，暂不要求 Phase 1 实现

**影响**：低（这是增强功能，V2 核心不依赖它）。但如果不设计，后期加进来可能需要改 Topbar 架构。

---

## 🟡 不一致（数字/命名/细节不统一）

### 6. P0-4 「待定」3 张表未被下游文档引用

P0-4 将 `email_messages`, `gsc_query_page`, `growth_actions` 标记为「待定——需 API usage audit 确认活跃状态」。但：
- P0-8 只说了「7 张疑似孤表」（现需改为 8），未提这 3 张待定
- P0-9 未设计这 3 张表的迁移方案（如果 `growth_actions` 要保留并加列呢？）

**修复**：P0-8 补上「待确认 3 张表」的说明。P0-9 不要求现在设计 migration（因为 pending），但需注明「Phase 0 结束后核查后决定」。

---

### 7. 通知系统 Phase 10 太晚，Phase 4 开始就需要

**不一致**：
- P0-13 将通知中心放在 Phase 10（依赖 Phase 3-9 的事件源）
- 但 Phase 4-6 就会产生需要通知的事件（新询盘、AI 完成、商品发布等）
- 如果在 Phase 10 才做通知，Phase 4-9 期间的 AI 操作完成和询盘到达用户都看不到

**修复**：不是移 Phase（基础设施在 Phase 2-3 还不够），而是在 Phase 4-6 的每个业务模块中暂时用 Toast（已有组件）做即时反馈，Phase 10 再升级为持久通知中心 + 铃铛未读计数。P0-13 Phase 4-6 验收标准中补充「关键操作有 Toast 即时反馈」。

---

### 8. Phase 7「AI 融入业务页面」的时序矛盾

**不一致**：
- P0-13 将 AI Integration 放在 Phase 7，依赖 Phase 3-6 完成
- 这意味着 Phase 4-6 开发的业务页面（内容/商品/客户/OEM）**不带 AI Panel**
- Phase 7 需要回过头给 Phase 4-6 的页面逐一加 AI Panel

**修复**：
- Phase 4-6 开发时在每个业务页面预留 AI Panel 插槽（`<div id="ai-panel-slot" />`），Phase 7 填充
- 这不改变 Phase 顺序，但要求 Phase 4-6 的页面设计留好扩展点
- P0-13 每个 Phase 4-6 的验收标准补充「AI Panel 插槽预留」

**影响**：中。不预留的话 Phase 7 需要大改已完成页面。

---

## 🟢 已确认一致（7 项无需修改）

| # | 检查项 | 结果 |
|---|--------|------|
| 1 | Migration 编号 0049-0063 在 P0-7 / P0-9 / P0-13 间一致 | ✅ 15 张 migration，编号无冲突 |
| 2 | Before/After/Diff/Rollback 在 P0-5 / P0-7 / P0-11 / P0-13 间覆盖完整 | ✅ DiffViewer+AIPanel+rollback API+content_versions |
| 3 | 46 组件设计 — P0-7 组件树 ≈ P0-11 组件目录 | ✅ 基本对齐，细微差异（P0-7 多了几个分析组件） |
| 4 | API 锁死清单 50 端点 — P0-10 vs P0-3 | ✅ P0-3 确认全部有 auth，P0-10 全锁 |
| 5 | V2 新 API 路径 `/api/admin/v2/` 在各文档一致 | ✅ P0-7/P0-8/P0-10/P0-13 全部使用此前缀 |
| 6 | 14 Phase 依赖链在 P0-13 中无循环依赖 | ✅ |
| 7 | OEM 6 表（0057-0058）在 P0-7/P0-9 一致 | ✅ oem_projects/requirements/samples/quotes/files/timeline |

---

## 修复优先级建议

| 优先级 | 问题 | 修复工作量 |
|--------|------|-----------|
| **立即** | #1 废弃表数量 7→8（P0-8 + MASTER_PLAN） | 2 处文字修改 |
| **立即** | #6 待定 3 表在 P0-8 中补说明 | 1 处补充 |
| **审前** | #3 `admin_entities` 表补充设计 | P0-7 + P0-9 各加一段 |
| **审前** | #4 `copy_assets` 字段展开 | P0-9 补充表结构 |
| **审前** | #2 8 废弃表下线 migration 补充 | P0-9 追加 0064 |
| **审前** | #8 AI Panel 插槽预留说明 | P0-13 Phase 4-6 验收标准各加一条 |
| **可延后** | #5 Command Bar（自然语言AI命令） | P0-7 + P0-11 补充设计 |
| **可延后** | #7 通知系统时序 | P0-13 Phase 4-6 补「Toast 即时反馈」 |

---

## 总结

**14 份文档整体质量高，技术方向正确，核心审计扎实。**

发现的问题：
- 2 个矛盾（废弃表数量、废弃表无下线计划）—— 都是 P0-4 完成后其他文档未同步更新
- 3 个缺口（admin_entities 缺失、cop_assets 字段不足、Command Bar 未设计）—— 其中前两个影响 V2 规范落地
- 3 个不一致（待定表遗漏、通知时序、AI Panel 时序）—— 都是跨 Phase 的协调问题

**全部可修，无阻塞性问题。修正后 P0 即可通过进入 Phase 1。**

---

*本审查基于 14 份 V2_*.md 文件逐项交叉核对。未做猜测。*