/**
 * Start the local Aromiso Studio without requiring callers to remember the
 * external Studio path. Use `npm run studio:start -- --daemon` for the
 * watchdog launcher.
 */
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const studioRoot = process.env.AROMISO_STUDIO_ROOT || "D:\\aromiso-studio";
const daemon = process.argv.includes("--daemon");
const launcher = join(studioRoot, daemon ? "studio-daemon.bat" : "start-studio.bat");
const studioPort = Number(process.env.AROMISO_STUDIO_PORT || 8711);
const startupStatePath = join(tmpdir(), "aromiso-studio-startup.json");

function writeStartupState(status, detail) {
  try {
    writeFileSync(
      startupStatePath,
      JSON.stringify({ status, detail, updated_at: new Date().toISOString() }),
      "utf8",
    );
  } catch {
    // Diagnostics must never prevent the actual launcher from running.
  }
}

function fail(status, message) {
  writeStartupState(status, message);
  console.error(`status=${status}：${message}`);
  process.exit(1);
}

if (process.platform !== "win32") {
  fail("startup_failed", "Aromiso Studio 的启动器目前只支持 Windows。");
}

if (!existsSync(launcher)) {
  fail(
    "model_missing",
    `找不到 Studio 启动器：${launcher}。请设置 AROMISO_STUDIO_ROOT，或先安装 D:\\aromiso-studio。`,
  );
}

const modelsDir = join(studioRoot, "models");
if (!existsSync(modelsDir) || readdirSync(modelsDir).length === 0) {
  fail("model_missing", `找不到可用模型目录：${modelsDir}`);
}

function portIsListening(port) {
  const result = spawnSync("netstat.exe", ["-ano"], { encoding: "utf8", windowsHide: true });
  if (result.error || result.status !== 0) return false;
  return String(result.stdout || "")
    .split(/\r?\n/)
    .some((line) => line.includes(`:${port}`) && /LISTENING\s+\d+\s*$/.test(line));
}

async function probeHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`http://127.0.0.1:${studioPort}/healthz`, {
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

if (await probeHealth()) {
  writeStartupState("running", `Studio 已在 http://127.0.0.1:${studioPort} 提供服务。`);
  console.log(`status=running：Studio 已在 http://127.0.0.1:${studioPort} 提供服务。`);
  process.exit(0);
}
if (portIsListening(studioPort)) {
  fail("port_conflict", `${studioPort} 已被占用，但不是可用的 Studio。`);
}

const ollama = spawnSync("where.exe", ["ollama"], { encoding: "utf8", windowsHide: true });
console.log(`Ollama：${ollama.status === 0 ? "已安装（Studio 可按需使用）" : "未安装或不在 PATH（Studio 使用内置模型时可继续）"}`);
const gpu = spawnSync("nvidia-smi.exe", ["-L"], { encoding: "utf8", windowsHide: true });
if (gpu.status !== 0) {
  console.warn("status=gpu_unavailable：未检测到 NVIDIA GPU，Studio 可能退回 CPU 或启动失败。");
}

console.log(`启动 Aromiso Studio：${launcher}${daemon ? "（后台守护）" : ""}`);
const startupErrors = [];
const child = spawn("cmd.exe", ["/d", "/c", launcher], {
  cwd: studioRoot,
  detached: daemon,
  stdio: daemon ? "ignore" : ["ignore", "inherit", "pipe"],
  windowsHide: daemon,
});

if (daemon) child.unref();
child.stderr?.on("data", (chunk) => {
  const text = String(chunk);
  startupErrors.push(...text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  process.stderr.write(text);
});

let healthy = false;
let healthTimer;
const healthDeadline = Date.now() + 30_000;
const pollHealth = async () => {
  if (await probeHealth()) {
    healthy = true;
    clearInterval(healthTimer);
    writeStartupState("running", `Studio healthz 已通过：http://127.0.0.1:${studioPort}/healthz`);
    console.log(`status=running：Studio healthz 已通过（http://127.0.0.1:${studioPort}/healthz）。`);
    if (daemon) process.exit(0);
    return;
  }
  if (Date.now() >= healthDeadline) {
    clearInterval(healthTimer);
    const message = startupErrors.length
      ? startupErrors.slice(-3).join(" ")
      : "启动器已运行，但 30 秒内 healthz 未通过；执行 npm run studio:status 查看详情。";
    writeStartupState("startup_failed", message);
    console.error(`status=startup_failed：${message}`);
    if (daemon) process.exit(1);
  }
};
healthTimer = setInterval(pollHealth, 1000);
void pollHealth();

child.on("error", (error) => {
  clearInterval(healthTimer);
  writeStartupState("startup_failed", `Studio 启动失败：${error.message}`);
  console.error(`Studio 启动失败：${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  clearInterval(healthTimer);
  if (signal) {
    console.error(`Studio 进程被信号 ${signal} 终止`);
    process.exitCode = 1;
  } else {
    process.exitCode = healthy ? 0 : code || 1;
    if (!healthy) {
      const message = startupErrors.length
        ? startupErrors.slice(-3).join(" ")
        : `启动器退出，code=${code ?? "unknown"}。`;
      writeStartupState("startup_failed", message);
      console.error(`status=startup_failed：${message}`);
    } else if (!daemon) {
      writeStartupState("stopped", "Studio 启动器已退出。");
    }
  }
});
