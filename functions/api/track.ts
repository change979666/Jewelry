// ---------------------------------------------------------------------------
//  Aromiso V4 — POST /api/track
//
//  Public endpoint for self-built behavior tracking (no auth required).
//  Receives events via navigator.sendBeacon from the frontend.
//  Rate-limited per IP (100 events/hour). Writes to D1 behavior_events.
//  Graceful degradation: always returns 200 to avoid blocking the user.
// ---------------------------------------------------------------------------

import type { Env } from "../types";

const VALID_EVENTS = new Set([
  "page_view",
  "click_quote",
  "click_whatsapp",
  "click_messenger",
  "click_facebook",
  "click_email",
  "download_catalog",
  "download_cert",
  "download_oem",
  "download_packaging",
  "newsletter",
  "inquiry_submit",
  "scroll_25",
  "scroll_50",
  "scroll_75",
  "scroll_100",
  "view_product",
  "blog_read",
  "copy_email",
  // V5.27: Shop & merchandising events
  "filter_use", // value: "category:Essential Oils" or "moq:le50"
  "shop_search", // value: search term
  "featured_click", // value: product_id from featured strip
  "add_to_cart",
  "rfq_start", // RFQ form opened (not submitted)
  "related_product_click", // value: product_slug
  "guide_click", // value: guide slug
  // Studio V1: localized video line (names kept distinct from Meta Pixel events, §16.4)
  "video_view", // value: video asset id
  "video_product_click", // value: video asset id + product slug
]);

const MAX_FIELD_LEN = 500;
const RATE_LIMIT = 100; // events per hour per IP
const RATE_WINDOW = 3600; // seconds

interface TrackBody {
  event_type?: string;
  page?: string;
  product_slug?: string;
  lang?: string;
  device?: string;
  referrer?: string;
  session_id?: string;
  label?: string; // V5.27: event-specific context (search term, filter value, etc.)
}

function truncate(s: unknown, max = MAX_FIELD_LEN): string | null {
  if (typeof s !== "string" || s.length === 0) return null;
  return s.slice(0, max);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // ---- Rate limiting (KV-based, per IP) ----
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (env.DRAFTS && ip !== "unknown") {
    const rlKey = `rl:track:${ip}`;
    const count = Number((await env.DRAFTS.get(rlKey)) || "0");
    if (count >= RATE_LIMIT) {
      // Still return 200 — don't reveal rate limiting to client
      return new Response(null, { status: 204 });
    }
    await env.DRAFTS.put(rlKey, String(count + 1), { expirationTtl: RATE_WINDOW });
  }

  // ---- Parse body (sendBeacon sends as text/plain or application/json) ----
  let body: TrackBody;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  // ---- Validate event_type ----
  const eventType = body.event_type;
  if (!eventType || !VALID_EVENTS.has(eventType)) {
    return new Response(null, { status: 204 });
  }

  // ---- Extract fields ----
  const country = request.headers.get("CF-IPCountry") || null;
  const page = truncate(body.page);
  const productSlug = truncate(body.product_slug);
  const lang = truncate(body.lang, 5);
  const device = truncate(body.device, 20);
  const referrer = truncate(body.referrer);
  const sessionId = truncate(body.session_id, 64);
  const label = truncate(body.label); // V5.27: event context
  const createdAt = Math.floor(Date.now() / 1000);

  // ---- Write to D1 (graceful: log error but return success) ----
  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO behavior_events (event_type, page, product_slug, lang, country, device, referrer, session_id, label, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          eventType,
          page,
          productSlug,
          lang,
          country,
          device,
          referrer,
          sessionId,
          label,
          createdAt,
        )
        .run();
    } catch {
      // Graceful degradation — don't fail the user's page load
    }
  }

  return new Response(null, { status: 204 });
};
