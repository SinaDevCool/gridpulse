/** Extract asynchronous application commands with explicit, typed context. */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const task = JSON.parse(process.argv[2]);
const text = fs.readFileSync(task.source, "utf8");
const ast = ts.createSourceFile(task.source, text, ts.ScriptTarget.Latest, true);
const controller = ast.statements.find(
  (n) => ts.isFunctionDeclaration(n) && n.name.text === task.controller,
);
function bound(n) {
  return ts.isIdentifier(n)
    ? [n.text]
    : (n.elements?.flatMap((e) => (e.name ? bound(e.name) : [])) ?? []);
}
const locals = new Set([
  ...controller.parameters.flatMap((n) => bound(n.name)),
  ...controller.body.statements.flatMap((n) =>
    ts.isVariableStatement(n)
      ? n.declarationList.declarations.flatMap((d) => bound(d.name))
      : ts.isFunctionDeclaration(n)
        ? [n.name.text]
        : [],
  ),
]);
const imports = ast.statements
  .filter(ts.isImportDeclaration)
  .map((n) => n.getText(ast))
  .join("\n");
const commands = controller.body.statements.filter(
  (n) =>
    ts.isFunctionDeclaration(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword),
);
const replacements = [],
  extra = new Set(),
  header = [];
for (const command of commands) {
  const ids = new Set();
  function visit(n) {
    if (ts.isIdentifier(n)) ids.add(n.text);
    ts.forEachChild(n, visit);
  }
  visit(command.body);
  const declared = new Set(
    command.body.statements
      .filter(ts.isVariableStatement)
      .flatMap((node) => node.declarationList.declarations.flatMap((d) => bound(d.name))),
  );
  const capture = [...locals].filter(
    (name) => ids.has(name) && name !== command.name.text && !declared.has(name),
  );
  capture.forEach((name) => extra.add(name));
  const name = command.name.text;
  const target = path.join(path.dirname(task.source), `command-${name}.ts`);
  if (fs.existsSync(target)) throw new Error("Command exists");
  const parameters = command.parameters.map((p) => p.getText(ast));
  const args = command.parameters.map((p) => p.name.getText(ast));
  const output =
    imports +
    `\nimport type { ${task.controller} } from "./${path.basename(task.source).replace(/\.ts$/, "")}";\n` +
    `type Context = Pick<ReturnType<typeof ${task.controller}>, ${capture.map((n) => JSON.stringify(n)).join(" | ")}>;\n` +
    `export async function execute(context: Context${parameters.length ? ", " + parameters.join(", ") : ""}): Promise<unknown> {\n` +
    `const { ${capture.join(", ")} } = context;\n` +
    command.body.statements.map((n) => n.getText(ast)).join("\n") +
    "\nreturn;\n}\n";
  fs.writeFileSync(target, output);
  header.push(`import { execute as ${name}Command } from "./command-${name}";`);
  replacements.push([
    command.getStart(ast),
    command.end,
    `async function ${name}(${parameters.join(", ")}) { return ${name}Command({ ${capture.join(", ")} }${args.length ? ", " + args.join(", ") : ""}); }`,
  ]);
}
const result = controller.body.statements.filter(ts.isReturnStatement).at(-1);
const existing = result.expression.properties.map((n) => n.name.text);
const added = [...extra].filter((name) => !existing.includes(name));
replacements.push([
  result.expression.end - 1,
  result.expression.end - 1,
  added.length ? `, ${added.join(", ")}` : "",
]);
let next = text;
for (const [start, end, value] of replacements.sort((a, b) => b[0] - a[0]))
  next = next.slice(0, start) + value + next.slice(end);
fs.writeFileSync(task.source, header.join("\n") + "\n" + next);
