// ---------------------------------------------------------------------------
//  Knowledge Consumption Tracking (V5.69 §4 Decision OS — Owner watch-item)
//
//  目标：把「active 979 条知识」从一个库存数字，变成可追溯的
//        knowledge → consumer → action → outcome 链路。
//
//  存储：复用既有 audit_logs 表 + 既有列（不新建表、不改 schema，与 inbox/ack.ts
//        的复用方式一致）。audit_logs 恰好已具备本任务需要的全部列：
//          resource_type='knowledge'   resource_id=<knowledge_v2.id>
//          action='consume'            username=<consumer role>
//          change_summary='knowledge_consume:role=…;mission=…;prompt=…;batch=N'
//          after_snippet=结构化明细（role / mission_id / prompt / knowledge_id / at）
//        （注：任务文案称「ai_action_logs」，但该表列为 mission_id/action_type/…，
//          并无 resource_type/resource_id/action/change_summary 列；这些列属于
//          audit_logs。为遵守「不新建表、不改 schema」硬约束，采用 audit_logs。）
//
//  契约：绝不抛错、绝不阻断 AI 调用（消费埋点失败只 console.error，永不静默）。
//        批量写入（db.batch 单次往返），每次调用封顶 N 条，成本恒定、可预期。
// ---------------------------------------------------------------------------

import type { D1Database } from "@cloudflare/workers-types";

/** change_summary 前缀 marker，供 GET 端点稳定过滤消费事件（对齐 inbox_ack: 约定）。 */
export const CONSUME_MARKER = "knowledge_consume:";

/** 单次调用最多记录多少条消费事件（配额/存储友好；注入本身就是 Top-K）。 */
const DEFAULT_CAP = 25;

export interface ConsumedKnowledge {
  id: string;
  title?: string | null;
}

export interface ConsumerContext {
  /** 消费方角色名（strategist / analyst / librarian / ai-role-call …）。 */
  role?: string;
  /** 关联的 mission / task id，用于 knowledge→action→outcome 追溯与错误知识联查。 */
  missionId?: string | null;
  /** 触发消费的 prompt / 场景标识（可选）。 */
  prompt?: string | null;
}

/**
 * 记录一批知识被某个 AI 消费方注入 prompt 的事件。
 * fire-and-forget 语义：内部吞掉所有错误（console.error 可见），绝不阻断主流程。
 */
export async function logKnowledgeConsumption(
  db: D1Database | undefined,
  consumed: ConsumedKnowledge[],
  consumer: ConsumerContext = {},
  cap = DEFAULT_CAP,
): Promise<void> {
  if (!db || !consumed || consumed.length === 0) return;
  const role = String(consumer.role || "ai").slice(0, 60);
  const missionId = consumer.missionId ? String(consumer.missionId).slice(0, 80) : "";
  const prompt = consumer.prompt ? String(consumer.prompt).slice(0, 60) : "";
  const at = new Date().toISOString();

  // 封顶：只记录本次真正注入的前 N 条，成本恒定。
  const rows = consumed.slice(0, Math.max(1, cap));

  const statements = rows.map((k) => {
    const id = String(k.id).slice(0, 80);
    const title = k.title ? String(k.title).slice(0, 200) : null;
    const changeSummary =
      `${CONSUME_MARKER}role=${role}${missionId ? `;mission=${missionId}` : ""}${
        prompt ? `;prompt=${prompt}` : ""
      };batch=${rows.length}`.slice(0, 500);
    const afterSnippet = JSON.stringify({
      role,
      mission_id: missionId || null,
      prompt: prompt || null,
      knowledge_id: id,
      at,
    });
    return db
      .prepare(
        `INSERT INTO audit_logs
           (id, actor_type, user_id, username, action, resource_type, resource_id,
            resource_title, change_summary, after_snippet, request_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      )
      .bind(
        crypto.randomUUID(),
        "ai",
        null,
        role,
        "consume",
        "knowledge",
        id,
        title,
        changeSummary,
        afterSnippet,
        null,
      );
  });

  try {
    // 单次往返批量写入；若运行时/测试桩不支持 batch，则退回顺序写入。
    if (typeof db.batch === "function") {
      await db.batch(statements);
    } else {
      for (const s of statements) await s.run();
    }
  } catch (e) {
    // 消费埋点是旁路观测，失败绝不阻断 AI 调用——但必须可见，永不静默。
    console.error(
      "[knowledge-consumption] log failed (non-blocking):",
      e instanceof Error ? e.message : String(e),
    );
  }
}
