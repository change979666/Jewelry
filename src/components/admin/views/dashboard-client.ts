// ============================================================================
// 五问主屏客户端（2026-09-02 重写）
// What happened → What AI did → What worked → What needs me
// 数据全部来自既有端点（零新增 API）；无数据一律 —，未接入标 Not deployed，
// 错误显式提示——绝不伪造数字。新代码治理：真实类型，不用 any。
// ============================================================================

const API = "/api/admin/v2/dashboard";

function esc(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let didRedirect = false;

/** 硬失败（非 200 / 网络错误）统一走同一条横幅文案，靠 label 区分区块。
 *  Toast.astro 的横幅按 message 去重，因此四路并发失败只会出现一条持久横幅。 */
function reportFetchFailure(label: string, detail: string): void {
  window.AromisoShowDegraded?.("仪表盘部分数据加载失败", `${label}：${detail}`);
}

async function fetchJSON<T>(url: string, label = "仪表盘"): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (r.status === 401) {
      if (!didRedirect) {
        didRedirect = true;
        window.location.href = "/admin-v2/login";
      }
      return null;
    }
    if (!r.ok) {
      // M5/S12：失败不能塌缩成 null 后被读成「没有数据」。
      reportFetchFailure(label, `HTTP ${r.status}`);
      return null;
    }
    const j = (await r.json()) as { success?: boolean; data?: T };
    // M5/S12/F06：信封（degraded / guard_state / errors[]）或数据体
    // （KPI state:"ERROR"、meta.degraded）带降级标记时必须可见。
    if (!window.AromisoNotifyDegraded?.(j, label)) {
      window.AromisoNotifyDegraded?.(j.data, label);
    }
    return j.success && j.data != null ? j.data : null;
  } catch (e) {
    reportFetchFailure(label, e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ---- 数据契约（与 v2/dashboard/* 和 v2/ai/workforce 对齐）----
/** S14：KPI 三态信封。ERROR=查询故障，NO_DATA=结构性无数据，NO_PERMISSION=缺权限。 */
interface KpiEnvelope {
  value: number | Record<string, number> | null;
  state: string;
  source?: string;
  error?: string | null;
}
type KpiKey =
  | "inquiriesThisMonth"
  | "ordersThisMonth"
  | "siteUsers"
  | "aiCompleted"
  | "totalInquiries"
  | "commerceActive";
interface KpiData {
  inquiriesThisMonth: number | null;
  ordersThisMonth: number | null;
  siteUsers: number | null;
  aiCompleted: number | null;
  contentCounts: Record<string, number> | null;
  totalInquiries: number | null;
  commerceActive: number | null;
  envelopes?: Partial<Record<KpiKey | "contentCounts", KpiEnvelope>>;
}
interface Envelope {
  value: number | string | null;
  state: string; // HAS_DATA | REAL_ZERO | NO_DATA | ERROR | PENDING
  error?: string | null;
  reason?: string | null;
}
interface GscKpi {
  impressions: Envelope | null;
  clicks: Envelope | null;
  ctr: Envelope | null;
  position: Envelope | null;
  latest_date: string | null;
}
interface HealthInfo {
  score: number;
  level: string;
  data_date: string | null;
}
interface TodayStats {
  total: number;
  completed: number;
  skipped: number;
  blocked: number;
  running: number;
  approvalsNeeded: number;
}
interface TimelineMission {
  mission_id: string;
  agent_name: string | null;
  mission_type: string | null;
  status: string | null;
  scheduled_at: number | null;
}
interface Finding {
  opp_type: string | null;
  page: string | null;
  query: string | null;
  exec_level: string | null;
  suggested_action: string | null;
  score: number;
}
interface ReviewItem {
  source: string;
  id: number | string;
  title: string | null;
  type: string | null;
  risk_level: string | null;
  role: string | null;
}
interface WorkforceData {
  overview?: {
    health?: HealthInfo | null;
    todayStats?: TodayStats | null;
    monthlySpendCny?: number;
    monthlyCapCny?: number;
    aiRecommendation?: string | null;
    todayTimeline?: TimelineMission[];
    topFindings?: Finding[];
    dataKpi?: { gsc?: GscKpi | null; inquiries?: Envelope | null } | null;
  };
  review?: { pendingCount?: number; items?: ReviewItem[] };
}
interface FunnelStage {
  label: string;
  value: number | null;
}
interface FunnelData {
  inquiryFunnel?: FunnelStage[] | null;
  commerceFunnel?: FunnelStage[] | null;
}
interface RecentData {
  recentContent?: { title?: string; updated_at?: string; href?: string }[];
  recentInquiries?: { name?: string; email?: string; product?: string; created_at?: string }[];
}

// ---- 展示助手 ----
/** S14/M5：三态信封文案。ERROR≠NO_DATA≠NO_PERMISSION≠真实 0，绝不渲染成裸 — 或 0。 */
const NODATA_TEXT = new Set(["无法获取", "暂无数据", "无权限"]);
function envVal(e: Envelope | null | undefined): string | number | null {
  if (!e) return null;
  if (e.state === "HAS_DATA" || e.state === "REAL_ZERO") return e.value;
  if (e.state === "ERROR") return "无法获取"; // 查询失败/额度限制
  if (e.state === "NO_PERMISSION") return "无权限";
  if (e.state === "NO_DATA" || e.state === "PENDING") return "暂无数据";
  return null;
}
/** 信封是否真的有数（用于健康点等布尔判断，不能把「无法获取」当成已连接）。 */
function envHasData(e: Envelope | null | undefined): boolean {
  return e?.state === "HAS_DATA" || e?.state === "REAL_ZERO";
}
/** 标量 KPI 优先读三态信封（S14）；旧响应无 envelopes 时回落标量值。 */
function kpiCell(kpi: KpiData | null, key: KpiKey): string | number | null {
  if (!kpi) return null;
  const env = kpi.envelopes?.[key];
  if (!env) return kpi[key] ?? null;
  if (env.state === "HAS_DATA" || env.state === "REAL_ZERO")
    return typeof env.value === "number" ? env.value : null;
  if (env.state === "ERROR") return "无法获取";
  if (env.state === "NO_PERMISSION") return "无权限";
  return "暂无数据";
}
function fmt(v: string | number | null): string {
  if (v == null) return '<span class="dash-nodata">—</span>';
  if (typeof v === "string" && NODATA_TEXT.has(v))
    return `<span class="dash-nodata">${esc(v)}</span>`;
  return esc(typeof v === "number" ? v.toLocaleString("en-US") : v);
}
function pulseCard(
  key: string,
  value: string | number | null,
  sub?: string,
  star = false,
  href?: string,
): string {
  return `<div class="dash-pulse-card${star ? " is-star" : ""}${href ? " is-link" : ""}"${href ? ` data-href="${href}"` : ""}><div class="v">${fmt(value)}</div><div class="k">${esc(key)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ""}</div>`;
}
function agentShort(name: string | null): string {
  if (!name) return "AI";
  const i = name.indexOf("（");
  return i > 0 ? name.slice(0, i) : name;
}
function hm(unix: number | null): string {
  if (!unix) return "--:--";
  return new Date(unix * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}
function statusDot(status: string | null): string {
  if (status === "running")
    return '<span class="dash-dot dash-dot--running" title="running"></span>';
  if (status === "completed")
    return '<span class="dash-dot dash-dot--ok" title="completed"></span>';
  if (status === "blocked" || status === "failed")
    return '<span class="dash-dot dash-dot--danger" title="blocked"></span>';
  if (status === "skipped") return '<span class="dash-dot dash-dot--muted" title="skipped"></span>';
  return '<span class="dash-dot dash-dot--warn" title="pending"></span>';
}
const ERROR_NOTE =
  '<div class="admin-empty-state">数据暂不可用（接口错误或额度限制），恢复后自动正常</div>';

// ---- ① Hero 状态带 ----
function renderHero(kpi: KpiData | null, wf: WorkforceData | null) {
  const ts = wf?.overview?.todayStats ?? null;
  const pending = wf?.review?.pendingCount ?? null;
  const completed = ts ? ts.completed : null;
  const titleEl = document.getElementById("hero-title");
  if (titleEl) {
    if (!ts && !kpi) {
      titleEl.innerHTML = "Aromiso 状态暂不可用";
    } else {
      titleEl.innerHTML =
        `Aromiso 正在运行 · AI 今日已完成 <span class="dash-hero-num">${fmt(completed)}</span> 项动作` +
        ` · 本月询盘 <span class="dash-hero-num">${fmt(kpiCell(kpi, "inquiriesThisMonth"))}</span>` +
        ` · <span class="dash-hero-num">${fmt(pending)}</span> 项等你决定`;
    }
  }
  const strip = document.getElementById("hero-strip");
  if (!strip) return;
  const health = wf?.overview?.health ?? null;
  const healthDot = health
    ? health.level === "GREEN"
      ? "ok"
      : health.level === "YELLOW"
        ? "warn"
        : "danger"
    : "muted";
  const healthTxt = health ? `健康分 ${health.score}` : "健康分 —";
  const runDot = ts && ts.running > 0 ? "running" : "muted";
  const runTxt = ts ? `AI ${ts.running > 0 ? "running" : "idle"}` : "AI —";
  const gsc = wf?.overview?.dataKpi?.gsc ?? null;
  const gscOk = envHasData(gsc?.clicks);
  const gscTxt = gscOk ? "GSC 已连接" : gsc?.clicks?.state === "ERROR" ? "无法获取" : "暂无数据";
  const spend = wf?.overview?.monthlySpendCny ?? null;
  const cap = wf?.overview?.monthlyCapCny ?? null;
  const ratio = spend != null && cap ? spend / cap : null;
  const budgetDot = ratio == null ? "muted" : ratio >= 1 ? "danger" : ratio >= 0.8 ? "warn" : "ok";
  strip.innerHTML =
    `<span><span class="dash-dot dash-dot--${healthDot}"></span> 系统 · ${esc(healthTxt)}</span>` +
    `<span><span class="dash-dot dash-dot--${runDot}"></span> ${esc(runTxt)}</span>` +
    `<span><span class="dash-dot dash-dot--${gscOk ? "ok" : "muted"}"></span> 搜索数据 · ${esc(gscTxt)}</span>` +
    `<span><span class="dash-dot dash-dot--${budgetDot}"></span> AI 预算 · ${spend != null && cap != null ? esc("¥" + spend + " / ¥" + cap) : '<span class="dash-nodata">—</span>'}</span>`;

  // Command Center hero: real Business Health Score + truthful system status.
  const hsEl = document.getElementById("cc-health-score");
  if (hsEl) hsEl.textContent = health ? String(health.score) : "—";
  const stEl = document.getElementById("cc-system-status");
  if (stEl) {
    const lvl = health ? health.level : null;
    const stTxt =
      lvl === "GREEN"
        ? "系统在线"
        : lvl === "YELLOW"
          ? "系统观察中"
          : lvl === "RED"
            ? "系统降级"
            : "系统 —";
    const dotCls =
      lvl === "GREEN"
        ? "cc-dot--online"
        : lvl === "YELLOW"
          ? "cc-dot--learning"
          : lvl === "RED"
            ? "cc-dot--processing"
            : "cc-dot--watching";
    stEl.innerHTML = `<span class="cc-dot ${dotCls}"></span> ${esc(stTxt)}`;
  }
}

// ---- ② Business Pulse ----
function renderPulse(kpi: KpiData | null, wf: WorkforceData | null) {
  const el = document.getElementById("pulse-grid");
  if (!el) return;
  if (!kpi && !wf) {
    el.innerHTML = ERROR_NOTE;
    return;
  }
  const gsc = wf?.overview?.dataKpi?.gsc ?? null;
  const clicks = envVal(gsc?.clicks);
  const imp = envVal(gsc?.impressions);
  const ctrRaw = envVal(gsc?.ctr);
  const ctr = typeof ctrRaw === "number" ? (ctrRaw * 100).toFixed(1) + "%" : ctrRaw;
  el.innerHTML = [
    pulseCard(
      "本月询盘",
      kpiCell(kpi, "inquiriesThisMonth"),
      "北极星 · Search→Inquiry",
      true,
      "/admin-v2/customers/inquiries",
    ),
    pulseCard(
      "询盘总数",
      kpiCell(kpi, "totalInquiries"),
      undefined,
      false,
      "/admin-v2/customers/inquiries",
    ),
    pulseCard("GSC 点击 · 7天", clicks, "Search Console", false, "/admin-v2/growth/analytics"),
    pulseCard("GSC 曝光 · 7天", imp, undefined, false, "/admin-v2/growth/analytics"),
    pulseCard("平均 CTR · 7天", ctr, undefined, false, "/admin-v2/growth/analytics"),
    pulseCard(
      "本月订单额",
      kpiCell(kpi, "ordersThisMonth"),
      undefined,
      false,
      "/admin-v2/commerce/orders",
    ),
    pulseCard(
      "在售商品",
      kpiCell(kpi, "commerceActive"),
      undefined,
      false,
      "/admin-v2/commerce/products",
    ),
    pulseCard(
      "AI 完成 · 本月",
      kpiCell(kpi, "aiCompleted"),
      undefined,
      false,
      "/admin-v2/ai/activity",
    ),
  ].join("");
}

// ---- ③ AI Control（今日动作）----
function renderAiPanel(wf: WorkforceData | null) {
  const kEl = document.getElementById("ai-panel-kpis");
  const tEl = document.getElementById("ai-timeline");
  if (!kEl || !tEl) return;
  const ov = wf?.overview;
  if (!ov) {
    kEl.innerHTML = "";
    tEl.innerHTML = ERROR_NOTE;
    return;
  }
  const ts = ov.todayStats ?? null;
  kEl.innerHTML =
    `<div><div class="v">${ts ? ts.completed : '<span class="dash-nodata">—</span>'}</div><div class="k">今日完成</div></div>` +
    `<div><div class="v">${ts ? ts.total : '<span class="dash-nodata">—</span>'}</div><div class="k">今日任务</div></div>` +
    `<div><div class="v">${ts ? ts.approvalsNeeded : '<span class="dash-nodata">—</span>'}</div><div class="k">待确认</div></div>` +
    `<div><div class="v">${ov.monthlySpendCny != null ? "¥" + ov.monthlySpendCny : '<span class="dash-nodata">—</span>'}</div><div class="k">本月成本</div></div>`;

  // Agent roster: per-agent status derived strictly from REAL today's timeline (no fabrication).
  const rEl = document.getElementById("ai-roster");
  if (rEl) {
    const rosterTl = ov.todayTimeline ?? [];
    const byAgent = new Map<string, { status: string; task: string }>();
    for (const m of rosterTl) {
      const a = agentShort(m.agent_name) || "agent";
      const cur = byAgent.get(a);
      if (!cur) byAgent.set(a, { status: m.status || "unknown", task: m.mission_type || "—" });
      else if (m.status === "running") cur.status = "running";
    }
    if (!byAgent.size) {
      rEl.innerHTML =
        '<div class="cc-agent-row"><span class="cc-agent-task">当前无活跃 Agent 记录（今日暂无 mission）</span></div>';
    } else {
      rEl.innerHTML = Array.from(byAgent.entries())
        .map(([name, v]) => {
          const st =
            v.status === "running"
              ? "processing"
              : v.status === "success" || v.status === "completed"
                ? "online"
                : v.status === "failed"
                  ? "failed"
                  : "watching";
          const label =
            st === "processing"
              ? "PROCESSING"
              : st === "online"
                ? "ACTIVE"
                : st === "failed"
                  ? "FAILED"
                  : "WATCHING";
          return (
            `<div class="cc-agent-row"><span class="cc-dot cc-dot--${st}"></span>` +
            `<span class="cc-agent-name">${esc(name)}</span>` +
            `<span class="cc-agent-task">${esc(v.task)}</span>` +
            `<span class="cc-agent-state">${label}</span></div>`
          );
        })
        .join("");
    }
  }

  const tl = ov.todayTimeline ?? [];
  if (!tl.length) {
    tEl.innerHTML = '<div class="admin-empty-state">今天还没有 AI 动作记录</div>';
    return;
  }
  tEl.innerHTML =
    '<div class="dash-timeline">' +
    tl
      .map(
        (m) =>
          `<div class="dash-tl-row"><span class="dash-tl-time">${hm(m.scheduled_at)}</span>${statusDot(m.status)}<span class="dash-tl-agent">${esc(agentShort(m.agent_name))}</span><span class="dash-tl-what">${esc(m.mission_type || "—")}</span></div>`,
      )
      .join("") +
    "</div>";
}

// ---- ④ AI Learning（策略复盘：真实数据 + 诚实占位）----
function renderLearning(wf: WorkforceData | null) {
  const el = document.getElementById("learn-grid");
  if (!el) return;
  const findings = wf?.overview?.topFindings ?? [];
  const top3 = findings.slice(0, 3);
  const findCard = wf
    ? `
    <div class="dash-learn-card is-link" data-href="/admin-v2/growth/opportunities">
      <div class="t">机会发现（Growth）</div>
      <div class="m">今日新增 <b>${findings.length}</b> 条（按分数取前 6）</div>
      <div class="d">${
        top3.length
          ? top3
              .map((f) =>
                esc(
                  (f.query || f.page || f.opp_type || "—") +
                    (f.exec_level ? ` · ${f.exec_level}` : ""),
                ),
              )
              .join("<br>")
          : '<span class="dash-nodata">—</span>'
      }</div>
    </div>`
    : '<div class="dash-learn-card"><div class="t">机会发现（Growth）</div><div class="d dash-nodata">—</div></div>';
  const pendingCard = (title: string) => `
    <div class="dash-learn-card">
      <div class="t">${esc(title)}</div>
      <div class="m">提升幅度 <span class="dash-nodata">—</span></div>
      <div class="d">未部署 · Outcome 复盘（T+14 基线对比）属 Phase 3，接入前不显示数字</div>
    </div>`;
  el.innerHTML = findCard + pendingCard("标题优化策略") + pendingCard("内容刷新策略");
}

// ---- ⑤ Needs You（决策队列）----
function renderQueue(wf: WorkforceData | null) {
  const el = document.getElementById("queue-rows");
  const meta = document.getElementById("queue-count");
  if (!el) return;
  const items = wf?.review?.items ?? [];
  const count = wf?.review?.pendingCount ?? null;
  if (meta) meta.textContent = count != null ? `${count} 项待决策` : "—";
  if (!wf) {
    el.innerHTML = ERROR_NOTE;
    return;
  }
  if (!items.length) {
    el.innerHTML =
      '<div class="dash-queue-empty">当前没有需要你决策的事项。AI 可自动处理的都已处理，其余在下方详情区。</div>';
    return;
  }
  const srcLabel: Record<string, string> = {
    tasks: "任务",
    growth_opportunities: "增长机会",
    ai_tasks: "AI 任务",
  };
  el.innerHTML =
    '<div class="dash-queue">' +
    items
      .slice(0, 6)
      .map((it) => {
        const lv = it.risk_level || "";
        const cls = lv === "C" ? "is-high" : lv === "B" || lv === "L2" ? "is-mid" : "is-low";
        return `<a class="dash-queue-row ${cls}" href="/admin-v2/ai/review">
      <span class="q-title">${esc(it.title || it.type || "—")}</span>
      <span class="q-src">${esc(srcLabel[it.source] || it.source)}${lv ? " · " + esc(lv) : ""}${it.role ? " · " + esc(it.role) : ""}</span>
    </a>`;
      })
      .join("") +
    "</div>";
}

// ---- 详情区：漏斗（保留原能力）----
function funnelStageRow(s: FunnelStage, max: number): string {
  const h = s.value != null ? Math.max(16, (s.value / max) * 100) : 16;
  return `<div class="admin-funnel-stage"><span class="admin-funnel-value">${s.value != null ? s.value : "—"}</span><div class="admin-funnel-bar" style="height:${h}px;"></div><span class="admin-funnel-label">${esc(s.label)}</span></div>`;
}
function renderFunnel(sel: string, title: string, stages: FunnelStage[] | null | undefined) {
  const el = document.getElementById(sel);
  if (!el) return;
  if (!stages) {
    el.innerHTML = `<div class="admin-card"><div class="admin-card-header"><span class="admin-card-title">${esc(title)}</span></div><div class="admin-card-body admin-empty-state">暂无数据</div></div>`;
    return;
  }
  const max = Math.max(...stages.map((s) => s.value ?? 0), 1);
  el.innerHTML = `<div class="admin-card"><div class="admin-card-header"><span class="admin-card-title">${esc(title)}</span></div><div class="admin-card-body"><div class="admin-funnel">${stages.map((s) => funnelStageRow(s, max)).join("")}</div></div></div>`;
}
function renderRecent(recent: RecentData | null) {
  const rc = document.getElementById("recent-content");
  const rq = document.getElementById("recent-inquiries");
  if (rc) {
    const list = recent?.recentContent ?? [];
    rc.innerHTML = list.length
      ? '<div class="admin-card-body">' +
        list
          .map(
            (c) =>
              `<div class="admin-recent-item"><a href="${esc(c.href || "#")}">${esc(c.title || "—")}</a><span class="admin-recent-time">${esc((c.updated_at || "").slice(0, 10))}</span></div>`,
          )
          .join("") +
        "</div>"
      : '<div class="admin-card-body admin-empty-state">暂无</div>';
  }
  if (rq) {
    const list = recent?.recentInquiries ?? [];
    rq.innerHTML = list.length
      ? '<div class="admin-card-body">' +
        list
          .map(
            (i) =>
              `<div class="admin-recent-item"><span>${esc(i.name || "—")}${i.product ? " · " + esc(i.product) : ""}</span><span class="admin-recent-time">${esc((i.created_at || "").slice(0, 10))}</span></div>`,
          )
          .join("") +
        "</div>"
      : '<div class="admin-card-body admin-empty-state">暂无</div>';
  }
}

// ---- 运营总览（保留原能力）----
function renderOps(kpi: KpiData | null) {
  const opsEl = document.getElementById("ops-overview");
  if (!opsEl) return;
  const n = (v: unknown): string | number =>
    v != null ? (typeof v === "number" ? v : String(v)) : "—";
  let cs: Record<string, unknown>;
  try {
    cs = JSON.parse(opsEl.dataset.content || "{}") as Record<string, unknown>;
  } catch {
    cs = {};
  }
  opsEl.innerHTML =
    pulseCard("博客文章", n(cs.blog), undefined, false, "/admin-v2/content?type=blog") +
    pulseCard(
      "产品资料",
      n(cs.products),
      undefined,
      false,
      "/admin-v2/content?type=product_content",
    ) +
    pulseCard("指南", n(cs.guides), undefined, false, "/admin-v2/content?type=guide") +
    pulseCard("案例", n(cs.cases), undefined, false, "/admin-v2/content?type=case_study") +
    pulseCard(
      "现货商品",
      kpiCell(kpi, "commerceActive"),
      undefined,
      false,
      "/admin-v2/commerce/products",
    ) +
    pulseCard(
      "询盘总数",
      kpiCell(kpi, "totalInquiries"),
      undefined,
      false,
      "/admin-v2/customers/inquiries",
    );
}

// ---- 启动 ----
document.addEventListener("click", (e) => {
  const card = (e.target as HTMLElement).closest?.("[data-href]") as HTMLElement | null;
  if (!card) return;
  const href = card.getAttribute("data-href");
  if (href) window.location.href = href;
});
async function init(): Promise<void> {
  const [kpi, wf, funnel, recent] = await Promise.all([
    fetchJSON<KpiData>(`${API}/kpi`, "业务 KPI"),
    fetchJSON<WorkforceData>("/api/admin/v2/ai/workforce", "AI 工作台"),
    fetchJSON<FunnelData>(`${API}/funnel`, "转化漏斗"),
    fetchJSON<RecentData>(`${API}/recent`, "最近动态"),
  ]);
  renderHero(kpi, wf);
  renderPulse(kpi, wf);
  renderAiPanel(wf);
  renderLearning(wf);
  renderQueue(wf);
  renderOps(kpi);
  renderFunnel("funnel-inquiry", "询盘漏斗", funnel?.inquiryFunnel ?? null);
  renderFunnel("funnel-commerce", "订单漏斗", funnel?.commerceFunnel ?? null);
  renderRecent(recent);
}

void init();
