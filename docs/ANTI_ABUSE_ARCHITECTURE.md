# Aromiso 反滥用与信任增长架构开发文档

> 版本：V1.0（2026-08-02）
> 状态：服务端+前端代码已实施并上线（main，2026-08-04 经 GitHub API 核实 guard.ts/Turnstile.astro/settings.json 均在远程 main）。**剩余仅 CF/Resend 控制台激活**：TURNSTILE_SECRET_KEY / WAF 速率规则 / Bot Fight Mode / sales@ 退信排查（密钥类操作需人工在控制台完成）。
> 触发事件：2026-08-01 晚至 08-02 晨询盘接口遭自动化垃圾提交轰炸（"Robertbib" 事件）
> 执行规则：本文档所有改动需逐项确认后执行；未确认前不改动任何现有文件。
> 关联文档：`docs/GROWTH_OPTIMIZATION_PLAN.md`（SEO/内容侧，已完成 7 项整改）

---

## 第一部分：背景与事件复盘

### 1.1 事件时间线

2026-08-01 晚至 08-02 早，`POST /api/inquiry` 遭持续自动化提交，频率 5–7 分钟/条，集中凌晨 00:00–08:00。

### 1.2 攻击特征（证据链）

| 证据 | 内容 |
|---|---|
| 同源提交 | 后台询盘全部同名 `Robertbib`，来源 google / homepage |
| 机器翻译 | 同一句"想知道你的价格"被翻译成 10+ 种语言（意/冰岛/立陶宛/丹麦/葡/卢森堡/匈牙利/阿尔巴尼亚语，甚至拉丁语） |
| 邮箱轮换 | carlo.marra@libero.it / arthurmoreno@outlook.com / padillaleye@gmail.com / Katrinah@lee-stores.com 等 |
| 流量异常 | CF 24h：13.74k 请求（+121%）、6.01k 访问（+135%）、缓存命中仅 3.28%；2.00k 个 4xx（现有按 IP 限流部分生效但被分布式 IP 绕过） |
| IP 分布 | 美国 11.43%、新加坡、罗马尼亚、法国、英国、德国等——典型分布式 botnet |

### 1.3 损害链（四条，按严重度）

1. **域名信誉风险（最严重）**：每条垃圾询盘触发客户自动回复，发送到 outlook/gmail 等真实存在邮箱 → 真实用户收到未请求的"询盘确认"→ 举报垃圾邮件 → aromiso.com 发信信誉受损，极端情况 Resend 封号（backscatter）。
2. **额度燃烧**：每条询盘 = 2 封 Resend（客户自动回复 + sales 通知），约 50 条即烧光免费额度 100 封/天。
3. **通知链路隐性故障**：Resend → sales@aromiso.com 的询盘通知全部 Bounced（异步退信），主通知链路本就处于故障状态，仅靠 163 转发兜底。
4. **邮件循环**：垃圾自动回复打到真实邮箱后，对方服务器自动回复/退信回流至 sales@，经 email-worker 转发 163，一夜 55 封"客户回复未匹配到已有询盘"。

### 1.4 根因

**公开的 POST 接口与有成本的外部资源（Resend API）在请求路径内同步直连。** 攻击者只需不断 POST，系统就替他消耗邮件资源。代码佐证：`functions/api/inquiry.ts` L229–340 邮件发送位于请求处理路径内。

---

## 第二部分：目标与底线

### 2.1 目标

**业务目标**
1. 任何自动化滥用都无法消耗邮件额度、AI 额度等付费/限量资源；
2. 真实海外买家提交询盘/订单的摩擦不增加（无感防护）；
3. 通知与发信链路恢复可信（sales@ 退信修复）；
4. 询盘/订单数据干净，后台运营时间花在真实客户上。

**技术目标**
1. 一套统一防护中间件覆盖全部公开写接口（写一次，处处复用）；
2. "接收"与"发信/调 AI"解耦，资源消耗必须过风险门；
3. 风险分级处置（正常/降速/静默/拦截），拒绝真人/机器人二元判断；
4. 行为指纹优先于 IP 作为识别维度（应对换 IP 攻击）。

**数据目标**
1. 攻击数据不删除，沉淀 `abuse_log` 供模式学习；
2. 下载/提交行为数据反哺商业洞察（哪国客户关注合规、哪产品被爬虫盯上）。

### 2.2 底线（红线，任何方案不得逾越）

| # | 红线 | 说明 |
|---|---|---|
| 1 | **不伤害真实客户** | 不无差别验证码、不上登录墙、不按国家/VPN 封禁（B2B 买家常用企业 VPN） |
| 2 | **零新增成本** | 全程 Cloudflare 免费层。明确不用：Cloudflare Queues（付费）、Workers Paid、付费 WAF 规则 |
| 3 | **不伪造数据** | 评价/评分/客户案例必须真实（伪造评价的人工处置风险已验证并整改） |
| 4 | **AI 不做第一道防线** | 规则先行，AI 仅处理边界案例；AI 出建议、规则做执行；自动拦截仅限 risk>98 且命中多条硬规则 |
| 5 | **公开资产保持公开** | 证书 PDF、产品页不因防爬加墙（SEO 资产 + 免费无限带宽 + B2B 转发场景） |
| 6 | **攻击数据不删除** | 高风险请求落 abuse_log，不直接丢弃 |
| 7 | **隐私合规** | IP 等敏感标识哈希化存储；行为数据不用于"毛骨悚然式"个性化 |

---

## 第三部分：攻击面测绘（2026-08-02 实测）

### 3.1 路由清单与风险分级（42 个函数路由）

| 接口 | 方法 | 发邮件 | 现有防护 | 缺口 | 风险 |
|---|---|---|---|---|---|
| `/api/inquiry` | POST | ✅ 2 封/次 | 限流 10/h/IP、蜜罐、字段校验 | Turnstile、邮箱维度限流、去重、熔断、风险门 | 🔴 |
| `/api/commerce/orders` | POST | ✅ 订单确认 | 幂等键、商品/库存状态校验 | Turnstile、限流、未付款订单上限、风险门 | 🔴 |
| `/api/commerce/reviews` | POST | 否 | 审核管道（pending→approved） | 入口无 Turnstile/限流 | 🟠 |
| `/api/commerce/questions` | POST | 否 | 审核管道（pending→answered） | 入口无 Turnstile/限流 | 🟠 |
| `/api/subscribe` | POST | 否（纯 D1） | 限流 5/h/IP、蜜罐 | Turnstile（先于此再谈 double opt-in） | 🟡 |
| `/api/track` | POST | 否 | 少量 | 防投毒（污染风控数据源） | 🟡 |
| `/api/search` | GET | 否 | — | 频率限制 + 结果缓存 | 🟡 |
| `/api/commerce/products` | GET | 否 | — | 防滥用不限爬（SEO 需要） | 🟢 |
| `/api/admin/*`（34 个） | 混合 | email-send | 会话 HMAC、login 限流 5/15min | 已达标 | 🟢 |

### 3.2 已实装能力盘点（避免重复开发）

- inquiry：honeypot（website 字段静默丢弃）、KV 限流、字段长度限制、邮箱正则、escapeHtml、D1 参数化 + KV 回退；
- orders：`idem:` KV 幂等、商品/变体 active 校验、out_of_stock 拦截、order_events 状态事件表；
- reviews/questions：pending 审核管道（前台只显示 approved/answered）、reviews 带 verified_buyer 关联已完成订单；
- admin：会话 HMAC（常数时间比较）、login 限流（V3.14）、upload 路径白名单、get 目录白名单；
- AI Growth Center：ai-brief / ai-opportunities / ai-lead-score / ai-product / knowledge 等已在路由中；
- Cloudflare 侧：AI Crawl Control（仪表盘已有）、免费 WAF 1 条 rate limiting 规则、免费 Bot Fight Mode。

### 3.3 代码级缺陷（随本次一并修复）

1. **重试放大**：inquiry.ts 中 owner 通知失败时返回 502 但询盘已写 D1 → 前端报错 → 用户重试 → 重复写入 + 重复发信尝试。
2. **sales@ 异步退信**：Resend accept 后投递被退，需查 Suppression list / SPF / DMARC / CF Email Routing。

---

## 第四部分：总体架构

### 4.1 分层防线

```
INTERNET
   │
   ▼
┌─────────────────────────────────────┐
│ Edge 层（CF 仪表盘，零代码）          │
│  WAF Rate Limiting 规则（1 条免费）   │
│  Bot Fight Mode                     │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ Guard 层（functions/api/_lib/guard） │
│  Turnstile 服务端验证                │
│  多维限流（IP/Email/Session）        │
│  蜜罐 / Time-trap / 黑名单           │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ Risk Gate 层（业务内联）              │
│  内容哈希去重 / 同邮箱合并            │
│  风险分档 → 决定 写库/发信/通知       │
│  Resend 日配额熔断                   │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 业务层                               │
│  D1 写入（永远先落库）                │
│  邮件/AI 仅对通过风险门的请求执行      │
│  高风险请求 → abuse_log（保留学习）   │
└─────────────────────────────────────┘
               ▼
     AI Intelligence（离线/异步）
     每日审计 → 模式学习 → 规则调优建议
```

### 4.2 核心原则（贯穿全文）

1. **规则 → 风险评分 → AI**，顺序不可颠倒（否则机器人刷的是 AI 额度）；
2. **AI 建议制**：AI 输出 risk + recommendation，规则系统执行；
3. **先落库、后消耗**：任何写接口先 D1，邮件/AI 为异步或可跳过步骤；
4. **指纹 > IP**：IP 是风险信号不是用户身份（公司/酒店/NAT 共享 IP）；
5. **防滥用不防爬**：Googlebot/Bingbot/AI 爬虫正常放行，只拦异常速率。

---

## 第五部分：P0 止血包开发规格（目标：1 天）

### 5.1 Turnstile 接入（inquiry + orders）

**目的**：以零摩擦方式拦截 99% 自动化提交。

**配置步骤**
1. CF 仪表盘 → Turnstile → Add Site → 选 Managed 模式 → 获取 Site Key + Secret Key；
2. Pages 项目环境变量新增 `TURNSTILE_SECRET_KEY`（生产+预览）。

**前端规格**（联系页 / 快速询盘组件 / 商城下单页）
- 引入 `https://challenges.cloudflare.com/turnstile/v0/api.js`（async defer）；
- 表单内放 `<div class="cf-turnstile" data-sitekey="SITE_KEY"></div>`；
- 提交时携带 `cf-turnstile-response` 字段（widget 自动注入同名 hidden input）。

**后端规格**（inquiry.ts / orders.ts 复用同一函数）

```ts
async function turnstileOk(env: Env, token: string, ip: string): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // 未配置时放行并告警日志，避免误伤线上
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${secret}&response=${token}&remoteip=${ip}`,
  });
  const data = await res.json();
  return data.success === true;
}
```

- 校验位置：honeypot 之后、限流之前；
- 失败返回 `403 { ok:false, error:"Verification failed, please retry." }`；
- token 一次性、有效期 300 秒，不得复用（siteverify 负责判定）。

**验收**：无 token curl 提交 → 403；浏览器正常提交 → 通过且用户无感；env 缺失时降级放行并 `console.error` 告警。

### 5.2 WAF 边缘限流规则（免费版 1 条）

**配置**：CF 仪表盘 → 安全性 → WAF → 速率限制规则 → 新建：
- 匹配：`http.request.uri.path eq "/api/inquiry"` 或 `eq "/api/commerce/orders"`，方法 POST；
- 阈值：每 IP 每 1 分钟 5 次；
- 动作：Managed Challenge（非 Block，防误伤）；
- 时长：10 分钟。

**验收**：curl 连发 10 次，第 6 次起收到 challenge。

### 5.3 Bot Fight Mode

CF 仪表盘 → 安全性 → 机器人 → 开启 Bot Fight Mode（免费）。对已知自动化 UA 直接 challenge。

### 5.4 邮件风险门（inquiry.ts / orders.ts 内联实现）

**目的**：在不解耦架构的前提下，立即切断"POST 成功 = 烧 2 封邮件"。

**规格（按执行顺序）**

```ts
// 1) 同邮箱合并：同 email 10 分钟内已存在询盘
const dupKey = `dedup:email:${email.toLowerCase()}`;
if (await kv.get(dupKey)) {
  // 仍写 D1，status 标 'Duplicate'，不发任何邮件，返回 ok
}
await kv.put(dupKey, "1", { expirationTtl: 600 });

// 2) 内容哈希去重：normalize(name+email+message) → SHA-256 → 24h
const hash = await sha256(normalize(name + email + message));
const hashKey = `dedup:hash:${hash}`;
if (await kv.get(hashKey)) { /* 同上：写 D1 标 Duplicate，不发信 */ }
await kv.put(hashKey, "1", { expirationTtl: 86400 });

// 3) Resend 日配额熔断（UTC 日计数）
const dayKey = `mail:budget:${new Date().toISOString().slice(0, 10)}`;
const used = Number((await kv.get(dayKey)) || "0");
// used >= 95：只写库，完全不发信
// used >= 80：只发 sales 通知，停客户自动回复（防 backscatter 优先）
// 其余：正常两封；每成功发送一封 used+1
```

**normalize 规则**：lowercase → trim → 去标点 → 压缩空白。

**验收**：脚本模拟同内容连发 10 次 → D1 有 10 条（9 条 Duplicate）→ Resend 仅 1–2 封；当日计数达阈值后日志显示熔断生效。

### 5.5 sales@aromiso.com 退信排查（ checklist ）

1. Resend 后台 → Suppression list：查 sales@aromiso.com 是否被抑制（若存在，移除并排查当初为何退信）；
2. Resend → Domains：确认 aromiso.com 的 SPF/DKIM 记录全部 Verified；
3. CF → Email Routing → 路由规则：确认 sales@ 转发目标（163）有效且未达转发上限；
4. 测试：后台触发一条测试询盘，观察 Resend 日志状态由 Bounced → Delivered。

### 5.6 存量 spam 清理（D1 控制台执行）

```sql
-- 先标记后观察，确认无误再删
UPDATE inquiries SET status = 'Spam'
WHERE name = 'Robertbib'
   OR email IN ('carlo.marra@libero.it','arthurmoreno@outlook.com','padillaleye@gmail.com','Katrinah@lee-stores.com');
-- 观察 24h 无真实客户误伤后：
DELETE FROM inquiries WHERE status = 'Spam';
```

### 5.7 黑名单（KV）

- 键：`bl:email:<lowercase email>` / `bl:name:<lowercase name>`；
- guard 检查命中 → 返回假成功 `{ ok:true }`，不写库不发信，记 abuse_log（P1 建表后）；
- 初始条目：事件中的 4 个邮箱 + "Robertbib"。

**P0 回滚方案**：Turnstile env 置空即降级放行；WAF 规则/ Bot Fight Mode 仪表盘一键关闭；熔断阈值上调即恢复。

---

## 第六部分：P1 统一防护层开发规格（2–3 天）

### 6.1 `functions/api/_lib/guard.ts` 中间件

```ts
export interface GuardResult {
  pass: boolean;
  action: "allow" | "challenge" | "silent-drop" | "block";
  reason?: string;
  riskScore: number;
}

export async function guard(context: EventContext<Env, any, any>, opts: {
  turnstile?: boolean;        // 是否需要 Turnstile（写操作 true，track false）
  rateLimits?: { key: string; limit: number; window: number }[]; // 多维限流
  honeypotField?: string;
  minFillMs?: number;         // time-trap，默认 3000
}): Promise<GuardResult>
```

**限流键规范**：`rl:<route>:ip:<ip>`、`rl:<route>:email:<email>`、`rl:<route>:session:<sid>`，KV TTL = window。建议默认：IP 1 分钟 2 次 / 10 分钟 5 次 / 1 小时 10 次；email 1 小时 3 次 / 24 小时 5 次。

### 6.2 六接口接入矩阵

| 接口 | Turnstile | 特殊处理 |
|---|---|---|
| inquiry | ✅ | 邮件风险门（P0 已建） |
| commerce/orders | ✅ | 未付款订单上限（见 6.3） |
| commerce/reviews | ✅ | 保持 pending 管道；guard 仅挡自动化 |
| commerce/questions | ✅ | 同上 |
| subscribe | ✅ | 接入后再评估 double opt-in（顺序红线） |
| track | ❌（轻量） | 仅 IP 限流 60/min + payload schema 校验，防数据投毒 |

### 6.3 订单防刷补齐

- **未付款订单上限**：同 customer（email+session+指纹综合键）`status IN ('Requested','Reviewing','Quoted','AwaitingPayment')` 的订单 ≤ 3；超出返回"您有待处理订单，请先完成或联系销售"；
- 幂等键规范推广：所有写接口接受 `idempotency_key`，KV `idem:` 去重（orders 已有实现，提炼进 guard）。

### 6.4 abuse_log 表（新 migration）

```sql
CREATE TABLE IF NOT EXISTS abuse_log (
  id TEXT PRIMARY KEY,
  route TEXT NOT NULL,
  ip_hash TEXT,
  email_hash TEXT,
  fingerprint TEXT,
  risk_score INTEGER,
  action TEXT,            -- silent-drop / challenge / block / suppressed-email
  reason TEXT,
  payload_excerpt TEXT,   -- 截断 500 字符，脱敏
  created_at TEXT NOT NULL
);
CREATE INDEX idx_abuse_created ON abuse_log(created_at);
```

### 6.5 通知分级

| 风险档 | D1 | sales 即时通知 | 客户自动回复 | 后台展示 |
|---|---|---|---|---|
| Low | ✅ | ✅ | ✅ | 新询盘 |
| Medium | ✅ | ❌（进待审核） | ✅ | ⚠️ 待审核 |
| High | ✅ | ❌ | ❌ | 🚨 仅 abuse 视图 |
| Critical | abuse_log | ❌ | ❌ | abuse_log |

### 6.6 后台配套

- 询盘管理：批量"标记垃圾 / 删除"；筛选器加 Duplicate/Spam 状态；
- 新增 Abuse 视图：读 abuse_log，支持按 route/risk_score/时间筛选；
- （复用现有 Behavior/Analytics 页面框架，不新建技术栈。）

---

## 第七部分：P2 Risk Engine 开发规格（2–4 周）

### 7.1 数据模型（KV）

- 键：`risk:session:<session_id>` → `{ score, signals: {...}, updatedAt }`，TTL 24h；
- 键：`risk:fp:<fingerprint>` → 同上，TTL 7 天（指纹比 session 更持久）。

### 7.2 行为指纹算法

```
fingerprint = sha256( UA + accept-language + timezone + 平均请求间隔分桶 + 页面序列哈希 ).slice(0,12)
```

### 7.3 信号与计分（V1 规则集）

| 信号 | 分值 |
|---|---|
| 无页面浏览直接 POST 写接口 | +40 |
| 页面平均停留 < 1s 且连续 > 5 页 | +30 |
| 请求间隔标准差 < 0.5s（机械节奏） | +25 |
| 同内容哈希 24h 内重复 | +35 |
| 蜜罐/time-trap 命中 | +50 |
| 邮箱为临时域名（维护列表） | +20 |
| 有正常浏览轨迹（>3 页、停留>10s）后提交 | -30 |
| 浏览过证书/合规页（B2B 强信号） | -15 |

### 7.4 四档动作

| 分数 | 档位 | 动作 |
|---|---|---|
| 0–20 | Normal | 正常服务 |
| 21–50 | Suspicious | 降速 + 触发 Turnstile challenge |
| 51–80 | High | 写 D1，不发邮件/不调 AI，进待审核 |
| 81–100 | Critical | 429 + abuse_log；自动拦截仅限 >98 且 ≥2 条硬规则 |

### 7.5 SEO 关联（引用不重复）

`docs/GROWTH_OPTIMIZATION_PLAN.md` 剩余项：CTR 专项（85 查询词）、blog↔guide 重叠审计、每日手动请求收录、GSC 周报四指标（收录率/曝光/CTR/询盘）。

---

## 第八部分：P3 双轨成交 + 智能层（按用户拍板，月度）

### 8.1 业务决策（已确认）

**同一商品体系下双轨成交**：现货直购保留不动，RFQ/Quote 体系并行新建，**不重做现有订单状态机**。

### 8.2 状态机

**现货线（Ready to Ship）**
```
Product → Cart → Request Order → Reviewing → Quoted
→ AwaitingPayment（锁库存 24h TTL）→ Paid → Processing → Shipped → Completed
  └ 超时 → Expired（释放库存，记录保留）
```

**RFQ 线（OEM/Bulk）**
```
Product/OEM → Request Quote → AI Lead Analysis → Reviewing → Quoted
→ AwaitingPayment/Deposit → Paid → Production → Inspection → Shipped → Completed
```

### 8.3 数据模型要点

- **三状态分离**：`order_status` / `payment_status`（Unpaid/Pending/Paid/Failed/Refunded）/ `inventory_status`（Available/Reserved/Allocated/Released），禁止单 status 字段承载全部语义；
- **配置入 commerce_settings**：`quote_valid_hours=72`、`inventory_reserve_hours=24`（现货）/ 72（RFQ）/ 168（特殊项目）；
- **库存红线**：Requested/Reviewing/Quoted 阶段**不锁库存**，仅 AwaitingPayment 才 Reserved，超时自动 Released；
- **恶意下单**：同客户未付款订单 ≤ 3（P1 已实现，此处沿用）。

### 8.4 产品页分流（单页覆盖三类买家）

```
Reed Diffuser 100ml — From $2.80/pc, MOQ 50
[Add to Cart]  [Request Sample]
─────────────────────────────
Need 500+ pcs? Get better pricing with bulk purchasing.
[Request Bulk Quote]
─────────────────────────────
Need your own brand? OEM / Private Label available.
[Request OEM Quote]
```

参考分流阈值（按真实订单数据调整）：<$500 直购 / $500–2,000 Request Order 人工确认运费 / >$2,000 引导 RFQ。

### 8.5 智能层模块

1. **AI Behavior & Abuse Intelligence**（ai-brief 第四模块，其余不重建）：每日 06:00 汇总 GA4/Behavior/Inquiry/Orders/abuse_log → 攻击模式识别 → 规则调优**建议**；
2. **Customer 360**：以 email 为主键合并询盘/订单/行为 timeline；AI Customer Summary + Next Action 建议；
3. **私有文档层**：R2 私有桶 + HMAC 签名 URL（5–10 分钟有效）+ "Request Document" 留资表单（转为获客入口）；**公开 PDF 不动**；
4. **每日 5 件事简报**：Business/Lead/Security 三合一，只呈现需人工处理的 Top 5 + Recommended Actions。

---

## 第九部分：明确不做清单（范围控制）

| 项 | 原因 |
|---|---|
| 公开 PDF 加签名 URL/水印 | 伤 SEO、伤 B2B 转发场景、静态文件无资源成本 |
| Cloudflare Queues | 付费；D1 表 + Cron Trigger 免费替代 |
| AI 做拦截第一道防线 | 机器人会反刷 AI 额度；规则先行 |
| Newsletter double opt-in（先于 Turnstile） | 顺序反了等于新开烧邮件口子 |
| 重做现有订单状态机 | 现货线已稳定，双轨并行即可 |
| 按国家/VPN/ASN 一刀切封禁 | 误伤企业 VPN 真实买家 |
| 全员登录墙/强制验证邮箱才能询盘 | 抬高首次联系门槛，违背获客目标 |
| 每条请求调 AI 评分 | 成本与延迟不可接受；AI 只处理边界案例 |

---

## 第十部分：成本与预算

### 10.1 免费层资源清单

| 资源 | 免费额度 | 保护设计 |
|---|---|---|
| Turnstile | unlimited | — |
| WAF Rate Limiting | 1 条规则 | 用于 inquiry+orders 联合匹配 |
| Bot Fight Mode | 免费 | — |
| KV（DRAFTS） | 100k 读/1k 写每天 | 限流键 TTL 自动过期 |
| D1 | 100k 读/100k 写每天（免费档） | abuse_log 截断写入 |
| Cron Trigger | 免费 | 邮件队列/日审使用 |
| Resend | 100 封/天、3,000/月 | 风险门 + 熔断器（80/95 阈值） |

### 10.2 付费触发点（未来评估，非现在）

- Resend Pro（$20/月，50k/月无日限）：真实询盘日均 >40 条时评估；
- Workers Paid（$5/月）：需要 Queues/更高 CPU 时评估。

---

## 第十一部分：验收与 KPI

### 11.1 P0 验收测试用例

```bash
# 1) 无 Turnstile token → 403
curl -X POST https://aromiso.com/api/inquiry -H "Content-Type: application/json" \
  -d '{"name":"t","email":"t@t.com","message":"hello test"}'

# 2) 同内容连发 10 次 → D1 十条（9 条 Duplicate），Resend ≤2 封
# 3) WAF 规则：单 IP 1 分钟连发 10 次 → 第 6 次起 challenge
# 4) 熔断：KV 手工置入 mail:budget:<today>=96 → 提交后仅写库不发信
# 5) sales@ 退信：触发测试询盘 → Resend 日志 Delivered
```

### 11.2 KPI 基线与目标

| 指标 | 基线（2026-08-02） | P0 后 | P1 后 |
|---|---|---|---|
| Resend 日消耗 | ~100（被打满） | <20 | <15 |
| 垃圾询盘占比 | ~90% | <20% | <5% |
| sales@ 通知送达率 | 0%（Bounced） | 100% | 100% |
| 误伤率（真实客户被拦） | — | 0（人工复核 abuse_log） | <1% |
| 高价值询盘识别时效 | 人工翻列表 | — | 后台分级即时可见 |

---

## 第十二部分：排期与里程碑

| 里程碑 | 内容 | 时间 |
|---|---|---|
| M0 | P0 #1 Turnstile + #2 WAF 规则 + #4 邮件风险门 + #5 退信排查 | 今天 |
| M1 | P0 剩余（Bot Fight Mode / 清理 / 黑名单） | 明天 |
| M2 | P1 guard.ts + 六接口接入 + abuse_log + 后台分级 | 本周 |
| M3 | P2 Risk Engine V1 + SEO 剩余项 | 2–4 周 |
| M4 | P3 RFQ 双轨 + 智能层 | 月度（业务节奏决定） |

---

## 附录

### A. 事件证据存档

手机 163 收件箱（55 封未匹配回复通知）、CF Analytics 24h（13.74k/+121%）、Resend 发送日志（Delivered 自动回复 + Bounced sales 通知交替）、后台询盘管理 Robertbib 系列截图 ×2。

### B. 参考文档

- Turnstile Get Started / Server-side validation：https://developers.cloudflare.com/turnstile/get-started/
- Cloudflare Workers Rate Limiting：https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- Protect forms from spam and abuse（CF use case）：https://developers.cloudflare.com/use-cases/solutions/protect-sensitive-forms-fraud-abuse/
- Resend Pricing：https://resend.com/pricing/
- Google Spam Policies（scaled content abuse）：https://developers.google.com/search/docs/essentials/spam-policies

### C. 与既有文档关系

- `docs/GROWTH_OPTIMIZATION_PLAN.md`：SEO/内容侧整改（已完成 7 项：伪造评价删除、shop offers 修复、分类归一化 32→12、内链注入、sitemap 分桶、10 篇新指南、V4.6 薄页丰富化）。本文档聚焦安全/风控/成交架构，两者互补不重叠。
- 工作记忆：`.workbuddy/memory/2026-08-02.md`（六批外部材料校准原始记录）。
