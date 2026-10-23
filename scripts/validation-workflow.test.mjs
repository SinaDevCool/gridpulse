import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const { load } = createRequire(import.meta.url)("js-yaml");
const workflow = (name) => load(readFileSync(`.github/workflows/${name}.yml`, "utf8"));

test("PR and release reuse validation; only validated main artifacts can publish", () => {
  const pr = workflow("frontend-ci"),
    deploy = workflow("deploy-cloudflare");
  assert.equal(pr.jobs.validate.uses, deploy.jobs.validate.uses);
  assert.equal(pr.concurrency["cancel-in-progress"], true);
  assert.equal(deploy.jobs.publish.concurrency["cancel-in-progress"], false);
  assert.equal(deploy.jobs.publish.needs, "validate");
  assert.match(deploy.jobs.publish.if, /refs\/heads\/main/);
  const steps = deploy.jobs.publish.steps;
  assert.ok(!steps.some((step) => step.run === "npm run build"));
  assert.ok(steps.some((step) => step.run?.includes("candidate-artifact.mjs verify")));
  assert.ok(steps.some((step) => step.run?.includes("git ls-remote")));
  assert.ok(steps.some((step) => step.run === "npx playwright install --with-deps chromium"));
  for (const step of steps)
    if (step.env?.CLOUDFLARE_API_TOKEN)
      assert.equal(step.run, "npx wrangler deploy --config dist/server/wrangler.json");
});
test("fast gate precedes bounded, owned remote browser suites with reports", () => {
  const { jobs } = workflow("validate-candidate");
  assert.equal(jobs.fast.needs, "build");
  assert.ok(jobs.browsers.needs.includes("fast"));
  assert.equal(jobs.browsers.strategy["max-parallel"], 2);
  assert.deepEqual(jobs.browsers.strategy.matrix.suite, ["operations", "finder", "shared"]);
  assert.deepEqual(jobs.gate.needs, ["build", "fast", "browsers", "isolation"]);
  for (const name of ["build", "fast", "browsers"]) {
    assert.ok(jobs[name]["timeout-minutes"]);
    assert.ok(
      jobs[name].steps.some(
        (step) => step.if?.includes("always()") && step.uses === "actions/upload-artifact@v4",
      ),
    );
  }
  assert.equal(jobs.build.steps.filter((step) => step.run === "npm run build").length, 1);
  assert.equal(jobs.browsers.env.GRIDPULSE_TEST_COMPILED, "1");
});
test("compiled test servers keep generated runtime state outside dist", () => {
  for (const config of [
    "playwright.config.ts",
    "playwright.finder.config.ts",
    "playwright.runtime.config.ts",
  ]) {
    const source = readFileSync(config, "utf8");
    assert.match(source, /--persist-to/);
    assert.match(source, /\.wrangler\/test-state\//);
  }
});

test("production requires real public configuration; PR fixture origin cannot publish", () => {
  const { jobs } = workflow("validate-candidate");
  const preflight = jobs.build.steps.find(
    (step) => step.name === "Require production public configuration",
  );
  assert.match(preflight.if, /inputs.production/);
  assert.match(preflight.run, /test -n.*VITE_SUPABASE_URL/);
  assert.match(preflight.run, /test -n.*VITE_SUPABASE_PUBLISHABLE_KEY/);
  const build = jobs.build.steps.find((step) => step.run === "npm run build");
  assert.ok(jobs.build.steps.indexOf(preflight) < jobs.build.steps.indexOf(build));
  assert.match(build.env.VITE_SUPABASE_URL, /!inputs.production.*browser-fixture.invalid/);
  assert.match(build.env.VITE_SUPABASE_PUBLISHABLE_KEY, /!inputs.production.*not-a-credential/);
});
