> **入库说明（V5.33，2026-08-15）**：本文是 Aromiso Composable Agent OS 的架构蓝图，owner 指令按其执行。
> **已落地（Phase 1）**：Fact Authority Layer（`functions/lib/fact-registry.json` + `functions/lib/truthfulness.ts` 真实性硬闸门，接入 Content Factory）、Model Router 预备层（`functions/lib/model-router.ts`，默认关）、Skill 固化（`docs/skills/buyer-decision/`、`docs/skills/compliance/truthfulness/`）。
> **未落地部分一律以本文 §34/§35 的冻结清单为准**：不做 Buyer Agent、不建 Plugin Registry 表、不注入 Analyst Prompt、不全站自动审计、不允许 AI 自我修改生产 Prompt；升级须数据证明 + owner 明确指令。
> **Owner 2026-08-15 复审裁决（V5.33 定稿）**：V5.33 是 Aromiso 从「多个 AI 功能」迈向「可组合 AI 操作系统」的第一版——AI 能力层（Skill / Tool / Knowledge / Policy / Fact Authority / Model Router）与业务角色层（Analyst / Content Writer / Strategist）正式解耦；以后新增能力优先「新增 Skill/Tool/Policy 让已有角色组合」，而不是新增 Agent。**当下不继续开发，进入观察期**（观察协议与 5 指标见 `docs/BACKLOG.md` §九）；Phase 2 形态（升级 Skill / 四层 Memory / 打开 Model Router / 引入 Harness Runtime / 不开发）由业务数据决定——让业务结果决定架构，而不是让新技术决定架构。
> **人机分工总原则（架构公理，任何 Phase 不得突破）**：AI owns information preparation. Human owns commercial relationship.——AI 负责信息准备与决策支持（客户背景分析、关注点判断、资料与证据整理、FAQ、缺失信息提醒、Email/WhatsApp 草稿生成），**聊客户、发不发、价格/MOQ/交期/付款谈判、客户关系与成交永远由 owner 掌控**。

# Aromiso AI Agent Architecture Upgrade — DeepSeek Harness / Plugin Architecture 研究与落地方案

**版本：V1.0 Research & Architecture Blueprint**  
**日期：2026-08-15**  
**状态：研究文档 / 不代表立即改造生产系统**  
**项目：Aromiso OS 2.0**

---

## 0. 执行摘要

这次研究的核心结论不是「把 DeepSeek 接进 Aromiso」，而是：

> **DeepSeek Harness 应被视为 Aromiso 重新设计 Agent Runtime 的一个参考架构，而不是当前生产系统的直接替代品。**

Aromiso 目前已经具备一套自己的 AI OS：

- Analyst
- Librarian / Knowledge
- Strategist
- Executor
- Auditor
- 商品文案师
- 翻译官
- Task Engine
- Knowledge / D1 / R2
- AI Feedback
- Outcome 验证
- Role Center / Prompt Version
- Content Factory

现有系统已经不是「一个 Prompt 调一个模型」，而是一个带有角色、任务、知识、反馈和结果验证的 AI 运营闭环。

真正值得从 Harness 借鉴的是：

**把「角色能力」进一步拆成可组合的 Skill / Tool / Connector / Workflow / Memory / Policy，而不是继续无限增加 Agent 角色。**

因此，未来 Aromiso 更理想的结构不是：

```text
Analyst
Strategist
Executor
Content Writer
Buyer Agent
Sales Agent
...
```

无限增加角色。

而应该逐渐演化成：

```text
                    Aromiso AI OS
                         │
                ┌────────┴────────┐
                │  Agent Runtime  │
                └────────┬────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
       Roles          Skills          Tools
          │              │              │
     Analyst        SEO Audit       GSC
     Strategist     BDF Audit       GA
     Librarian      Product Audit   D1
     Executor       Compliance      R2
     Content        Content         GitHub
     Translator     Translation     Email
          │              │              │
          └──────────────┼──────────────┘
                         │
                  Knowledge / Memory
                  D1 + R2 + Feedback
                         │
                   Policy / Gates
                Truthfulness First
```

**核心升级方向：**

> 从「多角色 AI」升级成「多角色 + 可组合能力插件 + 工具权限 + 记忆 + 工作流 + 安全闸门」的 Agent OS。

---

# 1. DeepSeek Harness 到底给 Aromiso 带来了什么？

DeepSeek 生态目前已经形成了一个明显趋势：DeepSeek V4-Pro / V4-Flash 被大量接入各种 Agent Harness、Coding Agent、MCP、Skills 和插件体系。

DeepSeek 官方维护的 `awesome-deepseek-agent` 已经收录大量 Agent / Coding 工具，包括 OpenCode、Pi、DeepSeek-TUI、Hermes、LobeHub、OpenClaw、Qwen Code、WorkBuddy/CodeBuddy 等。

其中值得注意的不是「某一个工具」，而是共同出现的能力：

1. Skills
2. MCP
3. Plugins
4. Hooks
5. Sub-agents
6. Session
7. Tool permissions
8. Sandbox
9. Workflow
10. Runtime API
11. Persistent memory
12. Self-improvement

这意味着 Agent 的能力边界正在从：

```text
Prompt
+
Model
```

变成：

```text
Model
+
Harness
+
Tools
+
Skills
+
Memory
+
Runtime
+
Policy
+
Workflow
```

这对 Aromiso 的意义非常大。

---

# 2. 先纠正一个概念：Harness ≠ 模型

最重要的理解：

```text
DeepSeek V4 Pro
        ↓
      Model
        ↓
     Harness
        ↓
┌───────┼────────┐
Tools  Skills   Memory
  │       │        │
GSC     SEO      Knowledge
GitHub  BDF      Feedback
R2      Product  History
D1      Content  Outcome
```

模型决定：

> 「能不能想明白」

Harness 决定：

> 「能不能持续地做完事情」

所以如果 Aromiso 只是把：

```text
当前模型 → DeepSeek V4 Pro
```

那么提升可能有限。

真正值得研究的是：

```text
当前 Aromiso OS
        ↓
Agent Runtime Upgrade
        ↓
Role + Skill + Tool + Memory + Policy
```

---

# 3. Aromiso 当前架构与 Harness 架构对照

| 维度 | Aromiso 当前 | Harness 思路 | 未来方向 |
|---|---|---|---|
| Model | DeepSeek / 其他模型 | Model Provider | 保持多模型 |
| Role | ai_roles | Agent | 保留 |
| Prompt | Role Prompt | Skill / System | 逐步 Skill 化 |
| Tool | functions/lib | Tools / MCP | 工具注册化 |
| Knowledge | D1 + R2 | Memory / Context | 统一 Context Layer |
| Task | Task Engine | Workflow / Agent Loop | 增强 |
| Feedback | ai_feedback | Learning Loop | 保留 |
| Outcome | Outcome 验证 | Evaluation | 强化 |
| 权限 | 现有后端控制 | Permission / Sandbox | 强化 |
| 扩展 | 改代码 | Plugin / Skill | 未来插件化 |
| Sub-agent | 当前较弱 | 原生支持 | L2/L3 |
| Session | Task 为主 | Session | 未来增加 |
| 自我扩展 | 无 | Skill/Plugin | 暂不开放生产权限 |

---

# 4. Aromiso 最大的升级机会

不是增加更多 Agent。

而是：

## 「Agent 能力组件化」

现在：

```text
Analyst
  └── Prompt
      └── GSC
      └── GA
      └── Knowledge
```

未来：

```text
Analyst
  │
  ├── Skill: SEO Analysis
  ├── Skill: Buyer Decision Audit
  ├── Skill: Product Audit
  ├── Skill: Opportunity Detection
  │
  ├── Tool: GSC
  ├── Tool: GA
  ├── Tool: Product DB
  ├── Tool: Knowledge
  │
  └── Policy: Truthfulness First
```

Analyst 不再需要知道所有能力的具体实现。

它只需要知道：

> 我现在有哪些能力可以调用？

---

# 5. 多角色模型应该如何升级？

## 5.1 当前模型

现在更接近：

```text
Role
 ↓
Prompt
 ↓
Knowledge
 ↓
Model
 ↓
Output
```

建议未来升级为：

```text
Role
 ↓
Role Policy
 ↓
Available Skills
 ↓
Available Tools
 ↓
Knowledge Context
 ↓
Task Context
 ↓
Model
 ↓
Tool Calls
 ↓
Observation
 ↓
Decision
 ↓
Action
 ↓
Validation
 ↓
Knowledge
```

这就是一次真正的 Agent Loop。

---

# 6. 五个现有角色如何升级

## 6.1 Analyst

### 当前

负责：

- GSC
- GA
- SEO observation
- 异常
- 机会

### 未来

升级成：

> **Research & Diagnosis Agent**

可组合：

```text
SEO Skill
Buyer Decision Skill
Product Audit Skill
Competitor Analysis Skill
Analytics Skill
Knowledge Retrieval Skill
```

它不一定自动执行。

它的主要职责仍然是：

> 发现问题 → 判断价值 → 输出 Observation。

---

# 7. Librarian

当前 Librarian 已经是 Aromiso 最重要的基础设施之一。

已有：

- Knowledge
- Feedback
- 去重
- Outcome
- Validated / Deprecated

这实际上已经接近：

> Memory Agent

未来应该升级为：

```text
Memory Manager
│
├── Retrieve
├── Deduplicate
├── Summarize
├── Classify
├── Validate
├── Expire
└── Promote
```

知识等级可以继续：

```text
observation
preference
principle
validated
deprecated
```

不要让 AI 随便修改 `validated`。

---

# 8. Strategist

未来不是：

> AI 想到什么就创建任务。

而是：

```text
Observation
      ↓
Evidence
      ↓
Impact
      ↓
Confidence
      ↓
Priority
      ↓
Recommended Action
```

Strategist 应成为：

> Decision Agent

它决定：

- 做不做
- 为什么
- 优先级
- 风险
- 预期结果
- 验证方法

---

# 9. Executor

Executor 最适合 Harness 化。

因为它天然需要：

```text
Tool
+
Permission
+
Workflow
+
Verification
```

例如：

```text
Executor
 ↓
GitHub Tool
 ↓
修改文件
 ↓
Build
 ↓
Test
 ↓
Diff
 ↓
Validation
 ↓
提交/发布
```

以后 Executor 可以拥有：

```text
read-only
workspace-write
publish
```

三种权限。

绝对不要默认 Full Access。

---

# 10. Content Factory

Content Factory 不应该继续单纯依赖：

```text
Prompt → Blog
```

而应该：

```text
Content Role
    +
Content Skill
    +
Knowledge
    +
SEO Skill
    +
Truthfulness Policy
    +
Product Context
    ↓
Draft
    ↓
Validator
    ↓
Human Review
    ↓
Publish
```

这会显著降低：

- 编造案例
- 编造认证
- 过度承诺
- 产品事实漂移

---

# 11. Buyer Decision Framework 应该成为 Skill，而不是 Agent

这是本项目最重要的结论之一。

不要：

```text
Buyer Agent
```

而是：

```text
Buyer Decision Skill
```

任何角色都可以调用：

```text
Analyst
Strategist
Product Auditor
Content Writer
```

例如：

```text
Analyst
  ↓
发现某 PDP 转化异常
  ↓
调用 Buyer Decision Skill
  ↓
输出：
✅ ⚠️ ❌
三层需求
订单铁三角
Decision Chain
Missing Evidence
最小改动
```

这样 BDF 不需要独立运行时。

这与目前的手工验证策略完全兼容。

---

# 12. Truthfulness First 必须成为 Runtime Policy

不能只是 Prompt。

未来应该：

```text
Policy Layer
     ↓
Truthfulness First
     ↓
所有 Agent / Skill / Tool
```

例如任何 AI 想写：

```text
ISO certified
IFRA certified
Every shipment includes GC-MS
3-5 day delivery
3000 MOQ
```

系统应该要求：

```text
Fact Registry
     ↓
Verified?
     ↓
YES → 可以使用
NO  → Missing Evidence
```

而不是：

```text
模型觉得合理
↓
写出去
```

---

# 13. 未来的事实系统

建议最终形成：

```text
SUPPLY_CHAIN_CAPABILITIES.md
             +
Verified Facts
             +
Product Facts
             +
Case Studies
             +
Certification Registry
             +
Document Registry
             ↓
      Fact Authority Layer
```

所有 Agent 都只能从这里拿：

> 「可信事实」

而不是让每个 Agent 自己判断。

---

# 14. Skill 应该怎么设计？

一个 Skill 不应该只是 Prompt。

推荐结构：

```text
skills/
  buyer-decision/
    SKILL.md
    rules.md
    input-schema.json
    output-schema.json
    validators.ts
    examples/
```

例如：

```text
buyer-decision/
├── SKILL.md
├── rules.md
├── coverage.schema.json
├── truthfulness.rules.json
├── validators.ts
└── examples/
```

---

# 15. Aromiso 可以拥有的 Skill 类型

第一阶段只设计，不全部开发：

### Research

- SEO Analysis
- GSC Analysis
- GA Analysis
- Competitor Analysis

### Commerce

- Product Audit
- Product Import
- Pricing Audit
- SKU Audit

### Buyer

- Buyer Decision Audit
- Inquiry Quality Audit
- Decision Chain Audit

### Content

- Blog Planning
- SEO Content
- Product Copy
- Translation
- FAQ

### Compliance

- Truthfulness Check
- Certification Check
- Claims Check
- Document Availability Check

### Operations

- Task Planning
- Task Verification
- Outcome Analysis
- Knowledge Distillation

---

# 16. Tools 应该和 Skills 分离

这是一个非常关键的架构原则。

### Skill

告诉 AI：

> 怎么做。

### Tool

告诉 AI：

> 可以做什么。

例如：

```text
Buyer Decision Skill
```

可以调用：

```text
get_product()
get_faq()
get_cases()
get_supply_chain_facts()
get_documents()
```

而不是 Skill 自己直接访问数据库。

这样未来换数据库、换 API 都不用重写 Skill。

---

# 17. MCP 在 Aromiso 中的价值

MCP 非常适合成为：

> Tool Gateway

例如：

```text
Aromiso MCP
│
├── product.get
├── product.search
├── faq.search
├── knowledge.search
├── knowledge.write
├── gsc.query
├── ga.query
├── github.diff
├── github.commit
├── r2.read
└── inquiry.read
```

然后：

```text
任何 Agent
     ↓
MCP
     ↓
Aromiso Tools
```

这会让未来接：

- DeepSeek
- GPT
- Claude
- Qwen
- Codex
- 其他 Agent

变得简单很多。

---

# 18. 为什么这比「换模型」更重要？

假设：

```text
GPT + 旧架构
```

和：

```text
DeepSeek + 旧架构
```

比较。

这只是模型比较。

但：

```text
GPT + Harness
DeepSeek + Harness
Qwen + Harness
Claude + Harness
```

才是：

> Agent Runtime 比较。

真正应该沉淀的是：

```text
Aromiso Skills
Aromiso Tools
Aromiso Memory
Aromiso Policies
Aromiso Workflows
```

模型变成可替换组件。

---

# 19. 多模型路由

未来建议：

```text
                   Model Router
                       │
        ┌──────────────┼──────────────┐
        │              │              │
     Flash          Pro          Premium
        │              │              │
   简单任务        深度推理        高风险任务
```

例如：

| 工作 | 模型 |
|---|---|
| 翻译 | Flash |
| 分类 | Flash |
| 去重 | Flash |
| SEO 初筛 | Flash |
| 产品字段提取 | Flash |
| Buyer Audit | Pro |
| 复杂战略分析 | Pro |
| Truthfulness Review | Pro |
| 代码修改 | Pro / Codex |
| 最终高风险审核 | 更强模型 + 人工 |

这样成本会比：

> 所有任务都用最强模型

合理得多。

---

# 20. Harness 的 Cache 思路值得借鉴

公开的 DeepSeek Harness 实现记录了多轮 tool-use 时的协议处理、reasoning_content 保留、token 上限、tool call 聚合以及 prefix cache 等工程问题。

其中尤其值得 Aromiso 注意的是：

> **稳定的系统 Prompt / Skill / Policy 可以作为稳定前缀；动态数据不要污染缓存前缀。**

未来可以设计：

```text
Stable Prefix
├── Role
├── Policy
├── Skill
├── Schema
└── Static Knowledge

Dynamic Context
├── GSC
├── GA
├── Product
├── Current Task
└── Latest Feedback
```

这样更适合长期运行。

---

# 21. Sub-agent 对 Aromiso 的意义

未来可以出现：

```text
Strategist
     ↓
Research Agent
     ├── SEO
     ├── Product
     └── Buyer

     ↓
Verifier Agent

     ↓
Executor
```

但：

> **现在不要开发。**

因为目前 Aromiso 正处于观察期。

Sub-agent 是 L2/L3 能力。

---

# 22. Self-improving Agent 应该怎么做？

这里可以借鉴 Hermes 类 Agent 的思路，但不能直接复制「AI 自己改自己」。

Aromiso 应该：

```text
Experience
   ↓
Feedback
   ↓
Knowledge
   ↓
Validated
   ↓
Skill improvement proposal
   ↓
Human approval
   ↓
Skill version
```

而不是：

```text
AI
 ↓
发现自己不够好
 ↓
修改自己的 Prompt
 ↓
自动上线
```

后者风险太高。

---

# 23. Aromiso 的「自进化」正确方式

最终：

```text
Agent
 ↓
Action
 ↓
Outcome
 ↓
Feedback
 ↓
Learning
 ↓
Proposal
 ↓
Human Approval
 ↓
New Skill Version
```

这实际上比「AI 自己改自己」更适合商业系统。

---

# 24. 云端部署是否可行？

## 可以。

但需要区分两种东西。

### A. DeepSeek Harness 本身

很多公开 Harness 是：

```text
Python
Node.js
MCP
CLI
```

可以部署到 VPS / Docker / 云服务器。

### B. Aromiso 当前 Cloudflare Pages

Aromiso 当前是：

```text
Astro
+
Cloudflare Pages
+
Functions
+
D1
+
KV
+
R2
+
GitHub
```

这种环境非常适合：

```text
轻量 Tool
API
Webhook
Task
MCP Gateway
```

但不适合把完整：

```text
长时间运行 Agent Runtime
Shell
Sandbox
大型 CLI
```

直接塞进 Pages Function。

---

# 25. 推荐未来架构

不要：

```text
Cloudflare Pages
    ↓
直接运行完整 Harness
```

建议：

```text
                  Aromiso.com
                      │
                Cloudflare
                      │
              ┌───────┴───────┐
              │               │
          Web / CMS       Agent API
                              │
                       Agent Runtime
                              │
                 ┌────────────┼────────────┐
                 │            │            │
               Roles        Skills        Tools
                 │            │            │
                 └────────────┼────────────┘
                              │
                         Model Router
                              │
                 ┌────────────┼────────────┐
                 │            │            │
              DeepSeek       GPT         Qwen

                      ┌──────────────┐
                      │ Aromiso Data │
                      ├──────────────┤
                      │ D1           │
                      │ KV           │
                      │ R2           │
                      │ GitHub       │
                      │ GSC / GA     │
                      └──────────────┘
```

---

# 26. 插件部署模式

未来插件可以有三种级别。

## Level 1：纯 Skill

例如：

```text
Buyer Decision Skill
SEO Skill
Translation Skill
```

只包含：

```text
Markdown
JSON Schema
Rules
Examples
```

最安全。

---

## Level 2：Tool Plugin

例如：

```text
GSC Tool
Product Tool
Knowledge Tool
GitHub Tool
```

具有 API 权限。

---

## Level 3：Executable Plugin

例如：

```text
Browser automation
Shell
Image processing
Data scraping
Complex ETL
```

具有执行能力。

**Level 3 必须严格权限控制。**

---

# 27. 权限系统

强烈建议未来采用：

```text
READ
WRITE
PUBLISH
ADMIN
```

而不是简单：

```text
ON / OFF
```

例如：

### Analyst

```text
READ:
GSC
GA
D1
R2

WRITE:
knowledge.observation

PUBLISH:
NO
```

### Strategist

```text
READ:
knowledge
analytics

WRITE:
tasks
decisions

PUBLISH:
NO
```

### Executor

```text
READ:
all required

WRITE:
approved scope

PUBLISH:
approved files only
```

这样 Agent 越强，反而越可控。

---

# 28. Plugin Registry

未来可以建立：

```text
ai_plugins
```

逻辑上包含：

```text
plugin_id
name
version
type
description
permissions
enabled
allowed_roles
config
health
created_at
updated_at
```

例如：

```text
buyer-decision
seo-audit
product-audit
gsc
ga
github
r2
knowledge
```

但：

> **现在不需要创建这张表。**

先验证 Skill 是否真的需要动态加载。

---

# 29. 为什么现在不要直接做 Plugin System？

因为目前：

```text
Buyer Decision Framework
```

才刚完成：

> 手工验证。

我们已经证明：

> 规则能发现传统 SEO Audit 看不到的采购决策缺口。

但还没有证明：

> 它需要动态插件运行时。

所以现在最合理的路线是：

```text
手工 Skill
 ↓
重复验证
 ↓
规则稳定
 ↓
Skill 固化
 ↓
Tool 化
 ↓
Runtime 化
 ↓
Plugin 化
```

而不是反过来。

---

# 30. 当前最应该做的不是迁移，而是「能力抽象」

把现在已经验证过的东西抽出来：

```text
BUYER_DECISION_FRAMEWORK
        ↓
Skill
```

而不是：

```text
Buyer Agent
```

同样：

```text
SEO Analyst
        ↓
SEO Analysis Skill
```

未来：

```text
Analyst
├── SEO Skill
├── Buyer Skill
├── Product Skill
└── Compliance Skill
```

---

# 31. Aromiso 最终 AI 架构

我认为最终形态应该是：

```text
                       AROMISO AI OS
                             │
                    ┌────────┴────────┐
                    │  Agent Runtime  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
            Roles          Skills          Tools
              │              │              │
       ┌──────┼──────┐       │              │
       │      │      │       │              │
    Analyst Strategist Executor        MCP / APIs
       │      │      │       │              │
       └──────┼──────┘       │              │
              │              │              │
              └──────────────┼──────────────┘
                             │
                        Model Router
                             │
                  ┌──────────┼──────────┐
                  │          │          │
                Flash       Pro       Other
                             │
                        Policy Layer
                             │
                  Truthfulness First
                             │
                        Memory Layer
                             │
                   D1 + R2 + Feedback
                             │
                        Outcome Loop
                             │
                       Human Approval
```

---

# 32. 这套架构最大的变化

过去：

> AI 是一个个「员工」。

未来：

> AI 是一个「组织」。

角色是员工。

Skill 是能力。

Tool 是工具。

Knowledge 是组织记忆。

Policy 是公司制度。

Workflow 是 SOP。

Task Engine 是项目管理。

Outcome 是绩效。

Human 是最终决策者。

这才是真正意义上的：

# AI Company Operating System

---

# 33. 与当前 Aromiso 项目的三句话对齐

这三句话必须保留，并成为未来 Agent Runtime 的设计原则：

> **Aromiso AI 不负责替业务创造“可信度”，只负责发现“可信度缺口”。**

> **Aromiso AI 不负责替业务成交，只负责降低客户进入人工销售之前的信息摩擦。**

> **Aromiso AI 不负责无限增加内容，而负责让已有事实在正确的采购决策节点出现。**

因此：

```text
AI
 ↓
降低信息摩擦
 ↓
提高询盘质量
 ↓
人接管
 ↓
Email / WhatsApp
 ↓
人工成交
```

而不是：

```text
AI
 ↓
自动聊天
 ↓
自动报价
 ↓
自动承诺
 ↓
自动成交
```

---

# 34. 当前版本的明确冻结边界

本研究不会改变：

- V5.327 已上线状态
- Buyer Decision Framework 手工验证机制
- Sales Intelligence Engine L3 BACKLOG
- Truthfulness First
- Email / WhatsApp 人工成交
- 不创建 Buyer Agent
- 不创建 Opportunity Engine
- 不创建 Sales 状态机
- 不注入 Analyst Prompt
- 不创建 Plugin Registry
- 不做全站自动 Buyer Audit
- 不开放 AI 自我修改生产 Prompt

---

# 35. 推荐 Roadmap

## Phase 0 — 当前

```text
手工 Skill
+
手工 Audit
+
事实确认
```

状态：

**现在。**

---

## Phase 1 — Skill 固化

当 BDF 连续验证有效：

```text
BUYER_DECISION_FRAMEWORK.md
        ↓
BUYER_DECISION_SKILL.md
```

仍然不自动运行。

---

## Phase 2 — Tool 化

建立：

```text
Product Tool
Knowledge Tool
Fact Tool
Document Tool
Analytics Tool
```

---

## Phase 3 — Agent Runtime

统一：

```text
Role
Skill
Tool
Memory
Policy
Task
```

---

## Phase 4 — Multi-model Router

根据任务：

```text
Flash
Pro
GPT
Qwen
```

自动选择。

---

## Phase 5 — Sub-agent

复杂任务才启用：

```text
Research Agent
Verifier Agent
Executor Agent
```

---

## Phase 6 — Plugin Ecosystem

最后才考虑：

```text
Dynamic Plugin
Install
Enable
Disable
Version
Permission
Health
```

---

# 36. 最终判断

## DeepSeek Harness 值不值得研究？

**值得。**

## 要不要现在迁移？

**不建议。**

## 要不要把 DeepSeek V4 Pro 接入做对照实验？

**值得。**

## 要不要学习 Harness 的架构？

**非常值得。**

## 要不要把 Aromiso 现有多角色升级？

**值得，但方向不是增加角色，而是组件化角色能力。**

## 要不要做 Plugin Registry？

**现在不要。**

## 要不要把 BDF 做成 Agent？

**不要。先做 Skill。**

## 要不要让 AI 自己创建插件？

**未来可以研究，现在禁止进入生产权限。**

## 最重要的升级是什么？

不是：

> 换 DeepSeek。

而是：

> **让 Aromiso 的 Role、Skill、Tool、Memory、Policy、Workflow 真正解耦。**

---

# 37. 一句话架构结论

### V5.x

```text
多角色 AI OS
```

↓

### V6.x 理想方向

```text
Composable Agent OS
```

↓

### 最终形态

```text
Aromiso Agent Runtime

Model
×
Role
×
Skill
×
Tool
×
Memory
×
Policy
×
Workflow
×
Outcome
```

模型可以换。

角色可以换。

Skill 可以增加。

Tool 可以增加。

知识可以积累。

规则可以升级。

但：

> **Truthfulness First + Human Sales Boundary + Evidence-first 事实体系永远在最上层。**

---

# 附录 A：DeepSeek 生态值得关注的方向

DeepSeek 官方的 `awesome-deepseek-agent` 当前已经收录多种 Agent 工具，其中值得 Aromiso 关注的是：

### 1. OpenCode

关注：

- Tool
- Agent
- Provider
- Extension

### 2. Pi

关注：

- TypeScript extensions
- Skills
- Prompt templates
- Sessions

### 3. DeepSeek-TUI

关注：

- MCP
- Skills
- Hooks
- Sub-agents
- HTTP Runtime API

### 4. Hermes

关注：

- Persistent memory
- Learning loop
- Skills
- Self-improvement

### 5. LobeHub

关注：

- Agent management
- Scheduling
- 7×24 operation

这些应该作为：

> **架构研究样本**

而不是直接作为 Aromiso 生产依赖。

---

# 附录 B：建议的 Aromiso Skill 目录

未来可以逐渐形成：

```text
skills/
├── seo/
│   ├── gsc-analysis
│   ├── technical-seo
│   └── content-opportunity
│
├── buyer/
│   ├── buyer-decision
│   ├── decision-chain
│   └── inquiry-quality
│
├── commerce/
│   ├── product-audit
│   ├── product-import
│   └── pricing
│
├── compliance/
│   ├── truthfulness
│   ├── certification
│   └── claims
│
├── content/
│   ├── blog
│   ├── product-copy
│   ├── faq
│   └── translation
│
└── operations/
    ├── task-planning
    ├── task-validation
    └── outcome-analysis
```

注意：

> 这只是未来结构设计，不代表现在创建目录。

---

# 附录 C：建议的 Tool Registry

未来：

```text
tools/
├── analytics/
│   ├── gsc
│   └── ga
│
├── commerce/
│   ├── products
│   ├── sku
│   └── pricing
│
├── knowledge/
│   ├── d1
│   └── r2
│
├── content/
│   ├── github
│   └── cms
│
├── communication/
│   └── email
│
└── infrastructure/
    ├── cloudflare
    └── github
```

---

# 附录 D：实验建议

如果未来开始实验，不要直接迁移。

做 A/B：

```text
同一个任务
同一个输入
同一个 Skill
同一个事实库
同一个 Output Schema

        ↓

A：现有 Runtime + 当前模型

B：Harness Runtime + DeepSeek V4 Pro
```

评分：

```text
1. 事实准确率
2. Missing Evidence 识别率
3. 结构完整度
4. 工具调用效率
5. Token
6. 延迟
7. 失败率
8. 可重复性
9. 人工修改量
10. 最终业务价值
```

最终不是比较：

> 哪个回答更漂亮。

而是比较：

> 哪个系统用更少成本，稳定地产出更少错误、更可执行、更符合业务事实的结果。

---

# 附录 E：最终决策树

```text
DeepSeek Harness
      │
      ↓
是否比现有 Runtime 更好？
      │
 ┌────┴────┐
 NO        YES
 │          │
保持现状     ↓
          是否降低成本？
             │
        ┌────┴────┐
       NO        YES
        │          │
      小范围试用    ↓
                 是否提高稳定性？
                    │
              ┌─────┴─────┐
             NO           YES
              │             │
            保持现状        ↓
                         进入 L2
                         Runtime Upgrade
```

---

## 研究结论

**DeepSeek Harness 对 Aromiso 最大的价值，不是成为 Aromiso 的新底座，而是帮助我们重新定义「AI 角色到底是什么」。**

角色不是能力。

Prompt 不是能力。

模型也不是能力。

真正的能力应该是：

```text
Role
+
Skill
+
Tool
+
Memory
+
Policy
+
Workflow
+
Evaluation
```

而 Aromiso 当前已经拥有其中相当一部分基础设施。

因此最正确的路线不是推倒重来，而是：

> **沿着现有 OS 继续演进，把已经验证过的能力逐步抽象成可组合组件。**

这才是 DeepSeek Harness 对 Aromiso 真正值得吸收的东西。

---

# 38. V5.37–V5.4 阶段对齐：AI Operating System for Aromiso（2026-08-16 owner 策略评审）

从 V5.37 开始，不要把 Aromiso 理解成「一个有几个 AI Agent 的网站后台」——它已经越来越接近 **AI Operating System for Aromiso**。业务视角的总分层：

```text
                  ┌─────────────────────┐
                  │    AI CONTROL TOWER │
                  │ 今天 / 现在 / 明天   │
                  └──────────┬──────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ↓                  ↓                  ↓
   Demand Generation   Business Enablement   Operations
          │                  │                  │
       SEO/GSC             BDF/Sales         Data/Tasks
       GA4                 PDP               Knowledge
       Shopping            Inquiry           Reports
       Content             Email             Execution
          │                  │                  │
          └──────────────────┼──────────────────┘
                             ↓
                     Agent Runtime
                             ↓
                  Model Router / Skills
                             ↓
                 DeepSeek / GPT / 其他模型
                             ↓
                  Tools / Browser / APIs
```

**DeepSeek Harness 应该属于最下面这一层（runtime 层），而不是上面的业务层**——这样以后即使 DeepSeek 被换掉，整个 Aromiso OS 也不会被绑死。实验运行时设计与两个实验（SEO Analyst 只读分析 / Buyer Decision Audit A/B）见 [`docs/BACKLOG.md`](./BACKLOG.md) §十三/§十四。

阶段定义：**V5.37–V5.4 = Autonomous Observation & Learning Phase（自主观察与学习期）——不是继续造 AI，而是让 AI 证明自己。** 本文 §34/§35 冻结清单在观察期内持续有效；等这一轮跑出第一批真实数据（第 14 天决策门），再决定下一刀砍在哪里。
