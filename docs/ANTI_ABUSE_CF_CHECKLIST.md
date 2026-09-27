# Aromiso 反滥用 P0 — Cloudflare 仪表盘手动配置清单

> ⚠️ **历史快照 — 非当前文档。** 本文描述的是前身项目 **Aromiso（香薰 B2B）** 时期的实现，
> 其中的 `functions/` 目录、`commerce_*` 表、en/es/de 三语、`/admin`（V1）等均**已不存在**。
> 保留此文仅作迁移对照与决策留痕。**当前架构与约定以 [`README.md`](../README.md) 与
> [`docs/01-项目说明.md`](./01-项目说明.md) 为准。**

> 配套代码改动：`functions/api/_lib/guard.ts` + inquiry/orders 接入（commit 见 IMPLEMENTED_FEATURES V4.7）。
> 本文档列出**必须在 Cloudflare / Resend 仪表盘手工完成**的步骤——代码无法代劳。
> 完成一项勾一项。全部完成后 P0 止血包才真正生效。

---

## 1. Turnstile 人机验证（最关键）

**1.1 创建站点**
- [ ] CF 仪表盘 → **Turnstile** → Add Site
- [ ] Site Name：`aromiso.com`
- [ ] Domain：`aromiso.com`（+ `www.aromiso.com`、预览域名可加 `*.aromiso.com.pages.dev`）
- [ ] Mode：**Managed**（推荐，自动判断是否需要挑战）
- [ ] 创建后复制 **Site Key** 与 **Secret Key**

**1.2 配置 Site Key（前台 widget）**
- [ ] 网站后台 → 设置 → 「Turnstile Site Key」粘贴 Site Key → 保存
- [ ] 保存后站点自动重新构建，联系页/首页/商城询盘/购物车下单 4 个表单出现验证组件

**1.3 配置 Secret Key（后端校验）**
- [ ] CF 仪表盘 → Workers & Pages → `aromiso` 项目 → Settings → Variables and Secrets
- [ ] 新增环境变量 `TURNSTILE_SECRET_KEY` = 你的 Secret Key（**生产 + 预览都要加**）
- [ ] 标记为 Secret（加密）
- [ ] 重新部署一次使变量生效

**验收**：`curl -X POST https://aromiso.com/api/inquiry -H "Content-Type: application/json" -d '{"name":"t","email":"t@t.com","message":"hello"}'` → 返回 `403 Verification failed`。浏览器正常提交 → 通过且用户无感。

> ⚠️ 未配置 Secret 时后端**降级放行**（fail open）并打 error 日志——不会锁死表单，但也没有防护。务必配置。

---

## 2. WAF 边缘限流规则（免费版 1 条）

- [ ] CF 仪表盘 → **安全性 → WAF → 速率限制规则** → 新建
- [ ] 匹配条件：`http.request.uri.path` 等于 `/api/inquiry` **或** `/api/commerce/orders`，且 Method = POST
- [ ] 阈值：每 IP 每 **1 分钟 5 次**
- [ ] 动作：**Managed Challenge**（不要选 Block，防误伤真实买家）
- [ ] 时长：10 分钟

**验收**：`for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://aromiso.com/api/inquiry; done` → 第 6 次起出现 challenge 状态码。

---

## 3. Bot Fight Mode

- [ ] CF 仪表盘 → **安全性 → 机器人** → 开启 **Bot Fight Mode**（免费）
- [ ] 对已知自动化 UA 直接发起挑战

---

## 4. sales@aromiso.com 退信排查（修复主通知链路）

当前 Resend → sales@ 的询盘通知**全部 Bounced**，主通知链路处于故障状态，仅靠 163 转发兜底。逐项排查：

- [ ] **Resend → Suppression list**：查 `sales@aromiso.com` 是否被抑制。若在，移除并查明当初为何退信。
- [ ] **Resend → Domains**：确认 `aromiso.com` 的 SPF / DKIM / DMARC 记录全部 Verified。
- [ ] **CF → Email Routing**：确认 `sales@` 转发目标（163 邮箱）有效且未达转发上限。
- [ ] **测试**：后台触发一条测试询盘，观察 Resend 日志状态由 `Bounced` → `Delivered`。

---

## 5. 黑名单种子（KV）

代码已支持 KV 黑名单（`bl:email:<小写邮箱>` / `bl:name:<小写名字>`），命中即静默丢弃（假成功、不写库、不发信）。初始需手工写入事件中的 4 个邮箱 + "Robertbib"：

```bash
# 用 wrangler（需 KV namespace ID，即 DRAFTS 绑定）
npx wrangler kv:key put --namespace-id=<DRAFTS_ID> "bl:email:carlo.marra@libero.it" "1"
npx wrangler kv:key put --namespace-id=<DRAFTS_ID> "bl:email:arthurmoreno@outlook.com" "1"
npx wrangler kv:key put --namespace-id=<DRAFTS_ID> "bl:email:padillaleye@gmail.com" "1"
npx wrangler kv:key put --namespace-id=<DRAFTS_ID> "bl:email:katrinah@lee-stores.com" "1"
npx wrangler kv:key put --namespace-id=<DRAFTS_ID> "bl:name:robertbib" "1"
```

> 后续可在 P1 后台 Abuse 视图里可视化管理黑名单，无需再手工 wrangler。

---

## 6. 存量 spam 清理（D1）

迁移 `0016_mark_spam_inquiries.sql` 已把已知垃圾询盘标记为 `Spam`（非删除）。

- [ ] 部署后在后台询盘管理确认 Spam 标记无误伤
- [ ] 观察 24h 后，如需彻底删除，手工执行：`DELETE FROM inquiries WHERE status = 'Spam';`

---

## 完成度自检

| 项 | 状态 |
|---|---|
| Turnstile Site Key（前台） | ☐ |
| Turnstile Secret Key（后端 env） | ☐ |
| WAF 限流规则 | ☐ |
| Bot Fight Mode | ☐ |
| sales@ 退信修复 | ☐ |
| 黑名单种子 | ☐ |
| spam 标记核对 | ☐ |

全部勾选后，对照 `docs/ANTI_ABUSE_ARCHITECTURE.md` §11.2 KPI：Resend 日消耗应 <20，垃圾询盘占比 <20%，sales@ 送达率 100%。
