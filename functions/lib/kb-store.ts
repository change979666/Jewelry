// ---------------------------------------------------------------------------
//  Jewelry V5.30 — Unified Knowledge Base Store (R2-backed)
//
//  Bucket: legacy knowledge-base bucket name (binding: env.KB, not wired in V1.0). One index object `kb-index.json`
//  holds the whole entry array — reads are a single GET (fast admin page),
//  writes are read-modify-write (fine: writers are cron jobs / admin UI,
//  low concurrency; the admin "同步" button reconciles any lost write).
//
//  Entries here are the long-term archive. D1 stays the fast runtime store:
//    - `knowledge_base` (legacy V4.3)  → mirror ids `legacy-<d1id>`
//    - `knowledge`      (OS 1.0)       → mirror ids `os-<d1id>`
// ---------------------------------------------------------------------------

export interface KbEntry {
  id: string;
  /** e.g. seo_keyword / page_insight / content_gap / user_behavior / site_fact / operation … */
  category: string;
  title: string;
  detail: string;
  /** ai / manual / cron-extract / cron-pull / os … */
  source: string;
  /** Normalized to a 1–10 scale for display. */
  importance: number;
  /** Optional OS-knowledge extras. */
  level?: string;
  confidence?: number;
  created_at: number; // unix seconds
}

const INDEX_KEY = "kb-index.json";
const MAX_DETAIL = 8000;

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.max(min, Math.min(max, n));
}

function str(v: unknown, max = 600): string {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return s.slice(0, max);
}

/** Normalize importance to 1–10 (OS table uses 0–100). */
export function normImportance(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 5;
  return clampInt(n > 10 ? n / 10 : n, 1, 10, 5);
}

function cleanEntry(raw: Record<string, unknown>): KbEntry {
  return {
    id: str(raw.id, 80),
    category: str(raw.category, 60) || "general",
    title: str(raw.title, 300),
    detail: str(raw.detail, MAX_DETAIL),
    source: str(raw.source, 40) || "manual",
    importance: normImportance(raw.importance),
    ...(typeof raw.level === "string" && raw.level ? { level: str(raw.level, 40) } : {}),
    ...(typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
      ? { confidence: clampInt(raw.confidence, 0, 100, 50) }
      : {}),
    created_at: clampInt(raw.created_at, 0, 4102444800, Math.floor(Date.now() / 1000)),
  };
}

export function newKbId(): string {
  return "kb-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}

/**
 * V5.67（S01 P0 根治）：索引读取严格区分四种状态，杜绝「索引损坏/读取失败
 * 被当成空索引 → 写操作整库覆盖成 1 条」的数据丢失。
 *
 *   ok       —— 成功解析，entries 有效（可能为空数组：真的还没有条目）
 *   missing  —— R2 中索引对象不存在（首次使用；允许从零写入）
 *   corrupt  —— 对象存在但不是合法 JSON 数组（结构异常）
 *   error    —— R2 读取本身抛错（网络/权限/绑定缺失）
 *
 * corrupt / error 一律 **禁止写入**：宁可停止写入，也不能覆盖已有数据。
 */
export type KbIndexState = "ok" | "missing" | "corrupt" | "error";
export interface KbLoadResult {
  state: KbIndexState;
  entries: KbEntry[];
  error?: string;
}

/** 写入路径在索引不可信（corrupt/error）时抛出，调用方必须让失败可见（502/日志），不得吞掉后继续。 */
export class KbIndexUnavailableError extends Error {
  constructor(
    public readonly state: KbIndexState,
    message: string,
  ) {
    super(message);
    this.name = "KbIndexUnavailableError";
  }
}

export async function kbLoadIndexChecked(bucket: R2Bucket): Promise<KbLoadResult> {
  let obj: R2ObjectBody | null;
  try {
    obj = await bucket.get(INDEX_KEY);
  } catch (e) {
    return { state: "error", entries: [], error: e instanceof Error ? e.message : String(e) };
  }
  if (!obj) return { state: "missing", entries: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(await obj.text());
  } catch (e) {
    return { state: "corrupt", entries: [], error: e instanceof Error ? e.message : String(e) };
  }
  if (!Array.isArray(parsed)) {
    return { state: "corrupt", entries: [], error: "kb-index.json is not a JSON array" };
  }
  const entries = parsed
    .filter((e) => e && typeof e === "object" && typeof e.id === "string")
    .map((e) => cleanEntry(e as Record<string, unknown>));
  return { state: "ok", entries };
}

/**
 * 只读加载（列表/展示路径）。missing → []（合法空）；corrupt/error → [] 但
 * **大声记日志**，避免故障被静默读成「知识库为空」。写路径请勿用本函数，
 * 改用 kbLoadIndexChecked 并对 corrupt/error fail-closed。
 */
export async function kbLoadIndex(bucket: R2Bucket): Promise<KbEntry[]> {
  const r = await kbLoadIndexChecked(bucket);
  if (r.state === "corrupt" || r.state === "error") {
    console.error(`[kb-store] index ${r.state}, returning empty for read-only path:`, r.error);
    return [];
  }
  return r.entries;
}

/**
 * 写入前的可信加载：corrupt/error 直接抛 KbIndexUnavailableError，
 * ok/missing 返回 entries（missing 允许从零建索引）。
 */
async function kbLoadForWrite(bucket: R2Bucket): Promise<KbEntry[]> {
  const r = await kbLoadIndexChecked(bucket);
  if (r.state === "corrupt" || r.state === "error") {
    throw new KbIndexUnavailableError(
      r.state,
      `Refusing to write KB index: state=${r.state}${r.error ? ` (${r.error})` : ""}`,
    );
  }
  return r.entries;
}

async function kbSaveIndex(bucket: R2Bucket, entries: KbEntry[]): Promise<void> {
  entries.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  await bucket.put(INDEX_KEY, JSON.stringify(entries), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

/**
 * Insert or replace (by id). Returns the saved entry.
 * 索引 corrupt/error 时抛 KbIndexUnavailableError（fail-closed），绝不整库覆盖。
 */
export async function kbUpsert(bucket: R2Bucket, entry: KbEntry): Promise<KbEntry> {
  const clean = cleanEntry(entry as unknown as Record<string, unknown>);
  const list = await kbLoadForWrite(bucket);
  const idx = list.findIndex((e) => e.id === clean.id);
  if (idx >= 0) list[idx] = clean;
  else list.push(clean);
  await kbSaveIndex(bucket, list);
  return clean;
}

export async function kbDelete(bucket: R2Bucket, id: string): Promise<boolean> {
  const list = await kbLoadForWrite(bucket);
  const next = list.filter((e) => e.id !== id);
  if (next.length === list.length) return false;
  await kbSaveIndex(bucket, next);
  return true;
}

/**
 * Backfill: copy every D1 knowledge entry (both tables) into R2 if its
 * mirror id is not there yet. Returns counts for the admin UI toast.
 */
export async function kbSyncFromD1(
  bucket: R2Bucket,
  db: D1Database,
): Promise<{ added: number; skipped: number; total: number }> {
  // 写路径：索引 corrupt/error 时抛错，绝不把已有 KB 覆盖成「仅 D1 派生条目」。
  const list = await kbLoadForWrite(bucket);
  const seen = new Set(list.map((e) => e.id));
  let added = 0;
  let skipped = 0;

  // OS 1.0 knowledge table
  try {
    const os = await db
      .prepare(
        `SELECT id, level, category, summary, evidence, confidence, importance, source, created_at
         FROM knowledge ORDER BY created_at DESC LIMIT 1000`,
      )
      .all<Record<string, unknown>>();
    for (const r of os.results) {
      const mid = `os-${r.id}`;
      if (seen.has(mid)) {
        skipped++;
        continue;
      }
      list.push(
        cleanEntry({
          id: mid,
          category: r.category,
          title: r.summary,
          detail: r.evidence,
          source: r.source || "ai",
          importance: r.importance,
          level: r.level,
          confidence: r.confidence,
          created_at: r.created_at,
        }),
      );
      seen.add(mid);
      added++;
    }
  } catch {
    // table may not exist yet — ignore
  }

  // Legacy V4.3 knowledge_base table
  try {
    const legacy = await db
      .prepare(
        `SELECT id, category, title, detail, source, importance, created_at
         FROM knowledge_base ORDER BY created_at DESC LIMIT 1000`,
      )
      .all<Record<string, unknown>>();
    for (const r of legacy.results) {
      const mid = `legacy-${r.id}`;
      if (seen.has(mid)) {
        skipped++;
        continue;
      }
      list.push(
        cleanEntry({
          id: mid,
          category: r.category,
          title: r.title,
          detail: r.detail,
          source: r.source || "manual",
          importance: r.importance,
          created_at: r.created_at,
        }),
      );
      seen.add(mid);
      added++;
    }
  } catch {
    // ignore
  }

  if (added > 0) await kbSaveIndex(bucket, list);
  return { added, skipped, total: list.length };
}
