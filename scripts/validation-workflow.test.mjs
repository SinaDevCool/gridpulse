import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const { load } = createRequire(import.meta.url)("js-yaml");
const workflow = (name) => load(readFileSync(`.github/workflows/${name}.yml`, "utf8"));

test("deployments require live freezes and production requires exact staging evidence", () => {
  for (const [file, environment] of [["deploy-cloudflare", "production"], ["deploy-staging", "staging"]]) {
    const release = workflow(file);
    assert.equal(release.on.push, undefined);
    assert.equal(release.on.workflow_dispatch.inputs.change_reference.required, true);
    const job = release.jobs.publish;
    assert.equal(typeof job.environment === "string" ? job.environment : job.environment.name, environment);
    const guard = job.steps.findIndex(step => step.run === "node scripts/release-guard.mjs");
    const deploy = job.steps.findIndex(step => step.run === "npx wrangler deploy --config dist/server/wrangler.json");
    assert.ok(guard >= 0 && guard < deploy);
    assert.equal(job.steps[guard].env.RELEASE_ENVIRONMENT, environment);
  }
  assert.equal(workflow("deploy-cloudflare").jobs.publish.concurrency.group, "gridpulse-production-mutation");
  assert.equal(workflow("deploy-cloudflare").on.workflow_dispatch.inputs.staging_run_id.required, true);
});

test("scheduled source monitoring has no production credentials or database writes", () => {
  const source = readFileSync('.github/workflows/grid-source-health.yml', 'utf8');
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|publish-operator-health|ingest-grid-stress-smard/);
  const steps = workflow('grid-source-health').jobs['mastr-source'].steps;
  assert.equal(steps.find(step => step.uses === 'actions/upload-artifact@v4').if, 'always()');
});

test("production monitoring can reach its browser checks without installing system packages", () => {
  const job = workflow("production-health").jobs["application-health"];
  assert.equal(job.env.GRIDPULSE_SMOKE_BROWSER_CHANNEL, "chrome");
  const steps = job.steps;
  const setup = steps.find(step => step.name === "Prepare production smoke-test browser");
  assert.ok(setup["timeout-minutes"] < job["timeout-minutes"]);
  assert.match(setup.run, /chromium.launch/);
  assert.ok(!steps.some(step => step.run?.includes("playwright install")));
  for (const script of ["check-production-map.mjs", "check-production-milp.mjs"]) {
    const check = steps.findIndex(step => step.run === `node scripts/${script}`);
    assert.ok(check > steps.indexOf(setup));
  }
});

test("legacy mutation jobs cannot bypass release governance", () => {
  for (const [file, job] of [['activate-public-milp-auth','activate-auth'], ['configure-milp-render','configure'], ['public-milp-qualification','apply-approved-boundary'], ['milp-storage-preflight','apply-approved-scope']]) {
    assert.equal(workflow(file).jobs[job].if, '${{ false }}');
  }
  const database = workflow('qualify-staging-schema');
  assert.ok(database.on.pull_request.paths.includes('supabase/migrations/**'));
  assert.match(database.jobs.replay.steps.find(step => step.env?.TEST_DATABASE_URL).env.TEST_DATABASE_URL, /127\.0\.0\.1:55439/);
});

test("one automatic PR run owns mandatory MILP qualification before full regression", () => {
  const pr = workflow("frontend-ci"), focused = workflow("milp-frontend-qualification");
  assert.ok(pr.on.pull_request);
  assert.equal(focused.on.push, undefined);
  assert.ok(Object.hasOwn(focused.on, "workflow_call"));
  assert.ok(Object.hasOwn(focused.on, "workflow_dispatch"));
  assert.equal(pr.jobs.milp.uses, "./.github/workflows/milp-frontend-qualification.yml");
  assert.equal(pr.jobs.validate.needs, "milp");
  assert.equal(focused.jobs.focused["continue-on-error"], undefined);
  const browser = focused.jobs.focused.steps.find(step => step.run === "npm run test:browser -- milp");
  assert.ok(browser, "focused qualification must use the central MILP suite");
  assert.equal(browser.env.GRIDPULSE_TEST_MILP_REQUIRED, "1");
  assert.equal(browser["continue-on-error"], undefined);
  assert.equal(focused.concurrency["cancel-in-progress"], true);
  assert.notEqual(pr.concurrency.group, focused.concurrency.group);
  assert.match(pr["run-name"], /head.sha/);
  const summary = focused.jobs.focused.steps.find(step => step.name === "Summarize this exact qualification attempt");
  assert.equal(summary.if, "always()");
  assert.match(summary.run, /GITHUB_STEP_SUMMARY/);
});

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
  assert.equal(deploy.jobs.publish.env.GRIDPULSE_SMOKE_BROWSER_CHANNEL, "chrome");
  const browserSetup = steps.find(step => step.name === "Prepare production smoke-test browser");
  assert.equal(browserSetup["timeout-minutes"], 2);
  assert.match(browserSetup.run, /google-chrome --version/);
  assert.match(browserSetup.run, /chromium.launch/);
  assert.ok(!steps.some(step => step.run?.includes("playwright install")));
  for (const script of ["check-production-map.mjs", "check-production-milp.mjs"]) {
    assert.match(readFileSync(`scripts/${script}`, "utf8"), /channel: process.env.GRIDPULSE_SMOKE_BROWSER_CHANNEL/);
  }
  for (const step of steps)
    if (step.env?.CLOUDFLARE_API_TOKEN)
      assert.ok(["npx wrangler deploy --config dist/server/wrangler.json", "node scripts/configure-copilot-secret.mjs"].includes(step.run));
  const configure = steps.findIndex(step => step.run === "node scripts/configure-copilot-secret.mjs");
  const publish = steps.findIndex(step => step.run === "npx wrangler deploy --config dist/server/wrangler.json");
  assert.ok(configure >= 0 && configure < publish);
  assert.equal(steps[configure].env.OPENAI_API_KEY, "${{ secrets.OPENAI_API_KEY }}");
  assert.ok(!workflow("validate-candidate").jobs.build.env.OPENAI_API_KEY);
});
test("fast gate precedes bounded, owned remote browser suites with reports", () => {
  const { jobs } = workflow("validate-candidate");
  assert.equal(jobs.fast.needs, "build");
  assert.ok(jobs.browsers.needs.includes("fast"));
  assert.equal(jobs.browsers.strategy["max-parallel"], 2);
  assert.deepEqual(jobs.browsers.strategy.matrix.suite, ["operations", "finder", "shared"]);
  assert.deepEqual(jobs.gate.needs, ["build", "fast", "browsers", "isolation", "core"]);
  assert.equal(jobs.core.uses, './.github/workflows/python-analytics-ci.yml');
  assert.ok(!jobs.build.steps.some(step => step.run?.includes('python -m pytest')));
  assert.ok(Object.hasOwn(workflow('python-analytics-ci').on, 'workflow_call'));
  assert.ok(workflow('frontend-ci').on.pull_request.paths.includes('services/grid-data/**'));
  for (const name of ["build", "fast", "browsers"]) {
    assert.ok(jobs[name]["timeout-minutes"]);
    assert.ok(
      jobs[name].steps.some(
        (step) => step.if?.includes("always()") && step.uses === "actions/upload-artifact@v4",
      ),
    );
  }
  assert.equal(jobs.build.steps.filter((step) => step.run === "npm run build" && !step.if).length, 1);
  assert.equal(jobs.browsers.env.GRIDPULSE_TEST_COMPILED, "1");
});

test("production MILP is tested before switching to a separately sealed compatibility artifact", () => {
  const { jobs } = workflow("validate-candidate");
  const compatibility = jobs.build.steps.find(step => step.name === "Build non-deployable scenario compatibility fixture");
  assert.equal(compatibility.if, "${{ inputs.production }}");
  assert.equal(compatibility.env.VITE_OPERATIONS_MILP_ENABLED, "false");
  assert.equal(compatibility.env.GRIDPULSE_BUILD_ENV, "compatibility");
  const upload = jobs.build.steps.find(step => step.uses === "actions/upload-artifact@v4" && step.with.name.startsWith("candidate-"));
  assert.ok(jobs.build.steps.indexOf(upload) < jobs.build.steps.indexOf(compatibility));
  const exact = jobs.fast.steps.find(step => step.name === "Qualify the exact production MILP artifact");
  assert.match(exact.run, /test:browser -- milp/);
  assert.equal(exact.env.GRIDPULSE_TEST_MILP_REQUIRED, "1");
  const move = jobs.fast.steps.find(step => step.run === "mv dist validated-production-dist");
  assert.ok(jobs.fast.steps.indexOf(exact) < jobs.fast.steps.indexOf(move));
  assert.match(jobs.browsers.steps.find(step => step.uses === "actions/download-artifact@v4").with.name,
    /matrix.suite == 'operations'.*compatibility.*artifact/);
  const publish = workflow("deploy-cloudflare").jobs.publish.steps.find(step => step.uses === "actions/download-artifact@v4");
  assert.equal(publish.with.name, "${{ needs.validate.outputs.artifact }}");
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
