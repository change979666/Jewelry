// ---------------------------------------------------------------------------
//  Jewelry V5.67 — 统一「安全访问契约」原语（静默失败根治地基）
//  functions/lib/safe.ts
//
//  背景（见 SILENT_FAILURE_AUDIT.md）：项目里大量真实错误被塌缩成
//  null / 0 / false / {} / void，调用方无法区分「真的没有」与「查询/写入失败」，
//  导致失败被当成正常继续运行、用户无感知。本模块提供三组契约原语，
//  让 success / not_found / no_change / error / degraded 在类型上强制可分：
//
//    读：firstChecked / allChecked   —— { ok, row/results, found } | { ok:false, error }
//    写：runChecked                  —— { ok, changes, lastRowId } | { ok:false, error }
//    入参：parseJsonBody             —— 区分 EMPTY_BODY / INVALID_JSON / 合法
//
//  规则（对齐全项目整改原则）：
//    · 真的没有数据 ≠ 请求失败；请求失败 ≠ 0 条；降级 ≠ 正常。
//    · 写操作必须知道 affected_rows；changes=0 是 no_change，不是 success。
//    · 解析失败必须保持真实语义（400），不得退化成「字段为空」的 422。
// ---------------------------------------------------------------------------

/** 通用二态结果：成功带 value，失败带 error（可选 code / cause）。 */
export type Result<T> =
  { ok: true; value: T } | { ok: false; error: string; code?: string; cause?: unknown };

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ---- 写操作契约 ------------------------------------------------------------

export interface RunOk {
  ok: true;
  /** meta.changes：真实受影响行数。0 表示语句执行成功但没有命中任何行（no_change）。 */
  changes: number;
  lastRowId: number | null;
}
export interface RunErr {
  ok: false;
  error: string;
  changes: 0;
  lastRowId: null;
}
export type RunResult = RunOk | RunErr;

/**
 * 包裹 D1 `.run()`，绝不丢弃 meta.changes，绝不吞异常。
 * 调用方据此区分：ok&&changes>0（写入生效）/ ok&&changes=0（no_change，
 * 例如 UPDATE 未命中、软删除目标不存在）/ !ok（数据库故障，不得报成功）。
 */
export async function runChecked(stmt: D1PreparedStatement): Promise<RunResult> {
  try {
    const r = await stmt.run();
    return {
      ok: true,
      changes: Number(r.meta?.changes ?? 0),
      lastRowId: (r.meta?.last_row_id as number | null) ?? null,
    };
  } catch (e) {
    return { ok: false, error: msg(e), changes: 0, lastRowId: null };
  }
}

// ---- 读操作契约 ------------------------------------------------------------

export type FirstResult<T> =
  | { ok: true; row: T | null; found: boolean }
  | { ok: false; error: string; row: null; found: false };

/**
 * 包裹 D1 `.first()`：区分「查到了 null（真的没有该行）」与「查询抛错」。
 * ok:true && row:null && found:false → 合法的 not_found；
 * ok:false → 数据库故障，调用方必须走 ERROR 分支，不得当成 not_found。
 */
export async function firstChecked<T>(stmt: D1PreparedStatement): Promise<FirstResult<T>> {
  try {
    const row = await stmt.first<T>();
    return { ok: true, row: row ?? null, found: row != null };
  } catch (e) {
    return { ok: false, error: msg(e), row: null, found: false };
  }
}

export type AllResult<T> =
  { ok: true; results: T[]; count: number } | { ok: false; error: string; results: null; count: 0 };

/**
 * 包裹 D1 `.all()`：区分「合法空结果集」与「查询抛错」。
 * ok:true && results:[] → 真的是 0 行；ok:false → 故障，禁止塌缩成 []。
 */
export async function allChecked<T>(stmt: D1PreparedStatement): Promise<AllResult<T>> {
  try {
    const r = await stmt.all<T>();
    const results = r.results ?? [];
    return { ok: true, results, count: results.length };
  } catch (e) {
    return { ok: false, error: msg(e), results: null, count: 0 };
  }
}

// ---- 请求体解析契约 --------------------------------------------------------

export type JsonBodyResult<T> =
  | { ok: true; body: T; empty: boolean }
  | { ok: false; code: "EMPTY_BODY" | "INVALID_JSON" | "BODY_READ_ERROR"; error: string };

/**
 * 统一 JSON body 解析。绝不再出现 `request.json().catch(() => ({}))`
 * 把「非法 JSON / 空 body」退化成 {} 再报「字段为空」的语义错位。
 *
 *   合法 JSON        → { ok:true, body, empty:false }
 *   空 / 全空白 body → { ok:false, code:"EMPTY_BODY" }   （调用方决定 400/422）
 *   非法 JSON        → { ok:false, code:"INVALID_JSON" } （调用方应回 400）
 *   读取失败         → { ok:false, code:"BODY_READ_ERROR" }
 */
export async function parseJsonBody<T = Record<string, unknown>>(
  request: Request,
): Promise<JsonBodyResult<T>> {
  let text: string;
  try {
    text = await request.text();
  } catch (e) {
    return { ok: false, code: "BODY_READ_ERROR", error: msg(e) };
  }
  if (!text || !text.trim()) {
    return { ok: false, code: "EMPTY_BODY", error: "Request body is empty" };
  }
  try {
    return { ok: true, body: JSON.parse(text) as T, empty: false };
  } catch (e) {
    return { ok: false, code: "INVALID_JSON", error: `Invalid JSON: ${msg(e)}` };
  }
}

// ---- 外部服务调用契约（Resend / R2 / GitHub / webhook / sync）-------------

export type ExternalResult<T = unknown> =
  | { ok: true; status: number; value: T | null }
  | { ok: false; status: number | null; error: string; networkError: boolean };

/**
 * 包裹对外部 HTTP 服务的调用，成功状态必须来自真实响应（res.ok），
 * 绝不用「闸门决策 / 乐观假设」伪造 delivered/synced/published=true。
 * networkError=true 表示连响应都没拿到（DNS/超时/抛异常）。
 */
export async function callExternal<T = unknown>(
  doFetch: () => Promise<Response>,
  parseJson = true,
): Promise<ExternalResult<T>> {
  let res: Response;
  try {
    res = await doFetch();
  } catch (e) {
    return { ok: false, status: null, error: msg(e), networkError: true };
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 500);
    } catch {
      /* ignore body read failure */
    }
    return {
      ok: false,
      status: res.status,
      error: detail || `HTTP ${res.status}`,
      networkError: false,
    };
  }
  if (!parseJson) return { ok: true, status: res.status, value: null };
  try {
    return { ok: true, status: res.status, value: (await res.json()) as T };
  } catch {
    // 2xx 但响应体非 JSON：仍算成功，但 value=null，不伪造内容。
    return { ok: true, status: res.status, value: null };
  }
}
