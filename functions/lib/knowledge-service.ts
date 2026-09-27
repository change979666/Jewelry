// ============================================================================
// Knowledge Service — Jewelry AI 知识 SSOT
//
// 原则：所有 AI 模块统一从这里获取知识，禁止各自查库维护事实。
//   - Fact 与 AI Inference 严格分离：human/product/catalog = 事实源（可升级
//     verified）；vlm/ocr/ai = 推断（永远 candidate，必须人工批准，绝不自动升级）
//   - 商业字段（MOQ/价格/认证/交期/材质规格/付款条款）拒绝推断源入库
//   - 不知道 = UNKNOWN，猜测 = INFERENCE，未确认提取 = CANDIDATE，
//     可靠来源 = FACT，人工确认 = VERIFIED
//   - 过期知识（expires_at 已过）自动退出可信集，进入 review
//   - 同一事实禁止重复存储（dedupe by entity+category+title+source）
// ============================================================================

import type { D1Database } from "@cloudflare/workers-types";

export type KBStatus = "draft" | "active" | "review" | "deprecated" | "archived";

/** 事实源：可经人工确认升级为 verified */
export const FACT_SOURCES = new Set(["human", "product", "catalog"]);
/** 推断源：永远 candidate，必须人工批量批准，绝不自动成为可信事实 */
export const INFERENCE_SOURCES = new Set(["vlm", "ocr", "ai", "import", "cron"]);
/** 商业字段红线：推断源一律不得入库这些字段的知识 */
export const COMMERCIAL_KB_FIELDS = new Set([
  "moq",
  "price",
  "certification",
  "lead_time",
  "material_spec",
  "payment_terms",
]);

export function confidenceTier(c: number): "verified" | "high" | "medium" | "low" | "unknown" {
  if (c >= 100) return "verified";
  if (c >= 80) return "high";
  if (c >= 50) return "medium";
  if (c >= 20) return "low";
  return "unknown";
}

export interface KnowledgeInput {
  layer?: string; // L0-L4，默认 L0
  category: string; // product/company/sales/seo/media/general（词表冻结）
  title: string;
  content: string;
  source: string; // human/product/catalog/vlm/ocr/ai/import/cron
  confidence?: number; // 0-100
  importance?: number; // 1-10
  entity_type?: string | null; // product/content/inquiry 等
  entity_id?: string | null;
  tags?: string[];
  source_ref?: string; // 来源引用（存入 tags_json）
  expires_at?: string | null; // ISO（商业时效类事实）
  created_by?: string;
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `kb-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }
}

let _versionsTableReady = false;

/** 变更前快照 → knowledge_versions（V5.54 版本化）。失败不阻塞主流程。 */
async function writeVersion(
  db: D1Database,
  knowledgeId: string,
  changedBy: string,
  reason: string,
): Promise<void> {
  try {
    if (!_versionsTableReady) {
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS knowledge_versions (
            id TEXT PRIMARY KEY, knowledge_id TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
            confidence INTEGER NOT NULL DEFAULT 0, changed_by TEXT NOT NULL DEFAULT 'system',
            change_reason TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        )
        .run();
      await db
        .prepare(
          `CREATE INDEX IF NOT EXISTS idx_knowledge_versions_kid ON knowledge_versions (knowledge_id, version DESC)`,
        )
        .run();
      _versionsTableReady = true;
    }
    const cur = await db
      .prepare(`SELECT status, content, confidence FROM knowledge_v2 WHERE id = ?`)
      .bind(knowledgeId)
      .first<{ status: string; content: string; confidence: number }>();
    if (!cur) return;
    const next = await db
      .prepare(
        `SELECT COALESCE(MAX(version),0) + 1 AS v FROM knowledge_versions WHERE knowledge_id = ?`,
      )
      .bind(knowledgeId)
      .first<{ v: number }>();
    await db
      .prepare(
        `INSERT INTO knowledge_versions (id, knowledge_id, version, status, content, confidence, changed_by, change_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        newId(),
        knowledgeId,
        Number(next?.v ?? 1),
        cur.status ?? "",
        cur.content ?? "",
        Number(cur.confidence ?? 0),
        changedBy,
        reason,
      )
      .run();
  } catch {
    /* 版本表缺失/写入失败不影响主流程 */
  }
}

/**
 * 创建候选知识（幂等去重）。推断源强制 status=review（候选），事实源 = draft。
 * 商业字段 + 推断源 → 拒绝入库（红线）。
 * 同 (entity_type, entity_id, category, title, source) 已存在 → 更新内容与置信度，不重复插入。
 */
export async function createCandidateKnowledge(
  db: D1Database,
  input: KnowledgeInput,
): Promise<{ created: boolean; id: string | null; reason?: string }> {
  const source = String(input.source || "ai");
  const isCommercial = COMMERCIAL_KB_FIELDS.has(String(input.category).toLowerCase());
  if (INFERENCE_SOURCES.has(source) && isCommercial) {
    return { created: false, id: null, reason: "商业字段红线：推断源不得入库" };
  }
  const conf = Math.max(0, Math.min(100, Math.round(input.confidence ?? 50)));
  const status: KBStatus = INFERENCE_SOURCES.has(source) ? "review" : "draft";

  // dedupe：同实体 + 分类 + 标题 + 来源视为同一知识
  const existing = await db
    .prepare(
      `SELECT id, confidence FROM knowledge_v2
       WHERE COALESCE(linked_entity_type,'') = ? AND COALESCE(linked_entity_id,'') = ?
         AND category = ? AND title = ? AND source = ?`,
    )
    .bind(input.entity_type || "", input.entity_id || "", input.category, input.title, source)
    .first<{ id: string; confidence: number }>();

  if (existing) {
    // 不重复存储：更新为更高置信度与最新内容（先留版本快照）
    const newConf = Math.max(Number(existing.confidence) || 0, conf);
    await writeVersion(db, existing.id, input.created_by || "system", "dedupe-update");
    await db
      .prepare(
        `UPDATE knowledge_v2 SET content = ?, confidence = ?, tags_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
      .bind(input.content, newConf, JSON.stringify(input.tags ?? []), existing.id)
      .run();
    return { created: false, id: existing.id, reason: "dedupe-updated" };
  }

  const id = newId();
  try {
    await db
      .prepare(
        `INSERT INTO knowledge_v2
         (id, layer, category, title, content, source, importance, confidence, tags_json,
          linked_entity_type, linked_entity_id, created_by, status, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .bind(
        id,
        input.layer || "L0",
        input.category,
        input.title,
        input.content,
        source,
        Math.max(1, Math.min(10, Math.round(input.importance ?? 5))),
        conf,
        JSON.stringify({
          ...(input.tags ?? []),
          ...(input.source_ref ? { source_ref: input.source_ref } : {}),
        }),
        input.entity_type ?? null,
        input.entity_id ?? null,
        input.created_by || "system",
        status,
        input.expires_at ?? null,
      )
      .run();
    return { created: true, id };
  } catch (e) {
    // V5.56：0082 部分 UNIQUE 索引下，并发插入竞态 → 回退为更新既有候选，绝不产生重复。
    if (/UNIQUE/i.test(e instanceof Error ? e.message : String(e))) {
      const again = await db
        .prepare(
          `SELECT id, confidence FROM knowledge_v2
           WHERE COALESCE(linked_entity_type,'') = ? AND COALESCE(linked_entity_id,'') = ?
             AND category = ? AND title = ? AND source = ? AND status IN ('review','draft')`,
        )
        .bind(input.entity_type || "", input.entity_id || "", input.category, input.title, source)
        .first<{ id: string; confidence: number }>();
      if (again) {
        const newConf = Math.max(Number(again.confidence) || 0, conf);
        await db
          .prepare(
            `UPDATE knowledge_v2 SET content = ?, confidence = ?, tags_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          )
          .bind(input.content, newConf, JSON.stringify(input.tags ?? []), again.id)
          .run();
        return { created: false, id: again.id, reason: "dedupe-race-updated" };
      }
    }
    throw e; // 非竞态错误：抛出，调用方 fail-safe
  }
}

/** 可信事实：status=active 且未过期。AI 行动只允许使用这里的结果。 */
export async function getTrustedFacts(
  db: D1Database,
  opts: { entity_type?: string; entity_id?: string; category?: string; limit?: number },
): Promise<Array<Record<string, unknown>>> {
  const conds = [`status = 'active'`, `(expires_at IS NULL OR expires_at > datetime('now'))`];
  const binds: unknown[] = [];
  if (opts.entity_type) {
    conds.push("linked_entity_type = ?");
    binds.push(opts.entity_type);
  }
  if (opts.entity_id) {
    conds.push("linked_entity_id = ?");
    binds.push(opts.entity_id);
  }
  if (opts.category) {
    conds.push("category = ?");
    binds.push(opts.category);
  }
  const safeLimit1 = Number.isFinite(opts.limit ?? 50)
    ? Math.min(200, Math.max(1, (opts.limit ?? 50) as number))
    : 50;
  const rows = await db
    .prepare(
      `SELECT * FROM knowledge_v2 WHERE ${conds.join(" AND ")} ORDER BY confidence DESC, updated_at DESC LIMIT ?`,
    )
    .bind(...binds, safeLimit1)
    .all();
  return rows.results as Array<Record<string, unknown>>;
}

/** 搜索（关键词/类型/来源/状态/置信度）。 */
export async function searchKnowledge(
  db: D1Database,
  opts: {
    q?: string;
    category?: string;
    source?: string;
    status?: string;
    min_confidence?: number;
    limit?: number;
    offset?: number;
  },
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
  const conds: string[] = [];
  const binds: unknown[] = [];
  if (opts.q) {
    conds.push("(title LIKE ? OR content LIKE ?)");
    binds.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  if (opts.category) {
    conds.push("category = ?");
    binds.push(opts.category);
  }
  if (opts.source) {
    conds.push("source = ?");
    binds.push(opts.source);
  }
  if (opts.status) {
    conds.push("status = ?");
    binds.push(opts.status);
  }
  if (opts.min_confidence != null) {
    conds.push("confidence >= ?");
    binds.push(opts.min_confidence);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const total =
    (
      await db
        .prepare(`SELECT COUNT(*) AS c FROM knowledge_v2 ${where}`)
        .bind(...binds)
        .first<{ c: number }>()
    )?.c ?? 0;
  const rawLimit2 = opts.limit ?? 20;
  const limit = Number.isFinite(rawLimit2) ? Math.min(100, Math.max(1, rawLimit2)) : 20;
  const rawOffset2 = opts.offset ?? 0;
  const offset = Number.isFinite(rawOffset2) ? Math.max(0, rawOffset2) : 0;
  const rows = await db
    .prepare(`SELECT * FROM knowledge_v2 ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
    .bind(...binds, limit, offset)
    .all();
  return { items: rows.results as Array<Record<string, unknown>>, total };
}

/** 单个产品的完整知识视图（可信事实 + 候选）。 */
export async function getProductKnowledge(
  db: D1Database,
  entityId: string,
): Promise<{
  trusted: Array<Record<string, unknown>>;
  candidates: Array<Record<string, unknown>>;
}> {
  const trusted = await getTrustedFacts(db, {
    entity_type: "product",
    entity_id: entityId,
    limit: 100,
  });
  const cand = await db
    .prepare(
      `SELECT * FROM knowledge_v2 WHERE linked_entity_type='product' AND linked_entity_id=? AND status IN ('review','draft') ORDER BY confidence DESC LIMIT 100`,
    )
    .bind(entityId)
    .all();
  return { trusted, candidates: cand.results as Array<Record<string, unknown>> };
}

/** 批量批准（人批"这一批"，不逐条审批）：review→active，confidence→100，记录确认人/时间。 */
export async function approveKnowledge(
  db: D1Database,
  ids: string[],
  approvedBy: string,
): Promise<number> {
  if (!ids.length) return 0;
  // 批准前逐条留版本快照（review→active 是关键状态跃迁）
  for (const id of ids) {
    await writeVersion(db, id, approvedBy, "approve");
  }
  const ph = ids.map(() => "?").join(",");
  const res = await db
    .prepare(
      `UPDATE knowledge_v2 SET status='active', confidence=100, verified_by=?, verified_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
       WHERE id IN (${ph}) AND status='review'`,
    )
    .bind(approvedBy, ...ids)
    .run();
  return Number(res.meta.changes);
}

/** 作废：→ deprecated（AI 不再使用，历史保留）。V5.55：记录拒绝人/原因。 */
export async function invalidateKnowledge(
  db: D1Database,
  id: string,
  changedBy = "system",
  reason = "invalidate",
): Promise<void> {
  await writeVersion(db, id, changedBy, reason);
  await db
    .prepare(`UPDATE knowledge_v2 SET status='deprecated', updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(id)
    .run();
}

/** V5.55：人工编辑候选内容（保留来源/置信度字段，留版本快照，回到 review）。 */
export async function updateKnowledgeContent(
  db: D1Database,
  id: string,
  content: string,
  changedBy: string,
): Promise<void> {
  await writeVersion(db, id, changedBy, "edit");
  await db
    .prepare(
      `UPDATE knowledge_v2 SET content=?, status='review', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    )
    .bind(content, id)
    .run();
}

/** V5.55：冲突分组（含成员明细）——同一实体+分类下多条不同内容 → 一组，供 Fact A vs Fact B 人审。 */
export async function conflictGroups(db: D1Database): Promise<
  Array<{
    entity_type: string | null;
    entity_id: string | null;
    category: string;
    count: number;
    members: Array<{
      id: string;
      title: string;
      content: string;
      source: string;
      confidence: number;
      status: string;
      created_at: string;
    }>;
  }>
> {
  // 先找冲突的 (实体,分类) 组合（限量，配额友好）
  const groups = await db
    .prepare(
      `SELECT linked_entity_type, linked_entity_id, category, COUNT(*) AS count
       FROM knowledge_v2
       WHERE status IN ('active','review','draft')
       GROUP BY linked_entity_type, linked_entity_id, category
       HAVING COUNT(DISTINCT content) > 1
       ORDER BY count DESC LIMIT 50`,
    )
    .all<{
      linked_entity_type: string | null;
      linked_entity_id: string | null;
      category: string;
      count: number;
    }>();

  // V5.57 N+1 优化：成员明细改为分块批量查询（每块 30 组 × 3 绑定 = 90，
  // 低于 D1 单语句 ~100 绑定上限），由 1+N 降到 1+⌈N/30⌉（50 组 → 3 次查询）。
  const keyStr = (t: string | null, i: string | null, c: string) =>
    `${t || ""}\u0001${i || ""}\u0001${c}`;
  const memberMap = new Map<
    string,
    Array<{
      id: string;
      title: string;
      content: string;
      source: string;
      confidence: number;
      status: string;
      created_at: string;
    }>
  >();
  const CHUNK = 30;
  for (let i = 0; i < groups.results.length; i += CHUNK) {
    const ch = groups.results.slice(i, i + CHUNK);
    const cond = ch
      .map(
        () =>
          "(COALESCE(linked_entity_type,'')=? AND COALESCE(linked_entity_id,'')=? AND category=?)",
      )
      .join(" OR ");
    const binds = ch.flatMap((g) => [
      g.linked_entity_type || "",
      g.linked_entity_id || "",
      g.category,
    ]);
    const rows = await db
      .prepare(
        `SELECT linked_entity_type, linked_entity_id, category,
                id, title, content, source, confidence, status, created_at
         FROM knowledge_v2
         WHERE status IN ('active','review','draft') AND (${cond})
         ORDER BY confidence DESC, created_at DESC`,
      )
      .bind(...binds)
      .all<{
        linked_entity_type: string | null;
        linked_entity_id: string | null;
        category: string;
        id: string;
        title: string;
        content: string;
        source: string;
        confidence: number;
        status: string;
        created_at: string;
      }>();
    for (const r of rows.results) {
      const k = keyStr(r.linked_entity_type, r.linked_entity_id, r.category);
      const arr = memberMap.get(k) || [];
      if (arr.length < 10) {
        arr.push({
          id: r.id,
          title: r.title,
          content: r.content,
          source: r.source,
          confidence: r.confidence,
          status: r.status,
          created_at: r.created_at,
        });
        memberMap.set(k, arr);
      }
    }
  }

  return groups.results.map((g) => ({
    entity_type: g.linked_entity_type,
    entity_id: g.linked_entity_id,
    category: g.category,
    count: g.count,
    members: memberMap.get(keyStr(g.linked_entity_type, g.linked_entity_id, g.category)) || [],
  }));
}

/** 过期清扫：已过期且仍 active 的 → review（AI 不再信任，等人工复核）。 */
export async function expireSweep(db: D1Database): Promise<number> {
  const res = await db
    .prepare(
      `UPDATE knowledge_v2 SET status='review', updated_at=CURRENT_TIMESTAMP
       WHERE status='active' AND expires_at IS NOT NULL AND expires_at <= datetime('now')`,
    )
    .run();
  return Number(res.meta.changes);
}

/** 冲突检测：同一实体 + 分类下多条不同内容的非弃用知识 → 冲突对。 */
export async function findConflicts(db: D1Database): Promise<
  Array<{
    entity_type: string | null;
    entity_id: string | null;
    category: string;
    count: number;
    titles: string;
  }>
> {
  const rows = await db
    .prepare(
      `SELECT linked_entity_type, linked_entity_id, category, COUNT(*) AS count,
              GROUP_CONCAT(title, ' ⚡ ') AS titles
       FROM knowledge_v2
       WHERE status IN ('active','review','draft')
       GROUP BY linked_entity_type, linked_entity_id, category
       HAVING COUNT(DISTINCT content) > 1
       ORDER BY count DESC LIMIT 50`,
    )
    .all();
  return rows.results as Array<{
    entity_type: string | null;
    entity_id: string | null;
    category: string;
    count: number;
    titles: string;
  }>;
}

/** 健康概览：各状态计数 + 过期/冲突数。 */
export async function knowledgeHealth(db: D1Database): Promise<Record<string, number>> {
  const rows = await db
    .prepare(`SELECT status, COUNT(*) AS c FROM knowledge_v2 GROUP BY status`)
    .all<{ status: string; c: number }>();
  const out: Record<string, number> = {
    total: 0,
    active: 0,
    review: 0,
    draft: 0,
    deprecated: 0,
    archived: 0,
    expiring_soon: 0,
    conflicts: 0,
  };
  for (const r of rows.results) {
    out[r.status] = Number(r.c);
    out.total += Number(r.c);
  }
  const expiring = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM knowledge_v2 WHERE status='active' AND expires_at IS NOT NULL AND expires_at <= datetime('now','+7 days')`,
    )
    .first<{ c: number }>();
  out.expiring_soon = Number(expiring?.c ?? 0);
  const conflicts = await findConflicts(db);
  out.conflicts = conflicts.length;
  return out;
}
