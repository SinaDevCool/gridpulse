import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { checkFinderProductionCandidate } from "./check-finder-production-candidate.mjs";
import targets from "../deployment/neon-finder/targets.json" with { type: "json" };
import release from "../deployment/neon-finder/release.json" with { type: "json" };
test("production artifact rejects staging bindings and leaked client credentials", async () => {
  const root = await mkdtemp(join(tmpdir(), "gridpulse-production-guard-"));
  try {
    await mkdir(join(root, "server"));
    await mkdir(join(root, "client"));
    const config = {
      name: targets.production.worker,
      vars: {
        PUBLIC_FINDER_EXPERIMENTAL_MODE: "false",
        PUBLIC_FINDER_PROVIDER: "neon",
        PUBLIC_FINDER_ENVIRONMENT: "production",
        NEON_FINDER_HOST: targets.production.pooledHost,
        FINDER_DATA_RELEASE: release.id,
        FINDER_DATA_SHA256: release.manifestSha256,
      },
      ratelimits: [
        { name: "COPILOT_RATE_LIMITER", namespace_id: "1003" },
        { name: "PUBLIC_FINDER_RATE_LIMITER", namespace_id: "1001" },
        { name: "OPERATIONS_RATE_LIMITER", namespace_id: "1002" },
      ],
    };
    const put = (value) => writeFile(join(root, "server/wrangler.json"), JSON.stringify(value));
    await put(config);
    await writeFile(join(root, "client/app.js"), "export default {}");
    await checkFinderProductionCandidate(root);
    for (const change of [
      { name: targets.staging.worker },
      { vars: { ...config.vars, NEON_FINDER_HOST: targets.staging.pooledHost } },
      { vars: { ...config.vars, FINDER_DATA_SHA256: "a".repeat(64) } },
    ]) {
      await put({ ...config, ...change });
      await assert.rejects(checkFinderProductionCandidate(root));
    }
    await put(config);
    await writeFile(
      join(root, "client/app.js"),
      "const leaked='postgresql://fixture:fixture@example.com/gridpulse';",
    );
    await assert.rejects(checkFinderProductionCandidate(root), /credentials/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("production binds a qualified reader after live policy and publishes the sealed artifact", async () => {
  const { load } = createRequire(import.meta.url)("js-yaml");
  const production = load(await readFile(".github/workflows/deploy-cloudflare.yml", "utf8"));
  const staging = load(await readFile(".github/workflows/deploy-staging.yml", "utf8"));
  for (const flow of [production, staging]) {
    assert.equal(flow.jobs.validate.needs, "preflight");
    assert.equal(flow.jobs.preflight.steps.at(-1).run, "node scripts/check-release-input.mjs");
  }
  const steps = production.jobs.publish.steps;
  const guard = steps.findIndex((s) => s.run === "node scripts/release-guard.mjs");
  const bind = steps.findIndex((s) => s.run === "node scripts/bind-neon-finder-secret.mjs");
  const deploy = steps.findIndex((s) => s.name === "Publish the validated artifact");
  assert.ok(guard >= 0 && bind > guard && deploy > bind);
  assert.equal(steps[bind].env.FINDER_DEPLOYMENT_ENVIRONMENT, "production");
  assert.equal(production.jobs.publish.environment, "production");
  assert.ok(
    steps
      .slice(bind + 1, deploy)
      .some((s) => s.run === "node scripts/candidate-artifact.mjs verify"),
  );
  assert.ok(!steps.some((s) => s.run?.includes("npm run build")));
  const rollback = steps.find((s) => s.run === "node scripts/rollback-finder-worker.mjs");
  assert.match(rollback.if, /failure\(\).*publish_worker.outcome == 'success'/);
});
