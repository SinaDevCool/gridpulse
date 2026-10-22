import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acquireValidationLock,
  assertResources,
  validationPlan,
  nextPressureCount,
  runGuarded,
} from "./resource-safe-validation.mjs";

test("focused validation excludes builds, browsers and Finder", () => {
  const stages = validationPlan("operations");
  assert.equal(stages.length, 2);
  assert.ok(stages.flat().includes("test:product:operations"));
  assert.ok(!JSON.stringify(stages).includes("finder"));
  assert.deepEqual(validationPlan("unit", ["src/example.test.ts"]), [
    ["run", "test", "--", "src/example.test.ts"],
  ]);
  assert.throws(() => validationPlan("unit"));
  assert.throws(() => validationPlan("unit", ["--maxWorkers=12"]));
});
test("watchdog requires sustained pressure and resets when RAM recovers", () => {
  assert.equal(nextPressureCount(0, 1000), 1);
  assert.equal(nextPressureCount(1, 1000), 2);
  assert.equal(nextPressureCount(1, 6000), 0);
  assert.equal(nextPressureCount(1, NaN), 2);
});
test("watchdog cancels only its disposable child fixture and reports failure", async () => {
  await assert.rejects(
    runGuarded(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      readMemory: () => 1000,
      sampleMs: 30,
    }),
    /Memory safety stop/,
  );
});
test("guard preserves success and failure exit status", async () => {
  await runGuarded(process.execPath, ["-e", "process.exit(0)"], { readMemory: () => 6000 });
  await assert.rejects(
    runGuarded(process.execPath, ["-e", "process.exit(3)"], { readMemory: () => 6000 }),
    /Stage failed/,
  );
});
test("full pass orders unit tests before build before UI; Finder remains opt-in", () => {
  const stages = validationPlan("full", [], ["tests/e2e/operations-example.spec.ts"]);
  const names = stages.map((s) => s.join(" "));
  assert.ok(names.indexOf("run test") < names.indexOf("run build"));
  assert.ok(names.findIndex((s) => s.includes("playwright")) > names.indexOf("run build"));
  assert.ok(!names.some((s) => s.includes("finder")));
  assert.ok(validationPlan("finder")[0].includes("test:e2e:finder"));
});
test("preflight refuses low RAM, unknown memory, and existing heavy processes", () => {
  assert.throws(() => assertResources({ availableMb: 2000, busy: [] }), /3072/);
  assert.throws(() => assertResources({ availableMb: NaN, busy: [] }));
  assert.throws(() => assertResources({ availableMb: 6000, busy: [42] }), /42/);
  assert.doesNotThrow(() => assertResources({ availableMb: 6000, busy: [] }));
});
test("cross-worktree lock rejects a live owner and releases only itself", async () => {
  const folder = await mkdtemp(join(tmpdir(), "gridpulse-lock-test-"));
  const path = join(folder, "lock");
  try {
    const release = await acquireValidationLock(path);
    await assert.rejects(acquireValidationLock(path), /active/);
    await release();
    const next = await acquireValidationLock(path);
    await writeFile(path, "different-owner");
    await next();
    assert.equal(await readFile(path, "utf8"), "different-owner");
  } finally {
    await rm(folder, { recursive: true });
  }
});
test("a malformed lock fails closed rather than being deleted", async () => {
  const folder = await mkdtemp(join(tmpdir(), "gridpulse-lock-test-"));
  const path = join(folder, "lock");
  try {
    await writeFile(path, "not-a-pid");
    await assert.rejects(acquireValidationLock(path), /Invalid validation lock/);
    assert.equal(await readFile(path, "utf8"), "not-a-pid");
  } finally {
    await rm(folder, { recursive: true });
  }
});
