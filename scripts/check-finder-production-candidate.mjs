import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import targets from "../deployment/neon-finder/targets.json" with { type: "json" };
import release from "../deployment/neon-finder/release.json" with { type: "json" };

export async function checkFinderProductionCandidate(root) {
  const config = JSON.parse(await readFile(join(root, "server/wrangler.json"), "utf8"));
  assert.equal(config.name, targets.production.worker, "Production Worker required");
  assert.deepEqual(config.vars, {
    PUBLIC_FINDER_EXPERIMENTAL_MODE: "false",
    PUBLIC_FINDER_PROVIDER: "neon",
    PUBLIC_FINDER_ENVIRONMENT: "production",
    NEON_FINDER_HOST: targets.production.pooledHost,
    FINDER_DATA_RELEASE: release.id,
    FINDER_DATA_SHA256: release.manifestSha256,
  });
  assert.ok(
    !(config.routes ?? []).some((r) => JSON.stringify(r).includes("staging.")),
    "No staging route in production",
  );
  for (const [name, id] of [
    ["COPILOT_RATE_LIMITER", "1003"],
    ["PUBLIC_FINDER_RATE_LIMITER", "1001"],
    ["OPERATIONS_RATE_LIMITER", "1002"],
  ])
    assert.equal(config.ratelimits?.find((r) => r.name === name)?.namespace_id, id);
  async function walk(path, client = false) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink(), "No candidate symlinks");
      assert.ok(
        !/^(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?)$/.test(entry.name),
        "No local secrets in candidate",
      );
      const file = join(path, entry.name);
      if (entry.isDirectory()) await walk(file, client || entry.name === "client");
      else if (client && /\.js$/.test(entry.name)) {
        const source = await readFile(file, "utf8");
        assert.ok(
          !/postgres(?:ql)?:\/\/|NEON_DATABASE_URL|sb_secret_/i.test(source),
          "No server credentials in client assets",
        );
      }
    }
  }
  await walk(root);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkFinderProductionCandidate(resolve("dist"));
  console.log("Production Finder candidate checks passed.");
}
