import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import targets from "../deployment/neon-finder/targets.json" with { type: "json" };
try {
  const environment = process.env.FINDER_DEPLOYMENT_ENVIRONMENT;
  const target = targets[environment];
  if (!target) throw Error("Explicit rollback environment required");
  const config = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
  const previous = JSON.parse(
    await readFile(`.release-state/${environment}-previous.json`, "utf8"),
  );
  if (
    config.name !== target.worker ||
    previous.worker !== target.worker ||
    previous.environment !== environment ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(previous.versionId)
  )
    throw Error("Rollback target mismatch");
  const r = spawnSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "rollback",
      previous.versionId,
      "--config",
      "dist/server/wrangler.json",
      "--message",
      "Restore the recorded version after a failed qualified release",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: 120000 },
  );
  if (r.status !== 0) throw Error("Worker rollback failed");
  console.log("Restored the recorded " + environment + " Worker version " + previous.versionId);
} catch {
  console.error("Recorded Worker rollback could not complete.");
  process.exitCode = 1;
}
