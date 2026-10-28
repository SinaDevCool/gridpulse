import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { tmpdir, userInfo } from "node:os";
import {
  assertResources,
  resourcePreflight,
  acquireValidationLock,
  runGuarded,
} from "./resource-safe-validation.mjs";
const require = createRequire(import.meta.url);
if (!process.argv.includes("--child")) {
  const release = await acquireValidationLock(
    join(
      tmpdir(),
      `gridpulse-validation-${userInfo().username.replace(/[^a-z0-9-]/gi, "_")}.lock`,
    ),
  );
  try {
    assertResources(resourcePreflight());
    await runGuarded(process.execPath, [
      "scripts/qualify-copilot-budget.mjs",
      "--child",
    ]);
  } finally {
    await release();
  }
} else {
  const { Miniflare, convertV4MiniflareOptions } = await import(
    pathToFileURL(
      require.resolve("miniflare", {
        paths: [resolve("node_modules/wrangler")],
      }),
    ).href
  );
  execFileSync(
    process.execPath,
    [
      "node_modules/typescript/bin/tsc",
      "--noEmit",
      "--target",
      "ES2022",
      "--module",
      "ESNext",
      "--moduleResolution",
      "Bundler",
      "--skipLibCheck",
      "deployment/copilot-budget/worker.ts",
      "worker-configuration.d.ts",
    ],
    { stdio: "inherit" },
  );
  let source = readFileSync("deployment/copilot-budget/worker.ts", "utf8");
  source =
    source.slice(0, source.indexOf("export default")) +
    `export default {async fetch(request,env){const value=await request.json();const stub=env.BUDGET.getByName(value.scope);return Response.json(value.op==='settle' ? await stub.settle(value.id,value.actual) ?? null : await stub.reserve(value.id,value.amount,value.limit));}};`;
  const output = await build({
    stdin: {
      contents: source,
      resolveDir: resolve("deployment/copilot-budget"),
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    external: ["cloudflare:workers"],
    logLevel: "silent",
  });
  const directory = resolve(".codex-tmp/budget-runtime-" + Date.now());
  mkdirSync(directory, { recursive: true });
  const options = {
    name: "budget-qualification",
    modules: true,
    script: output.outputFiles[0].text,
    compatibilityDate: "2026-07-18",
    durableObjects: { BUDGET: { className: "CopilotBudget", useSQLite: true } },
    resourcePersistencePath: directory,
  };
  let mf = new Miniflare(convertV4MiniflareOptions(options));
  const call = async (value) =>
    (
      await mf.dispatchFetch("http://local.invalid", {
        method: "POST",
        body: JSON.stringify(value),
      })
    ).json();
  try {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        call({
          scope: "team:2026-10",
          id: "request-" + i,
          amount: 10,
          limit: 50,
        }),
      ),
    );
    assert.equal(results.filter(Boolean).length, 5);
    assert.equal(
      await call({
        scope: "team:2026-10",
        id: "request-0",
        amount: 10,
        limit: 50,
      }),
      false,
    );
    assert.equal(
      await call({
        scope: "other:2026-10",
        id: "request-a",
        amount: 60,
        limit: 100,
      }),
      true,
    );
    assert.equal(
      await call({
        scope: "other:2026-10",
        id: "request-b",
        amount: 41,
        limit: 100,
      }),
      false,
    );
    await call({
      scope: "other:2026-10",
      op: "settle",
      id: "request-a",
      actual: 20,
    });
    assert.equal(
      await call({
        scope: "other:2026-10",
        id: "request-c",
        amount: 80,
        limit: 100,
      }),
      true,
    );
    await mf.dispose();
    mf = new Miniflare(convertV4MiniflareOptions(options));
    assert.equal(
      await call({
        scope: "team:2026-10",
        id: "after-restart",
        amount: 1,
        limit: 50,
      }),
      false,
    );
    assert.equal(
      await call({
        scope: "team:2026-11",
        id: "new-window",
        amount: 10,
        limit: 50,
      }),
      true,
    );
    console.log(
      "Workers SQLite budget: concurrency, duplicates, unknown usage, reconciliation, restart persistence and window isolation passed.",
    );
  } finally {
    await mf.dispose();
  }
}
