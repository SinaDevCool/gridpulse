import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = "dist/client/assets";
const budgets = [
  { pattern: /^power-finder-.*\.js$/, maxBytes: 500_000, label: "Power Finder route" },
  { pattern: /^maplibre-gl-.*\.js$/, maxBytes: 1_150_000, label: "MapLibre runtime" },
  { pattern: /^styles-.*\.css$/, maxBytes: 460_000, label: "global product styles" },
];

const files = await readdir(root);
const results = [];
let failed = false;
for (const budget of budgets) {
  const matching = files.filter((file) => budget.pattern.test(file));
  if (matching.length !== 1) {
    failed = true;
    results.push({
      label: budget.label,
      status: "fail",
      reason: `expected 1 artifact, found ${matching.length}`,
    });
    continue;
  }
  const path = join(root, matching[0]);
  const bytes = (await stat(path)).size;
  const status = bytes <= budget.maxBytes ? "pass" : "fail";
  if (status === "fail") failed = true;
  results.push({
    label: budget.label,
    status,
    artifact: relative("dist/client", path).replaceAll("\\", "/"),
    bytes,
    max_bytes: budget.maxBytes,
  });
}
console.log(JSON.stringify({ status: failed ? "fail" : "pass", results }, null, 2));
if (failed) process.exitCode = 1;
