# Aromiso V2 AI 系统地图（Current State）

> **生成日期**：2026-08-17  
> **源码依据**：`functions/lib/permissions.ts`、`truthfulness.ts`、`action-budget.ts`、`mission-log.ts`、`fact-registry.json`、`ai.ts`、`model-router.ts` 及全部 `functions/api/admin/*.ts` AI 端点（共 18 个文件，~8,000 行源码逐行阅读）  
> **用途**：V2 重构前的完整现状地图——不猜测，只从实际源码中提取事实。

---

## 一、AI 安全架构总览（四条独立安全闸门）

系统以四条独立闸门形成纵深防线。每道闸门是代码层硬约束，AI 产出的任何标注（如 `execution_mode`）从不被信任——执行器总在代码层重新裁定。

```
                         ┌──────────────────┐
                         │   AI 产出物       │
                         │   (tasks/txt)    │
                         └────────┬─────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │ 权限闸            │ │ 真实性闸         │ │ 预算闸            │
    │ permissions.ts   │ │ truthfulness.ts │ │ action-budget.ts │
    │ enforceMode()    │ │ checkClaims()   │ │ checkCreation    │
    │ 代码层重裁定      │ │ 5条红线纯函数    │ │ Budget() 三级     │
    └────────┬─────────┘ └────────┬────────┘ └────────┬────────┘
             │                    │                    │
             └────────────────────┼────────────────────┘
                                  │
                                  ▼
                        ┌─────────────────┐
                        │ 幂等地基         │
                        │ idempotency.ts  │
                        │ task_runs 唯一索引│
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ 数据四态闸       │
                        │ data-state.ts   │
                        │ 0≠坏数据         │
                        └─────────────────┘
```

### 1.1 权限闸门（permissions.ts，183 行）

**核心安全机制**：`enforceMode(task_type)` 在代码层重新裁定真实权限等级，忽略 AI 写入 `tasks.execution_mode` 的任何值，防止 prompt 注入提权。

#### 决策树

```
enforceMode(taskType)
  │
  ├─ taskType 为空 → MANUAL（不认识就不自动跑）
  │
  ├─ taskType ∈ FORBIDDEN_TASK_TYPES → MANUAL（硬禁止，永不可自动执行）
  │   ├─ delete_page / delete_content / delete_product
  │   ├─ price_change / payment / external_quote
  │   ├─ compliance_claim / publish_content
  │   ├─ send_email / contract
  │   └─ 这些即使被 AI 标成 "L3" 也一律返回 MANUAL
  │
  ├─ taskType ∈ TASK_TYPE_POLICY → 按代码表返回：
  │   ├─ L1: analysis / audit / monitor / report（只读，无副作用）
  │   ├─ L2: content_refresh / faq_append / meta_rewrite /
  │   │      content_generate / growth_review（须人工审核）
  │   ├─ L3: meta_fix / internal_link / translate_fill / alt_text_fill（低风险可逆）
  │   └─ L4: sitemap_ping（受限白名单自动）
  │
  └─ 其余未登记 taskType → MANUAL
```

#### canAutoExecute() 五态裁定

| enforcedMode | 条件 | allowed | requiresReview | forbidden |
|---|---|---|---|---|
| MANUAL (硬禁止) | FORBIDDEN_TASK_TYPES | false | false | true |
| MANUAL (未登记) | 不在 TASK_TYPE_POLICY | false | false | true |
| L1 | — | true | false | false |
| L2 | reviewApproved=true | true | true | false |
| L2 | reviewApproved=false | false | true | false |
| L3 | — | true | false | false |
| L4 | executor 在白名单 | true | false | false |
| L4 | executor 不在白名单 | false | true | false |

#### L4 白名单

只有 `sitemap_ping` 在白名单 `L4_EXECUTOR_ALLOWLIST`。其余所有 L4 task_type 不在此名单的，退回人工审核。

---

### 1.2 真实性闸门（truthfulness.ts，563 行 + fact-registry.json）

**核心机制**：纯函数 `checkClaims(text)` / `checkContentDraft(draft)` —— 同一输入永远同一输出，可单测穷举。判定原则「宁可误拦，不可漏放」：blocked 命中一律拦下；warnings 不拦草稿但随 REVIEW 任务交人工复核。

#### 五条红线（fact-registry.json → FACT_REGISTRY.redLines）

| # | 红线 | 源码规则 | 检测方式 |
|---|---|---|---|
| 1 | 主体归属要准确 | Aromiso 自持 vs 合作工厂持 | `scanSentence` 逐句：认证归属检测（强归属动词 STRONG_HOLD_RE / 弱归属 WEAK_HAVE_RE）+ 香精屋归属检测 + 能力归属检测（our perfumers / we formulate / our factory） |
| 2 | 绝不编造数字 | 评分/评价/销量/客户数/好评率 | `scanFullText` 全文：aggregateRating/reviewCount/rated N out of N/customer satisfaction %/over N customers/绝对化表述（#1/best/only） |
| 3 | 认证/文件须可出证 | IFRA/GC-MS/therapeutic grade/医疗声明/产地/成分% | `scanFullText` 全文：IFRA cert/compliant / GC-MS every lot / therapeutic grade / medical claims / burn-test / 产地（Provence/Grasse/Yunnan）/ 成分含量% |
| 4 | 不泄露供应链 | 1688 链接等 | `scanFullText` 全文：1688.com |
| 5 | 能力≠承诺 | MOQ/交期须标注"视订单而定" | `scanSentence` 逐句：MOQ 含数字无 hedge 词 / 交期数字无 hedge 词（48h 现货豁免） |

#### 两阶段检测流程

```
checkClaims(text)
  ├─ 空文本 → pass
  └─ 有内容：
      ├─ scanFullText(text) → blocked/warnings（全文规则，防跨句模式）
      ├─ splitSentences(text) → 逐句 scanSentence() → blocked/warnings
      └─ dedupe() → return { pass, blocked, warnings }
```

`checkContentDraft(draft)` 覆盖 title / excerpt / seoTitle / seoDescription / body 五个字段，命中带 field 标注。

#### 接入点

| 接入位置 | 作用 | blocked 行为 | warnings 行为 |
|---|---|---|---|
| `content-generate.ts` | 草稿过真实性闸 | 绝不入队（幂等记为 success，不重试烧预算）+ 🔴 高危告警 | 随 REVIEW 任务交人工 |
| `task-execute.ts` | 执行前对 payload 全部文本跑 | NO_ACTION 422 拦截 | — |
| `autonomy.ts` RED_LINES 常量 | 后台闸门面板展示 6 类永远人工的红线字段 | — | — |
| `notify.ts` evaluatePipelineAlerts | 每日自检 `fact_check_result='blocked'` → 🔴 高危告警 | — | — |

#### Fact Registry（事实权威层）

`functions/lib/fact-registry.json` 是事实裁定的**唯一入口**。源头为 `docs/SUPPLY_CHAIN_CAPABILITIES.md`（事实宪法）。改事实必须两处同步。

关键事实：
- **Aromiso 自持**：仅 ISO 9001 + ISO 22716/GMP
- **合作工厂持有**：ISO 14001/45001/FSC/CE/BSCI + Firmenich/Givaudan/Ogawa/Robertet 原料 + MSDS/SDS/SGS/CNAS/CMA/EPR 文件
- **可核实数字**：OEM MOQ 最低 100 / 采样 3-12d / 大货 10-35d / 日产能 1-5 万瓶 / 现货 48h 发

---

### 1.3 预算闸门（action-budget.ts，258 行 + ai.ts budget via PRICING）

系统设置**三层独立的动作预算**，防止「一晚上改 500 个页面」。

#### 第一层：AI 调用预算（ai.ts）

| 参数 | 值 | 位置 |
|---|---|---|
| MONTHLY_CAP_CNY | ¥30 | `ai.ts` L35 |
| ALERT_THRESHOLD | 0.8 (¥24) | `ai.ts` L36 |
| flash 输入 | ¥1/M tokens | `ai.ts` L29 |
| flash 输出 | ¥2/M tokens | `ai.ts` L29 |
| pro 输入 | ¥3/M tokens | `ai.ts` L30 |
| pro 输出 | ¥6/M tokens | `ai.ts` L30 |

**四级预算降级（`getBudgetLevel()`）**：

| Level | 触发 | 行为 |
|---|---|---|
| 0 | spend < ¥15 | 正常 |
| 1 | spend ≥ ¥15 | 强制 flash（Pro → Flash 自动切换，ai.ts L232-233） |
| 2 | spend ≥ ¥24 | 跳过非关键 AI 调用 |
| 3 | spend ≥ ¥30 | 阻断所有 AI 调用（aiCall 返回 null，ai.ts L227-229） |

#### 第二层：动作预算（action-budget.ts）

| 预算维度 | 默认值 | KV 覆盖键 |
|---|---|---|
| `per_type_daily.meta_fix` | ≤10 | `config:action_budget` |
| `per_type_daily.alt_text_fill` | ≤20 | `config:action_budget` |
| `per_type_daily.internal_link` | ≤10 | `config:action_budget` |
| `per_mission_max` | 单轮 ≤5 | `config:action_budget` |
| `daily_production_writes` | 日总量 ≤30 | `config:action_budget` |

受约束任务类型（`BUDGETED_TASK_TYPES`）：`meta_fix` / `alt_text_fill` / `internal_link` / `translate_fill` / `sitemap_ping`

**超预算行为（三层检查语义）**：

| 检查函数 | 使用场景 | 超限行为 |
|---|---|---|
| `checkCreationBudget()` | 路由侧（growth-sync） | **降级**为 growth_review 人工审核，不丢弃机会 |
| `checkProductionWriteBudget()` | 执行侧（task-execute） | **429 拦截** + `recordBlockedAction` 留痕 |
| `checkMissionActionBudget()` | Mission 作用域 | 当前单动作执行器恒通过；未来多动作 Mission 用 |

**统计查询失败的安全路径**：
- 路由侧：降级人工（fail-open 于观测，fail-safe 于动作——宁转人工不超限）
- 执行侧：放行计数 0 但附带 warning

#### 第三层：内容工厂预算（content-generate.ts）

| 约束 | 值 |
|---|---|
| 月预算硬顶 | MONTHLY_CAP_CNY = ¥30（通过 aiCall 预算层控制） |
| cron 触发开关 | CONTENT_FACTORY_LIVE === "on"（默认关） |
| 每选题每日幂等 | `content-gen:{key}:{locale}:{today}` |
| 每次最多生成 | ≤3 篇 |

#### 第四层：技术审计预算（growth-audit.ts）

| 约束 | 值 | 原因 |
|---|---|---|
| maxPages | 10 | CF Free 50 子请求预算 |
| maxLinkChecks | 15 | 同上 |
| fetchConcurrency | 6 | 限并发防 wall-clock 超 CF 100s |
| Index Monitor | ≤12/次 | 同上 |

---

### 1.4 任务记录层（mission-log.ts，643 行）

**目标**：让每一个 AI 行为「可观察、可追溯、可复盘」。

**铁律**：记录层永远不阻断主流程——所有写入 try/catch 吞错。

#### 数据结构

**ai_missions 表字段**（0037 migration）：

| 字段 | 类型 | 说明 |
|---|---|---|
| mission_id | TEXT UNIQUE | `MSN-20260817-gsc_sync-a1b2c3` |
| mission_type | TEXT | gsc_sync / ga4_sync / daily_recommendations / growth_sync / opportunity_scan / knowledge_distill / task_planning / task_followup / outcome_verification / action_execution / seo_audit / bdf_check / autonomy_change … |
| status | TEXT | scheduled / running / completed / skipped / blocked |
| agent_name | TEXT | 哪个 AI 角色（含中文注释） |
| model_used | TEXT | 实际模型名 |
| prompt_version | TEXT | 提示词版本（可追溯） |
| input_data | JSON | 结构化输入摘要 |
| output_summary | TEXT | ≤2000 字符 |
| actions_taken | TEXT[] | 每条一句话 |
| tasks_created | INTEGER | 产生任务数 |
| recommendations_count | INTEGER | 产生建议数 |
| blocked_reason | TEXT | 为什么被拦 |
| error_message | TEXT | 异常详情 |
| token_usage | INTEGER | 总 Token |
| cost_usd | REAL | 美元成本 |
| human_approval_needed | BOOLEAN | 是否需要人审 |
| duration_seconds | INTEGER | 执行耗时 |

**ai_action_logs 表字段**（0037 migration）：

| 字段 | 类型 | 说明 |
|---|---|---|
| mission_id | TEXT FK | 父 Mission |
| action_type | TEXT | read_gsc / analyze_intent / generate_fix / blocked_by_gate … |
| tool_used | TEXT | 调用工具名 |
| step_number | INTEGER | 步序号 |
| step_input / step_output | JSON | 步骤输入输出 |
| fact_check_result | TEXT | safe / warning / blocked |
| truthfulness_flags | TEXT[] | 真实性标记 |
| confidence_score | REAL | 0-1 置信度 |
| duration_ms | INTEGER | 耗时 |
| success | BOOLEAN | 是否成功 |
| affected_files | TEXT[] | 受影响的文件 |
| sandbox_mode | BOOLEAN | 是否沙箱模式 |

#### 三大核心函数

| 函数 | 作用 | 异常处理 |
|---|---|---|
| `startMission(db, spec)` | 创建 ai_missions 行（status=running）+ 孤儿清理（running>30min→blocked） | 返回 null（不阻断） |
| `finishMission(db, missionId, result)` | 更新状态/耗时/输出/成本 | try/catch 吞错 |
| `logAction(db, missionId, spec)` | 写 ai_action_logs（自动取步序号） | try/catch 吞错 |
| `withMission(db, spec, fn)` | 包装器：start→fn(log)→finish；fn 抛错→blocked 并继续抛出 | 主流程错误语义不变 |
| `recordBlockedAction(db, opts)` | 记录被闸门拦截的动作（含 start/finish/log） | 吞错 |
| `generateDailyReport(db, dateStr)` | 汇总当日 → ai_daily_report（upsert）+ Health Score 六因子 | 吞错 |
| `writeMissionPlans(db, todayStr)` | 写明日计划 + 未来 7 天预览 | 吞错 |

#### Health Score 六项子分（V5.37）

| 子分 | 权重 | 数据源 | 计算逻辑 |
|---|---|---|---|
| completion | 25% | ai_missions | completed/(completed+blocked) |
| fact_safety | 25% | ai_action_logs | 100 - blocked×15 - warn×3 |
| precision | 15% | ai_action_logs.success | 100×(1-failed/total) |
| action_success | 15% | growth_actions.outcome | positive/decided |
| anomaly_free | 10% | ai_missions | 100×(1-blocked/total) |
| cost_efficiency | 10% | ai_usage | (5-cny)/4 × 100，¥5 归零 |

---

### 1.5 通知层（Notify Layer）

通知层由系统规则从结构化日志生成，AI 不参与发信决策。

| 邮件类型 | 触发 | 冷却 | 发送源 |
|---|---|---|---|
| 🟢 日报（SYSTEM_HEALTHY） | 每日一封，心跳证明全链路存活 | 无冷却（每天必发） | os-daily auditor 收尾 ≈ 北京 07:00 |
| 🟡 报表异常+警告 | evaluatePipelineAlerts 发现异常 | warn 24h | os-daily / cron-pull growth |
| 🔴 高危（critical） | 真实性红线命中 / 连续 blocked | critical 6h | content-generate / os-daily |
| 【已恢复】 | 模块从异常恢复 | 自动清算旧失败 | evaluatePipelineAlerts |

---

## 二、完整 AI 角色目录

### 角色分类说明

- **DB 角色**：prompt 存储在 `ai_roles` 表，通过 `/api/admin/ai-roles` CRUD 热更新
- **内联角色**：prompt 硬编码在源码中（含回退逻辑以确保 ai_roles 缺失时不中断）
- **纯代码角色**：不调用 AI，为规则引擎/纯函数/数据采集
- **权限等级**：每个角色**不直接有权限等级**——权限由 `enforceMode(task_type)` 在代码层裁定，角色只是产出方；AI 写入的 `execution_mode` 不决定能否执行。

### 2.1 DB 角色（ai_roles 表，8 个）

#### ① analyst（数据分析师）

| 字段 | 值 |
|---|---|
| 角色标识 | `analyst` / 数据分析师 |
| 系统提示词位置 | `migrations/0009_aromiso_os.sql` L131（DB 存储，Role Center 可编辑） |
| 默认模型 | `deepseek-v4-pro` |
| reasoning_effort | low |
| 触发机制 | cron / os-daily step=analyst / 手动 POST os-daily |
| 输入数据 | GSC 快照 7d + GA4 快照 7d + behavior_events 7d + inquiries 7d |
| 输出格式 | JSON `{opportunities: [{type, score, impact, evidence, recommendation, confidence}]}` → D1 `knowledge` observation 层 |
| 成本跟踪 | `ai_usage` role="analyst" |
| 真实性闸门 | 纯分析任务，所读数据均来自结构化 D1 查询，不产生对外文案；其产出 observation 经 Librarian 二轮蒸馏后才入正式 knowledge |
| 当前代码引用 | `os-daily.ts` L98 `resolvePrompt(db, "analyst", getAnalystPrompt())` |
| 对应用层权限 | 产出机会进 observation 层，经 Strategist 路由为 tasks（tasks 的 execution_mode 会被 permissions.ts enforceMode 裁定） |
| V2 命运 | **保留**——数据分析是 OS 日循环第一棒，不可替代 |

#### ② librarian（知识管理员）

| 字段 | 值 |
|---|---|
| 角色标识 | `librarian` / 知识管理员 |
| 系统提示词位置 | `migrations/0009_aromiso_os.sql` L132（DB 存储） |
| 默认模型 | `deepseek-v4-pro` |
| reasoning_effort | low |
| 触发机制 | cron / os-daily step=librarian / 手动 POST os-daily |
| 输入数据 | knowledge（observation 层近 3 天 + Top-20 规则/原则）+ ai_feedback（未消费） |
| 输出格式 | JSON `{entries: [{level, category, summary, evidence, confidence, importance, decay_rate}]}` → D1 `knowledge`（含过期时间）+ R2 `aromiso-kb` |
| 成本跟踪 | `ai_usage` role="librarian" |
| 真实性闸门 | 蒸馏 observation 不产生对外文案；事实基础来自 Analyst 的已验证数据 |
| 当前代码引用 | `os-daily.ts` L198 `resolvePrompt(db, "librarian", getLibrarianPrompt())` |
| V2 命运 | **保留**——知识沉淀是记忆层核心，不可替代 |

#### ③ strategist（策略总监）

| 字段 | 值 |
|---|---|
| 角色标识 | `strategist` / 策略总监 |
| 系统提示词位置 | `migrations/0009_aromiso_os.sql` L133（DB 存储） |
| 默认模型 | `deepseek-v4-pro` |
| reasoning_effort | medium |
| 触发机制 | cron / os-daily step=strategist / 手动 POST os-daily |
| 输入数据 | knowledge（Top-20）+ tasks（未完成）+ decisions（近 30 天含拒绝原因） |
| 输出格式 | JSON `{tasks: [{title, roi_score, impact, difficulty, business_reason, knowledge_refs, task_type, executor, execution_mode}]}` → D1 `tasks` 表 |
| 成本跟踪 | `ai_usage` role="strategist" |
| 真实性闸门 | 产出 tasks 的 `execution_mode` **不被信任**——task-execute 执行时由 `enforceMode(task_type)` 在代码层重新裁定；建议出题前查 decisions 防重复已拒绝建议 |
| 当前代码引用 | `os-daily.ts` L314 `resolvePrompt(db, "strategist", getStrategistPrompt())` |
| V2 命运 | **保留**——策略规划是 OS 日循环第三棒 |

#### ④ executor（执行教练）

| 字段 | 值 |
|---|---|
| 角色标识 | `executor` / 执行教练 |
| 系统提示词位置 | `migrations/0009_aromiso_os.sql` L134（DB 存储） |
| 默认模型 | `deepseek-v4-pro` |
| reasoning_effort | low |
| 触发机制 | cron / os-daily step=executor / 手动 POST os-daily |
| 输入数据 | tasks（未完成）+ 最新 GSC/GA 数据（验证效果） |
| 输出格式 | JSON `{updates: [{task_id, status, result}]} + daily_summary` → D1 tasks 回填 actual_result |
| 成本跟踪 | `ai_usage` role="executor" |
| 当前代码引用 | `os-daily.ts` L478 `resolvePrompt(db, "executor", getExecutorPrompt())` |
| V2 命运 | **保留**——任务跟进是 OS 日循环第四棒 |

#### ⑤ auditor（审计官）

| 字段 | 值 |
|---|---|
| 角色标识 | `auditor` / 审计官 |
| 系统提示词位置 | `migrations/0009_aromiso_os.sql` L135（DB 存储） |
| 默认模型 | `deepseek-v4-pro` |
| reasoning_effort | low |
| 触发机制 | cron / os-daily step=auditor / POST os-audit / 手动 POST os-daily |
| 输入数据 | 站点页面列表 + GSC 索引状态 + 结构化数据检测结果（代码级扫描，AI 只做分级归因） |
| 输出格式 | JSON `{issues: [{severity, type, page, detail}]}` → D1 `audit_issues`（P0-P3 分级） |
| 成本跟踪 | `ai_usage` role="auditor" |
| 当前代码引用 | `os-audit.ts` L17 `loadRole(db, "auditor")`；`os-daily.ts` L724 step=auditor |
| V2 命运 | **保留**——网站审计是 Growth 管线的基础检查层 |

#### ⑥ translator（翻译官）

| 字段 | 值 |
|---|---|
| 角色标识 | `translator` / 翻译官 |
| 系统提示词位置 | `migrations/0017_translator_role.sql` L6（DB 存储） |
| 默认模型 | `deepseek-v4-flash` |
| reasoning_effort | low |
| 触发机制 | POST `/api/admin/translate-products` / POST `/api/admin/import-1688` / POST `/api/admin/import-excel` |
| 输入数据 | `{names: ["中文名1", ...]}` |
| 输出格式 | `{translations: ["English 1", ...]}` → 直接回填产品表字段 |
| 成本跟踪 | `ai_usage` role="translator" |
| 模型路由 | Model Router 档位 `translate` → flash（低风险高频） |
| 当前代码引用 | `translate-products.ts` L64 / `import-1688.ts` L52 / `import-excel.ts` L41 |
| V2 命运 | **保留**——翻译是高频操作，flash 模型低成本运行；如有更专业的翻译 API（如 DeepL）可**扩展**对接但不替换 AI 路线 |

#### ⑦ product_copywriter（商品文案师）

| 字段 | 值 |
|---|---|
| 角色标识 | `product_copywriter` / 商品文案师 |
| 系统提示词位置 | `migrations/0018_product_copywriter_role.sql` L7（DB 存储）；回退硬编码 `ai-product.ts` L60 `FALLBACK_COPY_PROMPT` |
| 默认模型 | `deepseek-v4-pro` |
| reasoning_effort | low |
| 触发机制 | POST `/api/admin/ai-product`（单商品）/ POST `/api/admin/ai-batch-generate`（批量） |
| 输入数据 | 商品上下文：title / category / description / materials / moq / key_features / specifications |
| 输出格式 | JSON `{title, short_description, seo_title, seo_description, key_features[], product_highlights[]}` → 后台表单自动填充（不直接发布） |
| 成本跟踪 | `ai_usage` role="product_copywriter" |
| 真实性闸门 | 产出为用户可见字段，**须人工确认后发布**（不自动写入 GitHub）；提示词约束「不编造认证、参数或统计数据」 |
| 当前代码引用 | `ai-product.ts` L121 / `ai-batch-generate.ts` L86 |
| V2 命运 | **保留**——商品文案是 Shop 运营核心能力。可**扩展**：在 Model Router 开启后对低风险字段（title 优化 / 规范补齐）走 flash，对完整生成走 pro |

#### ⑧ video_content_editor（视频内容编辑助手）

| 字段 | 值 |
|---|---|
| 角色标识 | `video_content_editor` / 视频内容编辑助手 |
| 系统提示词位置 | `migrations/0047_video_content_package.sql` L92（DB 存储） |
| 默认模型 | `deepseek-v4-flash` |
| reasoning_effort | low |
| 触发机制 | POST `/api/admin/video-content-package/[id]/generate` |
| 输入数据 | 视频转写稿 + 公开元数据（标签/发布渠道） |
| 输出格式 | JSON `{title, description, seo_title, seo_description, category, tags[], recommended_products[], warnings[], confidence, evidence[]}` → 草稿供人工审核 |
| 成本跟踪 | `ai_usage` role="video_content_editor" |
| 真实性闸门 | 提示词硬约束：「不能观看或解释视频帧；仅可使用转写稿 + 元数据 + 已关联产品的公开事实；不得编造规格/材质/认证/MOQ/价格/性能声明/工厂能力/客户名/数字声明；转写稿为空或过短返回 warnings 不发明内容；所有输出为草稿须人工审核」 |
| 当前代码引用 | `video-content-package/[id]/generate.ts` L69 / L159 |
| V2 命运 | **保留**——视频内容包是 V5.46 新增能力，flash 低成本运行合理 |

---

### 2.2 内联角色（不在 ai_roles 中，prompt 硬编码在源码）

#### ⑨ content_writer（内容写手）

| 字段 | 值 |
|---|---|
| 角色标识 | `content_writer` |
| 系统提示词位置 | `functions/api/admin/content-generate.ts` L130–156 `CONTENT_WRITER_PROMPT`（硬编码） |
| 默认模型 | Model Router `resolveModelForTask(env, "content_writer")` → 默认关→回退 `deepseek-v4-pro`；路由表 `content_writer → pro` |
| 触发机制 | POST `/api/admin/content-generate`（手动）；cron 可通过 `CONTENT_FACTORY_LIVE=on` + cron-pull 自动触发 |
| 输入数据 | 选题：keyword + category + angle + locale（共 19 组预设选题，覆盖 B2B 核心主题：香薰蜡烛、OEM/ODM、Fragrance Oils、酒店香氛…） |
| 输出格式 | JSON `{title, excerpt, seoTitle, seoDescription, category, tags[], keywords[], faq[], relatedProducts[], relatedGuides[], body (Markdown 900-1400w)}` → 质量闸（≥80/100）→ 真实性闸（blocked 拦截）→ KV draft:* + L2 REVIEW 任务 |
| 成本跟踪 | `ai_usage` role="content_writer" |
| 真实性闸门 | 全量通过 `checkContentDraft(draft)` 五字段检查；blocked 不写入 KV 不创建任务 → 🔴 高危告警；warnings 随 REVIEW 展示 |
| 当前代码引用 | `content-generate.ts` L287 / L305 / L312 |
| V2 命运 | **保留**——内容工厂是 Demand Generation（需求生成）核心管线。可**扩展**：当 CONTENT_FACTORY_LIVE 开启后，cron 自动跑，质量/真实性双闸达标后自动入 REVIEW 队列 |

#### ⑩ ai_brief（每日简报生成器）

| 字段 | 值 |
|---|---|
| 角色标识 | `ai_brief` |
| 系统提示词位置 | `functions/api/admin/ai-brief.ts` L17 `SYSTEM_PROMPT`（硬编码） |
| 默认模型 | `deepseek-v4-pro`（aiCall 默认） |
| 触发机制 | POST `/api/admin/ai-brief`（手动） |
| 输入数据 | 近 7 天业务统计：inquiries / orders / products_by_status / behavior_events |
| 输出格式 | JSON `{summary, issues[], opportunities[], signals[], health_score (LEGACY DEPRECATED), top_3_actions[]}` → D1 `ai_daily_briefs` |
| 成本跟踪 | `ai_usage` role="ai_brief" |
| 注意 | `health_score` 已被 V5.415 标记为 LEGACY DEPRECATED——SSOT 已迁移到 `ai_daily_report.health_score` |
| 当前代码引用 | `ai-brief.ts` L155 |
| V2 命运 | **合并**——建议并入 os-daily / daily_report 统一流水线，不单独维护一条路线 |

---

### 2.3 纯代码角色（不调用 AI）

#### ⑪ Data Collector（数据采集）

| 字段 | 值 |
|---|---|
| 角色标识 | Data Collector（数据采集） |
| 触发机制 | GitHub Actions cron (UTC 6:00) → POST `/api/admin/cron-pull?phase=gsc` / `phase=ga4` / `phase=backfill` |
| 输入数据 | GSC API + GA4 Data API |
| 输出 | D1 `gsc_daily`（4 维度：query/page/country/device + query×page 交叉表 `gsc_query_page`）+ D1 `ga_daily`（4 维度：country/device/source/page） |
| 成本 | 零 AI 成本（纯 API 读取 + D1 upsert） |
| 当前代码引用 | `cron-pull.ts` L248 / L300 / L351（mission agent_name） |
| V2 命运 | **保留**——数据采集是所有 Growth 管线的基础，纯代码实现无 AI 依赖 |

#### ⑫ Opportunity Analyst（机会引擎）

| 字段 | 值 |
|---|---|
| 角色标识 | Opportunity Analyst（机会引擎） |
| 触发机制 | cron-pull phase=growth → `runGrowthSync()` |
| 核心逻辑 | `growth-engine.ts` 纯函数：6 种机会类型（page1_candidate/protect/low_ctr/content_gap/query_page_mismatch/index_issue/shopping）+ Query Intent Mapping（commercial/transactional/informational/navigational）+ Growth Score 排序（impact × confidence ÷ effort × (1-risk/2)） |
| 合并模块 | `growth-audit.ts` 技术审计（canonical/hreflang/title/meta/h1/JSON-LD/alt/死链/孤页/sitemap）→ findings 合并入 `growth_opportunities` 同表同排序 |
| 输出 | D1 `growth_opportunities`（按周去重）+ 路由为 tasks（autofix 开关控制哪些进 L3） |
| 成本 | 零 AI 成本（纯函数引擎） |
| 权限 | 路由时调用 `checkCreationBudget()`（action-budget）+ `enforceMode()`（permissions） |
| 当前代码引用 | `cron-pull.ts` L761 / `growth-sync.ts` |
| V2 命运 | **保留+扩展**——Growth Engine 是 Demand Generation 核心引擎。可**扩展**更多机会类型（如 video_content_gap / shopping_freshness）和更细粒度的 Growth Score 参数 |

#### ⑬ Mission Planner（规则驱动）

| 字段 | 值 |
|---|---|
| 角色标识 | Mission Planner（规则驱动） |
| 触发机制 | `generateDailyReport()` + `writeMissionPlans()` 自动触发 |
| 核心逻辑 | `mission-log.ts` STANDARD_CYCLE 规则模板——6 个标准任务类型按固定顺序排列，不调用 AI |
| 输出 | D1 `ai_mission_plan`（明天计划 + 未来 7 天预览），confidence_score 0.80–0.90 |
| 成本 | 零 AI 成本 |
| 当前代码引用 | `mission-log.ts` L562–586 |
| V2 命运 | **保留**——计划生成用确定性模板是正确的架构选择。可**扩展**：在数据积累足够后对 confidence_score 做真实统计 |

#### ⑭ Task Executor（任务执行器）

| 字段 | 值 |
|---|---|
| 角色标识 | Task Executor（任务执行器） |
| 触发机制 | POST `/api/admin/task-execute`（手动，admin cookie + reviewApproved 判断）+ cron-pull growth 阶段路由 |
| 核心逻辑 | `task-execute.ts`：权限闸（enforceMode 重裁定）→ 真实性闸（payload 文本 run checkClaims）→ 预算闸（checkProductionWriteBudget）→ 幂等（task_runs 唯一索引）→ 执行前后 GSC 快照 → Task Memory |
| 安全开关 | `TASK_EXECUTOR_LIVE` 默认关闭（内容修改型执行器只记录意图 NO_EFFECT） |
| 成本 | 零 AI 成本（路由执行能力，不调用模型） |
| 当前代码引用 | `task-execute.ts` L223 / L241 / L267 / L294 / L339 / L419 |
| V2 命运 | **保留**——任务执行是闭环的最后一步。V2 中随 autofix 数据积累可逐步开启 TASK_EXECUTOR_LIVE |

---

### 2.4 辅助 AI 角色（无独立角色名，嵌入特定端点）

#### ⑮ AI Assist（CMS 编辑器 AI 辅助）

| 字段 | 值 |
|---|---|
| 端点 | POST `/api/admin/ai-assist` |
| 任务类型 | optimize_title / optimize_desc / optimize_body / suggest_links / full_audit |
| 模型 | `deepseek-v4-pro`（deepseekJson 默认） |
| 成本跟踪 | `ai_usage` role 由调用方传入 |
| 触发 | CMS 编辑器手动触发 |
| 输出 | `{suggestion, alternatives[], reasoning}` → 返回 CMS 前端展示 |
| 当前代码引用 | `ai-assist.ts` L77–178 |
| V2 命运 | **保留**——编辑器 AI 辅助是 CMS 内容运营的日常工具 |

#### ⑯ os-reports（周报/月报/季报生成）

| 字段 | 值 |
|---|---|
| 端点 | POST `/api/admin/os-reports` |
| 模型 | `deepseek-v4-pro`（硬编码 L68） |
| 模式 | thinking mode（AI 深度分析） |
| 输出 | D1 `ai_reports` |
| 触发 | cron 或手动 |
| 当前代码引用 | `os-reports.ts` L68 |
| V2 命运 | **保留**——周期性报告是 OS 标准能力 |

---

## 三、AI 调用点分布地图

### 3.1 定时触发（Cron）

```
GitHub Actions cron: 0 6 * * * UTC
  │
  └─ POST /api/admin/cron-pull (Bearer CRON_SECRET)
       │
       ├─ phase=gsc     → Data Collector（纯 API，无 AI）
       ├─ phase=ga4     → Data Collector（纯 API，无 AI）
       ├─ phase=recs    → Analyst（AI：deepseekJson，8-12 条建议）
       │                   └─ 回退规则引擎（AI 不可用时）
       ├─ phase=growth  → Opportunity Analyst（纯函数，无 AI）
       │                → runGrowthSync → growth_opportunities → tasks
       │                → generateDailyReport + writeMissionPlans
       │                → sendDailyDigest（如有昨日未发日报兜底补发）
       └─ phase=backfill → Data Collector（纯 API，无 AI）
```

### 3.2 四角色日循环（Cron 分 step 独立触发）

```
POST /api/admin/os-daily (Bearer CRON_SECRET, 分 5 step)
  │
  ├─ step=analyst    → Analyst（AI：aiJson）+ saveKnowledge（observation 层）
  │                     输入：GSC/GA4/behavior/inquiries 7d
  │
  ├─ step=librarian  → Librarian（AI：aiJson）+ saveKnowledge（finding/rule/principle 层）
  │                     输入：knowledge observation 层近 3 天 + ai_feedback
  │
  ├─ step=strategist → Strategist（AI：aiJson）+ D1 tasks 表
  │                     输入：knowledge Top-20 + pending tasks + decisions 30d
  │                     输出 tasks[].execution_mode → 但在执行侧会被 enforceMode 重裁定
  │
  ├─ step=executor   → Executor（AI：aiJson）+ D1 tasks 回填 actual_result/outcome
  │                     输入：pending tasks + GSC/GA 验证数据
  │
  └─ step=auditor    → Auditor（AI：aiJson）+ audit_issues
                        → generateDailyReport（纯代码）→ sendDailyDigest（邮件）
                        → evaluatePipelineAlerts（告警自检）
```

### 3.3 人工触发（Admin Cookie）

| 端点 | 角色 | 权限 | 输出目的地 |
|---|---|---|---|
| `POST /api/admin/content-generate` | content_writer | L2 REVIEW（永不自动发布） | KV draft:* + D1 tasks |
| `POST /api/admin/ai-product` | product_copywriter | 表单自动填充（须人工确认） | 返回 JSON → CMS 前端 |
| `POST /api/admin/ai-batch-generate` | product_copywriter | 同上 | D1 commerce_products 字段更新 |
| `POST /api/admin/ai-assist` | 内联 AI（5 种任务） | 纯建议展示 | 返回 JSON → CMS 前端 |
| `POST /api/admin/translate-products` | translator | 直接回填产品表 | D1 commerce_products variants 字段 |
| `POST /api/admin/import-1688` | translator | 直接回填 | D1 commerce_products 翻译字段 |
| `POST /api/admin/import-excel` | translator | 直接回填 | D1 commerce_products 翻译字段 |
| `POST /api/admin/os-audit` | auditor | 审计分级（P0-P3） | D1 audit_issues |
| `POST /api/admin/ai-brief` | ai_brief | 简报生成 | D1 ai_daily_briefs |
| `POST /api/admin/ai-opportunities` | 纯规则引擎（无 AI） | 机会扫描 | D1 ai_opportunities（旧表） |
| `POST /api/admin/ai-lead-score` | 纯规则引擎（无 AI） | 询盘评分 | D1 ai_lead_scores |
| `POST /api/admin/task-execute` | Task Executor（无 AI） | 三道闸门 + 执行 | D1 tasks / GitHub（仅 meta/alt/内链） |
| `POST /api/admin/os-daily` | 四角色（可选 step） | 完整日循环 | D1 knowledge/tasks/audit_issues |
| `POST /api/admin/os-reports` | 内联 AI（thinking mode） | 报告存档 | D1 ai_reports |
| `POST /api/admin/ai-roles` | 指定角色测试 | 试跑不写库 | 返回 AI response |
| `POST /api/admin/autonomy` | Human Operator | 开关切换（留痕） | KV config:growth_autofix_enabled |
| `POST /api/admin/video-content-package/[id]/generate` | video_content_editor | 草稿人工审核 | D1 video_content_package 字段 |

### 3.4 各角色在各端点的调用统计

| 角色 | cron-pull | os-daily | 手动端点 |
|---|---|---|---|
| Analyst（增长分析师） | phase=recs | step=analyst | POST os-daily |
| Librarian（知识管理员） | — | step=librarian | POST os-daily |
| Strategist（策略总监） | — | step=strategist | POST os-daily |
| Executor（执行教练/结果验证官） | — | step=executor / step=verifier | POST os-daily |
| Auditor（审计官） | — | step=auditor | POST os-audit / POST os-daily |
| Data Collector（数据采集） | phase=gsc/ga4/backfill | — | — |
| Opportunity Analyst（机会引擎） | phase=growth | — | POST ai-opportunities |
| Task Executor（任务执行器） | phase=growth（路由） | — | POST task-execute |
| Mission Planner（规则驱动） | phase=growth（日报+计划） | step=auditor（日报+计划） | — |
| content_writer | — | — | POST content-generate |
| product_copywriter | — | — | POST ai-product / ai-batch-generate |
| translator | — | — | POST translate-products / import-1688 / import-excel |
| ai_brief | — | — | POST ai-brief |
| video_content_editor | — | — | POST video-content-package/[id]/generate |

---

## 四、AI 数据流图

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          DATA SOURCES                                     │
│                                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ GSC API  │  │ GA4 API  │  │ behavior │  │inquiries │  │ Commerce   │ │
│  │ (query/  │  │ (country │  │ _events  │  │ 表       │  │ Products   │ │
│  │ page/    │  │ /device/ │  │ (D1)     │  │ (D1)     │  │ (D1)       │ │
│  │ country/ │  │ source/  │  │          │  │          │  │            │ │
│  │ device)  │  │ page)    │  │          │  │          │  │            │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘ │
│       │             │             │             │              │         │
└───────┼─────────────┼─────────────┼─────────────┼──────────────┼─────────┘
        │             │             │             │              │
        ▼             ▼             ▼             ▼              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       D1 STORAGE LAYER                                    │
│                                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐ │
│  │gsc_daily │ │ga_daily  │ │knowledge │ │decisions │ │pull_state     │ │
│  │gsc_query │ │          │ │(四级)    │ │          │ │(拉取账本)     │ │
│  │_page     │ │          │ │          │ │          │ │               │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────────────┘ │
│       │             │             │             │                         │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌───────────────┐ │
│  │tasks     │ │ai_missions│ │ai_action │ │ai_daily  │ │ai_mission_plan│ │
│  │task_runs │ │          │ │_logs     │ │_report   │ │               │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────────────┘ │
│       │             │             │             │                         │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐                   │
│  │growth    │ │daily_recs│ │audit     │ │ai_feedback│                   │
│  │_opps     │ │          │ │_issues   │ │          │                   │
│  │growth    │ │          │ │          │ │          │                   │
│  │_actions  │ │          │ │          │ │          │                   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                   │
└──────────────────────────────────────────────────────────────────────────┘
        │
        │ 纯代码读取
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     AI PROCESSING LAYER                                   │
│                                                                           │
│  ┌───────────────────────────────────────────────┐                       │
│  │ os-daily 四角色流水线                           │                      │
│  │ Analyst → Librarian → Strategist → Executor    │                      │
│  │ (aiJson × 4, model=deepseek-v4-pro, thinking)  │                      │
│  └───────────────────────┬───────────────────────┘                       │
│                          │                                               │
│  ┌───────────────────────┴───────────────────────┐                       │
│  │ cron-pull 每日运营建议                           │                      │
│  │ Analyst (deepseekJson) + 规则引擎兜底            │                      │
│  └───────────────────────┬───────────────────────┘                       │
│                          │                                               │
│  ┌───────────────────────┴───────────────────────┐                       │
│  │ Growth Engine (纯函数，零 AI)                    │                      │
│  │ opportunity engine + growth-audit.ts           │                      │
│  │ + Growth Score 排序 + Autofix 路由              │                      │
│  └───────────────────────┬───────────────────────┘                       │
│                          │                                               │
│  ┌───────────────────────┴───────────────────────┐                       │
│  │ 手动端点 AI                                        │                      │
│  │ content_writer / product_copywriter /           │                      │
│  │ translator / ai_brief / video_content_editor /  │                      │
│  │ auditor / os-reports / ai-assist               │                      │
│  └───────────────────────────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────────────┘
        │
        │ AI 产出
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      SECURITY GATE LAYER                                  │
│                                                                           │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐ │
│  │ 权限闸       │──▶│ 真实性闸     │──▶│ 预算闸       │──▶│ 幂等地基     │ │
│  │ enforceMode │   │ checkClaims │   │ checkBudget │   │ idempotency │ │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
        │
        │ 通过后
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        OUTPUT LAYER                                       │
│                                                                           │
│  AI 可写：                                                                │
│  ├─ D1 knowledge / tasks（L2/L3） / daily_recs                           │
│  ├─ D1 growth_opportunities / growth_actions                             │
│  ├─ D1 ai_missions / ai_action_logs / ai_daily_report / ai_mission_plan │
│  ├─ D1 audit_issues / ai_lead_scores / ai_feedback                       │
│  ├─ KV draft:*（绝不进 GitHub/生产）                                      │
│  ├─ KV config:*（开关状态）                                                │
│  └─ R2 aromiso-kb（统一知识档案）                                          │
│                                                                           │
│  AI 绝不写入（红线）：                                                     │
│  ├─ GitHub 仓库（ghPut）— 除人工在 CMS 点"发布"外不触发                   │
│  ├─ commerce_products 价格/认证/案例/合规字段                             │
│  ├─ 对外邮件/报价 — AI 永不发                                             │
│  └─ Google Indexing API — 不使用                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 五、V2 保留计划

### 5.1 必须完整保留（不改结构、不删、不重构）

| 模块 | 文件 | 原因 | V2 行为 |
|---|---|---|---|
| **权限闸门** | `functions/lib/permissions.ts` | 独立纯函数，安全不变量——enforceMode 的代码层裁定逻辑是防 prompt 注入的基石 | 原样保留，V2 只扩展 TASK_TYPE_POLICY 表项 |
| **真实性闸门** | `functions/lib/truthfulness.ts` + `fact-registry.json` | 纯函数+事实权威层——五条红线的正则判定 + Fact Registry 是 Truthfulness First 的唯一入口 | 原样保留，V2 只扩展 redLines 表项 |
| **预算闸门** | `functions/lib/action-budget.ts` | 三级预算 + KV 可覆盖——路由/执行双侧语义正确；统计失败 fail-safe 路径已落地 | 原样保留，V2 只调整默认阈值 |
| **任务记录层** | `functions/lib/mission-log.ts` | 可观察、可追溯、可复盘的唯一地基——所有 AI 行为写入两张核心审计表 | 原样保留，V2 扩展 mission_type 枚举 |
| **AI 调用层** | `functions/lib/ai.ts` | 统一调用 + 预算保护 + 角色加载 + 知识注入——所有 AI 调用的必经之路 | 原样保留，V2 扩展定价表 |
| **Model Router** | `functions/lib/model-router.ts` | 任务→模型路由表，默认关零漂移——正确架构 | 原样保留，V2 可扩展更多 task kind |
| **幂等地基** | `functions/lib/idempotency.ts` | 同一 T-2 日期+phase 只成功执行一次 | 原样保留 |
| **数据四态** | `functions/lib/data-state.ts` | 防 0=坏数据的基础防御层 | 原样保留 |
| **Fact Registry** | `functions/lib/fact-registry.json` | 事实权威层运行时副本——所有 AI 生成内容的事实裁定唯一入口 | 原样保留，改事实必须同步 `SUPPLY_CHAIN_CAPABILITIES.md` |

### 5.2 保留 + 扩展（保留核心逻辑，扩展能力）

| 角色/模块 | 扩展方向 | 条件 |
|---|---|---|
| **Analyst** | 增加更多数据源（GA4 更多维度、GSC 更多维度、视频表现数据） | 数据源接入后 |
| **Librarian** | 知识四级体系增加「视频内容」category | 视频内容包积累数据后 |
| **Strategist** | 任务类型扩展：新增 `video_meta_fix`（L3） / `product_content_refresh`（L2） | 新 task_type 写入 TASK_TYPE_POLICY 前须通过权限闸安全评审 |
| **Executor/Verifier** | T+14 实验闭环比 verifier 独立 step | 与 growth_actions 对齐 |
| **Opportunity Analyst** | 新机会类型：video_content_gap / shopping_freshness / bdf_coverage | 纯函数扩展，无 AI 风险 |
| **Task Executor** | 从只记录意图到真正的 meta_fix / alt_text_fill / internal_link L3 自动执行 | `TASK_EXECUTOR_LIVE=on` + autofix 数据证明 |
| **content_writer** | cron 自动跑（CONTENT_FACTORY_LIVE=on）+ 更多选题 | 质量/真实性闸持续过数据 |
| **product_copywriter** | 对低风险字段（title 优化 / 规范补齐）走 Model Router flash | Model Router 开启后 |
| **translator** | 对接更专业翻译 API（如 DeepL）作为补充路线 | 不替换 AI 路线，作为 fallback 增强 |

### 5.3 合并（保留能力但合并管线）

| 模块 | 合并方向 | 原因 |
|---|---|---|
| **ai_brief** | 并入 os-daily / ai_daily_report 统一流水线 | 单独的 brief 生成路线冗余；其 health_score 已 deprecated，SSOT 已迁移到 ai_daily_report |

### 5.4 替换（被新能力替代）

| 模块 | 替换方案 | 原因 |
|---|---|---|
| （当前无） | — | 架构设计正确，无需替换的模块 |

### 5.5 硬安全不变量——V2 任何改动都不可破坏的约束

1. **`enforceMode(task_type)` 总在代码层重新裁定权限等级**——AI 写入的 `execution_mode` 从不被信任
2. **任意一条闸门 FAIL → 动作被阻止**（block / 429 / 422 / NO_ACTION），带完整审计留痕
3. **所有对外发布路径（GitHub 写、邮件发、Google API 写）均不在 AI 可及范围内**
4. **通知层（email）由系统规则从结构化日志生成，AI 不参与发信决策**
5. **"Human owns commercial relationship"**——聊客户、发不发、价格/MOQ/交期/付款谈判、成交永远由 owner 掌控
6. **FORBIDDEN_TASK_TYPES 不可缩减**——10 类硬禁止动作（删页/改价/支付/报价/资质声明/发布/发邮件/合同）不可被任何开关打开
7. **Fact Registry 是事实裁定唯一入口**——改事实必须同步 `docs/SUPPLY_CHAIN_CAPABILITIES.md`
8. **记录层永远不阻断主流程**——所有写入 try/catch 吞错

---

## 六、关键数值汇总

| 参数 | 值 | 源码位置 |
|---|---|---|
| 月 AI 预算硬上限 | ¥30 CNY | `ai.ts` L35 |
| 预算降级 1 线 | ¥15（≥ 强制 flash） | `ai.ts` L102 |
| 预算降级 2 线 | ¥24（≥ 跳过非关键 AI） | `ai.ts` L101 |
| 预算耗尽线 | ¥30（阻断所有 AI） | `ai.ts` L100 |
| Flash 输入单价 | ¥1/M tokens | `ai.ts` L29 |
| Flash 输出单价 | ¥2/M tokens | `ai.ts` L29 |
| Pro 输入单价 | ¥3/M tokens | `ai.ts` L30 |
| Pro 输出单价 | ¥6/M tokens | `ai.ts` L30 |
| meta_fix 日上限 | 10 | `action-budget.ts` L33 |
| alt_text_fill 日上限 | 20 | `action-budget.ts` L33 |
| internal_link 日上限 | 10 | `action-budget.ts` L33 |
| per_mission_max | 5 | `action-budget.ts` L34 |
| daily_production_writes | 30 | `action-budget.ts` L35 |
| 技术审计 maxPages | 10 | `growth-audit.ts` |
| 技术审计 maxLinkChecks | 15 | `growth-audit.ts` |
| Index Monitor /次 | ≤12 | `growth-sync.ts` |
| 内容工厂每次 max | 3 篇 | `content-generate.ts` |
| AI 调用超时 | 120s (aiCall) / 90s (deepseekChat) | `ai.ts` L24 / `deepseek.ts` L16 |
| 孤儿任务阈值 | 30min（running→blocked） | `mission-log.ts` L99 |
| Health Score 档位 | ≥85 GREEN / 60–84 YELLOW / <60 RED | `mission-log.ts` L53 |
| Model Router 默认 | 关（回退 deepseek-v4-pro） | `model-router.ts` L73–79 |
| autofix 开关默认 | 关（config:growth_autofix_enabled ≠ "on"） | `autonomy.ts` L60 |
| CONTENT_FACTORY_LIVE | 默认关 | `content-generate.ts` |
| TASK_EXECUTOR_LIVE | 默认关 | `autonomy.ts` L85 |

---

## 附录：源码文件索引

| 文件 | 行数 | 内容 |
|---|---|---|
| `functions/lib/permissions.ts` | 183 | 权限四级闸门 + enforceMode + canAutoExecute |
| `functions/lib/truthfulness.ts` | 563 | 5 条红线 + checkClaims + checkContentDraft |
| `functions/lib/action-budget.ts` | 258 | 三级预算 + checkCreation/Production/MissionBudget |
| `functions/lib/mission-log.ts` | 643 | startMission / finishMission / logAction / withMission / generateDailyReport / writeMissionPlans |
| `functions/lib/ai.ts` | 578 | 统一 aiCall + 角色加载 aiRoleCall + 预算保护 + 知识注入 |
| `functions/lib/model-router.ts` | 80 | 任务→模型档位路由 + Model Router 开关 |
| `functions/lib/fact-registry.json` | 57 | 事实权威层（Fact Authority Layer） |
| `functions/lib/growth-sync.ts` | 594 | Growth Sync 核心：机会引擎 + 审计 + 路由 |
| `functions/lib/growth-engine.ts` | — | 纯函数机会引擎（6 种机会类型） |
| `functions/lib/growth-audit.ts` | — | 纯函数技术审计 |
| `functions/api/admin/deepseek.ts` | 286 | deepseekChat / deepseekJson / knowledgeBase |
| `functions/api/admin/ai.ts` | — | 旧版 aiCall（已迁移到 lib/ai.ts） |
| `functions/api/admin/cron-pull.ts` | 901 | Cron 主入口：GSC/GA4/recs/growth/backfill 五阶段 |
| `functions/api/admin/os-daily.ts` | 931 | 四角色日循环：Analyst→Librarian→Strategist→Executor+Auditor |
| `functions/api/admin/content-generate.ts` | 525 | 内容工厂：19 组选题 + 质量闸 + 真实性闸 |
| `functions/api/admin/ai-product.ts` | 173 | 单商品 AI 文案生成 |
| `functions/api/admin/ai-batch-generate.ts` | 263 | 批量商品 AI 文案生成 |
| `functions/api/admin/ai-assist.ts` | 238 | CMS 编辑器 AI 辅助（5 种任务） |
| `functions/api/admin/translate-products.ts` | — | 产品翻译回填 |
| `functions/api/admin/ai-roles.ts` | 157 | AI Role Center CRUD |
| `functions/api/admin/autonomy.ts` | 137 | 自主运行边界控制台 |
| `functions/api/admin/ai-brief.ts` | 241 | 每日简报生成 |
| `functions/api/admin/os-audit.ts` | 222 | 网站审计 |
| `functions/api/admin/os-reports.ts` | — | 周报/月报/季报 |
| `functions/api/admin/task-execute.ts` | — | 任务执行器 |
| `functions/api/admin/ai-lead-score.ts` | 220 | 询盘评分（纯规则引擎） |
| `functions/api/admin/ai-opportunities.ts` | 157 | 机会扫描（纯规则引擎） |
| `functions/api/admin/ai-feedback.ts` | — | AI 反馈记录 |
| `functions/api/admin/notify.ts` | — | 邮件通知层 |
| `functions/lib/notify.ts` | — | 通知层库函数 |
| `migrations/0009_aromiso_os.sql` | 135 | ai_roles 表创建 + 5 个初始角色 seed |
| `migrations/0017_translator_role.sql` | 6 | translator 角色 seed |
| `migrations/0018_product_copywriter_role.sql` | 7 | product_copywriter 角色 seed |
| `migrations/0037_ai_autonomous_operations.sql` | 259 | ai_missions + ai_action_logs + ai_daily_report + ai_mission_plan |
| `migrations/0047_video_content_package.sql` | 112 | video_content_editor 角色 seed |