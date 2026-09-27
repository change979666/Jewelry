/**
 * Local Studio diagnostic. It intentionally never starts a service or edits
 * the external Studio directory; the result is safe to attach to a handoff.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const isWindows = process.platform === "win32";
const studioRoot = process.env.AROMISO_STUDIO_ROOT || (isWindows ? "D:\\aromiso-studio" : "");
const studioPort = Number(process.env.AROMISO_STUDIO_PORT || 8711);
const ollamaPort = Number(process.env.OLLAMA_PORT || 11434);
const startupStatePath = join(tmpdir(), "aromiso-studio-startup.json");
const STATUS_VALUES = [
  "running",
  "stopped",
  "model_missing",
  "port_conflict",
  "gpu_unavailable",
  "startup_failed",
];

function commandAvailable(command) {
  if (!isWindows) return Boolean(spawnSync("sh", ["-lc", `command -v ${command}`]).status === 0);
  return spawnSync("where.exe", [command], { encoding: "utf8", windowsHide: true }).status === 0;
}

function portState(port) {
  if (!isWindows) return { supported: false, listening: null };
  const result = spawnSync("netstat.exe", ["-ano"], { encoding: "utf8", windowsHide: true });
  if (result.error) return { supported: true, listening: null, error: result.error.message };
  const needle = `:${port}`;
  const lines = String(result.stdout || "").split(/\r?\n/);
  const listeners = lines
    .filter((line) => line.includes(needle) && /LISTENING\s+\d+\s*$/.test(line))
    .map((line) => line.trim().split(/\s+/).at(-1));
  return { supported: true, listening: listeners.length > 0, pids: listeners };
}

function recentStartupFailure(root) {
  if (!root) return null;
  const candidates = [join(root, "uvicorn.log"), join(root, "studio-daemon.log")];
  const now = Date.now();
  for (const path of candidates) {
    try {
      const stat = statSync(path);
      if (now - stat.mtimeMs > 15 * 60 * 1000) continue;
      const tail = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).slice(-12);
      const failure = tail.find((line) => /error|traceback|exited \(code [^0]/i.test(line));
      if (failure) return { path, updated_at: stat.mtime.toISOString(), detail: failure.slice(0, 240) };
    } catch {
      // A missing or unreadable log should not hide the port/health result.
    }
  }
  return null;
}

function recentStartupState() {
  try {
    const state = JSON.parse(readFileSync(startupStatePath, "utf8"));
    const updatedAt = Date.parse(String(state.updated_at || ""));
    if (!updatedAt || Date.now() - updatedAt > 15 * 60 * 1000) return null;
    if (state.status !== "startup_failed") return null;
    return {
      path: startupStatePath,
      updated_at: new Date(updatedAt).toISOString(),
      detail: String(state.detail || "启动器未提供错误详情").slice(0, 240),
    };
  } catch {
    return null;
  }
}

function deriveStudioStatus({ rootExists, modelsPresent, startLauncher, health, port, gpu, failure }) {
  if (health.ok) return "running";
  if (!rootExists || !startLauncher || !modelsPresent) return "model_missing";
  if (gpu.supported && gpu.available === false) return "gpu_unavailable";
  if (port.listening) return "port_conflict";
  if (failure) return "startup_failed";
  return "stopped";
}

function nextAction(status) {
  switch (status) {
    case "running":
      return "Studio 已运行，可打开 http://127.0.0.1:8711。";
    case "model_missing":
      return "Studio 根目录、启动器或 models 目录不完整，请设置 AROMISO_STUDIO_ROOT 或补齐模型。";
    case "port_conflict":
      return "8711 已被其他进程占用且不是可用 Studio，请先释放端口。";
    case "gpu_unavailable":
      return "未检测到 NVIDIA GPU；确认驱动或决定是否允许 Studio 退回 CPU。";
    case "startup_failed":
      return "最近一次 Studio 启动失败，先查看 status.studio.startup_failure.detail。";
    default:
      return "Studio 未运行，执行 npm run studio:start。";
  }
}

function gpuState() {
  if (!isWindows) return { supported: false, available: null };
  const result = spawnSync(
    "nvidia-smi.exe",
    [
      "--query-gpu=name,memory.used,memory.total,utilization.gpu",
      "--format=csv,noheader,nounits",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.error || result.status !== 0) {
    return {
      supported: true,
      available: false,
      error: result.error?.message || String(result.stderr || "nvidia-smi unavailable").trim(),
    };
  }
  const devices = String(result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, memoryUsedMb, memoryTotalMb, utilizationPercent] = line
        .split(",")
        .map((value) => value.trim());
      return { name, memory_used_mb: memoryUsedMb, memory_total_mb: memoryTotalMb, utilization_percent: utilizationPercent };
    });
  return { supported: true, available: devices.length > 0, devices };
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

const launchers = [
  "start-studio.bat",
  "studio-daemon.bat",
  "run.bat",
  join("scripts", "start_service.ps1"),
];
const rootExists = Boolean(studioRoot && existsSync(studioRoot));
const envState = {
  AROMISO_STUDIO_ROOT: Boolean(process.env.AROMISO_STUDIO_ROOT),
  AROMISO_STUDIO_PORT: Boolean(process.env.AROMISO_STUDIO_PORT),
  OLLAMA_HOST: Boolean(process.env.OLLAMA_HOST),
  OLLAMA_PORT: Boolean(process.env.OLLAMA_PORT),
};
const modelEntries =
  rootExists && existsSync(join(studioRoot, "models"))
    ? readdirSync(join(studioRoot, "models"), { withFileTypes: true }).map((entry) => entry.name)
    : [];
const modelsPresent = modelEntries.length > 0;
const launchersState = Object.fromEntries(
  launchers.map((name) => [name, rootExists && existsSync(join(studioRoot, name))]),
);
const studioHealth = await probe(`http://127.0.0.1:${studioPort}/healthz`);
const ollamaHealth = await probe(`http://127.0.0.1:${ollamaPort}/api/tags`);
const studioPortState = portState(studioPort);
const gpu = gpuState();
const startupFailure = recentStartupFailure(studioRoot) || recentStartupState();
const studioStatus = deriveStudioStatus({
  rootExists,
  modelsPresent,
  startLauncher: Boolean(launchersState["start-studio.bat"]),
  health: studioHealth,
  port: studioPortState,
  gpu,
  failure: startupFailure,
});
const report = {
  ok: studioStatus === "running",
  status: studioStatus,
  status_values: STATUS_VALUES,
  platform: process.platform,
  runtime: {
    cwd: process.cwd(),
    node: process.version,
    env: envState,
    gpu,
  },
  studio: {
    status: studioStatus,
    root: studioRoot || null,
    root_exists: rootExists,
    launchers: launchersState,
    models_present: modelsPresent,
    port: studioPort,
    port_state: studioPortState,
    health: studioHealth,
    startup_failure: startupFailure,
    model_entries: modelEntries,
  },
  ollama: {
    command_available: commandAvailable("ollama"),
    port: ollamaPort,
    port_state: portState(ollamaPort),
    health: ollamaHealth,
  },
  next: nextAction(studioStatus),
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;
