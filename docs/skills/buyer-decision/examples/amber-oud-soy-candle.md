# Example — amber-oud-soy-candle Buyer Decision Audit（Validation #1 摘要，2026-08-14）

> 真实 L1 手工审查产出的浓缩示例（完整过程见 `docs/BUYER_DECISION_FRAMEWORK.md` §十三 Validation #1，生产落地为 V5.327）。
> 演示：三态判定、Missing Evidence 路由、归属审查特例、「不要改什么」清单、以及「AI 不补写」的执行形态。

## 输入（对照 input-schema.json）

- pageType: `pdp`；productKey: `amber-oud-soy-candle`；locale: `en`
- caseStudyLinks: `germany-private-label-candle`（德国私标蜡烛案例）
- sources: 产品页源码、`src/content/products/amber-oud-soy-candle.en.md`、事实宪法、已发布案例页

## 铁三角风险标记（不打分）

- customer: ⚠️ partial — 买家拿不到可向内部汇报的文件包（Docs 区块全站不渲染）
- demand: ⚠️ partial — 方案层字段基本齐，样品流程不可见
- value: ❌ missing→已修复 — 归属漂移污染信任（"our perfumers"、IFRA 徽章与 ISO 同排）
- **当前主要风险：个人层信任证据被「不可核实声明」污染——页面声称的超出事实宪法范围。**

## 覆盖判定节选（对照 coverage 契约）

| item | verdict | gapType | routeTo | note（缺什么→影响→可否补→归谁） |
|---|---|---|---|---|
| 文件支持（SDS/COA 区块） | missing | Missing Asset | owner-confirmation | Documents 区块模板已支持但全站字段空 → 合规决策节点无承接 → 需业务提供真实文件清单 |
| 样品流程 | missing | Missing Asset | owner-confirmation | samplePolicy 字段全空 → 打样里程碑无承接 → 需业务确认 Sample Terms |
| 真实案例 | partial | Existing Asset Not Connected | routing-fix | 德国私标案例已发布但未链到本 PDP → 路由问题，不需创造新事实 |
| 认证归属 | partial | —（归属特例） | owner-confirmation | IFRA 徽章无可出具证书；attribution-needs-confirmation |

## Missing Evidence（不生成、不推断、不包装成事实）

- "burn-test report included" → missing-evidence（V5.327 已从页面移除）
- "every lot ships with GC-MS" → missing-evidence + Evidence Scope Expansion 反模式（美国案例做过 ≠ 每批标配；V5.327 已移除）
- "Provence single origin" → missing-evidence（未经业务确认产地；V5.327 已移除）
- "our perfumers" → attribution-needs-confirmation → 事实宪法要求「合作工厂」措辞（V5.327 已改写）
- "IFRA-compliant wax" → missing-evidence（IFRA 非认证、站内无证书；V5.327 补删）

## 最小改动建议（Minimum Effective Change）

- 问题：IFRA 徽章与认证同排 → 建议：移除 IFRA 徽章与规格行 IFRA 表述 → 依据：事实宪法 unverifiable #1 → 状态：actionable（V5.327 执行）
- 问题：案例未进决策点 → 建议：PDP 增加德国私标案例入口 → 依据：已发布案例真实存在 → 状态：pending-business-confirmation
- 问题：Docs 区块不渲染 → 建议：按业务可出具文件逐产品填字段 → 状态：pending-business-confirmation（禁止 AI 自行编写文件承诺）

## 不要改什么（憋得住）

- 不加信任徽章墙 / 评分评价（红线 #2：绝不编造数字）
- 不编交期数字；单图问题暂缓（无数据证明比 Docs/Sample/案例路由更重要）
- IFRA 全站 i18n 组件（OEM 段落提及）在业务确认前不动，仅登记 BACKLOG

## 验收

> 它找到了普通 SEO Audit 找不到的真实缺口吗？**是**——采购决策链断点（Docs/Sample 节点无承接、案例未连接）+ 归属漂移/证据范围扩张两类事实风险。→ 框架通过，进入第二轮验证。
