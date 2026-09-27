---
name: truthfulness
description: Truthfulness First 内容真实性 Skill——一切 AI 生成对外内容（博客/指南/产品文案/案例/邮件）发布前的事实裁定标准与 Runtime Policy 使用说明。任何角色产出对外内容、或人工评审 AI 草稿时调用。事实唯一来源：docs/SUPPLY_CHAIN_CAPABILITIES.md（事实宪法）+ functions/lib/fact-registry.json（Fact Authority Layer 运行时副本）。
version: 1.0.0
status: Active — Runtime Policy 已在 Content Factory 生效（V5.33）
source: docs/SUPPLY_CHAIN_CAPABILITIES.md、functions/lib/truthfulness.ts
---

# Truthfulness Skill（内容真实性 Runtime Policy）

> 架构蓝图 §12/§13 的落地：**Truthfulness First 不只是 Prompt，而是代码级 Runtime Policy。** 模型「觉得合理」≠ 可以写出去；只有 Fact Authority Layer 里 Verified 的事实才可以使用，否则标记 Missing Evidence。

## Fact Authority Layer（事实权威层）

```text
docs/SUPPLY_CHAIN_CAPABILITIES.md（事实宪法，人读权威）
        ↓ 同步
functions/lib/fact-registry.json（运行时副本，机读权威）
        ↓ 驱动
functions/lib/truthfulness.ts（checkClaims / checkContentDraft）
        ↓ 闸门
Content Factory（content-generate.ts：blocked → 不入队；warnings → 随 REVIEW 交人工）
```

改事实必须**两处同步**（事实宪法 + fact-registry.json），且 `unverifiableClaims`/红线变更需 owner 确认。

## 五条红线（裁定依据）

1. **主体归属要准确**：Aromiso 自持仅 ISO 9001 + ISO 22716/GMP（可第一人称）；ISO 14001/45001/FSC/CE/BSCI/出口认证/香精屋原料（Firmenich/Givaudan/Ogawa/Robertet）/大豆蜡工艺等只能「合作工厂/源头工厂/供应链」措辞。
2. **绝不编造数字**：评分、评价条数、aggregateRating、销量、客户数、好评率一律禁止（历史教训：伪造 aggregateRating 险触发 GSC 人工处置）。
3. **认证/文件须可出证**：声称的认证或文件必须能拿出真实原件；不确定就写「可按需提供」并先内部核实。**IFRA 是香精屋符合性声明而非认证，站内无可出具证书——任何 IFRA 证书/合规声明都拦截。**
4. **不泄露供应链**：工厂主体名称、1688 链接、成本价、联系人永不进仓库与对外内容。
5. **能力≠承诺**：MOQ/交期/价格引用必须标注「视订单而定 / depending on order」。

## Runtime Policy 规则集（functions/lib/truthfulness.ts）

**blocked（硬拦截，草稿不得进 REVIEW 队列）**：ifra-claim / gcms-every-lot（证据范围扩张）/ attribution-drift（第一人称+合作工厂认证）/ fragrance-house-drift / capability-drift（our perfumers / we formulate / our own blends / our factory）/ fabricated-stats / absolute-claim / medical-claim / validation-claim（burn-test、controlled chamber）/ origin-claim（single origin、普罗旺斯/云南）/ composition-claim（成分百分比）/ grade-claim（therapeutic grade）/ supply-leak（1688）。

**warnings（不拦，随 REVIEW 任务交人工）**：commercial-unhedged（MOQ/交期无 hedge；48h 现货豁免）/ gcms-mention（证据范围提醒）/ attribution-soft / attribution-drift-CE（CE 产品级认证降级）/ wellness-soft（助眠/减压类软声明）。

## 人工评审清单（REVIEW 队列用法）

评审 AI 草稿时按顺序检查：

1. `truthfulness_pass` 是否为 true（false 的草稿系统已拦截，不会出现在队列）。
2. `truthfulness_warnings` 逐条过：hedge 是否补上、GC-MS 表述是否限定证据范围、CE/软声明措辞是否合适。
3. 抽查正文是否出现 Fact Authority 之外的事实（新认证、新数字、新客户案例）——出现即退回，**不手工补写**，走 Missing Evidence 流程（路由 owner 确认）。
4. 发布动作永远由人在 CMS 执行（save.ts ghPut）；任何自动化发布需 owner 按 AGENTS.md「AI 发布授权梯度」显式解锁。

## Missing Evidence 流程

```text
内容需要某事实 → Fact Authority 里有？
  YES → 使用（注意归属措辞与 hedge）
  NO  → 标记 Missing Evidence → 路由 owner 确认
        → owner 提供真实事实 → 先入事实宪法/registry → 再用于内容
        → owner 无法提供 → 不生成、不推断、不包装成事实
```

**禁止**：参考同行编写承诺、把「做过一次」扩张为「每批标配」（Evidence Scope Expansion）、用生成内容提高事实完整度。

## 测试基线

`tests/truthfulness.test.ts`（35 用例：真实事故句硬拦截 / 措辞豁免 / warnings / checkContentDraft 字段标注）+ `tests/content-generate.test.ts` 的 V5.33 端到端用例（红线草稿零 tasks 写）。改规则必须先改测试。
