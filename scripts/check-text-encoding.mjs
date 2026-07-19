import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const roots = ["src", "docs", "tests"];
const textExtensions = new Set([".css", ".html", ".json", ".md", ".mjs", ".ts", ".tsx"]);
const corruptedMarkers = ["\u00c2", "\u00c3", "\u00e2\u20ac", "\ufffd"];
const failures = [];

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(path);
      continue;
    }
    if (!textExtensions.has(extname(entry.name))) continue;
    const text = await readFile(path, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (corruptedMarkers.some((marker) => line.includes(marker))) {
        failures.push(`${relative(process.cwd(), path)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

for (const root of roots) await scan(root);

if (failures.length) {
  console.error("Possible UTF-8 corruption detected:\n" + failures.join("\n"));
  process.exit(1);
}

console.log("Text encoding check passed.");
