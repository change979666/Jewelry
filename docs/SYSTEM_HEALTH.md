# Aromiso SYSTEM HEALTH — V5.64

> 更新时间：2026-09-07（Asia/Shanghai）。本文件区分本地实现、远端 Git、Pages 部署、D1 schema 和 Worker 部署证据；没有真实运行证据统一写 `NOT MEASURED`。

## 可交接生产基线字段

```text
Production:          DEPLOY VERIFIED / PARTIAL — Pages deployment 4103944c（Source fafdb32）已上线；Email Worker 部署被 token 权限阻断
Git:                 implementation baseline @ 754aaede43c2826feb096f0e374ab2971cc6909f；docs-only evidence commits follow；remote tested content @ fafdb3254687bcfa1f4cf59490cee19a3fe22299；工作树含用户既有文件
D1:                  DEPLOY VERIFIED — 0083 执行成功（rows_written=1），远端 `attachments_json` 已验证存在
D1 Guard:            CODE VERIFIED — daily exhaustion fail-closed；SELECT 1 不提前解除 CRITICAL
Automation:          CODE VERIFIED/PARTIAL — trigger→guard→worker→retry→fallback；真实恢复周期未测量
Studio:               BLOCKED_EXTERNAL — 真实启动尝试失败，permission denied (os error 5)
Local AI:             PASS（诊断）/BLOCKED（Studio 运行）— 当前 status=stopped；最近一次 start 为 startup_failed 且已回读权限根因
Admin:                DEPLOY VERIFIED / PARTIAL — 匿名后台 302、管理 API 401；认证浏览器 mutation 未取得会话证据
Email:                PARTIAL — Pages/API 与 D1 schema 已部署；Email Worker 因 token 缺少 workers/services 权限未部署
Commerce:             CODE VERIFIED — 客户/询盘/内容边界修复已通过测试
Product Localization: BLOCKED_EXTERNAL — 19 个候选等待 D1 配额恢复后小批量执行
SEO:                  PASS — 三语 SSG、sitemap、canonical、hreflang、JSON-LD 构建通过
Security:             PASS — RBAC、转义、附件白名单、私有 R2 key 保护

Last successful automation: NOT MEASURED（D1 配额阻断期间不制造业务 reads）
Last verified code deployment: Pages `4103944c-f03e-44fb-81de-f4d94de4095b`（Source `fafdb32`）；后续 Pages 部署为 docs-only sync；Worker 未部署
Current D1 state:           NOT MEASURED（历史曾为 CRITICAL；本轮只验证 schema 与迁移结果）
Current blockers:            Email Worker 部署权限、D1 配额恢复后的自动化周期、管理员会话、Studio Windows 权限
```

## Final acceptance

| Area | Status | Evidence |
| --- | --- | --- |
| Production | DEPLOY VERIFIED / PARTIAL | Pages deployment `4103944c`（Source `fafdb32`）；`/en/` 200、`/admin-v2/customers/emails/` 302；Email Worker 尚未部署 |
| Admin V2 | BLOCKED_EXTERNAL | 页面静态产物与匿名 HTTP 已检查；登录后真实浏览器闭环未取得 |
| Authentication / RBAC | PASS | 未登录 API=401；有效旧 V2 session 遇 D1 quota 时只读降级；写入权限仍拒绝 |
| Automation | PARTIAL | 新版 heartbeat/fallback 线上实测 200 且健康分支正确；D1 quota=CRITICAL，恢复后连续业务周期未测量 |
| D1 Guard | PASS | 线上 `/api/admin/v2/system/d1-health` 返回 `state=CRITICAL`、`probe=false`、明确 reset 时间 |
| D1 Observability | PARTIAL | request_metric 结构化日志已部署；真实 hourly read/top source 未测量 |
| Studio Recovery | BLOCKED_EXTERNAL | 状态字段与 stale 逻辑已改；运行中的 Studio 进程尚未重启，fallback 未实跑 |
| Vision Security | PASS | 代码与测试覆盖 401/403/200 权限边界、usage 记录、key 脱敏 |
| V1 API Migration | PARTIAL | 迁移矩阵已建立；当前调用方仍为 ACTIVE，尚未逐项迁移 |
| SEO | PASS | 三语 SSG、sitemap、robots、canonical、hreflang、JSON-LD、301 构建/HTTP 检查通过 |
| Tests | PASS | check 0 error；lint/format 通过；本地 276/276 tests；build 2522 pages |
| Deployment | DEPLOY VERIFIED / PARTIAL | smart-push remote `fafdb3254687bcfa1f4cf59490cee19a3fe22299`；Pages 已部署，Worker 因权限未部署 |

## Current runtime facts

```text
Implementation commit: 754aaede43c2826feb096f0e374ab2971cc6909f
Production code commit: fafdb3254687bcfa1f4cf59490cee19a3fe22299 (smart-push; Pages deployment 4103944c)
D1 quota:            historical EXHAUSTED snapshot; current quota state NOT MEASURED
D1 guard:            historical CRITICAL snapshot; current post-reset guard state NOT MEASURED
D1 hourly reads:     NOT MEASURED
Top read source:     NOT MEASURED

Automation:
trigger:             transport 3/3; business 0/3 (guard blocked)
worker:              transport 2/2; business 0/2 (guard blocked)
processed:           0; confirmed guard skip, not no-work
retry:               Studio old process fail_streak=2; cloud retry cap=6x
failure:             D1 quota; one earlier transient SSL EOF
recovery:            healthy fallback branch verified; stale takeover and post-reset recovery NOT MEASURED

Studio:
heartbeat:           code implemented; live new-process value NOT MEASURED
scheduler:           single Windows process
stale:               code threshold = 45 minutes without Studio heartbeat
fallback:            GitHub Actions ai-automation.yml hourly; healthy branch live verified; stale takeover NOT MEASURED
watchdog:            hourly GitHub Actions heartbeat check + KV takeover lock; live takeover NOT MEASURED

Admin:
core flows verified: anonymous redirects/API 401 only; authenticated browser mutation flow NOT MEASURED

V1 APIs:
active:              13 (faqs, subscribers, email-send, email-thread, ai-lead-score, video-center,
                     commerce-products, upload, knowledge, cron-pull, os-daily, os-reports, os-audit)
migrating:           0
deprecated:          0
ready_to_remove:     0

P0:                  1
P1:                  5
P2:                  2
```

## Remaining problems

| Priority | Problem | Evidence | Root cause | Can auto fix | Status |
| --- | --- | --- | --- | --- | --- |
| P0 | 配额恢复后的自动化连续运行未证实 | D1 当前仍 `CRITICAL`；业务读取仍被 free-tier 拒绝 | 必须等待 Cloudflare 自然 reset | 否，需自然恢复窗口 | BLOCKED_EXTERNAL |
| P1 | Email Worker 与 Pages 版本尚未同时部署 | Pages 与 D1 已验证；`wrangler deploy --config email-worker/wrangler.toml` 返回 API 10000，token 缺少 workers/services 部署权限 | 需要具备 Workers Scripts Write/Deploy 权限的 Cloudflare token，随后按同一远端基线部署 Worker 并做真实收发验收 | 否 | BLOCKED_EXTERNAL |
| P1 | Studio 单点接管未实跑 | `npm run studio:start` 已真实执行；uv trampoline 以 `permission denied (os error 5)` 失败，8711 未监听；fallback 代码已改为 hourly | 当前 Windows 策略阻止 `.venv` Python 子进程 | 否 | BLOCKED_EXTERNAL |
| P1 | D1 来源级 hourly reads 未测量 | request_metric 的 runtime read count 不可直接取得 | 需 Cloudflare Logs/Analytics 权限 | 否 | BLOCKED_EXTERNAL |
| P1 | Admin 登录后核心流程未验证 | 当前只有匿名 HTTP/API 证据 | 当前会话无浏览器控制与可复用 cookie | 否 | BLOCKED_EXTERNAL |
| P1 | 19 个中文商品候选未完成本地化 | 目标映射和幂等代码已修复；D1 配额阻断生产写入 | 需要配额恢复后先小批量 dry-run 和人工抽样 | 否 | BLOCKED_EXTERNAL |
| P2 | V1 API 迁移未开始 | 矩阵中 13 项仍 ACTIVE | 真实调用方尚未逐项切换 | 是，需逐项改动 | FAIL |
| P2 | 636 处历史 query debt 未按 read 排序处理 | 没有来源级 read 数据 | 观测基础尚未完成 | 是，但本轮不批量处理 | NOT_APPLICABLE |

## Operating rule

配额恢复后必须连续记录至少 3 个 automation cycle：trigger、worker、processed、guard、retry、failure、cloud_sync、耗时、重复/丢失任务。任何一个周期只返回 HTTP 200 不能判定成功。

## 2026-09-07 本地接管增量

本地当前 HEAD 为 `f121fb5521ad0d144a40c8b1fe9fd1dfe07c5646`，实现基线为 `754aaede43c2826feb096f0e374ab2971cc6909f`；`npm test` 已通过 26 个测试文件/276 个用例，`check`、`lint`、`format:check` 和 `build` 也已通过。远端 smart-push 内容提交为 `fafdb3254687bcfa1f4cf59490cee19a3fe22299`，Pages 已部署；D1 0083 已执行并验证列存在，Email Worker 仍因 Workers 部署权限未发布。D1 guard 已区分 daily rows-read 耗尽与瞬时限流；当前 guard/配额状态仍需低成本健康证据。

本地 Studio 位于 `D:\aromiso-studio`，启动器和模型目录存在；GPU 可用，但最近一次真实启动因 `permission denied (os error 5)` 失败，当前 `uvicorn`/Ollama 未运行，8711/11434 均未监听。启动失败记录返回 `startup_failed`，无运行中的服务时 `studio:status` 返回 `stopped`。管理员登录后的邮件列表、会话、附件下载和回复发送同样需要真实会话验收。详细状态与未解决项见 [`AI_CURRENT_STATE.md`](./AI_CURRENT_STATE.md) 和 [`AI_OPEN_ISSUES.md`](./AI_OPEN_ISSUES.md)。
