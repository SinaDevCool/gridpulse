import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sealCandidate, verifyCandidate } from "./candidate-artifact.mjs";

test("candidate rejects wrong identity, tampering, missing and extra files", async () => {
  const root = await mkdtemp(join(tmpdir(), "gridpulse-candidate-"));
  const sha = "a".repeat(40),
    run = "123-1";
  try {
    await mkdir(join(root, "server"));
    await mkdir(join(root, "client"));
    await writeFile(join(root, "server/wrangler.json"), "{}");
    await writeFile(join(root, "server/index.js"), "export default {}");
    await writeFile(join(root, "client/app.js"), "original");
    await sealCandidate(root, sha, run);
    await verifyCandidate(root, sha, run);
    await assert.rejects(verifyCandidate(root, "b".repeat(40), run), /identity/);
    await assert.rejects(verifyCandidate(root, sha, "123-2"), /identity/);
    await writeFile(join(root, "client/app.js"), "tampered");
    await assert.rejects(verifyCandidate(root, sha, run), /contents/);
    await writeFile(join(root, "client/app.js"), "original");
    await writeFile(join(root, "extra.js"), "unexpected");
    await assert.rejects(verifyCandidate(root, sha, run), /contents/);
    await rm(join(root, "extra.js"));
    await rm(join(root, "client/app.js"));
    await assert.rejects(verifyCandidate(root, sha, run), /contents/);
    assert.equal(JSON.parse(await readFile(join(root, ".ci-candidate.json"))).sha, sha);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("candidate cannot be sealed without a complete compiled build", async () => {
  const root = await mkdtemp(join(tmpdir(), "gridpulse-empty-candidate-"));
  try {
    await assert.rejects(sealCandidate(root, "a".repeat(40), "123-1"), /compiled Worker/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
