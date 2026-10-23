import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, appendFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { suiteFiles, configFor } from "./e2e-manifest.mjs";

export function browserCommand(suite) {
  return [
    "node_modules/@playwright/test/cli.js",
    "test",
    "--config",
    configFor(suite),
    ...suiteFiles(suite),
    "--workers=1",
    "--global-timeout=720000",
    ...(suite === "fast" ? ["--max-failures=1"] : []),
  ];
}
export function failureNames(report) {
  const names = [];
  function walk(suite) {
    for (const spec of suite.specs ?? [])
      if (spec.tests?.some((test) => ["unexpected", "flaky"].includes(test.status)))
        names.push(spec.title);
    for (const child of suite.suites ?? []) walk(child);
  }
  for (const suite of report.suites ?? []) walk(suite);
  return names;
}
export function main(suite) {
  const args = browserCommand(suite);
  const folder = resolve("test-results", suite);
  mkdirSync(folder, { recursive: true });
  const json = resolve(folder, "results.json");
  rmSync(json, { force: true });
  const started = Date.now();
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      GRIDPULSE_TEST_OUTPUT: resolve(folder, "attachments"),
      GRIDPULSE_TEST_REPORT_DIR: folder,
    },
  });
  let report = {};
  try {
    report = JSON.parse(readFileSync(json, "utf8"));
  } catch {
    /* Startup failures still get a summary. */
  }
  const safe = (value) => String(value).replace(/[<>&|`\r\n]/g, " ");
  const seconds = Math.round((Date.now() - started) / 1000);
  const summary =
    `### Browser suite: ${safe(suite)}\n\n` +
    `SHA: \`${safe(process.env.GITHUB_SHA ?? "local")}\` · ${seconds}s · exit ${result.status ?? "signal/startup failure"}\n\n` +
    `Passed: ${report.stats?.expected ?? 0} · Failed: ${report.stats?.unexpected ?? "unknown"} · Flaky: ${report.stats?.flaky ?? 0}\n\n` +
    failureNames(report)
      .map((name) => `- ${safe(name)}\n`)
      .join("");
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (result.error) console.error(result.error.message);
  return result.status ?? 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = main(process.argv[2]);
