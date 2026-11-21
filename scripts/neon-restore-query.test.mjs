import { test } from "node:test";
import assert from "node:assert/strict";
import { neonConfig } from "@neondatabase/serverless";
import { setTimeout as delay } from "node:timers/promises";
import { createRestoreQuery } from "./neon-restore-query.mjs";
import { validateReaderUri } from "./neon-finder-deployment.mjs";
import { validateRestoreConnection } from "./restore-neon-public.mjs";
import targets from "../deployment/neon-finder/targets.json" with { type: "json" };

test("a long restore keeps fresh deadlines while individual slow requests still expire", async () => {
  const previous = neonConfig.fetchFunction;
  let slow = false;
  neonConfig.fetchFunction = async (_url, options) => {
    if (slow) await delay(40);
    if (options.signal.aborted) throw new DOMException("Request timed out", "TimeoutError");
    return Response.json({
      fields: [{ name: "value", dataTypeID: 23 }],
      rows: [["1"]],
      rowCount: 1,
    });
  };
  try {
    const query = createRestoreQuery("postgresql://fixture:fixture@fixture.neon.tech/fixture", 25);
    assert.deepEqual(await query("select 1 as value"), [{ value: 1 }]);
    await delay(40);
    assert.deepEqual(await query("select 1 as value"), [{ value: 1 }]);
    slow = true;
    await assert.rejects(query("select 1 as value"));
  } finally {
    neonConfig.fetchFunction = previous;
  }
});
test("restore and application credentials stay bound to the declared environment", () => {
  for (const environment of ["staging", "production"]) {
    const target = targets[environment];
    const reader = `postgresql://gridpulse_finder_reader:fixture@${target.pooledHost}/gridpulse?sslmode=require`;
    const owner = `postgresql://gridpulse_owner:fixture@${target.directHost}/gridpulse?sslmode=require`;
    validateReaderUri(reader, environment);
    validateRestoreConnection(owner, environment);
    const other = environment === "staging" ? "production" : "staging";
    assert.throws(() => validateReaderUri(reader, other));
    assert.throws(() => validateRestoreConnection(owner, other));
    assert.throws(() => validateReaderUri(owner, environment));
    assert.throws(() => validateRestoreConnection(reader, environment));
  }
});
