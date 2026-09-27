---
name: buyer-decision
description: Buyer Decision Audit（买家决策审查）Skill——用 B2B 买家采购决策链视角审查页面/内容，找出阻碍询盘的决策障碍。人工触发、人工执行、人工决策；观察期内绝不自动运行、不注入运行时 Prompt、不创建 Agent。任何角色（Analyst/Strategist/内容审查者）需要回答「客户从看到产品到愿意发询盘，每个决策节点有没有证据承接」时调用本 Skill。
version: 0.1.0
status: Validated · Manual（核心规则冻结 2026-08-15，owner 确认）
source: docs/BUYER_DECISION_FRAMEWORK.md（唯一权威；本目录是其可复用固化形态）
---

# Buyer Decision Skill（买家决策审查）

> 本 Skill 是 `docs/BUYER_DECISION_FRAMEWORK.md` v0.1 Validated · Manual 的**可复用固化形态**（架构蓝图 §11/§30：BDF 是 Skill，不是 Agent）。规则文本若与框架文档冲突，以框架文档为准。

## 硬边界（最高约束，违反即拒绝）

观察期内（2026-08-15 起）本 Skill：

- 仅作为**人工分析标准**使用：人工触发 → 人工审核 → 人工决定 → 人工上线。
- **不注入任何运行时 Prompt**（含 Analyst），**不创建 Agent / 数据库表 / Task**，**不触发自动执行**，**不自动修改 PDP**。
- 不为缺失项补写内容、不推断数字、不「参考同行」编写承诺（Missing Evidence 闸门）。
- 不使用任何数字评分（Trust Score / Opportunity Score / Critical-Red 分级）——只做三态覆盖判定（✅/⚠️/❌），防止滑回评分游戏。

## AI 职责三原则（调用前必须内化）

1. AI 不替业务创造「可信度」，只负责发现「可信度缺口」。
2. AI 不替业务成交，只负责降低客户进入人工销售之前的信息摩擦。
3. AI 不无限增加内容，而负责让已有事实在正确的采购决策节点出现。

分工：AI 管网站端（SEO 层 + Buyer Decision 层的静态内容支持）；owner 管 Email/WhatsApp 端（成交）。三层内容体系不得混淆：SEO（能不能找到）/ Buyer Decision（敢不敢询盘）/ Human Sales（如何成交）。

## 输入（input-schema.json）

一次审查的输入：页面类型（PDP/列表页/案例/指南）、路径/URL、locale、以及**必须实际读取的源**：页面源码、内容集合字段、FAQ、i18n 文案、`docs/SUPPLY_CHAIN_CAPABILITIES.md`（事实宪法）、已发布案例。不凭记忆、不凭摘要假设。

## 执行步骤（L1 规范）

1. **选品**：owner 指定或按 featured + 真实案例对应关系人工选定；小批量（2~3 个），不铺量，不依赖流量排名。
2. **读源**：按上节读全真实源。
3. **产出 8 项**（结构见 output-schema.json）：
   ① 买家疑虑清单 ② 三层覆盖（方案/组织/个人）③ 铁三角风险（客户×需求×价值，三态标记）④ 缺失的采购决策信息 ⑤ 可验证事实 / Missing Evidence ⑥ 最小改动建议 ⑦ 建议内容形态 ⑧ 是否值得进入 Content Factory。外加**「不要改什么」清单**。
4. **验收（唯一问题）**：它有没有找到一个普通 SEO Audit 找不到、但确实影响 B2B 买家决策的真实缺口？
5. **三原则内化**：利他（客户还缺什么信息才能做采购决定）、好奇心（「Fast Delivery」必须追问「多快」，资料没有就是 Missing Evidence）、憋得住（发现缺口但没有事实时暂不生成，等待事实）。

## 核心规则（rules.json，冻结）

八条 Buyer Decision Rules + Truthfulness First 最高规则 + 三层需求模型 + 订单铁三角 + Missing Evidence 闸门 + Minimum Effective Change，全部机器可读化在 `rules.json`。要点：

- **Buyer Decision Chain**：产品理解 → 采购适配 → 定制可行 → 样品 → 合规文件 → 质量控制 → 真实案例 → 包装/运输 → 询盘。
- **覆盖判定项**：产品规格、MOQ、定制流程、样品流程、包装信息、交期、QC、文件支持、真实案例、认证归属、询盘 CTA。
- **资产缺口三分类**（必须区分）：Missing Asset（证据不存在 → 等业务提供）/ Existing Asset Not Connected（证据存在但未出现在决策点 → 路由问题）/ Existing Asset, Wrong Decision Stage（出现但阶段错误 → 重新路由）。
- **归属审查特例**：页面声称的能力若属事实宪法「合作工厂持有」，判定为 ⚠️ 归属需明确，不是 ❌ 缺失。
- **反模式**：Evidence Scope Expansion（做过一次 ≠ 每批标配）；评分游戏；AI 补写缺失项。

## 输出纪律（validators.ts 机检）

- 每个 ⚠️/❌ 必须给出：缺什么 → 为什么影响采购决策 → 是否有可核实事实可补 → 补的动作归谁（业务确认 or 观察期后内容改动）。
- 每条最小改动建议：问题 → 建议（具体到区块/字段）→ 事实依据（引用事实宪法条目或已发布内容）→ 状态（可执行 / 待业务确认）。无事实依据的建议只能「待业务确认」并标注禁止 AI 自行编写承诺。
- 涉及 EB/TB/UB 决策角色的证据需求时，统一写「不同决策角色可能需要不同证据，具体证据类型需根据已验证业务流程确认」。
- `validators.ts` 提供 `validateAuditOutput()`：检查无数字评分、三态判定合法、缺失项有路由归属、建议有事实依据或待确认状态。

## 升级闸门（何时才谈 L2）

三条前置同时满足才考虑把规则固化为 Analyst Rule Module：连续多批 Audit 稳定产出真实缺口 + 观察期数据（GSC/GA/询盘归因）支撑 + 三条红线闸门（认证承诺/归属漂移/法规数字）并入审查流程且未违规。此前保持 L1 Manual；Sales Intelligence Engine（L3）蓝图整体冻结在 BACKLOG。

## 观察期反馈回路（Inquiry Reverse Verification Set）

owner 在 Email/WhatsApp 收到的真实客户问题是最宝贵的验证集：记录 → 判断「网站本来应该回答吗？」→ Yes 纳入未来决策节点补充计划（BACKLOG §8）→ No 标记为正常销售谈判范围。不混入 SEO Audit。

## 文件

- `rules.json` — 冻结规则机器可读版
- `input-schema.json` / `output-schema.json` — 输入输出契约
- `validators.ts` — 输出纪律机检（纯函数）
- `examples/amber-oud-soy-candle.md` — Validation #1 真实产出摘要
