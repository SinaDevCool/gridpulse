/** Moves independent effect groups behind typed hooks, preserving each callback and dependency list. */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const task = JSON.parse(process.argv[2]);
const text = fs.readFileSync(task.source, "utf8");
const ast = ts.createSourceFile(task.source, text, ts.ScriptTarget.Latest, true);
const controller = ast.statements.find(
  (n) => ts.isFunctionDeclaration(n) && n.name.text === task.controller,
);
const effects = controller.body.statements.filter(
  (n) => ts.isExpressionStatement(n) && n.expression.expression?.getText(ast) === "useEffect",
);
function bound(n) {
  return ts.isIdentifier(n)
    ? [n.text]
    : (n.elements?.flatMap((e) => (e.name ? bound(e.name) : [])) ?? []);
}
const locals = new Set(
  controller.body.statements.flatMap((n) =>
    ts.isVariableStatement(n)
      ? n.declarationList.declarations.flatMap((d) => bound(d.name))
      : ts.isFunctionDeclaration(n)
        ? [n.name.text]
        : [],
  ),
);
const imports = ast.statements
  .filter(ts.isImportDeclaration)
  .map((n) => n.getText(ast))
  .join("\n");
const replacements = [],
  extraReturn = new Set();
let header = "";
for (const group of task.groups) {
  const selected = group.effects.map((index) => effects[index]);
  if (selected.some((n) => !n)) throw new Error("Effect index not found");
  const ids = new Set();
  function visit(n) {
    if (ts.isIdentifier(n)) ids.add(n.text);
    ts.forEachChild(n, visit);
  }
  selected.forEach(visit);
  const capture = [...locals].filter((name) => ids.has(name));
  capture.forEach((name) => extraReturn.add(name));
  const output =
    imports +
    `\nimport type { ${task.controller} } from "./${path.basename(task.source).replace(/\.ts$/, "")}";\n` +
    `type Context = Pick<ReturnType<typeof ${task.controller}>, ${capture.map((n) => JSON.stringify(n)).join(" | ")}>;\n` +
    `export function ${group.hook}(context: Context) {\nconst { ${capture.join(", ")} } = context;\n` +
    selected.map((n) => n.getText(ast)).join("\n") +
    "\n}\n";
  const file = path.join(path.dirname(task.source), group.hook + ".ts");
  if (fs.existsSync(file)) throw new Error("Hook exists");
  fs.writeFileSync(file, output);
  const last = selected.at(-1);
  for (const n of selected)
    replacements.push([
      n.getStart(ast),
      n.end,
      n === last ? `${group.hook}({ ${capture.join(", ")} });` : "",
    ]);
  header += `import { ${group.hook} } from "./${group.hook}";\n`;
}
const result = controller.body.statements.filter(ts.isReturnStatement).at(-1);
const existing = result.expression.properties.map((n) => n.name.text);
const added = [...extraReturn].filter((name) => !existing.includes(name));
replacements.push([
  result.expression.end - 1,
  result.expression.end - 1,
  added.length ? `, ${added.join(", ")}` : "",
]);
let next = text;
for (const [start, end, value] of replacements.sort((a, b) => b[0] - a[0]))
  next = next.slice(0, start) + value + next.slice(end);
fs.writeFileSync(task.source, header + next);
