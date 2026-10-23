import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { suites, fast, suiteFiles } from "./e2e-manifest.mjs";

test("every browser spec has exactly one explicit owner", () => {
  const files = ["tests/e2e", "tests/finder-e2e", "tests/shared-e2e"].flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith(".spec.ts"))
      .map((name) => `${dir}/${name}`),
  );
  const declared = Object.values(suites).flat();
  assert.equal(new Set(declared).size, declared.length, "duplicate ownership");
  assert.deepEqual([...declared].sort(), files.sort(), "missing or stale spec ownership");
});
test("fast checks run first without duplicate Operations coverage", () => {
  assert.ok(fast.every((file) => suites.operations.includes(file)));
  assert.deepEqual(
    [...suiteFiles("fast"), ...suiteFiles("operations")].sort(),
    [...suites.operations].sort(),
  );
  assert.throws(() => suiteFiles("missing"));
});
