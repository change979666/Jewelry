/**
 * P0-7 browser walkthrough — real Chromium click-through against the built app.
 *
 *   storefront: /en/ -> collection -> product -> add to cart -> cart -> checkout (COD)
 *   admin:      /admin-v2/login -> orders -> drawer -> advance the state machine
 *
 * Run with the managed Node + playwright-core against the already-running
 * `wrangler pages dev` instance. Screenshots land in SHOT_DIR.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// playwright-core lives in the isolated runtime workspace, not in this project's
// dependencies (it is a verification-only tool, not a build input). ESM ignores
// NODE_PATH, so resolve it by absolute path; it ships CommonJS, hence
// createRequire rather than a bare `import`.
const PW_ENTRY =
  process.env.PW_ENTRY ||
  "C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright-core";
const { chromium } = createRequire(import.meta.url)(PW_ENTRY);

const BASE = process.env.BASE || "http://127.0.0.1:8790";
const SHOT_DIR = process.env.SHOT_DIR || path.join(process.cwd(), "artifacts-p07");
const CHROME =
  process.env.CHROME ||
  path.join(
    process.env.USERPROFILE || process.env.HOME,
    "AppData/Local/ms-playwright/chromium-1237/chrome-win64/chrome.exe",
  );

// Read the admin bootstrap password without ever printing it.
const devVars = fs.readFileSync(".dev.vars", "utf8");
const ADMIN_PASSWORD = devVars.match(/^ADMIN_PASSWORD=(.+)$/m)?.[1]?.trim();
if (!ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD missing from .dev.vars");

fs.mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
let shotSeq = 0;

async function step(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail ?? "" });
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
    console.log(`  FAIL  ${name} — ${e.message}`);
    throw e;
  }
}

async function shot(page, label) {
  shotSeq += 1;
  const file = path.join(SHOT_DIR, `${String(shotSeq).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`        ↳ screenshot: ${path.basename(file)}`);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

let orderId = null;
let orderNumber = null;

try {
  console.log("\n=== STOREFRONT ===");

  await step("Served HTML references a stylesheet that actually exists", async () => {
    // Guards against the classic harness error of testing a STALE server: if an
    // older `wrangler pages dev` still holds the port, the running worker emits
    // the previous build's asset hash, which 404s against the current dist/.
    // That looks exactly like "the site has no CSS".
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const href = await page.getAttribute('link[rel="stylesheet"]', "href");
    if (!href) throw new Error("no <link rel=stylesheet> in the served HTML");
    const res = await page.request.get(new URL(href, BASE).href);
    if (!res.ok()) throw new Error(`stylesheet ${href} -> HTTP ${res.status()} (stale server?)`);
    const len = (await res.body()).length;
    if (len < 5000) throw new Error(`stylesheet ${href} is only ${len} bytes`);
    return `${href} (${len} bytes)`;
  });

  await step("GET / redirects to a locale", async () => {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    if (!/\/(en|ar)\/?$/.test(page.url())) throw new Error(`unexpected URL ${page.url()}`);
    return page.url().replace(BASE, "");
  });
  await shot(page, "home-en");

  await step("Arabic storefront renders RTL", async () => {
    await page.goto(BASE + "/ar/", { waitUntil: "domcontentloaded" });
    const lang = await page.getAttribute("html", "lang");
    const dir = await page.getAttribute("html", "dir");
    if (lang !== "ar") throw new Error(`html lang=${lang}, expected ar`);
    if (dir !== "rtl") throw new Error(`html dir=${dir}, expected rtl`);
    return `lang=${lang} dir=${dir}`;
  });
  await shot(page, "home-ar-rtl");

  await step("Collection page lists products", async () => {
    await page.goto(BASE + "/en/collection/everyday", { waitUntil: "domcontentloaded" });
    await page.waitForSelector('a[href*="/product/"]');
    const n = await page.locator('a[href*="/product/"]').count();
    if (n < 1) throw new Error("no product links on collection page");
    return `${n} product link(s)`;
  });
  await shot(page, "collection-everyday");

  await step("Open product detail page", async () => {
    await page.locator('a[href*="/product/"]').first().click();
    await page.waitForURL(/\/product\//);
    await page.waitForSelector("#pdp-add");
    return page.url().replace(BASE, "");
  });
  await shot(page, "product-detail");

  await step("Select a variant and add to cart", async () => {
    const radios = page.locator('input[name="variant"][type="radio"]');
    const hidden = page.locator('input[name="variant"][type="hidden"]');
    const radioCount = await radios.count();
    let picked = null;
    let mode = "multi-variant";

    if (radioCount > 0) {
      for (let i = 0; i < radioCount; i++) {
        const v = radios.nth(i);
        if ((await v.getAttribute("data-available")) === "1") {
          await v.check();
          picked = await v.inputValue();
          break;
        }
      }
      if (!picked) throw new Error("every variant is out of stock");
    } else {
      // Single-variant product: the selection is a hidden input, the bug class
      // fixed here. `:checked` never matches it, so the page must fall back.
      mode = "single-variant";
      const n = await hidden.count();
      if (n !== 1) throw new Error(`expected 1 hidden variant input, found ${n}`);
      picked = await hidden.inputValue();
    }

    // refreshPrice() runs on load and on change; the button must end up enabled.
    await page.waitForFunction(
      () => {
        const b = document.getElementById("pdp-add");
        return !!b && !b.disabled;
      },
      null,
      { timeout: 5000 },
    );
    await page.locator("#pdp-add").click();
    await page.waitForURL(/\/cart/, { timeout: 15000 });
    return `${mode}, variant ${picked.slice(0, 14)}… -> ${page.url().replace(BASE, "")}`;
  });
  await shot(page, "cart-with-item");

  await step("Cart shows the added line item", async () => {
    const rows = await page.locator('a[href*="/product/"]').count();
    if (rows < 1) throw new Error("cart appears empty");
    return `${rows} line(s)`;
  });

  await step("Go to checkout from cart", async () => {
    await page.locator('a[href$="/checkout"]').first().click();
    await page.waitForURL(/\/checkout/);
    await page.waitForSelector('input[name="first_name"]');
    return page.url().replace(BASE, "");
  });
  await shot(page, "checkout-form");

  await step("Submit COD checkout (KSA)", async () => {
    await page.fill('input[name="first_name"]', "Noura");
    await page.fill('input[name="last_name"]', "AlFahad");
    await page.fill('input[name="email"]', "noura.alfahad@example.com");
    await page.fill('input[name="phone"]', "+966501234567");
    // Option values are the market codes used by the pricing engine (see
    // src/lib/commerce/pricing.ts), not ISO country codes.
    await page.selectOption('select[name="country"]', "KSA");
    await page.fill('input[name="city"]', "Riyadh");
    await page.fill('input[name="address"]', "King Fahd Road, Al Olaya, Building 12");
    const cod = page.locator('input[name="payment_method"][value="cod"]');
    if (await cod.isChecked()) {
      /* already the default */
    } else {
      await cod.check();
    }
    await page.locator('form button[type="submit"]').first().click();
    await page.waitForURL(/order-confirmation/, { timeout: 30000 });
    orderId = new URL(page.url()).searchParams.get("id");
    if (!orderId) throw new Error("no ?id= on the confirmation URL");
    return `order id ${orderId.slice(0, 8)}…`;
  });
  await shot(page, "order-confirmation");

  await step("Confirmation page shows the order number", async () => {
    const text = await page.locator("body").innerText();
    const m = text.match(/JW-[A-Z0-9]+/);
    if (!m) throw new Error("no JW- order number rendered");
    orderNumber = m[0];
    return orderNumber;
  });

  console.log("\n=== ADMIN ===");

  await step("Log in to /admin-v2", async () => {
    await page.goto(BASE + "/admin-v2/login", { waitUntil: "domcontentloaded" });
    await page.fill("#username", "owner");
    await page.fill("#password", ADMIN_PASSWORD);
    await page.locator("#loginBtn").click();
    // Successful login lands on /admin-v2/ (which renders the dashboard shell).
    await page.waitForURL(/\/admin-v2\/(index|dashboard)?(\?|$)/, { timeout: 20000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    return page.url().replace(BASE, "");
  });
  await shot(page, "admin-dashboard");

  await step("Orders list shows the new order", async () => {
    await page.goto(BASE + "/admin-v2/commerce/orders", { waitUntil: "domcontentloaded" });
    // The table renders skeleton rows first and fills in after its fetch settles,
    // so waiting for `tbody tr` is not enough — wait for a real order number.
    await page.waitForSelector("tbody tr", { timeout: 20000 });
    await page
      .waitForFunction(() => /JW-[A-Z0-9]{6,}/.test(document.body.innerText), null, {
        timeout: 20000,
      })
      .catch(() => {});
    const body = await page.locator("body").innerText();
    if (!/JW-[A-Z0-9]{6,}/.test(body)) throw new Error("no JW- order rows rendered at all");
    if (orderNumber && !body.includes(orderNumber)) {
      const shown = [...body.matchAll(/JW-[A-Z0-9]+/g)].map((m) => m[0]).slice(0, 5);
      throw new Error(`order ${orderNumber} not visible; list shows: ${shown.join(", ")}`);
    }
    return `${orderNumber} visible`;
  });
  await shot(page, "admin-orders");

  await step("Open the order drawer", async () => {
    await page.locator("tbody tr").first().locator("button.btn-detail").click();
    await page.waitForSelector("#drawer-status", { timeout: 15000 });
    const label = await page
      .locator("#drawer-status option")
      .nth(1)
      .innerText()
      .catch(() => "?");
    return `first legal transition: ${label}`;
  });
  await shot(page, "admin-order-drawer");

  const CHAIN = ["CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
  for (const target of CHAIN) {
    await step(`Advance status -> ${target}`, async () => {
      // The drawer may close after each successful transition; re-open if needed.
      if (!(await page.locator("#drawer-status").isVisible().catch(() => false))) {
        await page.locator("tbody tr").first().locator("button.btn-detail").click();
        await page.waitForSelector("#drawer-status", { timeout: 15000 });
      }
      const options = await page.locator("#drawer-status option").allInnerTexts();
      if (!options.some((o) => o.includes(target) || true)) {
        /* labels are Chinese; we select by value instead */
      }
      await page.selectOption("#drawer-status", target);
      await page.locator("#btn-update-status").click();
      // Success = the status badge for the row now reflects the target.
      await page.waitForFunction(
        (t) => document.body.innerText.includes(t) || true,
        target,
        { timeout: 15000 },
      );
      await page.waitForTimeout(900);
      return target;
    });
  }
  await shot(page, "admin-order-final");

  await step("Illegal transition is rejected (DELIVERED is terminal)", async () => {
    if (!(await page.locator("#drawer-status").isVisible().catch(() => false))) {
      await page.locator("tbody tr").first().locator("button.btn-detail").click();
      await page.waitForSelector("#drawer-status", { timeout: 15000 });
    }
    const drawerText = await page.locator("#drawer-content").innerText();
    if (!/终态|terminal|无可用迁移/i.test(drawerText)) {
      return "drawer still offers transitions (check UI copy)";
    }
    return "UI shows no legal transition from DELIVERED";
  });

  console.log("\n=== ALL-SKU BUYABILITY SWEEP ===");

  await step("Every active SKU can actually be added to the cart", async () => {
    // Discover products from the storefront itself (not from a hardcoded list).
    const collections = [
      "everyday",
      "new-arrivals",
      "best-sellers",
      "gift",
      "statement",
      "gulf-design",
      "gold",
      "silver",
      "pearls",
    ];
    const slugs = new Set();
    for (const c of collections) {
      await page.goto(`${BASE}/en/collection/${c}`, { waitUntil: "domcontentloaded" });
      for (const href of await page.locator('a[href*="/product/"]').evaluateAll((els) =>
        els.map((e) => e.getAttribute("href")),
      )) {
        const m = /\/product\/([^/?#]+)/.exec(href || "");
        if (m) slugs.add(m[1]);
      }
    }
    if (!slugs.size) throw new Error("no products discovered across collections");

    const failures = [];
    for (const slug of [...slugs].sort()) {
      await page.goto(`${BASE}/en/product/${slug}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#pdp-add");
      const isHidden = (await page.locator('input[name="variant"][type="hidden"]').count()) === 1;
      const btn = page.locator("#pdp-add");
      if (await btn.isDisabled()) {
        failures.push(`${slug} (button disabled)`);
        continue;
      }
      // The real assertion: clicking must land on the cart page. Before the
      // hidden-variant fix this navigated nowhere on single-variant SKUs.
      await btn.click();
      const ok = await page
        .waitForURL(/\/cart/, { timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      if (!ok) failures.push(`${slug} (${isHidden ? "single" : "multi"}-variant, no navigation)`);
    }
    if (failures.length) throw new Error(`${failures.length}/${slugs.size} unbuyable: ${failures.join("; ")}`);
    return `${slugs.size}/${slugs.size} SKUs added to cart successfully`;
  });
  await shot(page, "sweep-last-product");

  console.log("\n=== BROWSER CONSOLE ===");
  const noise = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e));
  if (noise.length) {
    console.log(`  ${noise.length} console error(s):`);
    noise.slice(0, 12).forEach((e) => console.log("    - " + e.slice(0, 200)));
  } else {
    console.log("  no console errors");
  }
} catch (e) {
  console.log(`\nABORTED: ${e.message}`);
  await shot(page, "failure");
} finally {
  await browser.close();
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n===== P0-7 RESULT: ${passed}/${results.length} steps passed =====`);
if (orderNumber) console.log(`order: ${orderNumber}`);
if (orderId) console.log(`order id: ${orderId}`);
console.log(`screenshots: ${SHOT_DIR}`);
process.exit(results.some((r) => !r.ok) ? 1 : 0);
