import test from "node:test";
import assert from "node:assert/strict";
import { browserCommand, failureNames } from "./run-e2e.mjs";
test("suite runner bounds workers and time and fails fast only in the fast gate", () => {
  assert.ok(browserCommand("fast").includes("--max-failures=1"));
  assert.ok(browserCommand("finder").includes("playwright.finder.config.ts"));
  for (const suite of ["fast", "operations", "finder", "shared", "runtime"]) {
    assert.ok(browserCommand(suite).includes("--workers=1"));
    assert.ok(browserCommand(suite).includes("--global-timeout=720000"));
  }
  assert.throws(() => browserCommand("--workers=99"));
});
test("summary identifies nested failures rather than successful tests", () => {
  assert.deepEqual(
    failureNames({
      suites: [
        {
          suites: [
            {
              specs: [
                { title: "failed history", tests: [{ status: "unexpected" }] },
                { title: "good", tests: [{ status: "expected" }] },
              ],
            },
          ],
        },
      ],
    }),
    ["failed history"],
  );
});
