# V2 Architecture — 文档索引

> Phase 0 全部产出 + 三轮审查。21 份文档。
> 最后更新：2026-08-24
> 状态：🟢 Phase 1 READY

---

## 快速导航

| 我要… | 看这份 |
|--------|--------|
| 了解整体规划 | `V2_MASTER_PLAN.md` |
| 开始 Phase 1 开发 | `V2_PHASE_PLAN.md` §3 |
| 查看当前系统架构 | `V2_ARCHITECTURE_CURRENT.md` |
| 查看 V2 目标架构 | `V2_ARCHITECTURE_TARGET.md` |
| 查数据库表结构 | `V2_DB_MAP_CURRENT.md` + `V2_DATA_MIGRATION.md` |
| 查 API 设计 | `V2_API_MAP_CURRENT.md` + `V2_API_COMPAT.md` |
| 查 AI 系统 | `V2_AI_MAP_CURRENT.md` |
| 查权限设计 | `V2_PERMISSION_MAP_CURRENT.md` |
| 查组件设计 | `V2_COMPONENT_PLAN.md` |
| 查风险 | `V2_RISK_REGISTER.md` |

---

## 文档分类

### 一、总规划（1 份）

| # | 文档 | 内容 |
|---|------|------|
| 0 | V2_MASTER_PLAN.md | 总体开发规划：原则铁律 / 当前基线 / 目标架构 / Phase 骨架 / 迁移策略 / 风险清单 |

### 二、Phase 0 架构审计 — 当前状态（6 份）

| # | 文档 | 内容 |
|---|------|------|
| P0-1 | V2_ARCHITECTURE_CURRENT.md | 技术栈 / 运行时拓扑 / 数据流 / ADR-1~5 |
| P0-2 | V2_PAGE_MAP_CURRENT.md | 25 视图 × 逐页函数/API/DB/AI |
| P0-3 | V2_API_MAP_CURRENT.md | 57 端点 × 认证/输入输出/外部服务 |
| P0-4 | V2_DB_MAP_CURRENT.md | 52 表 × 列/FK/索引/读写频率/V2 命运 |
| P0-5 | V2_AI_MAP_CURRENT.md | 16 角色 × 安全闸决策树 / 调用点分布 |
| P0-6 | V2_PERMISSION_MAP_CURRENT.md | HMAC 认证 / AI 权限双层 / 漏洞清单 |

### 三、Phase 0 架构设计 — V2 目标（7 份）

| # | 文档 | 内容 |
|---|------|------|
| P0-7 | V2_ARCHITECTURE_TARGET.md | V2 全景 / 边界划分 / 数据流 / 组件树 / ADR-6~9 |
| P0-8 | V2_MIGRATION_MAP.md | 页面×API×DB×AI 四维新旧映射 |
| P0-9 | V2_DATA_MIGRATION.md | 0049-0065 DDL / 回滚 / 废弃清理 |
| P0-10 | V2_API_COMPAT.md | 双路由共存 / 统一格式 / 锁死清单 |
| P0-11 | V2_COMPONENT_PLAN.md | 46 组件 / Props 接口 / Astro vs React 选型 |
| P0-12 | V2_RISK_REGISTER.md | 19 风险 × 概率影响矩阵 |
| P0-13 | V2_PHASE_PLAN.md | Phase 1-14 × 文件/API/Migration/测试/验收 |

### 四、审查报告（6 份，按时间序）

| 轮次 | 文档 | 发现 |
|------|------|------|
| Cross Audit | V2_P0_CROSS_AUDIT.md | 8 个内部矛盾 → 已修复 |
| Deep Audit (R1) | V2_P0_DEEP_AUDIT.md | 3 P0 + 7 P1（8 角色视角） |
| Contrarian (R2) | V2_P0_CONTRARIAN_AUDIT.md | 18 挑刺 + 8 使用痛点 |
| Final Merge | V2_P0_FINAL_AUDIT.md | 两轮合并 + 最终建议 |
| Final Contrarian (R3) | V2_P0.5_CONTRARIAN_AUDIT.md | 3 STOP / 9 MUST FIX / 8 SHOULD FIX |
| Pre-Dev Audit | V2_P0_FINAL_PRE_DEV_AUDIT.md | 20 维度 PASS/FAIL → 🟢 READY |

### 五、交付摘要（1 份）

| 文档 | 内容 |
|------|------|
| V2_P0_COMPLETE.md | Phase 0 交付总览 + 审查顺序建议 |

---

## ADR 决策记录

| ADR | 内容 | 来源 |
|-----|------|------|
| ADR-1~5 | GitHub 内容管线 / Astro 选型 / SPA 历史 / 无 ORM / AI 不直接写 DB | V2_ARCHITECTURE_CURRENT.md |
| ADR-6~9 | 不做 SPA 框架 / Astro+React 混合 / 保留 GitHub / D1-based Queue | V2_ARCHITECTURE_TARGET.md |
| **ADR-10** | admin_entities = Search Index, NOT Domain Model, 字段上限 5 个 | R3 Contrarian |
| **ADR-11** | content_versions = metadata-only + github_commit_sha + rollback_to_version_id | R3 Contrarian |
| **ADR-12** | recycle_bin 取消，用 deleted_at + 源表查询 | R3 Contrarian |
| **ADR-13** | entity_links 取消，具体关系具体建模 | R3 Contrarian |
| **ADR-14** | copy_assets AI 字段移除，FK → ai_action_logs | R3 Contrarian |
| **ADR-15** | AI 执行模型 5→2 层：ai_missions → ai_tasks | R3 Contrarian |
| **ADR-16** | 发布状态五态：Draft→Committing→Building→Deployed→BuildFailed | R3 Contrarian |
| **ADR-17** | Inquiry→Customer→OEM→Quote→Order 业务链 FK 设计 | R3 Contrarian |
| **INV-1** | admin_entities 字段永不加列（Architecture Invariant） | Owner 要求 |

---

## 关键裁决记录

| 裁决 | 结论 |
|------|------|
| 废弃表数量 | 8 张（knowledge_base/daily_recs/experiments/ai_opportunities/ai_daily_briefs/ai_usage/ai_reports/decisions），Phase 14 DROP |
| RBAC 角色数 | 4 角色（Owner/Admin/Editor/Viewer），按需扩展 |
| OEM V1 范围 | Inquiry→Customer→OEM→Req→Sample→Quote→Order 转换（不含 Production/Shipment） |
| 发布状态五态 | 仅适用于 GitHub 管线内容对象；Commerce/Video/OEM 有独立状态模型 |
| AI Command | Phase 1-7 不做，Phase 8 单独设计 |
| Rollback 能力 | Partial（GitHub 内容可回滚；D1 Commerce 和 R2 文件不可回滚） |
| 全局搜索 | Phase 1-9 UI 壳；Phase 10 评估外部索引（D1 LIKE 不可靠） |

---

## Phase 就绪状态

| Phase | 状态 | 阻塞项 |
|-------|------|--------|
| Phase 1: AdminShell + Design System | 🟢 READY | 无 |
| Phase 2: RBAC + Audit + Version | 🟢 READY | 无 |
| Phase 3: Dashboard V2 | 🟢 READY | 无 |
| Phase 4: Content Center | 🟡 CONDITIONAL | 发布五态 / content_versions SHA / 引用计数 / Partial Batch |
| Phase 4.5: Unified Product View | 🔴 BLOCKED | 页面设计未完成 |
| Phase 5: Commerce Center | 🟢 READY | 无独立阻塞 |
| Phase 6: Customer & OEM | 🟡 CONDITIONAL | Inquiry→Customer FK / Quote→Order FK |
| Phase 7: AI Integration | 🟡 CONDITIONAL | AI Rate Limiting / Worker 超时恢复 |
| Phase 8: Growth Center | 🔴 BLOCKED | AI Command 子系统未设计 |
| Phase 9-13 | 🟢 READY | 各自 Phase 前评估 |
| Phase 14: Cutover | 🟡 CONDITIONAL | 废弃表 RENAME 观察期 |

---

*本目录包含 Aromiso CMS V2 从架构审计到开发就绪的全部文档。所有 ADR/INV 可追溯到具体审查轮次和源文件。*
