// ---------------------------------------------------------------------------
//  GA4 pull result codes — machine-readable ingestion outcomes (forensic
//  hardening). Previously "rows = 0" alone had to carry error semantics, which
//  conflated "API returned a valid empty response" with "API request failed".
//  These codes are persisted to pull_state.error_code so every outcome is
//  explicit and machine-readable, while the legacy `status` vocabulary
//  (ok / empty / degraded / pending / gaveup) is preserved for compatibility.
// ---------------------------------------------------------------------------

export type Ga4ResultCode =
  | "OK"
  | "EMPTY_VALID_RESPONSE"
  | "AUTH_ERROR"
  | "PERMISSION_ERROR" // aka PERMISSION_DENIED (HTTP 403)
  | "BAD_REQUEST"
  | "API_ERROR"
  | "D1_WRITE_ERROR" // aka WRITE_ERROR
  | "UNKNOWN";

/** Codes that represent a real failure (not a valid empty response). */
export const GA4_ERROR_CODES: readonly Ga4ResultCode[] = [
  "AUTH_ERROR",
  "PERMISSION_ERROR",
  "BAD_REQUEST",
  "API_ERROR",
  "D1_WRITE_ERROR",
];

export function isGa4ErrorCode(code: string | null | undefined): boolean {
  return !!code && (GA4_ERROR_CODES as readonly string[]).includes(code);
}

/** Typed error so callers can distinguish failure classes without parsing text. */
export class Ga4RequestError extends Error {
  code: Ga4ResultCode;
  httpStatus?: number;
  constructor(code: Ga4ResultCode, message: string, httpStatus?: number) {
    super(message);
    this.name = "Ga4RequestError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Map a GA4 Data API HTTP status to a machine-readable result code. */
export function classifyGa4Http(httpStatus: number): Ga4ResultCode {
  if (httpStatus === 401) return "AUTH_ERROR";
  if (httpStatus === 403) return "PERMISSION_ERROR";
  if (httpStatus === 400) return "BAD_REQUEST";
  return "API_ERROR";
}

/** Coerce an unknown thrown value to a result code (safe default API_ERROR). */
export function codeOfError(e: unknown): Ga4ResultCode {
  if (e instanceof Ga4RequestError) return e.code;
  return "API_ERROR";
}

export type PullStatus = "ok" | "empty" | "degraded";

/**
 * Decide the compatibility `status` plus the explicit machine `code` for one
 * pull attempt. Rules:
 *   rows > 0                       -> status ok,       code OK
 *   real failure code              -> status degraded, code <that code>
 *   200 + 0 rows (not suspicious)  -> status empty,    code EMPTY_VALID_RESPONSE
 *   200 + 0 rows (suspicious gap)  -> status degraded, code EMPTY_VALID_RESPONSE
 * A failure code NEVER maps to status 'empty', so API failures can never be
 * mistaken for a genuine empty day (and never consume empty->gaveup attempts).
 */
export function decidePullOutcome(args: {
  rows: number;
  code?: Ga4ResultCode | null;
  suspiciousOutage?: boolean;
}): { status: PullStatus; code: Ga4ResultCode } {
  const { rows, code, suspiciousOutage } = args;
  if (rows > 0) return { status: "ok", code: "OK" };
  if (code && isGa4ErrorCode(code)) return { status: "degraded", code };
  const base: Ga4ResultCode =
    code === "EMPTY_VALID_RESPONSE" || code == null ? "EMPTY_VALID_RESPONSE" : code;
  if (base === "EMPTY_VALID_RESPONSE" && suspiciousOutage) {
    return { status: "degraded", code: base };
  }
  return { status: "empty", code: base };
}
