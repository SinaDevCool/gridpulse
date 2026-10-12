import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import postcss from "postcss";
const baseline = "f4b67678eda6537545e7b71e0a003ca2aa6f8ae4";
function signature(text, file, expand) {
  const result = [];
  const normalize = value => value.replace(/\s+/g, "");
  postcss.parse(text).walk(node => {
    if (node.type === "comment") return;
    if (node.type === "atrule" && node.name === "import" && expand) {
      const target = path.resolve(path.dirname(file), node.params.replace(/^['"]|['"]$/g, ""));
      result.push(...signature(fs.readFileSync(target, "utf8"), target, true));
    } else if (node.type === "rule") result.push(["rule", normalize(node.selector)]);
    else if (node.type === "decl") result.push(["decl", node.prop, normalize(node.value), Boolean(node.important)]);
    else if (node.type === "atrule") result.push(["at", node.name, normalize(node.params)]);
  });
  return result;
}
for (const file of ["src/product.css", "src/features/operations/operations.css"]) {
  const before = signature(execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }), file, false);
  const after = signature(fs.readFileSync(file, "utf8"), file, true);
  if (before.length !== after.length) throw new Error(`${file}: changed rule count`);
  let changes = 0;
  before.forEach((entry, index) => {
    if (JSON.stringify(entry) === JSON.stringify(after[index])) return;
    if (entry[0] === "decl" && entry[1] === "color" && entry[2] === "var(--muted-foreground)" && after[index][2] === "color-mix(insrgb,var(--muted-foreground)85%,var(--foreground)15%)") { changes++; return; }
    throw new Error(`${file}: unexpected cascade difference at ${index}: ${JSON.stringify(entry)} -> ${JSON.stringify(after[index])}`);
  });
  console.log(`${file}: ${before.length} ordered nodes preserved; ${changes} deliberate contrast correction.`);
}
