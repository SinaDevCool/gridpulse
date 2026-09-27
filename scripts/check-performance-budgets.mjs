import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = "dist/client/assets";
const budgets = [
  { pattern: /^power-finder-.*\.js$/, maxBytes: 500_000, label: "Power Finder route" },
  { pattern: /^maplibre-gl-.*\.js$/, maxBytes: 1_150_000, label: "MapLibre runtime" },
  { pattern: /^styles-.*\.css$/, maxBytes: 460_000, label: "global product styles" },
];

const publicAssetBudgets = [
  {
    path: "public/landing/german-grid-hero.webp",
    maxBytes: 150_000,
    label: "landing hero image",
  },
  {
    path: "public/landing/power-finder-product.jpg",
    maxBytes: 250_000,
    label: "landing Power Finder product image",
  },
  {
    path: "public/landing/power-finder-product-mobile.jpg",
    maxBytes: 100_000,
    label: "landing Power Finder mobile image",
  },
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
for (const budget of publicAssetBudgets) {
  const bytes = (await stat(budget.path)).size;
  const status = bytes <= budget.maxBytes ? "pass" : "fail";
  if (status === "fail") failed = true;
  results.push({
    label: budget.label,
    status,
    artifact: budget.path.replaceAll("\\", "/"),
    bytes,
    max_bytes: budget.maxBytes,
  });
}
console.log(JSON.stringify({ status: failed ? "fail" : "pass", results }, null, 2));
if (failed) process.exitCode = 1;
