// ---------------------------------------------------------------------------
//  Aromiso Commerce — Public Order Creation API
//  POST /api/commerce/orders → create a new order request
//
//  Security: server-side price recalculation, MOQ validation, rate limiting,
//  idempotency key. Client only sends product_id + variant_id + quantity.
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { turnstileOk, evaluateMailGate, bumpMailBudget } from "../_lib/guard";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function generateId(): string {
  return crypto.randomUUID();
}

function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `ARO-${y}${m}${d}-${seq}`;
}

interface OrderItemInput {
  product_id: string;
  variant_id?: string;
  quantity: number;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.DB;
  const kv = env.DRAFTS;
  if (!db) return json({ error: "Database unavailable" }, 500);

  // Rate limiting: 5 orders per IP per hour
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (kv) {
    const rlKey = `rl:order:${ip}`;
    const count = Number((await kv.get(rlKey)) || "0");
    if (count >= 5) return json({ error: "Too many requests. Please try again later." }, 429);
    await kv.put(rlKey, String(count + 1), { expirationTtl: 3600 });
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Idempotency key
  const idempotencyKey = (body.idempotency_key as string) || "";
  if (idempotencyKey && kv) {
    const existing = await kv.get(`idem:${idempotencyKey}`);
    if (existing) return json(JSON.parse(existing), 200);
  }

  // Turnstile: zero-friction challenge that stops automated order spam.
  const turnstileToken = String(body["cf-turnstile-response"] || "");
  if (!(await turnstileOk(env, turnstileToken, ip))) {
    return json({ error: "Verification failed, please retry." }, 403);
  }

  // Validate customer fields
  const customerName = String(body.customer_name || "")
    .trim()
    .slice(0, 200);
  const company = String(body.company || "")
    .trim()
    .slice(0, 200);
  const email = String(body.email || "")
    .trim()
    .slice(0, 200);
  const country = String(body.country || "")
    .trim()
    .slice(0, 100);
  const city = String(body.city || "")
    .trim()
    .slice(0, 100);
  const address = String(body.address || "")
    .trim()
    .slice(0, 500);
  const postalCode = String(body.postal_code || "")
    .trim()
    .slice(0, 20);
  const phone = String(body.phone || "")
    .trim()
    .slice(0, 50);
  const whatsapp = String(body.whatsapp || "")
    .trim()
    .slice(0, 50);
  const customerNote = String(body.customer_note || "")
    .trim()
    .slice(0, 2000);

  if (!customerName) return json({ error: "Full name is required" }, 422);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return json({ error: "Valid email is required" }, 422);
  if (!country) return json({ error: "Country is required" }, 422);

  // Unpaid-order cap: at most 3 open (pre-payment) orders per customer email.
  // Stops a single actor from flooding the pipeline with unresolved orders.
  const openRow = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM commerce_orders
       WHERE lower(email) = lower(?) AND status IN ('new','reviewing','quoted')`,
    )
    .bind(email)
    .first<{ c: number }>();
  if ((openRow?.c ?? 0) >= 3) {
    return json(
      {
        error:
          "You already have open order requests pending review. Please complete or contact sales before placing a new order.",
      },
      429,
    );
  }

  // Validate items
  const items = body.items as OrderItemInput[] | undefined;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return json({ error: "At least one item is required" }, 422);
  }
  if (items.length > 50) return json({ error: "Too many items" }, 422);

  // Server-side price recalculation
  const orderItems: {
    product_id: string;
    variant_id: string;
    product_name: string;
    variant_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    // Supply chain snapshot fields
    product_title_snapshot: string;
    variant_name_snapshot: string;
    variant_image_snapshot: string;
    source_platform: string;
    source_product_key: string;
    source_url: string;
    supplier_name: string;
    supplier_product_code: string;
    source_sku_id: string;
    supplier_sku_code: string;
    display_product_code: string;
    display_sku_code: string;
    purchase_cost_cny_snapshot: number;
    selling_price_usd_snapshot: number;
  }[] = [];

  let subtotal = 0;
  // S09：数量未命中任何价格档、回落到最低档时置真——必须让调用方看见，不得静默按最低价成交。
  let pricingFallback = false;

  for (const item of items) {
    const productId = String(item.product_id || "").trim();
    const variantId = String(item.variant_id || "").trim();
    const quantity = Math.floor(Number(item.quantity) || 0);

    if (!productId) return json({ error: "Product ID is required for each item" }, 422);
    if (quantity < 1) return json({ error: "Quantity must be at least 1" }, 422);
    if (quantity > 100000) return json({ error: "Quantity too large" }, 422);

    // Fetch product (include supply chain fields for order snapshot)
    const product = await db
      .prepare(
        `SELECT id, title, slug, moq, stock_status, status, health_status,
                source_platform, source_url, source_product_key,
                supplier_name, supplier_product_code, cost_price,
                display_product_code
         FROM commerce_products WHERE id = ?`,
      )
      .bind(productId)
      .first<{
        id: string;
        title: string;
        slug: string;
        moq: number;
        stock_status: string;
        status: string;
        health_status: string;
        source_platform: string;
        source_url: string;
        source_product_key: string;
        supplier_name: string;
        supplier_product_code: string;
        cost_price: number;
        display_product_code: string;
      }>();

    if (!product) return json({ error: `Product not found: ${productId}` }, 422);
    if (product.status !== "active")
      return json({ error: `Product unavailable: ${product.title}` }, 422);
    if (product.stock_status === "out_of_stock")
      return json({ error: `Product out of stock: ${product.title}` }, 422);
    // Health check: block products with stale supply chain data
    if (product.health_status === "unavailable")
      return json({ error: `Product supply unavailable: ${product.title}` }, 422);
    if (product.health_status === "risk")
      return json({ error: `Product supply needs verification: ${product.title}` }, 422);
    if (quantity < product.moq)
      return json({ error: `Minimum order quantity for ${product.title} is ${product.moq}` }, 422);

    // Fetch variant (if specified) — include supply chain fields for snapshot
    let variantName = "";
    let sku = "";
    let variantImage = "";
    let sourceSkuId = "";
    let supplierSkuCode = "";
    let displaySkuCode = "";
    if (variantId) {
      const variant = await db
        .prepare(
          `SELECT id, name, sku, status, image, source_sku_id, supplier_sku_code, display_sku_code
           FROM commerce_product_variants WHERE id = ? AND product_id = ?`,
        )
        .bind(variantId, productId)
        .first<{
          id: string;
          name: string;
          sku: string;
          status: string;
          image: string;
          source_sku_id: string;
          supplier_sku_code: string;
          display_sku_code: string;
        }>();

      if (!variant) return json({ error: `Variant not found for: ${product.title}` }, 422);
      if (variant.status !== "active")
        return json({ error: `Variant unavailable: ${variant.name}` }, 422);
      variantName = variant.name;
      sku = variant.sku;
      variantImage = variant.image || "";
      sourceSkuId = variant.source_sku_id || "";
      supplierSkuCode = variant.supplier_sku_code || "";
      displaySkuCode = variant.display_sku_code || "";
    }

    // Calculate price from tiers (server-side, never trust client)
    let unitPrice: number;
    const priceQuery = variantId
      ? "SELECT unit_price FROM commerce_price_tiers WHERE product_id = ? AND (variant_id = ? OR variant_id IS NULL) AND min_qty <= ? AND (max_qty IS NULL OR max_qty >= ?) ORDER BY min_qty DESC LIMIT 1"
      : "SELECT unit_price FROM commerce_price_tiers WHERE product_id = ? AND variant_id IS NULL AND min_qty <= ? AND (max_qty IS NULL OR max_qty >= ?) ORDER BY min_qty DESC LIMIT 1";

    const priceParams = variantId
      ? [productId, variantId, quantity, quantity]
      : [productId, quantity, quantity];

    const priceRow = await db
      .prepare(priceQuery)
      .bind(...priceParams)
      .first<{ unit_price: number }>();

    if (!priceRow) {
      // Fallback: get the lowest tier price
      const fallback = await db
        .prepare(
          "SELECT unit_price FROM commerce_price_tiers WHERE product_id = ? ORDER BY min_qty ASC LIMIT 1",
        )
        .bind(productId)
        .first<{ unit_price: number }>();
      unitPrice = fallback?.unit_price ?? 0;
      // S09：数量未命中价格档 → 记录回落，随响应回传（不再静默按最低档成交）。
      if (unitPrice > 0) pricingFallback = true;
    } else {
      unitPrice = priceRow.unit_price;
    }

    if (unitPrice <= 0) return json({ error: `No pricing available for: ${product.title}` }, 422);

    const itemSubtotal = Math.round(unitPrice * quantity * 100) / 100;
    subtotal += itemSubtotal;

    orderItems.push({
      product_id: productId,
      variant_id: variantId,
      product_name: product.title,
      variant_name: variantName,
      sku,
      quantity,
      unit_price: unitPrice,
      subtotal: itemSubtotal,
      // Supply chain snapshot
      product_title_snapshot: product.title,
      variant_name_snapshot: variantName,
      variant_image_snapshot: variantImage,
      source_platform: product.source_platform || "",
      source_product_key: product.source_product_key || "",
      source_url: product.source_url || "",
      supplier_name: product.supplier_name || "",
      supplier_product_code: product.supplier_product_code || "",
      source_sku_id: sourceSkuId,
      supplier_sku_code: supplierSkuCode,
      display_product_code: product.display_product_code || "",
      display_sku_code: displaySkuCode,
      purchase_cost_cny_snapshot: product.cost_price || 0,
      selling_price_usd_snapshot: unitPrice,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;

  // Source attribution
  const sourceType = String(body.source_type || "")
    .trim()
    .slice(0, 50);
  const sourceUrl = String(body.source_url || "")
    .trim()
    .slice(0, 500);
  const sourceProductId = String(body.source_product_id || "")
    .trim()
    .slice(0, 100);
  const sourceCategory = String(body.source_category || "")
    .trim()
    .slice(0, 100);

  // Create order
  const orderId = generateId();
  const orderNumber = generateOrderNumber();
  const now = Math.floor(Date.now() / 1000);

  // S08：订单头 + 全部明细 + 初始事件用 db.batch() 单事务原子提交。
  // 任一行失败 → 整批回滚，绝不留「孤儿订单 / 残缺明细」，客户重试也不会产生重复订单。
  const batchStatements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO commerce_orders (id, order_number, customer_name, company, email, country, city, address, postal_code, phone, whatsapp, currency, subtotal, shipping_cost, total, status, source_type, source_url, source_product_id, source_category, customer_note, admin_note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, NULL, ?, 'new', ?, ?, ?, ?, ?, '', ?, ?)`,
      )
      .bind(
        orderId,
        orderNumber,
        customerName,
        company,
        email,
        country,
        city,
        address,
        postalCode,
        phone,
        whatsapp,
        subtotal,
        subtotal,
        sourceType,
        sourceUrl,
        sourceProductId,
        sourceCategory,
        customerNote,
        now,
        now,
      ),
  ];

  // Insert order items (with supply chain snapshot)
  for (const item of orderItems) {
    const itemId = generateId();
    batchStatements.push(
      db
        .prepare(
          `INSERT INTO commerce_order_items (
            id, order_id, product_id, variant_id, product_name, variant_name, sku, quantity, unit_price, subtotal, created_at,
            product_title_snapshot, variant_name_snapshot, variant_image_snapshot,
            source_platform, source_product_key, source_url,
            supplier_name, supplier_product_code, source_sku_id, supplier_sku_code,
            display_product_code_snapshot, display_sku_code_snapshot,
            purchase_cost_cny_snapshot, selling_price_usd_snapshot
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          itemId,
          orderId,
          item.product_id,
          item.variant_id,
          item.product_name,
          item.variant_name,
          item.sku,
          item.quantity,
          item.unit_price,
          item.subtotal,
          now,
          item.product_title_snapshot,
          item.variant_name_snapshot,
          item.variant_image_snapshot,
          item.source_platform,
          item.source_product_key,
          item.source_url,
          item.supplier_name,
          item.supplier_product_code,
          item.source_sku_id,
          item.supplier_sku_code,
          item.display_product_code,
          item.display_sku_code,
          item.purchase_cost_cny_snapshot,
          item.selling_price_usd_snapshot,
        ),
    );
  }

  // Insert initial order event
  const eventId = generateId();
  batchStatements.push(
    db
      .prepare(
        `INSERT INTO commerce_order_events (id, order_id, from_status, to_status, note, created_by, created_at)
         VALUES (?, ?, '', 'new', 'Order request submitted', 'customer', ?)`,
      )
      .bind(eventId, orderId, now),
  );

  try {
    await db.batch(batchStatements);
  } catch (err) {
    // 原子事务：失败即全部回滚，无部分落库。
    return json({ error: "Failed to create order", detail: String(err) }, 500);
  }

  // Send emails (non-blocking, best effort)
  const responseData = {
    ok: true,
    order_number: orderNumber,
    order_id: orderId,
    message:
      "Your order request has been received. We will review availability and shipping, then contact you with the final quotation.",
    // S09：价格档回落如实标注，供前端/运营看见（不是静默按最低价成交）。
    ...(pricingFallback
      ? {
          pricing_note:
            "One or more items were priced at the lowest available tier because the requested quantity did not match a price tier. Final quotation may differ.",
        }
      : {}),
  };

  // Store idempotency result
  if (idempotencyKey && kv) {
    await kv.put(`idem:${idempotencyKey}`, JSON.stringify(responseData), { expirationTtl: 86400 });
  }

  // Send notification emails asynchronously — gated by the email risk gate.
  const gate = await evaluateMailGate(env, {
    name: customerName,
    email,
    message: customerNote,
  });
  sendOrderEmails(
    env,
    {
      orderNumber,
      customerName,
      company,
      email,
      country,
      items: orderItems,
      subtotal,
      sourceUrl,
    },
    { sendOwner: gate.sendOwner, sendAutoReply: gate.sendAutoReply },
  ).catch(() => {});

  return json(responseData, 201);
};

// ---- Email notifications (best effort) ----
async function sendOrderEmails(
  env: Env,
  data: {
    orderNumber: string;
    customerName: string;
    company: string;
    email: string;
    country: string;
    items: {
      product_name: string;
      variant_name: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }[];
    subtotal: number;
    sourceUrl: string;
  },
  mailGate: { sendOwner: boolean; sendAutoReply: boolean },
): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return;

  const itemsHtml = data.items
    .map(
      (i) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ""}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${i.unit_price.toFixed(2)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${i.subtotal.toFixed(2)}</td></tr>`,
    )
    .join("");

  // Admin notification
  if (mailGate.sendOwner) {
    const adminHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1a1a2e">🛒 New Commerce Order</h2>
      <p><strong>Order:</strong> ${data.orderNumber}</p>
      <p><strong>Customer:</strong> ${data.customerName}${data.company ? ` (${data.company})` : ""}</p>
      <p><strong>Country:</strong> ${data.country}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr style="background:#f5f5f5"><th style="padding:8px;text-align:left">Product</th><th style="padding:8px">Qty</th><th style="padding:8px;text-align:right">Unit</th><th style="padding:8px;text-align:right">Subtotal</th></tr>
        ${itemsHtml}
      </table>
      <p style="font-size:18px"><strong>Subtotal: $${data.subtotal.toFixed(2)}</strong></p>
      ${data.sourceUrl ? `<p style="color:#666;font-size:12px">Source: ${data.sourceUrl}</p>` : ""}
      <p style="color:#666;font-size:13px;margin-top:24px">Review this order in your admin panel. Confirm stock, calculate shipping, then send the customer a final quotation.</p>
    </div>`;

    const adminRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Aromiso Sales <sales@aromiso.com>",
        // V5.421：RESEND_TO 支持多收件人（逗号 / 分号 / 空白分隔）。
        to: (env.RESEND_TO || "sales@aromiso.com")
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        subject: `New Order ${data.orderNumber} — ${data.customerName} (${data.country})`,
        html: adminHtml,
      }),
    });
    if (adminRes.ok) await bumpMailBudget(env, 1);
  }

  // Customer confirmation
  if (mailGate.sendAutoReply) {
    const customerHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1a1a2e">Thank You for Your Order Request</h2>
      <p>Dear ${data.customerName},</p>
      <p>We have received your order request <strong>${data.orderNumber}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr style="background:#f5f5f5"><th style="padding:8px;text-align:left">Product</th><th style="padding:8px">Qty</th><th style="padding:8px;text-align:right">Unit</th><th style="padding:8px;text-align:right">Subtotal</th></tr>
        ${itemsHtml}
      </table>
      <p><strong>Estimated Subtotal:</strong> $${data.subtotal.toFixed(2)} USD</p>
      <p style="background:#f0f7ff;padding:12px;border-radius:6px;font-size:14px">
        Our team will review product availability and shipping options for your destination,
        then contact you with the <strong>final quotation including shipping cost</strong> within 1 business day.
      </p>
      <p style="color:#666;font-size:13px;margin-top:24px">
        Questions? Reply to this email or reach us at sales@aromiso.com<br/>
        Aromiso — Fragrance Manufacturing & Supply, Yiwu, China
      </p>
    </div>`;

    const custRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Aromiso Sales <sales@aromiso.com>",
        to: [data.email],
        reply_to: "sales@aromiso.com",
        subject: `Order Request Received — ${data.orderNumber}`,
        html: customerHtml,
      }),
    });
    if (custRes.ok) await bumpMailBudget(env, 1);
  }
}
