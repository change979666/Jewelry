// ---------------------------------------------------------------------------
//  Aromiso V5.4 — AI Notification & Heartbeat Layer（AI 通知与心跳层）
//
//  目标：owner 不打开后台，每天一封中文邮件即可知道——
//    系统今天有没有正常运行？做了什么？明天准备做什么？有没有异常？
//
//  邮件体系（V5.83 起，owner 2026-09-21 定「每天一封汇总邮件」）：
//    🟢 每日汇总日报（心跳）：每天一封，无异常也发——「没有消息 ≠ 不知道系统死没死」，
//       收到即代表全链路活着。主发送点 = os-daily auditor 收尾（四角色跑完后，
//       北京时间约 07:00 送达）；cron-pull growth 只做「昨日日报缺席」兜底补发。
//       板块：状态/健康分 → ⚠️ 需要关注（日内告警汇总）→ 增长 KPI → AI 工作 →
//       今日发现 → 今日询盘 ★ → 明日计划 → 结论。
//    🟡 一般警告（模块失败 / 预算触顶 / 健康分<80 等）：V5.83 起【不再单独发信】，
//       写入日内汇总（KV notify:rollup:<北京日期>），由当日唯一一封日报的
//       「⚠️ 需要关注」板块统一呈现（同 code 日内去重，发送后消费清空）。
//    🟡 报表异常（REPORT_DEGRADED）：日报主表缺失/生成失败时仍即时单独发信
//       （V5.415 起日报失败绝不发「运行正常」）——这是「日报本身坏了」的兜底，
//       不能等一封可能发不出来的日报。标题【Aromiso AI 报表异常】XXX。
//    🔴 高危提醒：真实性闸拦截 / 同类连续失败≥3 次，仍即时发信（6h 冷却去重），
//       同时落一份到日内汇总供日报留档。标题【Aromiso AI 高危】XXX。
//
//  铁律一：通知层永远不阻断主流程——所有逻辑 try/catch 吞错。
//  铁律二：Agent 自己不决定「给老板发邮件」——只由系统根据结构化日志
//          （ai_missions / ai_daily_report / ai_action_logs / ai_mission_plan）
//          聚合生成，防邮件轰炸、防 AI 越权打扰。
//  铁律三：日报每天最多一封（KV 幂等）；🟡 警告按 code 在日内汇总中去重；
//          🔴 高危按 code 冷却去重。
// ---------------------------------------------------------------------------

import type { Env } from "../types";
import { wrapEmailTemplate } from "./email-template";
import { getActionBudgetConfig, getBudgetUsage } from "./action-budget";
import { classifyIntent } from "./growth-engine";
import { classifyHealthBuckets } from "./health-buckets";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D1Row = Record<string, any>;

// ---- 小工具 ----------------------------------------------------------------

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 北京时间（UTC+8）日期与展示标签。 */
function beijing(): { dateStr: string; label: string; timeLabel: string } {
  const t = new Date(Date.now() + 8 * 3600 * 1000);
  const dateStr = t.toISOString().slice(0, 10);
  const label = `${t.getUTCMonth() + 1}月${t.getUTCDate()}日`;
  const hh = String(t.getUTCHours()).padStart(2, "0");
  const mm = String(t.getUTCMinutes()).padStart(2, "0");
  return { dateStr, label, timeLabel: `${hh}:${mm}` };
}

function utcDayRange(dateStr: string): { start: number; end: number } {
  const start = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
  return { start, end: start + 86400 };
}

// ---- 基础发信（Resend → RESEND_TO 运营邮箱） ------------------------------

async function sendSystemEmail(
  env: Env,
  subject: string,
  bodyHtml: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!env.RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY 未配置" };
    if (!env.RESEND_TO) return { ok: false, error: "RESEND_TO 未配置" };
    // V5.421：RESEND_TO 支持多收件人（逗号 / 分号 / 空白分隔），日报与告警同发全部地址。
    const to = String(env.RESEND_TO)
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (to.length === 0) return { ok: false, error: "RESEND_TO 未配置有效地址" };
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM || "Aromiso AI <sales@aromiso.com>",
        to,
        subject,
        html: wrapEmailTemplate(bodyHtml, { previewText: subject }),
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * V5.415（P1-3）：冷却去重拆成两步——
 *   checkCooldown：只读查询额度是否已被占用；
 *   commitCooldown：Resend 确认【发送成功后】才写入冷却键、消耗额度。
 * 旧版（acquireSendSlot）先写 KV 再发信：Resend 失败/超时/500 时冷却已被白白占用，
 * 接下来 24h 内的真实异常全部静默（狼来了反版）。现在发送失败不占额度，下次触发自动重试。
 * KV 读失败 → 返回 false（放行一次，宁可多发不可静默失联）。
 */
async function checkCooldown(env: Env, key: string): Promise<boolean> {
  try {
    const kv = env.DRAFTS;
    if (!kv) return false;
    return Boolean(await kv.get(key));
  } catch {
    return false; // KV 故障不阻断通知判断（宁可多发一封，不可静默失联）
  }
}

/**
 * 发送成功后写入冷却键。写失败只记日志、不回滚「已发送」事实
 * （最坏情况 = 冷却窗口内重复多发一封，不会造成静默）。
 */
async function commitCooldown(env: Env, key: string, ttlSec: number): Promise<void> {
  try {
    const kv = env.DRAFTS;
    if (!kv) return;
    await kv.put(key, String(Date.now()), { expirationTtl: ttlSec });
  } catch (e) {
    console.error("[notify] commitCooldown failed:", e);
  }
}

// ---- 🟡🔴 异常告警 ----------------------------------------------------------

export interface AlertInput {
  level: "warn" | "critical";
  /** 去重码，例如 "blocked:growth_sync" / "truthfulness" / "budget_cap" */
  code: string;
  /** 主题后缀，例如「Growth 阶段执行失败」 */
  title: string;
  /** 正文行（纯文本，内部转义） */
  lines: string[];
  /** 是否需要人工介入 */
  needHuman?: boolean;
}

// ---- 🗂 告警日内汇总（V5.83） ------------------------------------------------
// Owner 反馈「每天收到多封日报/告警邮件太繁琐」。从 V5.83 起：
//   🟡 警告 → 不再即时单独发信，写入日内汇总（KV），由当天唯一一封日报
//             邮件在「⚠️ 需要关注」板块统一呈现；
//   🔴 高危 → 仍即时发信（真实性红线等安全网，宁可多发不可静默），
//             同时落一份到汇总供日报留档。
// 汇总按【北京日期】分桶；日报发送时读取今昨两桶合并（跨 07:00 发送点的
// 事件不丢失），发送成功后消费清空。

interface RolledAlert {
  level: "warn" | "critical";
  code: string;
  title: string;
  lines: string[];
  needHuman?: boolean;
  ts: number;
}

async function readRollup(env: Env, dateStr: string): Promise<RolledAlert[]> {
  try {
    const raw = await env.DRAFTS?.get(`notify:rollup:${dateStr}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RolledAlert[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function appendRollup(env: Env, a: AlertInput): Promise<void> {
  try {
    const kv = env.DRAFTS;
    if (!kv) return;
    const bj = beijing();
    const list = await readRollup(env, bj.dateStr);
    const entry: RolledAlert = {
      level: a.level,
      code: a.code,
      title: a.title,
      lines: (a.lines || []).slice(0, 6),
      needHuman: a.needHuman,
      ts: Date.now(),
    };
    // 同 code 只保留最新一条（日内重复告警去重）
    const idx = list.findIndex((x) => x.code === a.code);
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);
    await kv.put(`notify:rollup:${bj.dateStr}`, JSON.stringify(list.slice(-30)), {
      expirationTtl: 172800,
    });
  } catch (e) {
    console.error("[notify] appendRollup failed:", e);
  }
}

async function clearRollup(env: Env, dateStr: string): Promise<void> {
  try {
    await env.DRAFTS?.delete(`notify:rollup:${dateStr}`);
  } catch {
    /* ignore */
  }
}

/**
 * 发送一条异常告警。
 * V5.83：🟡 警告改为写入日内汇总（随当日唯一一封日报呈现，不再单独发信）；
 *        🔴 高危保留即时发信（6h 冷却）并同步落汇总留档。
 * 返回 sent / cooled / skipped / rolled。永不抛错。
 */
export async function sendAlert(
  env: Env,
  a: AlertInput,
): Promise<"sent" | "cooled" | "skipped" | "rolled"> {
  try {
    if (a.level === "warn") {
      await appendRollup(env, a);
      return "rolled";
    }
    await appendRollup(env, a);
    const ttl = 6 * 3600;
    const key = `notify:alert:${a.level}:${a.code}`;
    if (await checkCooldown(env, key)) return "cooled";
    const bj = beijing();
    const tag = "🔴 高危";
    const subject = `【Aromiso AI 高危】${a.title}｜${bj.label}`;
    const rows = a.lines
      .map(
        (l) =>
          `<div style="margin:0 0 6px;font-size:14px;color:#333;line-height:1.6;">· ${esc(l)}</div>`,
      )
      .join("");
    const html = `
<p style="margin:0 0 12px;font-size:14px;color:#333;"><strong>异常等级：${tag}</strong></p>
<div style="margin:0 0 12px;padding:10px 14px;background:#fff7ed;border-left:4px solid #dc2626;border-radius:4px;">
${rows}
</div>
<p style="margin:0 0 4px;font-size:13px;color:#666;">发生时间：${bj.dateStr} ${bj.timeLabel}（北京时间）</p>
<p style="margin:0 0 4px;font-size:13px;color:#666;">是否需要人工介入：${a.needHuman ? "<strong style='color:#dc2626;'>是</strong>" : "否（系统继续运行 / 已按预案处理）"}</p>
<p style="margin:12px 0 0;font-size:12px;color:#999;">本邮件由 Aromiso AI 心跳层自动生成（同类高危 6 小时内不重复发送）。🟡 一般警告自 V5.83 起已并入每日日报统一呈现，不再单独发信。详情：后台 /admin/command-center</p>`;
    const r = await sendSystemEmail(env, subject, html);
    if (!r.ok) return "skipped"; // 发送失败不消耗冷却额度，下次触发可重试
    await commitCooldown(env, key, ttl);
    return "sent";
  } catch (e) {
    console.error("[notify] sendAlert failed:", e);
    return "skipped";
  }
}

/**
 * 流水线自检告警：在 cron-pull / os-daily 收尾处调用。
 * 从结构化日志推导异常，绝不依赖 AI 自报：
 *   ① 今日 blocked Mission（按类型去重告警）；
 *   ② 同类 Mission 48h 内失败 ≥3 次 → 升级 🔴；
 *   ③ 今日真实性闸拦截（fact_check_result='blocked'）→ 🔴；
 *   ④ Action Budget 日写入触顶 → 🟡；
 *   ⑤ 健康分 < 60（RED，统一分档 85/60，来源 ai_daily_report）→ 🟡；
 *   ⑥ 恢复状态机（V5.415 P1-2A）：已恢复模块的陈旧失败不再告警，只补一次「已恢复」。
 */
export async function evaluatePipelineAlerts(
  env: Env,
  db: D1Database | undefined,
  source: string,
): Promise<void> {
  if (!db) return;
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const { start: dayStart } = utcDayRange(todayStr);

    // ① + ② blocked missions
    try {
      const rows = (
        await db
          .prepare(
            `SELECT mission_type, agent_name, blocked_reason, error_message, created_at
             FROM ai_missions WHERE status = 'blocked' AND created_at >= ?
             ORDER BY created_at DESC LIMIT 30`,
          )
          .bind(dayStart - 86400)
          .all()
      ).results as D1Row[];
      const byType = new Map<string, D1Row[]>();
      for (const r of rows) {
        const t = String(r.mission_type || "unknown");
        if (!byType.has(t)) byType.set(t, []);
        byType.get(t)!.push(r);
      }
      for (const [type, list] of byType) {
        const today = list.filter((r) => Number(r.created_at) >= dayStart);
        const latest = list[0];
        const reason = String(latest.blocked_reason || latest.error_message || "未知异常");

        // ---- V5.415（P1-2A）恢复状态机：FAIL → ALERT → RECOVERED → 清算 ----
        // 该类型最近一次 mission 若在最后一次失败之后已 completed，则历史失败视为清算：
        // 不再发送陈旧告警（杜绝「GA4 已恢复 200 却仍报连续失败 6 次」）；
        // 之前发过告警的类型补发一次「已恢复」邮件（24h 去重，只发一次）。
        let recovered = false;
        try {
          const latestAny = await db
            .prepare(
              `SELECT status, created_at FROM ai_missions
               WHERE mission_type = ? AND created_at >= ?
               ORDER BY created_at DESC LIMIT 1`,
            )
            .bind(type, dayStart - 86400)
            .first<D1Row>();
          const lastBlockedAt = Math.max(...list.map((r) => Number(r.created_at || 0)));
          if (
            latestAny &&
            latestAny.status === "completed" &&
            Number(latestAny.created_at) > lastBlockedAt
          ) {
            recovered = true;
          }
        } catch {
          /* 恢复检查失败 → 按未恢复走原告警逻辑（宁可重复告警，不可漏报） */
        }

        if (recovered) {
          try {
            const kv = env.DRAFTS;
            if (kv && (await kv.get(`notify:alerted:${type}`))) {
              const recKey = `notify:alert:recovered:${type}`;
              if (!(await checkCooldown(env, recKey))) {
                /* 24h 内已发过恢复通知，跳过 */
              } else {
                const bj = beijing();
                const rr = await sendSystemEmail(
                  env,
                  `【Aromiso AI 恢复】${type} 已恢复正常｜${bj.label}`,
                  `
<p style="margin:0 0 12px;font-size:14px;color:#333;"><strong>之前告警的异常模块已恢复。</strong></p>
<div style="margin:0 0 12px;padding:10px 14px;background:#f0fdf4;border-left:4px solid #16a34a;border-radius:4px;">
  <div style="margin:0 0 6px;font-size:14px;color:#333;line-height:1.6;">· 模块：${esc(type)} 最近一次运行已正常完成（completed）</div>
  <div style="margin:0 0 6px;font-size:14px;color:#333;line-height:1.6;">· 历史失败计数已清算，后续不再就该故障重复告警</div>
  <div style="font-size:14px;color:#333;line-height:1.6;">· 无需 owner 操作</div>
</div>
<p style="margin:0 0 4px;font-size:13px;color:#666;">恢复确认时间：${bj.dateStr} ${bj.timeLabel}（北京时间）</p>
<p style="margin:12px 0 0;font-size:12px;color:#999;">本邮件由 Aromiso AI 心跳层自动生成（每类恢复通知 24 小时内只发一次）。详情：后台 /admin/command-center</p>`,
                );
                if (rr.ok) {
                  await commitCooldown(env, recKey, 24 * 3600);
                  try {
                    await kv.delete(`notify:alerted:${type}`);
                  } catch {
                    /* 标记删除失败仅可能导致下次再发一封恢复通知（有 24h 冷却兜底） */
                  }
                }
              }
            }
          } catch {
            /* 恢复通知失败不影响主流程 */
          }
          continue; // 已恢复 → 跳过该类型的全部陈旧告警
        }

        let result: "sent" | "cooled" | "skipped" | "rolled" = "skipped";
        if (list.length >= 3) {
          result = await sendAlert(env, {
            level: "critical",
            code: `repeat:${type}`,
            title: `${type} 连续失败 ${list.length} 次`,
            lines: [
              `模块：${type}（${latest.agent_name || "未知角色"}）`,
              `最近原因：${reason.slice(0, 300)}`,
              `48 小时内累计失败 ${list.length} 次（今日 ${today.length} 次）`,
              `来源：${source}`,
            ],
            needHuman: true,
          });
        } else if (today.length > 0) {
          result = await sendAlert(env, {
            level: "warn",
            code: `blocked:${type}`,
            title: `${type} 阶段出现异常`,
            lines: [
              `模块：${type}（${latest.agent_name || "未知角色"}）`,
              `原因：${reason.slice(0, 300)}`,
              `今日累计 ${today.length} 次；其余阶段不受影响，系统继续运行`,
              `来源：${source}`,
            ],
          });
        }
        // V5.415（P1-2A）：记录「该类型已发过告警」标记——恢复后据此发一次「已恢复」。
        // V5.83：仅对真正「已发信」的告警打标记。🟡 warn 现在走日内汇总（rolled）
        // 不发邮件，因此不打标记 → 也就不会产生对应的「已恢复」邮件（用户本就没
        // 收到失败邮件，再发「已恢复」只会增加噪音）；当前状态由日报实时呈现。
        // 🔴 critical 仍 sent → 标记照常，恢复通知链路不变。请勿把 rolled 并入此处。
        if (result === "sent") {
          try {
            if (env.DRAFTS)
              await env.DRAFTS.put(`notify:alerted:${type}`, String(Date.now()), {
                expirationTtl: 7 * 86400,
              });
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* 子查询失败不影响其它告警 */
    }

    // ③ 今日真实性闸拦截
    try {
      const fact = await db
        .prepare(
          `SELECT COUNT(*) AS n FROM ai_action_logs
           WHERE created_at >= ? AND fact_check_result = 'blocked'`,
        )
        .bind(dayStart)
        .first<D1Row>();
      const n = Number(fact?.n || 0);
      if (n > 0) {
        const sample = await db
          .prepare(
            `SELECT error_message FROM ai_action_logs
             WHERE created_at >= ? AND fact_check_result = 'blocked'
             ORDER BY created_at DESC LIMIT 1`,
          )
          .bind(dayStart)
          .first<D1Row>();
        await sendAlert(env, {
          level: "critical",
          code: "truthfulness",
          title: `真实性闸拦截 ${n} 次`,
          lines: [
            `AI 产出触发真实性红线，已被系统阻止（未进入任何对外渠道）`,
            `今日累计 ${n} 次；最近一次：${String(sample?.error_message || "").slice(0, 300)}`,
            `当前生产环境安全，无需紧急操作；建议有空时查看拦截详情`,
          ],
          needHuman: false,
        });
      }
    } catch {
      /* ignore */
    }

    // ④ Action Budget 触顶
    try {
      const cfg = await getActionBudgetConfig(env.DRAFTS);
      const usage = await getBudgetUsage(db, todayStr);
      if (usage.ok && usage.production_write_attempts >= cfg.daily_production_writes) {
        await sendAlert(env, {
          level: "warn",
          code: "budget_cap",
          title: "Action Budget 日写入已达上限",
          lines: [
            `今日生产写入尝试 ${usage.production_write_attempts} 次，已达上限 ${cfg.daily_production_writes}`,
            `超出部分自动降级为人工审核任务，不影响发现与记录`,
          ],
        });
      }
    } catch {
      /* ignore */
    }

    // ⑤ Health Score RED（<60）→ 🟡 警告
    // V5.415（P1-4）：健康分唯一事实源 = ai_daily_report.health_score；
    // 统一分档 ≥85 GREEN / 60–84 YELLOW / <60 RED，废弃旧的独立阈值 80。
    // YELLOW 不告警（日报中可见）；重大故障按事件等级（blocked/真实性闸）单独告警。
    try {
      const rep = await db
        .prepare(`SELECT health_score FROM ai_daily_report WHERE report_date = ?`)
        .bind(todayStr)
        .first<D1Row>();
      if (rep?.health_score != null && Number(rep.health_score) < 60) {
        // V5.69：RED 告警不再只丢一个数字——附「失败信号分桶」诊断，让 owner
        // 一眼看出这次红是自有故障(system/true_fail)、外部依赖(external)，还是
        // 慢成功误杀/假失败(slow_success/false_fail)。诊断失败绝不阻断告警本身。
        const diagLines: string[] = [];
        try {
          const b = await classifyHealthBuckets(db, 7);
          if (b) {
            diagLines.push(b.summary);
            const t = b.totals;
            diagLines.push(
              `分桶(近7天)：自有故障 system ${t.system}｜真实失败 true_fail ${t.true_fail}｜外部依赖 external ${t.external}｜慢成功 slow_success ${t.slow_success}｜假失败 false_fail ${t.false_fail}`,
            );
            // 优先把「我方可修」的桶样例顶到前面
            const ownFaults = [...b.examples.system, ...b.examples.true_fail].slice(0, 3);
            if (ownFaults.length > 0) diagLines.push(`需优先排查：${ownFaults.join(" ｜ ")}`);
            else if (b.clean_of_own_faults)
              diagLines.push(
                `无 system/true_fail 信号：本次 RED 由外部依赖或清理产物导致，先核对 GA4/GSC/邮件/AI 密钥与权限，不必紧急改代码`,
              );
            // PHASE E：附调参/排查建议（仅建议，系统绝不自动改阈值/配置）
            for (const adv of b.advisories.slice(0, 3)) diagLines.push(`建议：${adv}`);
          }
        } catch {
          /* 诊断层失败不阻断告警 */
        }
        await sendAlert(env, {
          level: "warn",
          code: "health_low",
          title: `AI 健康分 ${Number(rep.health_score)}，进入 RED 区间（<60）`,
          lines: [
            `今日健康分 ${Number(rep.health_score)}/100（统一分档：≥85 GREEN｜60–84 YELLOW｜<60 RED，来源 ai_daily_report）`,
            ...(diagLines.length > 0
              ? diagLines
              : [`常见原因：任务失败增多 / 真实性拦截 / 数据源中断，详见后台 Command Center`]),
            `系统仍在运行；若明日回到 60 以上则不再重复告警`,
          ],
        });
      }
    } catch {
      /* ignore */
    }
  } catch (e) {
    console.error("[notify] evaluatePipelineAlerts failed:", e);
  }
}

// ---- 🟢 每日运行日报（心跳） ------------------------------------------------

/**
 * V5.41：查询某日日报是否已成功发送（供 cron-pull 兜底检测）。
 * 注意：V5.41 起幂等键升级为 notify:digest:v2:<date>，且只在【发送成功后】写入——
 * 发信失败不再占用名额（旧版先占位后发信，失败会导致当天日报永久缺席）。
 * V5.411：键的日期为【北京时间日期】（与邮件标题一致），传入 dateStr 须按北京日期。
 */
export async function wasDigestSent(env: Env, dateStr: string): Promise<boolean> {
  try {
    const kv = env.DRAFTS;
    if (!kv) return false;
    return Boolean(await kv.get(`notify:digest:v2:${dateStr}`));
  } catch {
    return false;
  }
}

/**
 * 生成并发送中文 AI 运行日报。每天最多一封（KV 幂等键 notify:digest:v2:<北京日期>，
 * 发送成功后才写入，失败不占位、下次触发自动重试）。
 * dateStr 为统计窗口（UTC 日，与 ai_daily_report 一致）；邮件展示与幂等键均用北京时间
 * （V5.411：键随北京日期走，白天手工补发不占当晚定时发送名额）。
 *
 * V5.415（P1-2B）邮件三态：
 *   🟢 SYSTEM_HEALTHY  —— 日报主表存在，正常发送日报；
 *   🟡 REPORT_DEGRADED —— 日报主表缺失 / generateDailyReport 失败（genState.reportOk=false）：
 *                         只发【Aromiso AI 报表异常】，绝不发「运行正常」；
 *   🔴 SYSTEM_ALERT    —— 真实性拦截 / blocked≥3 等事件级异常（由 evaluatePipelineAlerts 负责）。
 * genState 由调用方（os-daily auditor / cron-pull 兜底）传入报告生成的真实结果。
 */
export async function sendDailyDigest(
  env: Env,
  db: D1Database | undefined,
  dateStr: string,
  genState?: {
    reportOk: boolean;
    reportErr?: string;
    // S36：7 天上下文聚合是否成功；contextOk=false 表示日报缺乏证据，须降级（🟡）。
    contextOk?: boolean;
    contextErr?: string;
  },
): Promise<{ sent: boolean; reason?: string; degraded?: boolean }> {
  try {
    if (!db) return { sent: false, reason: "DB 不可用" };
    // V5.411：幂等键改用【北京时间日期】（与邮件标题日期一致）。日报在北京时间 07:00
    // 送达、标题按北京日期展示，键随北京日期走：白天手工补发不会占用当晚 23:00 UTC
    // 定时发送的名额（两者北京日期不同），一天一封的语义与 owner 看到的日期对齐。
    const bj = beijing();
    if (await wasDigestSent(env, bj.dateStr))
      return { sent: false, reason: "今日已发送（幂等跳过）" };

    const { start: dayStart, end: dayEnd } = utcDayRange(dateStr);

    // ---- 日报主表 ----
    const report = await db
      .prepare(`SELECT * FROM ai_daily_report WHERE report_date = ?`)
      .bind(dateStr)
      .first<D1Row>();

    // ---- V5.415（P1-2B）REPORT_DEGRADED + S36 CONTEXT_DEGRADED：报告/上下文失败 ≠ 运行正常 ----
    // 报告行缺失、报告生成失败，或 7 天上下文聚合失败 → 发「报表异常」🟡 邮件。
    // 禁止用全 0 或无证据兜底伪装成「运行正常 🟢」（2026-08-17 事故：0038 漏迁移时照发「完成 0 项·运行正常」）。
    const reportFailed = !report || (genState ? !genState.reportOk : false);
    const contextFailed = genState ? genState.contextOk === false : false;
    if (reportFailed || contextFailed) {
      // S36：区分「日报本身生成失败」与「日报生成了但缺乏证据上下文（context:none）」，文案如实反映。
      const headline = reportFailed
        ? "今日 AI 运行日报（ai_daily_report）生成失败，本封邮件替代正常日报"
        : "7 天上下文聚合失败（GSC/GA/行为/询盘读取异常），日报缺乏证据支撑，已标记降级（context:none）";
      const errInfo = reportFailed
        ? genState?.reportErr
          ? String(genState.reportErr).slice(0, 300)
          : `ai_daily_report 中不存在 ${dateStr} 的报告行`
        : String(genState?.contextErr || "unknown").slice(0, 300);
      const subject = `【Aromiso AI 报表异常】${bj.label}｜${reportFailed ? "日报生成失败" : "上下文聚合失败"}（REPORT_DEGRADED）`;
      const html = `
<p style="margin:0 0 12px;font-size:14px;color:#333;"><strong>系统状态：🟡 REPORT_DEGRADED（报表降级）</strong></p>
<div style="margin:0 0 12px;padding:10px 14px;background:#fff7ed;border-left:4px solid #d97706;border-radius:4px;">
  <div style="margin:0 0 6px;font-size:14px;color:#333;line-height:1.6;">· ${headline}</div>
  <div style="margin:0 0 6px;font-size:14px;color:#333;line-height:1.6;">· 失败信息：${esc(errInfo)}</div>
  <div style="margin:0 0 6px;font-size:14px;color:#333;line-height:1.6;">· 邮件通道与主流程本身正常（能收到本邮件即为证明），其余模块不受影响、继续运行</div>
  <div style="font-size:14px;color:#333;line-height:1.6;">· 系统已记录该异常；若明日日报恢复正常将不再提示</div>
</div>
<p style="margin:0 0 4px;font-size:13px;color:#666;">统计窗口：${esc(dateStr)}（UTC）· 发送时间：${bj.dateStr} ${bj.timeLabel}（北京时间）</p>
<p style="margin:12px 0 0;font-size:12px;color:#999;">三级邮件体系：🟢 日报（SYSTEM_HEALTHY）· 🟡 报表异常/警告（REPORT_DEGRADED）· 🔴 高危（SYSTEM_ALERT）。详情：后台 /admin/command-center</p>`;
      const r = await sendSystemEmail(env, subject, html);
      if (!r.ok) return { sent: false, reason: r.error };
      try {
        if (env.DRAFTS)
          await env.DRAFTS.put(`notify:digest:v2:${bj.dateStr}`, String(Date.now()), {
            expirationTtl: 172800,
          });
      } catch {
        /* 写键失败最多导致当天多补一封 */
      }
      return { sent: true, degraded: true };
    }

    const total = Number(report?.total_missions || 0);
    const completed = Number(report?.completed_missions || 0);
    const skipped = Number(report?.skipped_missions || 0);
    const blocked = Number(report?.blocked_missions || 0);
    const approvals = Number(report?.human_reviewed || 0);
    const autoExec = Number(report?.auto_executions || 0);
    const factViolations = Number(report?.factual_violations || 0);
    const warnings = Number(report?.warnings_generated || 0);
    const healthScore = report?.health_score != null ? Number(report.health_score) : null;
    const cny = Number(report?.total_cost_usd || 0) * 7.1; // 报表存 USD，展示人民币

    let riskAlerts: string[] = [];
    try {
      riskAlerts = JSON.parse(String(report?.risk_alerts || "[]")) as string[];
    } catch {
      riskAlerts = [];
    }

    // ---- 今日 Mission 分组（做了什么） ----
    type GroupInfo = { agent: string; count: number; ok: number; bad: number; summary: string };
    const groups = new Map<string, GroupInfo>();
    try {
      const missions = (
        await db
          .prepare(
            `SELECT mission_type, agent_name, status, output_summary FROM ai_missions
             WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC LIMIT 200`,
          )
          .bind(dayStart, dayEnd)
          .all()
      ).results as D1Row[];
      for (const m of missions) {
        const key = String(m.mission_type || "unknown");
        if (!groups.has(key))
          groups.set(key, {
            agent: String(m.agent_name || ""),
            count: 0,
            ok: 0,
            bad: 0,
            summary: "",
          });
        const g = groups.get(key)!;
        g.count++;
        if (m.status === "completed") g.ok++;
        if (m.status === "blocked") g.bad++;
        if (!g.summary && m.status === "completed" && m.output_summary)
          g.summary = String(m.output_summary).slice(0, 160);
      }
    } catch {
      /* ignore */
    }

    // ---- 今日新发现（growth 机会 top5） ----
    let findings: D1Row[] = [];
    try {
      findings = (
        await db
          .prepare(
            `SELECT opp_type, page, query, reason, priority FROM growth_opportunities
             WHERE created_at >= ? AND created_at < ? ORDER BY id DESC LIMIT 5`,
          )
          .bind(dayStart, dayEnd)
          .all()
      ).results as D1Row[];
    } catch {
      /* ignore */
    }

    // ---- 明日计划 ----
    let planItems: { type?: string; agent?: string; desc?: string }[] = [];
    try {
      const tomorrow = new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + 86400000)
        .toISOString()
        .slice(0, 10);
      const plan = await db
        .prepare(
          `SELECT planned_missions FROM ai_mission_plan
           WHERE plan_date = ? AND horizon_type = 'tomorrow' ORDER BY updated_at DESC LIMIT 1`,
        )
        .bind(tomorrow)
        .first<D1Row>();
      if (plan?.planned_missions) planItems = JSON.parse(String(plan.planned_missions));
    } catch {
      planItems = [];
    }

    // ---- 📈 网站增长 KPI：最新 GSC 数据日 vs 7 天前（V5.41，owner 定的日报核心板块） ----
    // 口径：gsc_daily page 维度 = 全站曝光/点击/排名；query 维度拆分非品牌/商业意图；
    //       inquiries = Search→Inquiry 最高优先级指标（近 7 天滚动窗口）。
    type DayKpi = {
      impressions: number;
      clicks: number;
      position: number;
      nonBrand: number;
      commercial: number;
    };
    const kpiByDate = new Map<string, DayKpi>();
    let latestGscDate = "";
    const shiftDate = (ds: string, days: number) =>
      new Date(new Date(`${ds}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
    try {
      const pageRows = (
        await db
          .prepare(
            `SELECT date, SUM(impressions) AS im, SUM(clicks) AS cl, AVG(position) AS pos
             FROM gsc_daily WHERE dimension = 'page'
             GROUP BY date ORDER BY date DESC LIMIT 12`,
          )
          .all()
      ).results as D1Row[];
      for (const r of pageRows) {
        const d = String(r.date);
        kpiByDate.set(d, {
          impressions: Number(r.im || 0),
          clicks: Number(r.cl || 0),
          position: Number(r.pos || 0),
          nonBrand: 0,
          commercial: 0,
        });
        if (d > latestGscDate) latestGscDate = d;
      }
    } catch {
      /* ignore */
    }
    const inquiriesByDate = new Map<string, number>();
    if (latestGscDate) {
      try {
        const cutoff = shiftDate(latestGscDate, -14);
        const qRows = (
          await db
            .prepare(
              `SELECT date, key, clicks FROM gsc_daily
               WHERE dimension = 'query' AND date >= ? ORDER BY date DESC LIMIT 3000`,
            )
            .bind(cutoff)
            .all()
        ).results as D1Row[];
        for (const r of qRows) {
          const g = kpiByDate.get(String(r.date));
          if (!g) continue;
          const cl = Number(r.clicks || 0);
          const q = String(r.key || "");
          if (!/aromiso/i.test(q)) g.nonBrand += cl;
          if (classifyIntent(q) === "commercial") g.commercial += cl;
        }
        const iRows = (
          await db
            .prepare(
              `SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n FROM inquiries
               WHERE substr(created_at, 1, 10) >= ? GROUP BY d`,
            )
            .bind(cutoff)
            .all()
        ).results as D1Row[];
        for (const r of iRows) inquiriesByDate.set(String(r.d), Number(r.n || 0));
      } catch {
        /* ignore */
      }
    }
    // 对比基期 = 最新数据日往前 7 天（允许 ±3 天数据缺口，缺则显示「—」）
    let baseGscDate = "";
    if (latestGscDate) {
      const target = shiftDate(latestGscDate, -7);
      const candidates = [...kpiByDate.keys()]
        .filter((d) => d <= target)
        .sort()
        .reverse();
      if (candidates[0] && candidates[0] >= shiftDate(target, -3)) baseGscDate = candidates[0];
    }
    const inqWindow = (endInclusive: string) => {
      let sum = 0;
      for (let i = 0; i < 7; i++) sum += inquiriesByDate.get(shiftDate(endInclusive, -i)) || 0;
      return sum;
    };

    // ---- 需要留意的事项（与指挥中心「需要你确认」同口径） ----
    let pendingHuman = 0;
    try {
      const p = await db
        .prepare(
          `SELECT (SELECT COUNT(*) FROM growth_opportunities WHERE status='new' AND exec_level IN ('B','C'))
                  + (SELECT COUNT(*) FROM tasks WHERE status='pending' AND execution_mode IN ('L2','L4')) AS n`,
        )
        .first<D1Row>();
      pendingHuman = Number(p?.n || 0);
    } catch {
      /* ignore */
    }

    // ---- V5.83：日内告警汇总（🟡 随日报呈现；读今昨两桶防跨发送点丢事件） ----
    const bjNow = beijing();
    const rollupMap = new Map<string, RolledAlert>();
    for (const bucket of [
      await readRollup(env, bjNow.dateStr),
      await readRollup(env, shiftDate(bjNow.dateStr, -1)),
    ]) {
      for (const item of bucket) rollupMap.set(item.code, item);
    }
    const rollupList = [...rollupMap.values()].sort((a, b) => b.ts - a.ts);

    // ---- V5.83：今日询盘（contact-page + email-inbound，最高优先级指标落地） ----
    let todayInquiries: D1Row[] = [];
    try {
      todayInquiries = (
        await db
          .prepare(
            `SELECT name, email, product, source, status FROM inquiries
             WHERE substr(created_at, 1, 10) = ? ORDER BY created_at DESC LIMIT 10`,
          )
          .bind(dateStr)
          .all()
      ).results as D1Row[];
    } catch {
      /* ignore */
    }

    // ---- 预算用量 ----
    let budgetLine = "统计不可用（不影响运行）";
    try {
      const cfg = await getActionBudgetConfig(env.DRAFTS);
      const usage = await getBudgetUsage(db, dateStr);
      if (usage.ok) {
        const pct = Math.min(
          100,
          Math.round((usage.production_write_attempts / cfg.daily_production_writes) * 100),
        );
        budgetLine = `${usage.production_write_attempts}/${cfg.daily_production_writes} 次生产写入（${pct}%）`;
      }
    } catch {
      /* ignore */
    }

    // ---- 各角色状态（心跳表用） ----
    const roleLine =
      [...groups.values()]
        .map((g) => `${esc(g.agent || "unknown")}${g.bad > 0 ? "🟡" : "✅"}×${g.count}`)
        .join(" · ") || "今日暂无角色运行记录";

    // ---- 📈 KPI 表 HTML（指标 / 最新 / 较 7 天前） ----
    const changeHtml = (
      cur: number,
      base: number | null,
      lowerBetter = false,
      pct = true,
    ): string => {
      if (base == null) return `<span style="color:#999;">—</span>`;
      const delta = cur - base;
      if (Math.abs(delta) < 1e-9) return `<span style="color:#999;">持平</span>`;
      const good = lowerBetter ? delta < 0 : delta > 0;
      const color = good ? "#16a34a" : "#dc2626";
      let text: string;
      if (lowerBetter) {
        text = `${delta > 0 ? "+" : ""}${delta.toFixed(1)} 位`;
      } else if (pct) {
        text =
          base !== 0
            ? `${delta > 0 ? "+" : ""}${((delta / Math.abs(base)) * 100).toFixed(1)}%`
            : `${delta > 0 ? "+" : ""}${delta.toFixed(0)}`;
      } else {
        text = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
      }
      return `<span style="color:${color};font-weight:600;">${text}</span>`;
    };
    const kpiHtml = (() => {
      if (!latestGscDate)
        return `<div style="font-size:13px;color:#888;">GSC 暂无数据（NO_DATA：尚未同步，不影响其它板块）。</div>`;
      const cur = kpiByDate.get(latestGscDate)!;
      const base = baseGscDate ? kpiByDate.get(baseGscDate) || null : null;
      const curCtr = cur.impressions > 0 ? cur.clicks / cur.impressions : 0;
      const baseCtr = base && base.impressions > 0 ? base.clicks / base.impressions : null;
      const inqCur = inqWindow(latestGscDate);
      const inqBase = baseGscDate ? inqWindow(baseGscDate) : null;
      // V5.415（P1-5）：四态口径标注——query 维度 0 ≠ 真实的 0；数据日过旧 = 源延迟（PENDING）
      const queryDimZero = cur.nonBrand === 0 && cur.commercial === 0;
      const staleDays = Math.floor(
        (new Date(`${dateStr}T00:00:00Z`).getTime() -
          new Date(`${latestGscDate}T00:00:00Z`).getTime()) /
          86400000,
      );
      const row = (label: string, todayCell: string, changeCell: string, emphasize = false) =>
        `<tr>
          <td style="padding:5px 12px 5px 0;font-size:13px;color:${emphasize ? "#111" : "#555"};${emphasize ? "font-weight:600;" : ""}white-space:nowrap;">${esc(label)}</td>
          <td style="padding:5px 14px 5px 0;font-size:13px;color:#111;font-weight:600;text-align:right;">${todayCell}</td>
          <td style="padding:5px 0;font-size:13px;text-align:right;">${changeCell}</td>
        </tr>`;
      return `<div style="font-size:12px;color:#888;margin:0 0 6px;">数据日：${esc(latestGscDate)}（Google 数据延迟约 2 天）· 对比基期：${baseGscDate ? esc(baseGscDate) : "暂无（数据积累中）"}</div>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:480px;">
        <tr style="border-bottom:1px solid #e5e7eb;">
          <th style="padding:4px 12px 4px 0;font-size:12px;color:#999;text-align:left;font-weight:500;">指标</th>
          <th style="padding:4px 14px 4px 0;font-size:12px;color:#999;text-align:right;font-weight:500;">最新</th>
          <th style="padding:4px 0;font-size:12px;color:#999;text-align:right;font-weight:500;">较 7 天前</th>
        </tr>
        ${row("曝光 Impressions", cur.impressions.toLocaleString(), changeHtml(cur.impressions, base ? base.impressions : null))}
        ${row("点击 Clicks", cur.clicks.toLocaleString(), changeHtml(cur.clicks, base ? base.clicks : null))}
        ${row("点击率 CTR", `${(curCtr * 100).toFixed(1)}%`, changeHtml(curCtr, baseCtr))}
        ${row("平均排名（越低越好）", cur.position.toFixed(1), changeHtml(cur.position, base ? base.position : null, true, false))}
        ${row("非品牌点击（陌生客户）", cur.nonBrand.toLocaleString(), changeHtml(cur.nonBrand, base ? base.nonBrand : null))}
        ${row("商业意图点击（B2B 采购词）", cur.commercial.toLocaleString(), changeHtml(cur.commercial, base ? base.commercial : null))}
        ${row("询盘 Search→Inquiry（近7天）★", String(inqCur), changeHtml(inqCur, inqBase), true)}
      </table>
      <div style="font-size:12px;color:#888;margin-top:6px;">★ 最高优先级指标：让潜在客户找到 Aromiso 并发出询盘。</div>
      ${queryDimZero ? `<div style="font-size:12px;color:#d97706;margin-top:4px;">⚠ 口径标注：非品牌/商业点击按 query 维度拆分——低流量下 Google 对 query 维度 clicks 有隐私阈值（QUERY_DIMENSION_LIMITATION），0 是「无数据 NO_DATA」而非「真实的 0」；全站真实点击以 page 维度「点击 Clicks」行为准。</div>` : ""}
      ${staleDays > 4 ? `<div style="font-size:12px;color:#d97706;margin-top:4px;">⚠ GSC 数据延迟（PENDING）：最新数据日 ${esc(latestGscDate)} 落后报告日 ${staleDays} 天，以上数字为旧数据，非今日实况。</div>` : ""}`;
    })();

    // ---- 状态判定（V5.415 P1-4：健康分统一分档 ≥85 GREEN / 60–84 YELLOW / <60 RED） ----
    // 本分支走到这里说明报告行存在 → 🟢 SYSTEM_HEALTHY 或轻微波动；
    // REPORT_DEGRADED 已在上方单独处理，事件级 🔴 由 evaluatePipelineAlerts 单独发信。
    let statusTag = "🟢 运行正常";
    let statusColor = "#16a34a";
    if (factViolations > 0 || blocked >= 3) {
      statusTag = "🔴 有异常需留意";
      statusColor = "#dc2626";
    } else if (blocked > 0 || riskAlerts.length > 0 || (healthScore != null && healthScore < 60)) {
      statusTag = "🟡 有轻微波动";
      statusColor = "#d97706";
    }
    const subject = `【Aromiso AI日报】${bj.label}｜${statusTag.replace(/^[^\s]+\s/, "")}｜完成 ${completed} 项任务`;

    // ---- HTML 拼装 ----
    const kvRow = (k: string, v: string, color?: string) =>
      `<tr><td style="padding:4px 14px 4px 0;font-size:13px;color:#666;white-space:nowrap;">${esc(k)}</td>
       <td style="padding:4px 0;font-size:13px;color:${color || "#111"};font-weight:600;">${v}</td></tr>`;

    const groupRows = [...groups.entries()]
      .map(([type, g]) => {
        const badge = g.bad > 0 ? `<span style="color:#d97706;">（${g.bad} 次异常）</span>` : "";
        return `<div style="margin:0 0 8px;font-size:14px;color:#333;line-height:1.6;">
          <strong>${esc(g.agent || type)}</strong> ×${g.count}${badge}
          ${g.summary ? `<div style="font-size:12px;color:#888;margin-top:2px;">${esc(g.summary)}</div>` : ""}
        </div>`;
      })
      .join("");

    const findingRows = findings.length
      ? findings
          .map(
            (f) => `<div style="margin:0 0 6px;font-size:13px;color:#333;line-height:1.5;">
          · <strong>${esc(f.priority || "")}</strong> ${esc(f.opp_type || "")}${f.query ? `「${esc(f.query)}」` : ""} ${esc(f.page || "")}
          ${f.reason ? `<div style="font-size:12px;color:#888;">${esc(String(f.reason).slice(0, 120))}</div>` : ""}
        </div>`,
          )
          .join("")
      : `<div style="font-size:13px;color:#888;">今日无新发现（属正常情况，机会引擎每日持续扫描）。</div>`;

    const planRows = planItems.length
      ? planItems
          .map(
            (p, i) =>
              `<div style="margin:0 0 4px;font-size:13px;color:#333;">${i + 1}. ${esc(p.desc || p.type || "")} <span style="color:#999;">（${esc(p.agent || "")}）</span></div>`,
          )
          .join("")
      : `<div style="font-size:13px;color:#888;">标准每日循环：GSC/GA4 同步 → 分析 → 机会扫描 → 四角色日循环 → T+14 验证。</div>`;

    const riskBlock = riskAlerts.length
      ? `<div style="margin:12px 0 0;padding:10px 14px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;">
          ${riskAlerts
            .slice(0, 5)
            .map(
              (r) => `<div style="font-size:13px;color:#7f1d1d;margin:0 0 4px;">⚠ ${esc(r)}</div>`,
            )
            .join("")}
        </div>`
      : "";

    const conclusion =
      total === 0
        ? "今日无 AI 任务运行记录——请留意自动化触发链路是否正常（这封邮件本身说明邮件通道正常）。"
        : factViolations > 0 || blocked > 0 || pendingHuman > 0
          ? `今日有 ${blocked} 项被拦截/异常${pendingHuman > 0 ? `，后台另有 ${pendingHuman} 项待人工查看（不紧急）` : ""}。其余 ${completed} 项正常完成，系统继续自主运行。`
          : `今日 ${total} 项任务全部正常完成。系统无需人工干预，继续自主运行。`;

    const planFooter = `<div style="margin-top:6px;font-size:13px;color:#555;">预计明日：流水线 ${planItems.length > 0 ? `${planItems.length} 项计划任务` : "标准日循环"} · 当前待人工审核队列 ${pendingHuman} 项${pendingHuman > 0 ? "（不紧急，有空时看后台即可）" : "（今日没有需要人工处理的问题）"}</div>`;

    // ---- V5.83：⚠️ 需要关注（日内告警汇总板块；无告警时整块省略） ----
    const fmtRollupTime = (ts: number) => {
      const t = new Date(ts + 8 * 3600 * 1000);
      return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
    };
    const rollupBlock = rollupList.length
      ? `<h3 style="margin:18px 0 8px;font-size:14px;color:#b91c1c;">⚠️ 需要关注（今日 ${rollupList.length} 项）</h3>
        ${rollupList
          .slice(0, 10)
          .map((item) => {
            const critical = item.level === "critical";
            return `<div style="margin:0 0 6px;padding:8px 12px;background:${critical ? "#fef2f2" : "#fffbeb"};border-left:3px solid ${critical ? "#dc2626" : "#f59e0b"};border-radius:4px;">
              <div style="font-size:13px;color:#111;font-weight:600;">${critical ? "🔴" : "🟡"} ${esc(item.title)} <span style="color:#999;font-weight:400;">${fmtRollupTime(item.ts)}${item.needHuman ? " · 需人工介入" : ""}</span></div>
              ${(item.lines || [])
                .slice(0, 2)
                .map(
                  (l) =>
                    `<div style="font-size:12px;color:#666;margin-top:2px;">· ${esc(String(l).slice(0, 120))}</div>`,
                )
                .join("")}
            </div>`;
          })
          .join("")}
        <div style="font-size:12px;color:#999;margin-top:2px;">🟡 一般警告自 V5.83 起并入本日报呈现，不再单独发信；🔴 高危仍即时发送。</div>`
      : "";

    // ---- V5.83：📬 今日询盘板块 ----
    const SOURCE_BADGES: Record<string, string> = {
      "contact-page": "网站表单",
      "email-inbound": "客户邮件",
      "inbound-email": "客户邮件",
      "manual-outreach": "人工外联",
    };
    const inquiryBadge = (s: unknown) =>
      `<span style="display:inline-block;padding:0 6px;font-size:11px;border-radius:3px;background:${s === "contact-page" ? "#eef2ff;color:#4338ca;" : "#ecfdf5;color:#047857;"}">${esc(SOURCE_BADGES[String(s)] || String(s || "其他"))}</span>`;
    const inquiryRows = todayInquiries.length
      ? todayInquiries
          .map(
            (i) => `<div style="margin:0 0 6px;font-size:13px;color:#333;line-height:1.6;">
          · <strong>${esc(String(i.name || "未命名"))}</strong>
          <span style="color:#888;">${esc(String(i.email || ""))}</span>
          ${inquiryBadge(i.source)}
          ${i.status === "New" ? '<span style="color:#b45309;font-size:12px;">● 待跟进</span>' : '<span style="color:#16a34a;font-size:12px;">已联系</span>'}
          ${i.product ? `<div style="font-size:12px;color:#888;">意向：${esc(String(i.product).slice(0, 60))}</div>` : ""}
        </div>`,
          )
          .join("")
      : `<div style="font-size:13px;color:#888;">今日暂无新询盘。</div>`;

    const html = `
<p style="margin:0 0 14px;font-size:15px;color:#111;"><strong>今日系统状态：<span style="color:${statusColor};">${statusTag}</span></strong></p>

${rollupBlock}

<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;">
  ${kvRow(
    "AI 健康分（统一口径）",
    healthScore != null
      ? `${healthScore}/100 ${healthScore >= 85 ? "GREEN" : healthScore >= 60 ? "YELLOW" : "RED"}`
      : "数据不足",
    healthScore != null && healthScore < 60
      ? "#dc2626"
      : healthScore != null && healthScore < 85
        ? "#d97706"
        : undefined,
  )}
  ${kvRow("各角色状态", roleLine)}
  ${kvRow("今日 Mission", String(total))}
  ${kvRow("完成 / 跳过 / 拦截", `${completed} / ${skipped} / ${blocked}`, blocked > 0 ? "#d97706" : undefined)}
  ${kvRow("自动执行 / 待人工", `${autoExec} / ${approvals}`)}
  ${kvRow("真实性拦截 / 警告", `${factViolations} / ${warnings}`, factViolations > 0 ? "#dc2626" : undefined)}
  ${kvRow("今日动作预算", esc(budgetLine))}
  ${kvRow("AI 成本", `¥${cny.toFixed(2)}`)}
  ${kvRow("下次运行", "明日 06:00 起（北京时间，日报约 07:00 送达）")}
</table>

<h3 style="margin:18px 0 8px;font-size:14px;color:#111;">📈 一、网站增长</h3>
${kpiHtml}

<h3 style="margin:18px 0 8px;font-size:14px;color:#111;">二、AI 今天干了什么</h3>
${groupRows || `<div style="font-size:13px;color:#888;">今日无任务记录。</div>`}

<h3 style="margin:18px 0 8px;font-size:14px;color:#111;">今天最重要的发现</h3>
${findingRows}

<h3 style="margin:18px 0 8px;font-size:14px;color:#111;">📬 三、今日询盘（最高优先级）★</h3>
${inquiryRows}
<div style="font-size:12px;color:#999;margin-top:2px;">后台「询盘中心」可一键写邮件 / WhatsApp / Messenger 联系客户。</div>

<h3 style="margin:18px 0 8px;font-size:14px;color:#111;">四、AI 明天准备做什么</h3>
${planRows}
${planFooter}

${riskBlock}

<p style="margin:16px 0 0;font-size:14px;color:#111;"><strong>结论：</strong>${esc(conclusion)}</p>
${String(report?.ai_recommendation || "").trim() ? `<p style="margin:8px 0 0;font-size:13px;color:#555;">${esc(report?.ai_recommendation)}</p>` : ""}

<p style="margin:16px 0 0;font-size:12px;color:#999;">邮件体系（V5.83 起）：🟢 每日一封汇总日报（SYSTEM_HEALTHY，含增长 KPI / AI 工作 / 今日询盘 / 需要关注 / 明日计划，无异常也发）· 🟡 一般警告已并入日报「需要关注」板块，不再单独发信 · 🔴 高危（SYSTEM_ALERT：真实性红线 / 连续失败等）仍即时发送，6h 不重复 · 🟡 报表降级（REPORT_DEGRADED，日报本身故障时）仍即时发送作兜底。所有邮件均由系统规则从结构化日志生成，AI 不参与发信决策。详情：后台 /admin/command-center。直接回复本邮件不会触达 AI。</p>`;

    const r = await sendSystemEmail(env, subject, html);
    if (!r.ok) return { sent: false, reason: r.error };
    try {
      if (env.DRAFTS)
        await env.DRAFTS.put(`notify:digest:v2:${bj.dateStr}`, String(Date.now()), {
          expirationTtl: 172800,
        });
      // V5.83：消费清空今昨两桶告警汇总（发送成功后）
      await clearRollup(env, bjNow.dateStr);
      await clearRollup(env, shiftDate(bjNow.dateStr, -1));
    } catch {
      /* 写键失败不影响「已发送」事实，最多导致当天多补一封 */
    }
    return { sent: true };
  } catch (e) {
    console.error("[notify] sendDailyDigest failed:", e);
    return { sent: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
