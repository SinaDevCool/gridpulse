/** Mechanical extraction of a bounded lifecycle from a component into a hook. */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const task = JSON.parse(process.argv[2]);
const text = fs.readFileSync(task.source, "utf8");
const ast = ts.createSourceFile(task.source, text, ts.ScriptTarget.Latest, true);
const component = ast.statements.find(
  (n) => ts.isFunctionDeclaration(n) && n.name.text === task.component,
);
const selected = component.body.statements.filter((node) => {
  if (ts.isFunctionDeclaration(node)) return task.functions.includes(node.name.text);
  if (ts.isVariableStatement(node))
    return node.declarationList.declarations.some((d) =>
      task.variables.includes(d.name.getText(ast)),
    );
  return task.effects?.some((marker) => node.getText(ast).includes(marker));
});
if (!selected.length) throw new Error("No hook statements found");
const ids = new Set();
function visit(n) {
  if (ts.isIdentifier(n)) ids.add(n.text);
  ts.forEachChild(n, visit);
}
selected.forEach(visit);
visit(
  ts.createSourceFile(
    "signature.ts",
    `function signature(${task.arguments}) {}`,
    ts.ScriptTarget.Latest,
    true,
  ),
);
const imports = ast.statements.filter(ts.isImportDeclaration).flatMap((n) => {
  const clause = n.importClause,
    bindings = clause?.namedBindings;
  if (!clause || !bindings || !ts.isNamedImports(bindings)) return [];
  const used = bindings.elements.filter((e) => ids.has(e.name.text));
  if (!used.length) return [];
  let module = n.moduleSpecifier.text;
  if (module.startsWith(".")) {
    module = path
      .relative(path.dirname(task.target), path.resolve(path.dirname(task.source), module))
      .replaceAll("\\", "/");
    if (!module.startsWith(".")) module = "./" + module;
  }
  return [
    `import ${clause.isTypeOnly ? "type " : ""}{ ${used.map((e) => e.getText(ast)).join(", ")} } from ${JSON.stringify(module)};`,
  ];
});
const hook =
  imports.join("\n") +
  `\n\nexport function ${task.hook}(${task.arguments}) {\n` +
  selected.map((n) => n.getText(ast)).join("\n\n") +
  `\nreturn { ${task.returns.join(", ")} };\n}\n`;
let source = text;
for (const n of [...selected].reverse())
  source = source.slice(0, n.getFullStart()) + source.slice(n.end);
const anchor = task.anchor;
if (!source.includes(anchor)) throw new Error("Hook call anchor missing");
source =
  `import { ${task.hook} } from ${JSON.stringify("./" + path.relative(path.dirname(task.source), task.target).replaceAll("\\", "/").replace(/\.ts$/, ""))};\n` +
  source.replace(anchor, `${task.call}\n${anchor}`);
fs.mkdirSync(path.dirname(task.target), { recursive: true });
if (fs.existsSync(task.target)) throw new Error("Refusing to overwrite hook");
fs.writeFileSync(task.target, hook);
fs.writeFileSync(task.source, source);
