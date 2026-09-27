// ---------------------------------------------------------------------------
//  Aromiso V4.1 — GET /api/admin/stats?type=dashboard|seo|ga|behavior|products|inquiries&range=7d|28d|90d
//
//  Authenticated (admin cookie). Reads D1 snapshot tables and returns JSON
//  for the admin dashboard views. Includes AI-style analysis, opportunity
//  detection, anomaly alerts, hot-score ranking, and inquiry attribution.
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { readCookie, verifySession } from "./shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D1Row = Record<string, any>;

// ---- Helpers ----

function analyzeOpportunity(q: D1Row) {
  const pos = Number(q.position);
  const impr = Number(q.impressions);
  const ctr = Number(q.ctr);
  const suggestions: string[] = [];

  // Position 5-15 with decent impressions = quick win opportunity
  if (pos >= 5 && pos <= 15 && impr >= 100) {
    suggestions.push("优化Title和Meta Description");
    if (ctr < 1) suggestions.push("CTR偏低，增加FAQ区块");
    if (impr > 500) suggestions.push("高曝光关键词，建议增加相关Case Study");
  }
  // Position 1-4 but low CTR = title/metadata issue
  if (pos >= 1 && pos < 5 && ctr < 2 && impr > 50) {
    suggestions.push("排名靠前但CTR低，重写Title吸引点击");
  }
  // Position > 15 but high impressions = content gap
  if (pos > 15 && impr > 200) {
    suggestions.push("曝光高但排名靠后，需要增加高质量内容");
  }

  const score = impr * Math.max(0, 1 - pos / 20) * (1 + ctr / 10);
  return { ...q, suggestions, score: Math.round(score) };
}

function detectAnomaly(p: D1Row) {
  const avgTime = Number(p.avg_time);
  const bounceRate = Number(p.bounce_rate);
  const issues: { severity: string; message: string; suggestion: string }[] = [];

  if (avgTime < 15 && Number(p.sessions) > 5) {
    issues.push({
      severity: "high",
      message: `平均停留仅${Math.round(avgTime)}秒`,
      suggestion: "Hero不够吸引，建议增加视频或Factory实拍",
    });
  } else if (avgTime < 30 && Number(p.sessions) > 10) {
    issues.push({
      severity: "medium",
      message: `停留偏短(${Math.round(avgTime)}秒)`,
      suggestion: "增加MOQ/交期等关键信息前置",
    });
  }
  if (bounceRate > 0.7 && Number(p.sessions) > 5) {
    issues.push({
      severity: "medium",
      message: `跳出率${Math.round(bounceRate * 100)}%`,
      suggestion: "检查页面加载速度和首屏内容相关性",
    });
  }

  return { ...p, issues };
}

function calcHotScore(p: D1Row) {
  const score =
    Number(p.views) * 1 +
    Number(p.downloads) * 3 +
    Number(p.inquiries) * 8 +
    Number(p.whatsapp) * 6 +
    Number(p.email) * 5;
  return { ...p, score };
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // ---- Auth ----
  if (!env.ADMIN_PASSWORD) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const cookie = readCookie(request);
  if (!(await verifySession(cookie, env.ADMIN_PASSWORD))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!env.DB) {
    return Response.json({ error: "DB not bound" }, { status: 500 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "dashboard";
  const range = url.searchParams.get("range") || "28d";
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 28;

  // V5.38：自定义区间 start/end（含两端，YYYY-MM-DD）——后台 GA4 式日期选择器传入；
  // 缺省时回退旧 range=7d/28d/90d 行为（仪表盘仍走这里）。
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const startP = url.searchParams.get("start") || "";
  const endP = url.searchParams.get("end") || "";
  const hasCustom = DATE_RE.test(startP) && DATE_RE.test(endP) && startP <= endP;
  const since = hasCustom
    ? Math.floor(Date.parse(startP + "T00:00:00Z") / 1000)
    : Math.floor(Date.now() / 1000) - days * 86400;
  const until = hasCustom
    ? Math.floor(Date.parse(endP + "T00:00:00Z") / 1000) + 86399
    : Math.floor(Date.now() / 1000) + 86399;
  const sinceDate = hasCustom ? startP : new Date(since * 1000).toISOString().slice(0, 10);
  const endDate = hasCustom ? endP : new Date().toISOString().slice(0, 10);

  // =========================================================================
  //  V5.38 AVAILABILITY — 日期选择器数据可用性（没出来的日期置灰不可选）
  // =========================================================================
  if (type === "availability") {
    const [gscDates, gaDates, bhDates] = await Promise.all([
      env.DB.prepare(
        `SELECT DISTINCT date FROM gsc_daily WHERE date >= '2026-08-01' ORDER BY date`,
      ).all(),
      env.DB.prepare(
        `SELECT DISTINCT date FROM ga_daily WHERE date >= '2026-08-16' ORDER BY date`,
      ).all(),
      env.DB.prepare(
        `SELECT DISTINCT date(created_at, 'unixepoch') AS date FROM behavior_events
         WHERE created_at >= ? ORDER BY date`,
      )
        .bind(Math.floor(Date.parse("2026-07-01T00:00:00Z") / 1000))
        .all(),
    ]);
    let pending: D1Row[] = [];
    try {
      pending = (
        await env.DB.prepare(
          `SELECT source, date, status FROM pull_state WHERE status IN ('pending', 'empty', 'degraded')`,
        ).all()
      ).results as D1Row[];
    } catch {
      /* 迁移未跑时静默 */
    }
    return Response.json({
      type: "availability",
      today: new Date().toISOString().slice(0, 10),
      gsc: (gscDates.results as D1Row[]).map((r) => String(r.date)),
      ga4: (gaDates.results as D1Row[]).map((r) => String(r.date)),
      behavior: (bhDates.results as D1Row[]).map((r) => String(r.date)),
      pending: pending.map((r) => ({
        source: String(r.source),
        date: String(r.date),
        status: String(r.status),
      })),
    });
  }

  // =========================================================================
  //  DASHBOARD — all-in-one overview
  // =========================================================================
  if (type === "dashboard") {
    const [
      gscTotals,
      gaTotals,
      bhFunnel,
      opportunities,
      anomalies,
      hotProducts,
      downloads,
      scrollData,
      blogReads,
      dailyRecs,
      inquiryAttribution,
    ] = await Promise.all([
      env.DB.prepare(
        `SELECT SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(ctr) as ctr, AVG(position) as position FROM gsc_daily WHERE dimension = 'query' AND date >= ?`,
      )
        .bind(sinceDate)
        .all(),
      env.DB.prepare(
        `SELECT SUM(users) as users, SUM(sessions) as sessions, AVG(bounce_rate) as bounce_rate, AVG(avg_time) as avg_time FROM ga_daily WHERE dimension = 'country' AND date >= ?`,
      )
        .bind(sinceDate)
        .all(),
      env.DB.prepare(
        `SELECT SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) as page_views, SUM(CASE WHEN event_type='click_quote' THEN 1 ELSE 0 END) as quote_clicks, SUM(CASE WHEN event_type='click_whatsapp' THEN 1 ELSE 0 END) as whatsapp_clicks, SUM(CASE WHEN event_type='click_email' THEN 1 ELSE 0 END) as email_clicks, SUM(CASE WHEN event_type='inquiry_submit' THEN 1 ELSE 0 END) as inquiry_submits, SUM(CASE WHEN event_type='copy_email' THEN 1 ELSE 0 END) as email_copies FROM behavior_events WHERE created_at >= ?`,
      )
        .bind(since)
        .all(),
      // GSC opportunities: position 3-15, impressions > 50
      env.DB.prepare(
        `SELECT key, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(ctr) as ctr, AVG(position) as position FROM gsc_daily WHERE dimension = 'query' AND date >= ? GROUP BY key HAVING AVG(position) BETWEEN 3 AND 15 AND SUM(impressions) > 50 ORDER BY SUM(impressions) DESC LIMIT 10`,
      )
        .bind(sinceDate)
        .all(),
      // GA anomalies: pages with low avg_time
      env.DB.prepare(
        `SELECT key, SUM(users) as users, SUM(sessions) as sessions, AVG(avg_time) as avg_time, AVG(bounce_rate) as bounce_rate FROM ga_daily WHERE dimension = 'page' AND date >= ? GROUP BY key HAVING SUM(sessions) > 5 ORDER BY AVG(avg_time) ASC LIMIT 10`,
      )
        .bind(sinceDate)
        .all(),
      // Hot score products
      env.DB.prepare(
        `SELECT product_slug as slug, SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) as views, SUM(CASE WHEN event_type IN ('download_catalog','download_cert','download_oem','download_packaging') THEN 1 ELSE 0 END) as downloads, SUM(CASE WHEN event_type='inquiry_submit' THEN 1 ELSE 0 END) as inquiries, SUM(CASE WHEN event_type='click_whatsapp' THEN 1 ELSE 0 END) as whatsapp, SUM(CASE WHEN event_type='click_email' THEN 1 ELSE 0 END) as email FROM behavior_events WHERE created_at >= ? AND product_slug IS NOT NULL GROUP BY product_slug ORDER BY views DESC LIMIT 20`,
      )
        .bind(since)
        .all(),
      // Downloads breakdown
      env.DB.prepare(
        `SELECT event_type, COUNT(*) as count FROM behavior_events WHERE created_at >= ? AND event_type IN ('download_catalog','download_cert','download_oem','download_packaging') GROUP BY event_type ORDER BY count DESC`,
      )
        .bind(since)
        .all(),
      // Scroll depth
      env.DB.prepare(
        `SELECT event_type, COUNT(*) as count FROM behavior_events WHERE created_at >= ? AND event_type IN ('scroll_25','scroll_50','scroll_75','scroll_100') GROUP BY event_type ORDER BY event_type`,
      )
        .bind(since)
        .all(),
      // Blog read time
      env.DB.prepare(
        `SELECT page, COUNT(*) as reads FROM behavior_events WHERE created_at >= ? AND event_type = 'blog_read' AND page IS NOT NULL GROUP BY page ORDER BY reads DESC LIMIT 15`,
      )
        .bind(since)
        .all(),
      // Daily AI recommendations (latest batch)
      env.DB.prepare(
        `SELECT category, priority, title, detail, metric_val FROM daily_recs ORDER BY created_at DESC, metric_val DESC LIMIT 15`,
      ).all(),
      // Recent inquiries with session journey
      env.DB.prepare(
        `SELECT id, name, email, company, country, product, quantity, message, status, created_at, session_id FROM inquiries ORDER BY created_at DESC LIMIT 10`,
      ).all(),
    ]);

    const opps = opportunities.results
      .map((q) => analyzeOpportunity(q as D1Row))
      .filter((o) => o.suggestions.length > 0)
      .sort((a, b) => b.score - a.score);
    const anoms = anomalies.results
      .map((p) => detectAnomaly(p as D1Row))
      .filter((a) => a.issues.length > 0);
    const hotProds = hotProducts.results
      .map((p) => calcHotScore(p as D1Row))
      .sort((a, b) => b.score - a.score);
    const dlMap: Record<string, number> = {};
    for (const r of downloads.results) {
      const label = (r as D1Row).event_type.replace("download_", "");
      dlMap[label] = (r as D1Row).count;
    }
    const scrollMap: Record<string, number> = {};
    for (const r of scrollData.results) {
      scrollMap[(r as D1Row).event_type] = (r as D1Row).count;
    }

    return Response.json({
      type: "dashboard",
      range,
      gsc: gscTotals.results[0] || {},
      ga: gaTotals.results[0] || {},
      funnel: bhFunnel.results[0] || {},
      opportunities: opps,
      anomalies: anoms,
      hotProducts: hotProds,
      downloads: dlMap,
      scroll: scrollMap,
      blogReads: blogReads.results,
      dailyRecs: dailyRecs.results,
      recentInquiries: inquiryAttribution.results,
    });
  }

  // =========================================================================
  //  SEO — GSC data with opportunity analysis
  // =========================================================================
  if (type === "seo") {
    const [queries, pages, countries, totals, series] = await Promise.all([
      env.DB.prepare(
        `SELECT key, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(ctr) as ctr, AVG(position) as position FROM gsc_daily WHERE dimension = 'query' AND date >= ? AND date <= ? GROUP BY key ORDER BY clicks DESC LIMIT 30`,
      )
        .bind(sinceDate, endDate)
        .all(),
      env.DB.prepare(
        `SELECT key, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(ctr) as ctr, AVG(position) as position FROM gsc_daily WHERE dimension = 'page' AND date >= ? AND date <= ? GROUP BY key ORDER BY clicks DESC LIMIT 30`,
      )
        .bind(sinceDate, endDate)
        .all(),
      env.DB.prepare(
        `SELECT key, SUM(clicks) as clicks, SUM(impressions) as impressions FROM gsc_daily WHERE dimension = 'country' AND date >= ? AND date <= ? GROUP BY key ORDER BY clicks DESC LIMIT 15`,
      )
        .bind(sinceDate, endDate)
        .all(),
      env.DB.prepare(
        `SELECT SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(ctr) as ctr, AVG(position) as position FROM gsc_daily WHERE dimension = 'query' AND date >= ? AND date <= ?`,
      )
        .bind(sinceDate, endDate)
        .all(),
      env.DB.prepare(
        `SELECT date, SUM(clicks) as clicks, SUM(impressions) as impressions FROM gsc_daily WHERE dimension = 'query' AND date >= ? AND date <= ? GROUP BY date ORDER BY date`,
      )
        .bind(sinceDate, endDate)
        .all(),
    ]);

    const opps = queries.results
      .map((q) => analyzeOpportunity(q as D1Row))
      .filter((o) => o.suggestions.length > 0)
      .sort((a, b) => b.score - a.score);

    return Response.json({
      type: "seo",
      range,
      start: sinceDate,
      end: endDate,
      totals: totals.results[0] || {},
      topQueries: queries.results,
      topPages: pages.results,
      topCountries: countries.results,
      opportunities: opps,
      series: series.results,
    });
  }

  // =========================================================================
  //  GA — Analytics with anomaly detection
  // =========================================================================
  if (type === "ga") {
    const [countries, devices, sources, pages, totals, series] = await Promise.all([
      env.DB.prepare(
        `SELECT key, SUM(users) as users, SUM(sessions) as sessions, AVG(bounce_rate) as bounce_rate, AVG(avg_time) as avg_time FROM ga_daily WHERE dimension = 'country' AND date >= ? AND date <= ? GROUP BY key ORDER BY users DESC LIMIT 15`,
      )
        .bind(sinceDate, endDate)
        .all(),
      env.DB.prepare(
        `SELECT key, SUM(users) as users, SUM(sessions) as sessions, AVG(bounce_rate) as bounce_rate FROM ga_daily WHERE dimension = 'device' AND date >= ? AND date <= ? GROUP BY key ORDER BY users DESC`,
      )
        .bind(sinceDate, endDate)
        .all(),
      env.DB.prepare(
        `SELECT key, SUM(users) as users, SUM(sessions) as sessions FROM ga_daily WHERE dimension = 'source' AND date >= ? AND date <= ? GROUP BY key ORDER BY users DESC LIMIT 15`,
      )
        .bind(sinceDate, endDate)
        .all(),
      env.DB.prepare(
        `SELECT key, SUM(users) as users, SUM(sessions) as sessions, AVG(avg_time) as avg_time, AVG(bounce_rate) as bounce_rate FROM ga_daily WHERE dimension = 'page' AND date >= ? AND date <= ? GROUP BY key ORDER BY users DESC LIMIT 30`,
      )
        .bind(sinceDate, endDate)
        .all(),
      env.DB.prepare(
        `SELECT SUM(users) as users, SUM(sessions) as sessions, AVG(bounce_rate) as bounce_rate, AVG(avg_time) as avg_time FROM ga_daily WHERE dimension = 'country' AND date >= ? AND date <= ?`,
      )
        .bind(sinceDate, endDate)
        .all(),
      env.DB.prepare(
        `SELECT date, SUM(users) as users, SUM(sessions) as sessions FROM ga_daily WHERE dimension = 'country' AND date >= ? AND date <= ? GROUP BY date ORDER BY date`,
      )
        .bind(sinceDate, endDate)
        .all(),
    ]);

    const anoms = pages.results
      .map((p) => detectAnomaly(p as D1Row))
      .filter((a) => a.issues.length > 0);

    return Response.json({
      type: "ga",
      range,
      start: sinceDate,
      end: endDate,
      totals: totals.results[0] || {},
      topCountries: countries.results,
      devices: devices.results,
      topSources: sources.results,
      topPages: pages.results,
      anomalies: anoms,
      series: series.results,
    });
  }

  // =========================================================================
  //  BEHAVIOR — self-built tracking
  // =========================================================================
  if (type === "behavior") {
    const [events, products, funnel, downloads, scrollData, blogReads, series] = await Promise.all([
      env.DB.prepare(
        `SELECT event_type, COUNT(*) as count FROM behavior_events WHERE created_at >= ? AND created_at <= ? GROUP BY event_type ORDER BY count DESC`,
      )
        .bind(since, until)
        .all(),
      env.DB.prepare(
        `SELECT product_slug, COUNT(*) as count FROM behavior_events WHERE created_at >= ? AND created_at <= ? AND product_slug IS NOT NULL AND event_type IN ('click_quote','click_whatsapp','page_view','view_product') GROUP BY product_slug ORDER BY count DESC LIMIT 20`,
      )
        .bind(since, until)
        .all(),
      env.DB.prepare(
        `SELECT SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) as page_views, SUM(CASE WHEN event_type='click_quote' THEN 1 ELSE 0 END) as quote_clicks, SUM(CASE WHEN event_type='click_whatsapp' THEN 1 ELSE 0 END) as whatsapp_clicks, SUM(CASE WHEN event_type='click_email' THEN 1 ELSE 0 END) as email_clicks, SUM(CASE WHEN event_type='download_catalog' THEN 1 ELSE 0 END) as catalog_downloads, SUM(CASE WHEN event_type='download_cert' THEN 1 ELSE 0 END) as cert_downloads, SUM(CASE WHEN event_type='download_oem' THEN 1 ELSE 0 END) as oem_downloads, SUM(CASE WHEN event_type='download_packaging' THEN 1 ELSE 0 END) as packaging_downloads, SUM(CASE WHEN event_type='inquiry_submit' THEN 1 ELSE 0 END) as inquiry_submits, SUM(CASE WHEN event_type='copy_email' THEN 1 ELSE 0 END) as email_copies, SUM(CASE WHEN event_type='view_product' THEN 1 ELSE 0 END) as product_views, SUM(CASE WHEN event_type='blog_read' THEN 1 ELSE 0 END) as blog_reads FROM behavior_events WHERE created_at >= ? AND created_at <= ?`,
      )
        .bind(since, until)
        .all(),
      env.DB.prepare(
        `SELECT event_type, COUNT(*) as count FROM behavior_events WHERE created_at >= ? AND created_at <= ? AND event_type IN ('download_catalog','download_cert','download_oem','download_packaging') GROUP BY event_type ORDER BY count DESC`,
      )
        .bind(since, until)
        .all(),
      env.DB.prepare(
        `SELECT event_type, COUNT(*) as count FROM behavior_events WHERE created_at >= ? AND created_at <= ? AND event_type IN ('scroll_25','scroll_50','scroll_75','scroll_100') GROUP BY event_type ORDER BY event_type`,
      )
        .bind(since, until)
        .all(),
      env.DB.prepare(
        `SELECT page, COUNT(*) as reads FROM behavior_events WHERE created_at >= ? AND created_at <= ? AND event_type = 'blog_read' AND page IS NOT NULL GROUP BY page ORDER BY reads DESC LIMIT 15`,
      )
        .bind(since, until)
        .all(),
      env.DB.prepare(
        `SELECT date(created_at, 'unixepoch') as day, COUNT(*) as events, SUM(CASE WHEN event_type='inquiry_submit' THEN 1 ELSE 0 END) as inquiries FROM behavior_events WHERE created_at >= ? AND created_at <= ? GROUP BY day ORDER BY day`,
      )
        .bind(since, until)
        .all(),
    ]);

    const dlMap: Record<string, number> = {};
    for (const r of downloads.results)
      dlMap[(r as D1Row).event_type.replace("download_", "")] = (r as D1Row).count;
    const scrollMap: Record<string, number> = {};
    for (const r of scrollData.results) scrollMap[(r as D1Row).event_type] = (r as D1Row).count;

    return Response.json({
      type: "behavior",
      range,
      start: sinceDate,
      end: endDate,
      events: events.results,
      topProducts: products.results,
      funnel: funnel.results[0] || {},
      downloads: dlMap,
      scroll: scrollMap,
      blogReads: blogReads.results,
      series: series.results,
    });
  }

  // =========================================================================
  //  PRODUCTS — Hot Score ranking
  // =========================================================================
  if (type === "products") {
    const hotProducts = await env.DB.prepare(
      `SELECT product_slug as slug,
         SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) as views,
         SUM(CASE WHEN event_type IN ('download_catalog','download_cert','download_oem','download_packaging') THEN 1 ELSE 0 END) as downloads,
         SUM(CASE WHEN event_type='inquiry_submit' THEN 1 ELSE 0 END) as inquiries,
         SUM(CASE WHEN event_type='click_whatsapp' THEN 1 ELSE 0 END) as whatsapp,
         SUM(CASE WHEN event_type='click_email' THEN 1 ELSE 0 END) as email
       FROM behavior_events WHERE created_at >= ? AND product_slug IS NOT NULL
       GROUP BY product_slug ORDER BY views DESC LIMIT 50`,
    )
      .bind(since)
      .all();

    const ranked = hotProducts.results
      .map((p) => calcHotScore(p as D1Row))
      .sort((a, b) => b.score - a.score);

    return Response.json({ type: "products", range, products: ranked });
  }

  // =========================================================================
  //  INQUIRIES — with attribution
  // =========================================================================
  if (type === "inquiries") {
    const inquiries = await env.DB.prepare(
      `SELECT id, name, email, company, country, product, quantity, message, whatsapp, status, created_at, session_id
       FROM inquiries ORDER BY created_at DESC LIMIT 50`,
    ).all();

    // For each inquiry, fetch the session journey
    const results = [];
    for (const inq of inquiries.results as D1Row[]) {
      let journey: D1Row[] = [];
      if (inq.session_id) {
        const j = await env.DB.prepare(
          `SELECT event_type, page, product_slug, created_at FROM behavior_events WHERE session_id = ? ORDER BY created_at ASC LIMIT 50`,
        )
          .bind(inq.session_id)
          .all();
        journey = j.results;
      }
      results.push({ ...inq, journey });
    }

    return Response.json({ type: "inquiries", inquiries: results });
  }

  // =========================================================================
  //  SHOP — V5.28 shop analytics & data loop
  // =========================================================================
  if (type === "shop") {
    const [funnel, filters, searches, featured, social, paths, related, trend] = await Promise.all([
      env.DB.prepare(
        `SELECT
             SUM(CASE WHEN event_type='page_view' AND page LIKE '%/shop%' THEN 1 ELSE 0 END) as shop_views,
             SUM(CASE WHEN event_type='filter_use' THEN 1 ELSE 0 END) as filter_uses,
             SUM(CASE WHEN event_type='shop_search' THEN 1 ELSE 0 END) as searches,
             SUM(CASE WHEN event_type='featured_click' THEN 1 ELSE 0 END) as featured_clicks,
             SUM(CASE WHEN event_type='related_product_click' THEN 1 ELSE 0 END) as related_clicks,
             SUM(CASE WHEN event_type='guide_click' THEN 1 ELSE 0 END) as guide_clicks,
             SUM(CASE WHEN event_type='view_product' THEN 1 ELSE 0 END) as product_views,
             SUM(CASE WHEN event_type='add_to_cart' THEN 1 ELSE 0 END) as add_to_carts,
             SUM(CASE WHEN event_type='rfq_start' THEN 1 ELSE 0 END) as rfq_starts,
             SUM(CASE WHEN event_type='click_quote' THEN 1 ELSE 0 END) as quote_clicks,
             SUM(CASE WHEN event_type='inquiry_submit' THEN 1 ELSE 0 END) as inquiry_submits
           FROM behavior_events WHERE created_at >= ? AND created_at <= ?`,
      )
        .bind(since, until)
        .all(),
      env.DB.prepare(
        `SELECT label, COUNT(*) as count FROM behavior_events WHERE created_at >= ? AND created_at <= ? AND event_type='filter_use' AND label IS NOT NULL AND label != '' GROUP BY label ORDER BY count DESC LIMIT 20`,
      )
        .bind(since, until)
        .all(),
      env.DB.prepare(
        `SELECT label, COUNT(*) as count FROM behavior_events WHERE created_at >= ? AND created_at <= ? AND event_type='shop_search' AND label IS NOT NULL AND label != '' GROUP BY label ORDER BY count DESC LIMIT 20`,
      )
        .bind(since, until)
        .all(),
      env.DB.prepare(
        `SELECT label, COUNT(*) as count FROM behavior_events WHERE created_at >= ? AND created_at <= ? AND event_type='featured_click' AND label IS NOT NULL AND label != '' GROUP BY label ORDER BY count DESC LIMIT 20`,
      )
        .bind(since, until)
        .all(),
      env.DB.prepare(
        `SELECT event_type, page, COUNT(*) as count FROM behavior_events WHERE created_at >= ? AND created_at <= ? AND event_type IN ('click_facebook','click_messenger','click_whatsapp') GROUP BY event_type, page ORDER BY count DESC LIMIT 25`,
      )
        .bind(since, until)
        .all(),
      env.DB.prepare(
        `SELECT page, COUNT(*) as views FROM behavior_events WHERE created_at >= ? AND created_at <= ? AND event_type='page_view' AND page LIKE '%/shop%' GROUP BY page ORDER BY views DESC LIMIT 20`,
      )
        .bind(since, until)
        .all(),
      env.DB.prepare(
        `SELECT event_type, label, COUNT(*) as count FROM behavior_events WHERE created_at >= ? AND created_at <= ? AND event_type IN ('related_product_click','guide_click') AND label IS NOT NULL AND label != '' GROUP BY event_type, label ORDER BY count DESC LIMIT 25`,
      )
        .bind(since, until)
        .all(),
      env.DB.prepare(
        `SELECT date(created_at,'unixepoch') as day, COUNT(*) as events FROM behavior_events
           WHERE created_at >= ? AND created_at <= ? AND (
             event_type IN ('filter_use','shop_search','featured_click','add_to_cart','rfq_start')
             OR (event_type='page_view' AND page LIKE '%/shop%')
           ) GROUP BY day ORDER BY day`,
      )
        .bind(since, until)
        .all(),
    ]);

    return Response.json({
      type: "shop",
      range,
      start: sinceDate,
      end: endDate,
      funnel: funnel.results[0] || {},
      filters: filters.results,
      searches: searches.results,
      featured: featured.results,
      social: social.results,
      paths: paths.results,
      related: related.results,
      trend: trend.results,
    });
  }

  return Response.json({ error: `Unknown type: ${type}` }, { status: 400 });
};
