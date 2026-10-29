import assert from "node:assert/strict";
import { readFile, readdir, rmdir } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const staging = Object.freeze({
  worker: "gridpulse-insights-staging",
  site: "https://staging.gridpulseinsights.com",
  supabase: "https://vuudrdsjjxjyxxgmlhfn.supabase.co",
  api: "https://gridpulse-operations-staging.onrender.com",
});

export function checkBuildEnvironment(env) {
  assert.equal(env.CLOUDFLARE_ENV, "staging", "Select the staging Worker at build time");
  assert.equal(env.GRIDPULSE_BUILD_ENV, "staging");
  assert.equal(env.VITE_SUPABASE_URL, staging.supabase, "Staging Supabase URL required");
  assert.match(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "", /^sb_publishable_[A-Za-z0-9_-]+$/);
  assert.equal(env.VITE_ANALYTICS_API_URL, staging.api, "Staging Render API required");
  assert.equal(env.VITE_OPERATIONS_MILP_ENABLED, "true");
  assert.equal(env.VITE_PUBLIC_MILP_ENABLED, "true");
  for (const key of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "META_API_KEY",
    "OPENAI_API_KEY",
    "CLOUDFLARE_API_TOKEN",
  ])
    assert.ok(!env[key], `${key} must not be present in the build environment`);
}

// Wrangler removes its temporary files on exit but leaves .wrangler/tmp parents.
// Remove empty directories only: never delete or hide files from artifact verification.
async function removeEmptyRuntimeDirectories(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    assert.ok(
      entry.isDirectory() && !entry.isSymbolicLink(),
      "Candidate contains Wrangler runtime files",
    );
    await removeEmptyRuntimeDirectories(join(folder, entry.name));
  }
  await rmdir(folder);
}

export async function checkStagingCandidate(root) {
  const config = JSON.parse(await readFile(join(root, "server/wrangler.json"), "utf8"));
  assert.equal(config.name, staging.worker, "Refusing a Worker other than staging");
  assert.equal(config.vars?.COPILOT_ENABLED, "false");
  assert.equal(config.vars?.PUBLIC_FINDER_EXPERIMENTAL_MODE, "false");
  assert.deepEqual(Object.keys(config.vars).sort(), [
    "COPILOT_ENABLED",
    "PUBLIC_FINDER_EXPERIMENTAL_MODE",
  ]);
  assert.deepEqual(config.routes, [
    { pattern: new URL(staging.site).hostname, custom_domain: true },
  ]);
  for (const [name, id] of [
    ["COPILOT_RATE_LIMITER", "2003"],
    ["PUBLIC_FINDER_RATE_LIMITER", "2001"],
    ["OPERATIONS_RATE_LIMITER", "2002"],
  ])
    assert.equal(config.ratelimits?.find((entry) => entry.name === name)?.namespace_id, id);
  assert.equal(config.ratelimits.length, 3);
  let supabaseFound = false;
  let apiFound = false;
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink(), "Candidate cannot contain symlinks");
      const path = join(folder, entry.name);
      if (entry.name === ".wrangler" && entry.isDirectory()) {
        await removeEmptyRuntimeDirectories(path);
        continue;
      }
      assert.ok(
        !/^(?:\.dev\.vars(?:\..*)?|\.env(?:\..*)?|\.wrangler)$/.test(entry.name),
        `Candidate contains local configuration or secrets: ${relative(root, path)}`,
      );
      if (entry.isDirectory()) await walk(path);
      else if (path.includes(`${join(root, "client")}`) && /\.js$/.test(entry.name)) {
        const source = await readFile(path, "utf8");
        supabaseFound ||= source.includes(staging.supabase);
        apiFound ||= source.includes(staging.api);
        assert.ok(!source.includes("sb_secret_"), "Client contains a backend secret");
      }
    }
  }
  await walk(root);
  assert.ok(supabaseFound && apiFound, "Client must embed the staging Supabase and Render origins");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const action = process.argv[2];
  if (action === "build-env") checkBuildEnvironment(process.env);
  else if (action === "artifact") await checkStagingCandidate(resolve("dist"));
  else throw new Error("Use build-env or artifact");
  console.log(`Staging ${action} checks passed`);
}
