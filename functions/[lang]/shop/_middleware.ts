// ---------------------------------------------------------------------------
//  Aromiso OS 2.0 — PDP SSR 边缘中间件（V5.19）
//  路由：/{lang}/shop/**（Pages Functions 目录路由）
//
//  背景：商品详情页是「静态 shell + 客户端 JS 渲染」，构建时 canonical / og:url /
//        og:title / og:image / JSON-LD 全部写死成 /shop/product/ 占位值，爬虫拿到
//        的 HTML 没有结构化数据、且所有商品共用同一份错误 canonical/OG。
//
//  本中间件在边缘对「商品详情 URL」按真实商品数据重写 <head>：
//    1. 注入 Product + AggregateOffer + Brand + BreadcrumbList(+FAQPage) JSON-LD
//    2. 重写 canonical / og:url 为规范 short_id URL
//    3. 重写 <title> / description / og:title / og:description / og:image
//  前台零改动，客户端 JS 渲染逻辑保持不变（会再次覆盖 title/description，值一致）。
//
//  非商品详情路径（/shop/、/shop/compare、/shop/product 本体）原样放行。
//  查无商品或任何异常 → 放行原始 shell（前端自显 404 态），绝不 500。
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { deriveShortDescription } from "../../lib/product-short-description";

const SITE = "https://aromiso.com";
const RESERVED = new Set(["", "product", "compare"]);

interface ProductRow {
  slug?: string;
  short_id?: string;
  title?: string;
  short_name?: string;
  short_description?: string;
  description?: string;
  seo_title?: string;
  seo_description?: string;
  category?: string;
  cover_image?: string;
  stock_status?: string;
  certifications?: string;
  faq?: string;
}

interface PriceTier {
  unit_price?: number;
  currency?: string;
  min_qty?: number;
}

function abs(url: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return SITE + (url.startsWith("/") ? url : "/" + url);
}

function safeJsonLd(obj: unknown): string {
  // 防止 </script> 破坏脚本块：转义 < 为 \u003c
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const segs = url.pathname.split("/").filter(Boolean); // ["en","shop","abc123"]

  // 仅处理形如 /{lang}/shop/{seg} 的商品详情路径
  const lang = segs[0] || "en";
  const seg = segs.length >= 3 && segs[1] === "shop" ? segs[2] : "";

  // Phase 0 决策：旧查询串 PDP URL（/shop/product?slug=xxx 或 ?id=xxx）做 301 归一
  // 到规范 /{lang}/shop/{short_id}，避免两套 PDP URL 族长期并存。
  if (segs.length === 3 && segs[1] === "shop" && segs[2] === "product" && env.DB) {
    const key = (url.searchParams.get("id") || url.searchParams.get("slug") || "").trim();
    if (key) {
      try {
        const isShort = /^[a-f0-9]{10}$/i.test(key);
        const row = isShort
          ? await env.DB.prepare(
              "SELECT short_id FROM commerce_products WHERE short_id = ? AND status = 'active'",
            )
              .bind(key)
              .first<{ short_id?: string }>()
          : await env.DB.prepare(
              "SELECT short_id FROM commerce_products WHERE slug = ? AND status = 'active'",
            )
              .bind(key)
              .first<{ short_id?: string }>();
        const sid = row?.short_id;
        if (sid) {
          return Response.redirect(`${SITE}/${lang}/shop/${sid}`, 301);
        }
      } catch {
        /* fall through to shell */
      }
    }
  }

  if (segs.length !== 3 || segs[1] !== "shop" || RESERVED.has(seg)) {
    return next();
  }

  // 先取回静态 shell HTML（_redirects 200-rewrite 到 /{lang}/shop/product/）
  const response = await next();

  try {
    const ct = response.headers.get("content-type") || "";
    if (!ct.includes("text/html") || !env.DB) return response;

    // 解析 slug / short_id（10 位 hex 判定 short_id）
    const isShortId = /^[a-f0-9]{10}$/i.test(seg);
    const db = env.DB;
    let product: ProductRow | null = null;
    if (isShortId) {
      product = await db
        .prepare(
          "SELECT slug, short_id, title, short_name, short_description, description, seo_title, seo_description, category, cover_image, stock_status, certifications, faq FROM commerce_products WHERE short_id = ? AND status = 'active'",
        )
        .bind(seg)
        .first<ProductRow>();
    }
    if (!product) {
      product = await db
        .prepare(
          "SELECT slug, short_id, title, short_name, short_description, description, seo_title, seo_description, category, cover_image, stock_status, certifications, faq FROM commerce_products WHERE slug = ? AND status = 'active'",
        )
        .bind(seg)
        .first<ProductRow>();
    }
    if (!product) {
      // B-01: 查无此商品 → 返回真实 HTTP 404（此前放行 200 shell 造成 soft-404：
      // 爬虫拿到 200 + 商品页 <title>/canonical 等 SEO 信号）。保留 shell body 让前端
      // showNotFound() 仍渲染友好 404 界面；加 X-Robots-Tag: noindex 防止被收录。
      // 该分支仅在 /{lang}/shop/{seg}（seg 非 RESERVED）命中——列表页 /shop/、/shop/compare、
      // /shop/product 本体已在上方 RESERVED 守卫处 next() 放行，故真实商品页与列表页不受影响。
      // pdp-jsonld 占位脚本此路径为空（仅命中商品时下方才注入），故无假 Product 结构化数据。
      const notFoundHeaders = new Headers(response.headers);
      notFoundHeaders.set("X-Robots-Tag", "noindex, nofollow");
      return new Response(response.body, {
        status: 404,
        statusText: "Not Found",
        headers: notFoundHeaders,
      });
    }

    const canonicalId = product.short_id || seg;
    const canonical = `${SITE}/${lang}/shop/${canonicalId}`;
    const title = product.title || product.slug || "Product";
    // 显示层（H1 / 面包屑）优先用干净的 short_name；SEO 层（<title>/JSON-LD）仍用完整 title。
    // V5.69 locale integrity: legacy rows may carry a CJK short_name; public EN/ES/DE pages
    // must never render CJK, so prefer short_name only when CJK-free, else fall back to title.
    const sn = product.short_name || "";
    const displayName = sn && !/[一-鿿]/.test(sn) ? sn : product.seo_title || title;
    // Audit D01: short_description 历史上全空，旧代码直接回退到 description，
    // 而 description 在库里是 `<p>…</p>` HTML → meta / og / JSON-LD 被塞进标签源码。
    // 统一走确定性纯文本派生（去标签 + 首句 + ≤160 字符）。三个来源全空时
    // desc = ""：此时**不写** meta、也不给 JSON-LD 塞空 description ——
    // 缺失就是缺失，不用空串伪装成有值。
    const desc =
      (product.seo_description || "").trim() ||
      deriveShortDescription(product.short_description) ||
      deriveShortDescription(product.description);
    const ogImage = abs(product.cover_image || "/og.svg");
    const fullTitle = `${title} · Aromiso`;

    // 价格档位（构造 AggregateOffer）
    let tiers: PriceTier[] = [];
    try {
      const pr = await db
        .prepare(
          "SELECT unit_price, currency, min_qty FROM commerce_price_tiers WHERE product_id = (SELECT id FROM commerce_products WHERE short_id = ? OR slug = ? LIMIT 1) ORDER BY min_qty",
        )
        .bind(canonicalId, seg)
        .all<PriceTier>();
      tiers = pr.results || [];
    } catch {
      tiers = [];
    }

    // ---- 构造 JSON-LD（复刻前端 renderJsonLd 结构）----
    const productSchema: Record<string, unknown> = {
      "@type": "Product",
      name: title,
      image: ogImage,
      sku: product.slug || canonicalId,
      brand: { "@type": "Brand", name: "Aromiso" },
      category: product.category || "",
    };
    // Audit D01: 没有真实文案时省略 description 键，而不是写空串冒充有值。
    if (desc) productSchema.description = desc;
    if (tiers.length) {
      const prices = tiers.map((t) => Number(t.unit_price) || 0).filter((n) => n > 0);
      if (prices.length) {
        productSchema.offers = {
          "@type": "AggregateOffer",
          lowPrice: Math.min(...prices),
          highPrice: Math.max(...prices),
          priceCurrency: tiers[0].currency || "USD",
          availability:
            product.stock_status === "out_of_stock"
              ? "https://schema.org/OutOfStock"
              : "https://schema.org/InStock",
          url: canonical,
        };
      }
    }
    let certs: string[] = [];
    try {
      certs = JSON.parse(product.certifications || "[]");
    } catch {
      certs = [];
    }
    if (Array.isArray(certs) && certs.length) {
      productSchema.additionalProperty = certs.map((c) => ({
        "@type": "PropertyValue",
        name: "Certification",
        value: c,
      }));
    }

    const graph: Record<string, unknown>[] = [
      productSchema,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/${lang}` },
          { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE}/${lang}/shop` },
          { "@type": "ListItem", position: 3, name: displayName },
        ],
      },
    ];

    let faqs: { q?: string; a?: string }[] = [];
    try {
      faqs = JSON.parse(product.faq || "[]");
    } catch {
      faqs = [];
    }
    const validFaqs = (Array.isArray(faqs) ? faqs : []).filter((f) => f && f.q && f.a);
    if (validFaqs.length) {
      graph.push({
        "@type": "FAQPage",
        mainEntity: validFaqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      });
    }

    const jsonLd = safeJsonLd({ "@context": "https://schema.org", "@graph": graph });

    // ---- HTMLRewriter 注入 / 重写 <head> ----
    const rewriter = new HTMLRewriter()
      .on("script#pdp-jsonld", {
        element(el) {
          el.setInnerContent(jsonLd, { html: true });
        },
      })
      .on('link[rel="canonical"]', {
        element(el) {
          el.setAttribute("href", canonical);
        },
      })
      // SEO-02 — hreflang 必须指向真实的各语言 PDP URL，而非静态占位 shell
      // (/shop/product/)。此前 canonical 已重写为 /{lang}/shop/{canonicalId}，但 alternate
      // 未重写 → 全部 PDP 共用同一份指向占位页的 hreflang，与自身 canonical 矛盾。
      // x-default 归到 en；仅对真实存在的三语 locale 重写（/{en,es,de}/shop/{id} 实测均 200，
      // 不存在商品时各 locale 均 404，故不会为不存在的页面伪造 alternate）。
      .on('link[rel="alternate"]', {
        element(el) {
          const hl = el.getAttribute("hreflang") || "";
          const target = hl === "x-default" ? "en" : hl;
          if (target === "en" || target === "es" || target === "de") {
            el.setAttribute("href", `${SITE}/${target}/shop/${canonicalId}`);
          }
        },
      })
      .on("title", {
        element(el) {
          el.setInnerContent(fullTitle);
        },
      })
      .on('meta[name="description"]', {
        element(el) {
          if (desc) el.setAttribute("content", desc);
        },
      })
      .on('meta[property="og:title"]', {
        element(el) {
          el.setAttribute("content", fullTitle);
        },
      })
      .on('meta[property="og:description"]', {
        element(el) {
          if (desc) el.setAttribute("content", desc);
        },
      })
      .on('meta[property="og:url"]', {
        element(el) {
          el.setAttribute("content", canonical);
        },
      })
      .on('meta[property="og:image"]', {
        element(el) {
          el.setAttribute("content", ogImage);
        },
      })
      // P3-3 单一 h1：填充真实商品名到主标题 h1，并移除兜底 not-found 块里的
      // 竞争 h1（本中间件仅在商品存在时运行，该块永不展示，删其 h1 对前端无影响）。
      .on("h1#pdp-title", {
        element(el) {
          el.setInnerContent(displayName);
        },
      })
      .on("#pdp-not-found h1", {
        element(el) {
          el.remove();
        },
      });

    const transformed = rewriter.transform(response);
    const headers = new Headers(transformed.headers);
    headers.set("Cache-Control", "public, max-age=600"); // 边缘缓存 10 分钟
    return new Response(transformed.body, {
      status: transformed.status,
      statusText: transformed.statusText,
      headers,
    });
  } catch {
    // 任何异常都放行原 shell，绝不因 SEO 增强影响页面可用性
    return response;
  }
};
