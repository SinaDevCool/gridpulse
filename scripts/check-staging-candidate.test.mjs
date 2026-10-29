import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkBuildEnvironment,
  checkStagingCandidate,
  staging,
} from "./check-staging-candidate.mjs";

test("staging release waits for validation and publishes the sealed artifact without a rebuild", async () => {
  const { load } = createRequire(import.meta.url)("js-yaml");
  const flow = load(
    await readFile(new URL("../.github/workflows/deploy-staging.yml", import.meta.url), "utf8"),
  );
  assert.deepEqual(Object.keys(flow.on), ["workflow_dispatch"]);
  assert.equal(flow.jobs.validate.uses, "./.github/workflows/validate-candidate.yml");
  assert.equal(flow.jobs["build-staging"].needs, "validate");
  assert.equal(flow.jobs["build-staging"].environment, "staging");
  assert.equal(flow.jobs.publish.needs, "build-staging");
  assert.equal(flow.jobs.publish.environment.name, "staging");
  assert.equal(flow.jobs.publish.environment.url, staging.site);
  assert.match(flow.jobs.publish.if, /refs\/heads\/main/);
  const steps = flow.jobs.publish.steps;
  const runs = steps.filter((step) => step.run).map((step) => step.run);
  assert.ok(!runs.some((run) => /npm run build|vite build/.test(run)));
  const deploy = steps.findIndex((step) => step.name === "Deploy only the verified staging Worker");
  assert.ok(
    steps
      .slice(0, deploy)
      .some((step) => step.run === "node scripts/candidate-artifact.mjs verify"),
  );
  assert.ok(
    steps
      .slice(0, deploy)
      .some((step) => step.run === "node scripts/check-staging-candidate.mjs artifact"),
  );
  assert.ok(!JSON.stringify(flow.jobs["build-staging"].env).includes("CLOUDFLARE_API_TOKEN"));
  assert.equal(flow.concurrency["cancel-in-progress"], false);
});

test("staging build rejects production URLs and backend credentials", () => {
  const env = {
    CLOUDFLARE_ENV: "staging",
    GRIDPULSE_BUILD_ENV: "staging",
    VITE_SUPABASE_URL: staging.supabase,
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
    VITE_ANALYTICS_API_URL: staging.api,
    VITE_OPERATIONS_MILP_ENABLED: "true",
    VITE_PUBLIC_MILP_ENABLED: "true",
  };
  checkBuildEnvironment(env);
  for (const change of [
    { VITE_SUPABASE_URL: "https://production.supabase.co" },
    { VITE_ANALYTICS_API_URL: "https://gridpulse-operations-milp.onrender.com" },
    { VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_fixture" },
    { SUPABASE_SERVICE_ROLE_KEY: "private" },
    { CLOUDFLARE_ENV: "production" },
  ])
    assert.throws(() => checkBuildEnvironment({ ...env, ...change }));
});

test("artifact guard rejects production target, mixed routes and leaked config", async () => {
  const root = await mkdtemp(join(tmpdir(), "gridpulse-staging-guard-"));
  try {
    await mkdir(join(root, "server"));
    await mkdir(join(root, "client"));
    const config = {
      name: staging.worker,
      vars: { COPILOT_ENABLED: "false", PUBLIC_FINDER_EXPERIMENTAL_MODE: "false" },
      routes: [{ pattern: new URL(staging.site).hostname, custom_domain: true }],
      ratelimits: [
        { name: "COPILOT_RATE_LIMITER", namespace_id: "2003" },
        { name: "PUBLIC_FINDER_RATE_LIMITER", namespace_id: "2001" },
        { name: "OPERATIONS_RATE_LIMITER", namespace_id: "2002" },
      ],
    };
    const put = (value) => writeFile(join(root, "server/wrangler.json"), JSON.stringify(value));
    await put(config);
    await writeFile(join(root, "client/app.js"), JSON.stringify([staging.supabase, staging.api]));
    await checkStagingCandidate(root);
    await put({ ...config, name: "gridpulse-insights" });
    await assert.rejects(checkStagingCandidate(root));
    await put({
      ...config,
      routes: [...config.routes, { pattern: "gridpulseinsights.com", custom_domain: true }],
    });
    await assert.rejects(checkStagingCandidate(root));
    await put(config);
    await writeFile(join(root, "server/.dev.vars.staging"), "private");
    await assert.rejects(checkStagingCandidate(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
