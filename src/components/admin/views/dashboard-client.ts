// ============================================================================
// Jewelry V1.0 商业驾驶舱客户端
// 数据源：/api/admin/v2/dashboard/kpi（Jewelry 指标）
//         /api/admin/v2/commerce/orders?page=1&pageSize=8（最近订单，复用）
//         /api/admin/v2/commerce/products?status=active&pageSize=100（低库存明细）
// 原则：无数据一律 —，失败显式提示，绝不伪造数字。
// ============================================================================

const API_KPI = "/api/admin/v2/dashboard/kpi";
const API_ORDERS = "/api/admin/v2/commerce/orders";
const API_PRODUCTS = "/api/admin/v2/commerce/products";

function esc(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let didRedirect = false;

function reportFailure(label: string, detail: string): void {
  (window as any).showToast?.(`${label}：${detail}`, "warning");
}

async function fetchJSON<T>(url: string, label: string): Promise<T | null> {
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
      reportFailure(label, `HTTP ${r.status}`);
      return null;
    }
    const j = (await r.json()) as { success?: boolean; data?: T };
    return j.success && j.data != null ? j.data : null;
  } catch (e) {
    reportFailure(label, e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ---- 数据契约 ---------------------------------------------------------------
interface MarketRevenue {
  market: string;
  currency: string;
  orders: number;
  revenue: number; // minor units
}
interface KpiData {
  ordersToday: number;
  revenueToday: number;
  ordersThisMonth: number;
  revenueThisMonth: number;
  revenueTodayByMarket: MarketRevenue[];
  revenueThisMonthByMarket: MarketRevenue[];
  pendingConfirmation: number;
  activeProducts: number;
  lowStock: number;
  totalCustomers: number;
  pendingReviews: number;
  statusCounts: Record<string, number>;
}
interface AdminOrderRow {
  id: string;
  order_number: string;
  order_status: string;
  payment_status: string;
  market: string;
  currency: string;
  total_amount: number; // minor units
  created_at: string;
  customer_email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  country: string | null;
}
interface AdminProductRow {
  id: string;
  title: string;
  status: string;
  min_price: number | null;
  total_inventory: number;
}

// ---- 订单状态机标签（内部值 → 中文；UI 唯一映射处）---------------------------
export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: "待确认",
  CONFIRMED: "已确认",
  PROCESSING: "处理中",
  SHIPPED: "已发货",
  OUT_FOR_DELIVERY: "派送中",
  DELIVERED: "已送达",
  CANCELLED: "已取消",
  DELIVERY_FAILED: "派送失败",
  NDR: "问题件",
  RTO: "退回在途",
  RETURNED: "已退货",
  REFUNDED: "已退款",
};
function statusBadge(status: string | null | undefined): string {
  if (!status) return '<span class="admin-badge">—</span>';
  const tone: Record<string, string> = {
    PENDING_CONFIRMATION: "admin-badge-draft",
    CONFIRMED: "admin-badge-active",
    PROCESSING: "admin-badge-active",
    SHIPPED: "admin-badge-active",
    OUT_FOR_DELIVERY: "admin-badge-active",
    DELIVERED: "admin-badge-published",
    CANCELLED: "admin-badge-archived",
    DELIVERY_FAILED: "admin-badge-archived",
    NDR: "admin-badge-draft",
    RTO: "admin-badge-draft",
    RETURNED: "admin-badge-archived",
    REFUNDED: "admin-badge-archived",
  };
  const cls = tone[status] || "admin-badge";
  return `<span class="admin-badge ${cls}">${esc(ORDER_STATUS_LABELS[status] ?? status)}</span>`;
}

// minor units → 主单位（SAR/AED 均为 2 位小数）
function money(minor: number | null | undefined, currency: string): string {
  if (minor == null) return "—";
  const v = (minor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${esc(currency)} ${v}`;
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("zh-CN");
}

// ---- ① Hero ----
function renderHero(kpi: KpiData | null) {
  const titleEl = document.getElementById("hero-title");
  if (titleEl) {
    titleEl.innerHTML = kpi
      ? `今日新订单 <span class="dash-hero-num">${kpi.ordersToday}</span>` +
        ` · 待确认 <span class="dash-hero-num">${kpi.pendingConfirmation}</span>` +
        ` · 在售商品 <span class="dash-hero-num">${kpi.activeProducts}</span>`
      : "经营数据暂不可用";
  }
  const strip = document.getElementById("hero-strip");
  if (strip) {
    strip.innerHTML = kpi
      ? `<span>客户总数 ${kpi.totalCustomers}</span>` +
        `<span>低库存商品 ${kpi.lowStock}</span>` +
        `<span>待审核评价 ${kpi.pendingReviews}</span>`
      : "";
  }
  const ordersEl = document.getElementById("hero-orders-today");
  if (ordersEl) ordersEl.textContent = kpi ? String(kpi.ordersToday) : "—";
  const revenueEl = document.getElementById("hero-revenue-today");
  if (revenueEl) {
    revenueEl.innerHTML = kpi
      ? "今日收入 " +
        (kpi.revenueTodayByMarket.length
          ? kpi.revenueTodayByMarket
              .map((m) => esc(m.currency) + " " + (m.revenue / 100).toLocaleString("en-US"))
              .join(" / ")
          : '<span class="dash-nodata">—</span>')
      : "今日收入 —";
  }
}

// ---- ② Business Pulse ----
function pulseCard(key: string, value: string, sub?: string, href?: string): string {
  return `<div class="dash-pulse-card${href ? " is-link" : ""}"${href ? ` data-href="${href}"` : ""}><div class="v">${value}</div><div class="k">${esc(key)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ""}</div>`;
}
function renderPulse(kpi: KpiData | null) {
  const el = document.getElementById("pulse-grid");
  if (!el) return;
  if (!kpi) {
    el.innerHTML = '<div class="admin-empty-state">数据暂不可用（接口错误），恢复后自动正常</div>';
    return;
  }
  const monthRevenue = kpi.revenueThisMonthByMarket.length
    ? kpi.revenueThisMonthByMarket
        .map((m) => `${esc(m.currency)} ${(m.revenue / 100).toLocaleString("en-US")}`)
        .join(" / ")
    : "—";
  el.innerHTML = [
    pulseCard("今日订单", String(kpi.ordersToday), undefined, "/admin-v2/commerce/orders"),
    pulseCard(
      "今日收入",
      kpi.revenueTodayByMarket.length
        ? kpi.revenueTodayByMarket
            .map((m) => `${esc(m.currency)} ${(m.revenue / 100).toLocaleString("en-US")}`)
            .join(" / ")
        : "—",
    ),
    pulseCard("本月订单", String(kpi.ordersThisMonth), undefined, "/admin-v2/commerce/orders"),
    pulseCard("本月收入", monthRevenue),
    pulseCard(
      "待确认订单",
      String(kpi.pendingConfirmation),
      undefined,
      "/admin-v2/commerce/orders",
    ),
    pulseCard("在售商品", String(kpi.activeProducts), undefined, "/admin-v2/commerce/products"),
    pulseCard("低库存商品", String(kpi.lowStock), "总库存 < 5", "/admin-v2/commerce/products"),
    pulseCard("客户总数", String(kpi.totalCustomers), undefined, "/admin-v2/customers/list"),
  ].join("");
}

// ---- ③ 最近订单 ----
function renderRecentOrders(orders: AdminOrderRow[] | null) {
  const el = document.getElementById("recent-orders");
  if (!el) return;
  if (!orders) {
    el.innerHTML = '<div class="admin-empty-state">数据暂不可用</div>';
    return;
  }
  if (!orders.length) {
    el.innerHTML = '<div class="admin-empty-state">暂无订单</div>';
    return;
  }
  el.innerHTML =
    '<div class="dash-timeline">' +
    orders
      .map(
        (o) =>
          `<div class="dash-tl-row" style="grid-template-columns:auto 1fr auto auto;align-items:center;">` +
          `<span class="dash-tl-time">${fmtDate(o.created_at)}</span>` +
          `<span class="dash-tl-what">${esc(o.order_number)} · ${esc(o.first_name || o.customer_email || "访客")}</span>` +
          `${statusBadge(o.order_status)}` +
          `<span class="admin-font-semibold" style="white-space:nowrap;">${money(o.total_amount, o.currency)}</span>` +
          `</div>`,
      )
      .join("") +
    "</div>";
}

// ---- ④ 状态分布 + 低库存 ----
function renderStatusDist(kpi: KpiData | null) {
  const el = document.getElementById("status-dist");
  if (!el) return;
  if (!kpi) {
    el.innerHTML = '<div class="admin-empty-state">数据暂不可用</div>';
    return;
  }
  const entries = Object.entries(kpi.statusCounts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    el.innerHTML = '<div class="admin-empty-state">暂无订单</div>';
    return;
  }
  const max = Math.max(...entries.map(([, c]) => c), 1);
  el.innerHTML = entries
    .map(
      ([s, c]) =>
        `<div class="admin-flex admin-items-center" style="gap:var(--sp-2);margin-bottom:var(--sp-2);">` +
        `<span style="width:72px;flex-shrink:0;">${statusBadge(s)}</span>` +
        `<div style="flex:1;background:var(--bg-subtle);border-radius:4px;height:14px;overflow:hidden;">` +
        `<div style="width:${Math.max(4, (c / max) * 100)}%;height:100%;background:var(--accent);"></div>` +
        `</div>` +
        `<span class="admin-text-sm" style="width:32px;text-align:right;">${c}</span>` +
        `</div>`,
    )
    .join("");
}
function renderLowStock(products: AdminProductRow[] | null, kpi: KpiData | null) {
  const el = document.getElementById("low-stock");
  if (!el) return;
  if (!products || !kpi) {
    el.innerHTML = '<div class="admin-empty-state">数据暂不可用</div>';
    return;
  }
  const low = products.filter((p) => p.status === "active" && p.total_inventory < 5);
  if (!low.length) {
    el.innerHTML = '<div class="admin-empty-state">库存健康，无低库存商品</div>';
    return;
  }
  el.innerHTML =
    low
      .slice(0, 6)
      .map(
        (p) =>
          `<div class="admin-flex admin-items-center admin-justify-between" style="padding:var(--sp-2) 0;border-bottom:1px solid var(--line);">` +
          `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.title)}</span>` +
          `<span class="admin-badge admin-badge-draft">余 ${p.total_inventory}</span>` +
          `</div>`,
      )
      .join("") +
    (low.length > 6
      ? `<div class="admin-text-sm admin-text-muted" style="margin-top:var(--sp-2);">另有 ${low.length - 6} 件，请到商品管理查看</div>`
      : "");
}

// ---- ⑤ 内容总览 ----
function renderOps(kpi: KpiData | null) {
  const opsEl = document.getElementById("ops-overview");
  if (!opsEl) return;
  let cs: Record<string, unknown>;
  try {
    cs = JSON.parse(opsEl.dataset.content || "{}") as Record<string, unknown>;
  } catch {
    cs = {};
  }
  const n = (v: unknown): string => (typeof v === "number" ? String(v) : "—");
  opsEl.innerHTML =
    pulseCard("博客文章", n(cs.blog), undefined, "/admin-v2/content") +
    pulseCard("指南", n(cs.guides), undefined, "/admin-v2/content") +
    pulseCard(
      "在售商品",
      kpi ? String(kpi.activeProducts) : "—",
      undefined,
      "/admin-v2/commerce/products",
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
  const [kpi, recentOrders, activeProducts] = await Promise.all([
    fetchJSON<KpiData>(API_KPI, "经营 KPI"),
    fetchJSON<AdminOrderRow[]>(`${API_ORDERS}?page=1&pageSize=8`, "最近订单"),
    fetchJSON<AdminProductRow[]>(`${API_PRODUCTS}?status=active&pageSize=100`, "低库存"),
  ]);
  renderHero(kpi);
  renderPulse(kpi);
  renderRecentOrders(recentOrders);
  renderStatusDist(kpi);
  renderLowStock(activeProducts, kpi);
  renderOps(kpi);
}

void init();
