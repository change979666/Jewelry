/**
 * automation-tick.mjs — V5.54 AI 自动化闭环主调度器（本机计划任务入口）
 *
 * 每 20 分钟由 Windows 计划任务调用（见 IMPLEMENTED_FEATURES V5.54 条目）：
 *   schtasks /Query /TN "Aromiso Automation Tick"
 *
 * 流程：POST /api/admin/v2/ai/automation 两次（triggers → worker），
 * 与 GH Actions 兜底（.github/workflows/ai-automation.yml）共用同一端点；
 * 幂等键 + 原子认领保证双调度不产生重复执行。
 *
 * 免费优先：本机零成本运行；GH 侧仅 6 小时兜底一次。
 *
 * P0-3 可见性：每次调用带 scheduler:"local"，端点据此写持久心跳
 *   （site_settings: scheduler:local_last_run），后台 Decision Inbox 展示
 *   「本机调度最后运行时间」；本机计划任务停摆（电脑关机）时该心跳变陈旧即可被检出。
 */
import { readFileSync, appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOG_DIR = join(ROOT, "logs");
const LOG_FILE = join(LOG_DIR, "automation-tick.log");
const BASE = "https://aromiso.pages.dev";

function readSecret() {
  const vars = readFileSync(join(ROOT, ".dev.vars"), "utf-8");
  const m = vars.match(/^CRON_SECRET=(.+)$/m);
  if (!m) throw new Error("CRON_SECRET missing in .dev.vars");
  return m[1].trim();
}

function log(line) {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  // 日志滚动：>2MB 归档一份
  try {
    if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > 2 * 1024 * 1024) {
      renameSync(LOG_FILE, LOG_FILE + ".1");
    }
  } catch {}
  appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`);
  console.log(line);
}

async function call(secret, mode) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 150_000);
  try {
    const r = await fetch(`${BASE}/api/admin/v2/ai/automation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AromisoAutomationTick/1.0",
      },
      body: JSON.stringify({ mode, scheduler: "local" }),
      signal: ctrl.signal,
    });
    const text = await r.text();
    let body = text;
    try {
      body = JSON.stringify(JSON.parse(text)).slice(0, 500);
    } catch {}
    return { status: r.status, body };
  } finally {
    clearTimeout(timer);
  }
}

const secret = readSecret();
let fail = false;
for (const mode of ["triggers", "worker"]) {
  try {
    const { status, body } = await call(secret, mode);
    // 524 = 边缘超时但函数可能仍在执行；有状态恢复，不算致命
    const ok = status >= 200 && status < 400 || status === 524;
    log(`mode=${mode} http=${status} ${ok ? "ok" : "FAIL"} ${body}`);
    if (!ok) fail = true;
  } catch (e) {
    log(`mode=${mode} ERROR ${String(e).slice(0, 200)}`);
    fail = true;
  }
}
process.exit(fail ? 1 : 0);
