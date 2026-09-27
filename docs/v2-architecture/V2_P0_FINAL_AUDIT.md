# V2 Phase 0 — 最终审查合并报告
## Combined Audit Report (Deep Audit + Contrarian Stress Test)

日期：2026-08-24
包含：Phase 0.5 Deep Audit + Phase 0.5-B Contrarian Audit

---

# 第一部分：Phase 0.5 深度审查结果

详见 `docs/V2_P0_DEEP_AUDIT.md`。

## Executive Summary

**V2 总体评级：B+。3 个 P0 + 7 个 P1 需解决。**

| 维度 | 评分 |
|------|------|
| Architecture | 82 |
| Data | 75 |
| API | 85 |
| AI | 88 |
| Security | 80 |
| UX | 72 |
| Migration | 78 |
| Performance | 70 |
| Observability | 75 |

## 3 个 P0（不修不能开发对应 Phase）

| # | 问题 | 影响 Phase |
|---|------|-----------|
| P0-1 | admin_entities 同步机制缺失 | Phase 2 |
| P0-2 | GitHub/D1 双写失败恢复缺失 | Phase 4 |
| P0-3 | AI Prompt Injection 防线未在 V2 文档声明 | Phase 7 |

## 7 个 P1（不修会导致架构返工）

| # | 问题 |
|---|------|
| P1-1 | Product/Commerce 双对象 UI 整合 |
| P1-2 | AI Panel 时序（Phase 4-6 无 AI） |
| P1-3 | 全局搜索索引未设计 |
| P1-4 | 批量 AI 队列设计不完整 |
| P1-5 | OEM 生命周期缺失表（Fragrance/Formula/Production/Shipment） |
| P1-6 | 多语言 locale 扩展性 |
| P1-7 | 软删除级联未设计 |

## Phase 1 就绪：🟡 CONDITIONAL

Phase 1 是纯前端，不涉及上述 P0。修复后 → 🟢 READY。

---

# 第二部分：逆向压力审查结果

详见 `docs/V2_P0_CONTRARIAN_AUDIT.md`。

## 核心判断

**V2 不是差设计，但它是「工程师觉得优雅、用户会觉得烦」的设计。**

加了太多层抽象，没有减少用户操作步骤。为「AI 未来能做到的」建了基础设施，但今天的 AI 用不上这么多。为「数据完整性」加了表，但这些表本身会成为新的不一致源。

## 应该砍掉的 5 个设计

| # | 设计 | 问题 | 替代方案 |
|---|------|------|---------|
| 1 | `admin_entities` 统一对象表 | 镜像表，双写不一致源，D1 无事务 | UNION 查询源表；Dashboard KPI 直接 COUNT |
| 2 | `content_versions` body_snapshot | 与 GitHub commit history 重复 | 只存 metadata（version/author/summary）；body 走 GitHub API |
| 3 | `recycle_bin` 独立表 | 与 deleted_at 列重复（双重标记） | 回收站 UI 直接查源表 WHERE deleted_at IS NOT NULL |
| 4 | `entity_links` 通用关联表 | 无 FK 约束，EAV 反模式，SQLite 做图数据库 | 用具体关联表（video_product_links 已有；product_guide_links 等新建） |
| 5 | `copy_assets` 上的 AI 字段 | 范式混乱，一条记录混了「资产」+「AI 日志」 | AI 字段改为 FK 指向 ai_action_logs |

## 应该重新思考的 5 个设计

| # | 设计 | 问题 | 建议 |
|---|------|------|------|
| 6 | Product vs Commerce 双对象 | 用户永远需要区分「这是内容还是商品」 | 给 Commerce Product 加「统一产品视图」：一个页面聚合所有信息 |
| 7 | OEM 12 Tab | 信息过载，大部分 Tab 大部分时间空 | 改为「概览页 + 分段滚动」，关键信息首屏可见 |
| 8 | ✨ AI 按钮无处不在 | 视觉噪音，无建议时是空点击 | 只在 AI Score < 80 或有实质性建议时才显示 |
| 9 | 三栏编辑器 | 90% 编辑场景不需要右栏，编辑区太窄 | 默认两栏，右栏可折叠（需要时才展开） |
| 10 | 全局搜索 LIKE | D1 无 FTS，10 万行 LIKE 全表扫描 | Phase 10 评估 KV 缓存索引或外部搜索 |

## 「我每天用 8 小时」— 8 个会觉得烦的地方

| # | 痛点 | 原因 |
|---|------|------|
| 1 | 搜一个东西出两个结果 | Product Content + Commerce Product 双对象 |
| 2 | 点发布等 2 分钟，build 失败不知道 | GitHub → CF build 链路无状态反馈 |
| 3 | 改 MOQ 要跳 3 个页面 | 产品资料、现货商品、文案资产分三处 |
| 4 | AI 建议不敢直接接受 | AI 不说「为什么这样改」和「预期影响」 |
| 5 | 侧边栏 40+ 导航目标太长 | 常用 5 个分散在 4 个一级菜单下 |
| 6 | 删除前不知道影响 | 没提示「这个产品被 3 个询盘引用了」 |
| 7 | Dashboard「需要处理」不排优先级 | 不知道哪个最紧急 |
| 8 | 版本历史太多找不到好的 | 没有 AI Score 变化曲线，需要逐条点开看 diff |

## AI 特有的 3 个风险

| # | 风险 | 说明 |
|---|------|------|
| AI-1 | 善意 DDoS | AI 正常执行 L3 操作但规模效应压垮 GitHub API / CF build |
| AI-2 | 成功 ≠ 有效 | AI 标记 success 但对 SEO 无提升，用户不知道 |
| AI-3 | 合规文案幻觉 | AI 编造 FDA/USDA 认证，truthfulness 可能漏检，人工审核可能漏看 |

## 接手项目后我会先做的 12 件事

1. 砍掉 `admin_entities` → UNION 查询
2. 砍掉 `content_versions` body_snapshot → 只保留 metadata
3. 砍掉 `recycle_bin` → 用 deleted_at
4. 砍掉 `entity_links` → 具体关联表
5. 砍掉 `copy_assets` 上的 AI 字段 → FK 指向 ai_action_logs
6. 给 Commerce Product 加「统一产品视图」
7. OEM 详情从 12 Tab 改为概览页
8. ✨ AI 按钮改为「有条件显示」
9. 三栏编辑器默认两栏
10. 增加 AI 操作频率限制
11. 废弃表用 RENAME + 观察而非直接 DROP
12. i18n 从硬编码 ts 迁移到 D1

---

# 第三部分：两次审查的交叉结论

| 视角 | Deep Audit 结论 | Contrarian 结论 | 一致？ |
|------|----------------|-----------------|--------|
| admin_entities | P0-1: 同步机制缺失 | 砍掉整张表 | ⚠️ Deep Audit 说「补设计」；Contrarian 说「砍掉」 |
| content_versions | 通过 | 砍掉 body_snapshot | ⚠️ Deep Audit 说 OK；Contrarian 说冗余 |
| recycle_bin | 通过 | 砍掉整张表 | ⚠️ 同上 |
| entity_links | 通过 | 砍掉，用具体关联表 | ⚠️ 同上 |
| Product vs Commerce | P1-1: UI 整合 | 用户永远觉得烦 | ✅ 一致——这是真正的 UX 问题 |
| OEM 设计 | P1-5: 缺失表 | 12 Tab 信息过载 | ✅ 一致——OEM 设计需要改进 |
| AI 融入业务 | P1-2: 时序问题 | 视觉噪音 | ⚠️ 不同角度——都指出 AI 集成有问题 |
| 全局搜索 | P1-3: 索引缺失 | D1 不适合 LIKE | ✅ 一致——搜索是真实瓶颈 |
| 批量 AI | P1-4: 队列不足 | CF 10s 是硬伤 | ✅ 一致——批量 AI 不可靠 |

## 最终建议

**不砍 admin_entities，但必须简化**：只存 entity_type/entity_id/title/status/updated_at（5 个字段），去掉 owner/locale/source/created_at。它只做「全局搜索索引」和「Dashboard 分组统计」——不是「统一对象层」。

**不砍 content_versions，但必须去掉 body_snapshot**：只存 version/author/source/change_summary。body 走 GitHub API。省钱（D1 存储）且避免双源版本不一致。

**不砍 recycle_bin，但必须合并到 deleted_at**：回收站 UI 直接查源表。不需要独立表。

**砍掉 entity_links**：用具体关联表。D1 是关系型数据库，不是图数据库。

**砍掉 copy_assets 上的 AI 字段**：用 FK 指向 ai_action_logs。

**这些砍完之后，V2 的核心骨架仍然成立**。只是更简单、更不容易出错、更少维护负担。

---

# 第四部分：Phase 1 最终判定

**🟡 CONDITIONAL → 修复后 🟢 READY**

Phase 1 是纯前端（AdminShell + 10 个基础组件 + CSS），不涉及上述任何数据库/AI/API 问题。可以在 Phase 1 开发期间补设计文档。

**进入 Phase 1 前需确认的决策**：
1. admin_entities 是保留简化版还是砍掉？（建议：留简化版）
2. content_versions 是否去 body_snapshot？（建议：去）
3. recycle_bin 是独立表还是合并？（建议：合并到 deleted_at）
4. entity_links 是用通用表还是具体关联表？（建议：具体关联表）

**这 4 个决策确定了 V2 的数据层复杂度上限。确认后即可进入 Phase 1。**

---

*本报告合并了 Phase 0.5 深度审查（40 维度 × 8 角色）和逆向压力审查（18 项挑刺 + 8 小时真实使用模拟）。每一项结论可追溯到具体文档/源码。*