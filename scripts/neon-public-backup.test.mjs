import { test } from "node:test";
import assert from "node:assert/strict";
import { digest, verifyBatch } from "./neon-public-backup.mjs";
import { exportQuery } from "../deployment/neon-finder/export-query.mjs";
import { validateReaderUri } from "./bind-neon-staging-secret.mjs";

test("backup integrity rejects tampering and malformed rows", () => {
  const bytes = Buffer.from(JSON.stringify([{ id: "public-1", row_sha256: "a".repeat(64) }]));
  assert.equal(verifyBatch(bytes, digest(bytes)).length, 1);
  assert.throws(
    () => verifyBatch(Buffer.from(bytes.toString().replace("public-1", "public-2")), digest(bytes)),
    /hash mismatch/,
  );
  assert.throws(() => verifyBatch(Buffer.from("{}"), digest(Buffer.from("{}"))), /Invalid backup/);
});
test("exports accept only fixed groups, bounded pages and UUID cursors", () => {
  assert.throws(() => exportQuery("private_users"));
  assert.throws(() => exportQuery("nodes", "'; drop table anything; --"));
  assert.throws(() => exportQuery("nodes", undefined, 5001));
  assert.match(exportQuery("assets"), /location_precision in/);
});
test("staging binding rejects owner and production credentials", () => {
  const uri =
    "postgresql://gridpulse_finder_reader:fixture@ep-patient-breeze-bhm3qx7z-pooler.c-10.eu-central-1.aws.neon.tech/gridpulse?sslmode=require";
  validateReaderUri(uri);
  for (const value of [
    undefined,
    uri.replace("finder_reader", "owner"),
    uri.replace("gridpulse?", "private?"),
    uri.replace("sslmode=require", "sslmode=disable"),
  ])
    assert.throws(() => validateReaderUri(value));
});
