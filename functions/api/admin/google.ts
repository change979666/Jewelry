// ---------------------------------------------------------------------------
//  Aromiso V4 — Google API helpers (Service Account JWT + GSC + GA4)
//
//  Uses Web Crypto API (RS256) for JWT signing — native in Cloudflare Workers.
//  Token cached in KV (google:token, TTL 3300s) to avoid re-signing each call.
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { Ga4RequestError, classifyGa4Http } from "../../lib/ga4-result";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GSC_API = "https://www.googleapis.com/webmasters/v3/sites";
const GA_API = "https://analyticsdata.googleapis.com/v1beta/properties";

// ---- JWT Signing (RS256 via Web Crypto) ------------------------------------

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlStr(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Parse PEM private key (PKCS8) into CryptoKey for RS256 signing. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "")
    .trim();
  const binaryDer = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** Create a signed JWT for Google Service Account auth. */
async function createJwt(
  clientEmail: string,
  privateKeyPem: string,
  scope: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientEmail,
    scope,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64urlStr(JSON.stringify(header))}.${base64urlStr(JSON.stringify(claims))}`;
  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64url(signature)}`;
}

// ---- Token Management ------------------------------------------------------

const TOKEN_KV_KEY = "google:token";
const TOKEN_TTL = 3300; // 55 min (tokens valid 1h, refresh early)

interface TokenCache {
  access_token: string;
  expires_at: number;
}

/** Get a valid access_token, using KV cache or signing a new JWT. */
export async function getAccessToken(env: Env): Promise<string> {
  // Try cache first
  if (env.DRAFTS) {
    const cached = (await env.DRAFTS.get(TOKEN_KV_KEY, "json")) as TokenCache | null;
    if (cached && cached.expires_at > Date.now() / 1000 + 60) {
      return cached.access_token;
    }
  }

  const clientEmail = env.GSC_CLIENT_EMAIL;
  const privateKey = env.GSC_PRIVATE_KEY;
  if (!clientEmail || !privateKey) {
    throw new Ga4RequestError("AUTH_ERROR", "Missing GSC_CLIENT_EMAIL or GSC_PRIVATE_KEY");
  }

  const scope = [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/analytics.readonly",
  ].join(" ");

  const jwt = await createJwt(clientEmail, privateKey, scope);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Ga4RequestError(
      "AUTH_ERROR",
      `Token exchange failed (${res.status}): ${text}`,
      res.status,
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };

  // Cache in KV
  if (env.DRAFTS) {
    const cache: TokenCache = {
      access_token: data.access_token,
      expires_at: Math.floor(Date.now() / 1000) + TOKEN_TTL,
    };
    await env.DRAFTS.put(TOKEN_KV_KEY, JSON.stringify(cache), { expirationTtl: TOKEN_TTL });
  }

  return data.access_token;
}

// ---- GSC Search Analytics --------------------------------------------------

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Query GSC Search Analytics API. */
export async function fetchGsc(
  env: Env,
  token: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  rowLimit = 500,
): Promise<GscRow[]> {
  const siteUrl = env.GSC_SITE_URL || "sc-domain:aromiso.com";
  const url = `${GSC_API}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ startDate, endDate, dimensions, rowLimit }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GSC API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { rows?: GscRow[] };
  return data.rows || [];
}

// ---- GSC URL Inspection (Index Monitor) -------------------------------------

export type IndexVerdict =
  | "indexed"
  | "crawled_not_indexed"
  | "discovered_not_indexed"
  | "duplicate"
  | "not_found"
  | "unknown";

export interface UrlInspection {
  url: string;
  status: IndexVerdict;
  detail: string; // 原始 coverageState / 错误信息
  verdict: string; // PASS / FAIL / NEUTRAL
  lastCrawl: string;
}

/** 把 GSC coverageState 原文归一化为内部状态。 */
export function normalizeCoverage(coverage: string, verdict: string): IndexVerdict {
  const c = coverage.toLowerCase();
  if (c.includes("404") || c.includes("not found")) return "not_found";
  if (c.includes("duplicate")) return "duplicate";
  if (c.includes("crawled")) return "crawled_not_indexed";
  if (c.includes("discovered")) return "discovered_not_indexed";
  if (verdict === "PASS" || c.includes("indexed")) return "indexed";
  return "unknown";
}

/** URL Inspection API：程序化检查单个 URL 的索引状态（V5.34 Index Monitor）。 */
export async function inspectUrl(env: Env, token: string, url: string): Promise<UrlInspection> {
  const siteUrl = env.GSC_SITE_URL || "sc-domain:aromiso.com";
  // V5.361：单条调用加 15s 超时，避免一次挂起拖垮整个并发批次
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res: Response;
  try {
    res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inspectionUrl: url, siteUrl }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`URL Inspection error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    inspectionResult?: {
      indexStatusResult?: {
        verdict?: string;
        coverageState?: string;
        lastCrawlTime?: string;
      };
    };
  };
  const isr = data.inspectionResult?.indexStatusResult;
  const coverage = isr?.coverageState || "";
  const verdict = isr?.verdict || "";
  return {
    url,
    status: normalizeCoverage(coverage, verdict),
    detail: coverage,
    verdict,
    lastCrawl: isr?.lastCrawlTime || "",
  };
}

// ---- GA4 Data API ----------------------------------------------------------

export interface GaRow {
  dimensionValues: { value: string }[];
  metricValues: { value: string }[];
}

/** Run a GA4 report. */
export async function fetchGa4(
  env: Env,
  token: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  metrics: string[],
  limit = 500,
): Promise<GaRow[]> {
  const propertyId = env.GA_PROPERTY_ID;
  if (!propertyId) throw new Ga4RequestError("BAD_REQUEST", "Missing GA_PROPERTY_ID");

  const url = `${GA_API}/${propertyId}:runReport`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: dimensions.map((name) => ({ name })),
      metrics: metrics.map((name) => ({ name })),
      limit,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    const code = classifyGa4Http(res.status);
    // 403 基本都是「属性级」权限问题而非某个维度：要么 GA_PROPERTY_ID 指向了
    // 服务账号读不到的属性，要么该服务账号没在 GA4 属性里被授予查看者。
    // 附上可执行的排查提示，让日报/告警里能直接看出根因（V5.412）。
    if (res.status === 403) {
      throw new Ga4RequestError(
        code,
        `GA4 API error (403): ${text} ｜ 排查：确认 GA_PROPERTY_ID（当前 ${propertyId}）指向服务账号 ${env.GSC_CLIENT_EMAIL || "?"} 可读的属性，且在 GA4「管理 → 账户访问权限」中已把该服务账号加为查看者`,
        res.status,
      );
    }
    throw new Ga4RequestError(code, `GA4 API error (${res.status}): ${text}`, res.status);
  }

  const data = (await res.json()) as { rows?: GaRow[] };
  return data.rows || [];
}
