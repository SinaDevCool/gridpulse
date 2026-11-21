import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { qualifyReader } from "./neon-finder-deployment.mjs";
import targets from "../deployment/neon-finder/targets.json" with { type: "json" };
import release from "../deployment/neon-finder/release.json" with { type: "json" };
import { previousWorkerState } from "./finder-rollback-state.mjs";
try {
  const environment = process.env.FINDER_DEPLOYMENT_ENVIRONMENT;
  const target = targets[environment];
  const config = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
  if (
    !target ||
    config.name !== target.worker ||
    config.vars?.PUBLIC_FINDER_ENVIRONMENT !== environment ||
    config.vars?.PUBLIC_FINDER_PROVIDER !== "neon" ||
    config.vars?.NEON_FINDER_HOST !== target.pooledHost ||
    config.vars?.FINDER_DATA_RELEASE !== release.id ||
    config.vars?.FINDER_DATA_SHA256 !== release.manifestSha256
  )
    throw Error("Packaged Finder target mismatch");
  const credential = process.env.NEON_DATABASE_URL;
  await qualifyReader(credential, environment);
  const { NEON_DATABASE_URL: omitted, ...childEnv } = process.env;
  void omitted;
  const history = spawnSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "deployments",
      "list",
      "--config",
      "dist/server/wrangler.json",
      "--json",
    ],
    {
      env: childEnv,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 120000,
    },
  );
  if (history.status !== 0) throw Error("Cannot record existing deployment for rollback");
  const previous = previousWorkerState(JSON.parse(history.stdout), environment, target.worker);
  await mkdir(".release-state", { recursive: true });
  await writeFile(
    `.release-state/${environment}-previous.json`,
    JSON.stringify(previous, null, 2),
    { flag: "wx" },
  );
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "secret",
      "put",
      "NEON_DATABASE_URL",
      "--config",
      "dist/server/wrangler.json",
    ],
    {
      env: childEnv,
      input: credential + "\n",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      timeout: 120000,
    },
  );
  if (result.status !== 0) throw Error("Finder secret binding failed");
  console.log("Qualified read-only credential bound to " + environment + " Worker.");
} catch {
  console.error("Finder credential qualification or binding failed.");
  process.exitCode = 1;
}
