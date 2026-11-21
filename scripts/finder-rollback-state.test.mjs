import assert from "node:assert/strict";
import test from "node:test";
import { previousWorkerState } from "./finder-rollback-state.mjs";

const versionId = "12345678-1234-1234-1234-123456789abc";
const deployment = (id, date, versions = [{ version_id: versionId, percentage: 100 }]) => ({
  id,
  created_on: date,
  versions,
});

test("rollback records the latest deployed version regardless of API ordering", () => {
  const history = [
    deployment("latest", "2026-11-21T11:00:00Z"),
    deployment("older", "2026-11-20T11:00:00Z"),
  ];
  const result = previousWorkerState(history, "production", "gridpulse-insights");
  assert.equal(result.deploymentId, "latest");
  assert.equal(result.versionId, versionId);
  assert.equal(result.environment, "production");
  assert.equal(history[0].id, "latest");
});

test("rollback refuses a split latest deployment instead of selecting an older version", () => {
  assert.throws(
    () =>
      previousWorkerState(
        [
          deployment("older", "2026-11-20T11:00:00Z"),
          deployment("latest", "2026-11-21T11:00:00Z", [
            { version_id: versionId, percentage: 50 },
            { version_id: "23456789-1234-1234-1234-123456789abc", percentage: 50 },
          ]),
        ],
        "production",
        "gridpulse-insights",
      ),
    /single fully deployed/,
  );
});

test("rollback refuses missing history and malformed version identifiers", () => {
  assert.throws(() => previousWorkerState([], "production", "gridpulse-insights"));
  assert.throws(() =>
    previousWorkerState(
      [deployment("latest", "2026-11-21T11:00:00Z", [{ version_id: "unsafe", percentage: 100 }])],
      "production",
      "gridpulse-insights",
    ),
  );
});
