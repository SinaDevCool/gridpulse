import { spawn, spawnSync } from "node:child_process";
import { open, readFile, unlink } from "node:fs/promises";
import { ownedFiles, suiteFiles } from "./e2e-manifest.mjs";
import { tmpdir, freemem, userInfo } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function validationPlan(mode, targets = [], operationsSpecs = []) {
  if (targets.some((target) => target.startsWith("-")))
    throw new Error(
      "Supply test paths only; worker-limit overrides are not accepted by the safe runner.",
    );
  const npm = (name, args = []) => ["run", name, ...(args.length ? ["--", ...args] : [])];
  const checks = [
    "test:validation-tools",
    "check:encoding",
    "typecheck",
    "check:architecture",
    "lint:app",
  ].map((name) => npm(name));
  if (mode === "checks") return checks;
  if (mode === "operations") return [npm("test:validation-tools"), npm("test:product:operations")];
  if (mode === "unit" && targets.length) return [npm("test", targets)];
  if (mode === "build") return [npm("build"), npm("check:performance-budgets")];
  if (mode === "runtime") return [npm("test:operations:runtime")];
  if (mode === "browser" && targets.length === 1) {
    suiteFiles(targets[0]);
    return [npm("test:browser", targets)];
  }
  if (mode === "ui" && targets.length)
    return targets.map((target) => ["exec", "playwright", "--", "test", target, "--workers=1"]);
  if (mode === "finder-ui" && targets.length)
    return targets.map((target) => [
      "exec",
      "playwright",
      "--",
      "test",
      "--config",
      "playwright.finder.config.ts",
      target,
      "--workers=1",
    ]);
  if (mode === "finder") return [npm("test:e2e:finder")];
  if (mode === "full")
    return [
      ...checks,
      ...["test", "build", "check:performance-budgets"].map((name) => npm(name)),
      ...operationsSpecs.map((spec) => ["exec", "playwright", "--", "test", spec, "--workers=1"]),
      npm("test:operations:runtime"),
    ];
  throw new Error(
    "Use checks, operations, unit <paths>, ui <paths>, finder-ui <paths>, browser <suite>, build, runtime, finder, or full. Finder is intentionally opt-in.",
  );
}

export async function acquireValidationLock(path) {
  const owner = `${process.pid}:${Date.now()}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(path, "wx");
      await handle.writeFile(owner);
      await handle.close();
      return async () => {
        if ((await readFile(path, "utf8").catch(() => "")) === owner) await unlink(path);
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const existing = await readFile(path, "utf8");
      const pid = Number(existing.split(":")[0]);
      if (!Number.isInteger(pid) || pid <= 0)
        throw new Error(`Invalid validation lock; inspect ${path} manually.`);
      try {
        process.kill(pid, 0);
      } catch (probe) {
        if (probe.code === "ESRCH") {
          // Reclaim only the same stale owner; never delete another live run's lock.
          if ((await readFile(path, "utf8")) === existing) await unlink(path);
          continue;
        }
        throw probe;
      }
      throw new Error(
        `Another managed validation is active (PID ${pid}). Wait for it; do not start a parallel run.`,
      );
    }
  }
  throw new Error("Could not acquire validation lock.");
}

export function resourcePreflight() {
  if (process.platform !== "win32")
    return { availableMb: Math.round(freemem() / 1024 ** 2), busy: [] };
  const script = `$busy=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'workerd.exe' -or ($_.Name -eq 'node.exe' -and $_.CommandLine -match '[\\/](vitest|vite|playwright|typescript|eslint)[\\/]') } | Select-Object -ExpandProperty ProcessId); @{availableMb=(Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory).AvailableMBytes;busy=$busy} | ConvertTo-Json -Compress`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error("Cannot check available memory/processes. No heavy stage started.");
  return JSON.parse(result.stdout.trim());
}

export function assertResources({ availableMb, busy }) {
  if (!Number.isFinite(availableMb) || availableMb < 3072)
    throw new Error(
      `Only ${availableMb} MB RAM available; require 3072 MB before starting. No apps were closed.`,
    );
  if (busy.length)
    throw new Error(
      `Existing test/build/dev processes detected: ${busy.join(", ")}. Stop only task-owned jobs or wait; no process was killed.`,
    );
}

export function nextPressureCount(previous, availableMb) {
  return !Number.isFinite(availableMb) || availableMb < 1536 ? previous + 1 : 0;
}

function availableMemoryMb() {
  if (process.platform !== "win32") return Math.floor(freemem() / 1024 ** 2);
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "(Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory).AvailableMBytes",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  return result.status === 0 && result.stdout.trim() ? Number(result.stdout.trim()) : NaN;
}

export function runGuarded(
  command,
  args,
  { readMemory = availableMemoryMb, sampleMs = 4000 } = {},
) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { stdio: "inherit", windowsHide: true });
    let pressure = 0,
      cancelled = false;
    const timer = setInterval(() => {
      pressure = nextPressureCount(pressure, readMemory());
      if (pressure < 2 || cancelled || child.exitCode !== null) return;
      cancelled = true;
      console.error(
        "[resource-safe] Sustained low/unknown available RAM. Cancelling only this managed stage and its children.",
      );
      if (process.platform === "win32")
        spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      else child.kill("SIGTERM");
    }, sampleMs);
    child.on("error", (error) => {
      clearInterval(timer);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      clearInterval(timer);
      if (cancelled)
        reject(
          new Error(
            "Memory safety stop; no later stage was started. Close unneeded apps yourself or retry a narrower test set.",
          ),
        );
      else if (code === 0) accept();
      else
        reject(new Error(`Stage failed (${signal ?? code}); subsequent stages were not started.`));
    });
  });
}

async function runNpm(args) {
  // Use the current npm installation, with no shell interpolation or extra install.
  const cli = process.env.npm_execpath;
  if (!cli) throw new Error("Start this runner through npm run verify:local.");
  return runGuarded(process.execPath, [cli, ...args]);
}

export async function main(args = process.argv.slice(2)) {
  const specs = ownedFiles(["operations", "shared"]);
  const plan = validationPlan(args[0] ?? "operations", args.slice(1), specs);
  const lock = join(
    tmpdir(),
    `gridpulse-validation-${userInfo().username.replace(/[^a-z0-9-]/gi, "_")}.lock`,
  );
  const release = await acquireValidationLock(lock);
  try {
    for (const stage of plan) {
      const resources = resourcePreflight();
      assertResources(resources);
      console.log(
        `\n[resource-safe] ${resources.availableMb} MB available; npm ${stage.join(" ")}`,
      );
      await runNpm(stage);
    }
  } finally {
    await release();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
