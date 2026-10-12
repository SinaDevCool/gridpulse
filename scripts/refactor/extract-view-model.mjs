/** Extract derived values into a pure selector; remove React memo wrappers inside the selector. */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const task = JSON.parse(process.argv[2]);
const text = fs.readFileSync(task.source, "utf8");
const ast = ts.createSourceFile(task.source, text, ts.ScriptTarget.Latest, true);
const component = ast.statements.find(
  (n) => ts.isFunctionDeclaration(n) && n.name.text === task.component,
);
const variables = component.body.statements.filter(ts.isVariableStatement);
const start = variables.findIndex(
  (n) => n.declarationList.declarations[0].name.getText(ast) === task.first,
);
const end = variables.findIndex(
  (n) => n.declarationList.declarations[0].name.getText(ast) === task.last,
);
if (start < 0 || end < start) throw new Error("Selector range missing");
const selected = variables.slice(start, end + 1);
let body = text.slice(selected[0].getStart(ast), selected.at(-1).end);
const adjustments = [];
function visit(n) {
  if (ts.isCallExpression(n) && n.expression.getText(ast) === "useMemo")
    adjustments.push([
      n.getStart(ast) - selected[0].getStart(ast),
      n.end - selected[0].getStart(ast),
      n.arguments[0].body.getText(ast),
    ]);
  ts.forEachChild(n, visit);
}
selected.forEach(visit);
for (const [start, end, value] of adjustments.reverse())
  body = body.slice(0, start) + value + body.slice(end);
const names = selected.flatMap((n) =>
  n.declarationList.declarations.map((d) => d.name.getText(ast)),
);
const imports = ast.statements
  .filter(ts.isImportDeclaration)
  .map((n) => n.getText(ast).replace(/from "\.\/([^"\n]*)"/g, 'from "../$1"'))
  .join("\n");
const output =
  imports +
  `\nexport function ${task.selector}(${task.arguments}) {\n${body}\nreturn { ${names.join(", ")} };\n}\n`;
if (fs.existsSync(task.target)) throw new Error("Selector exists");
fs.writeFileSync(task.target, output);
const module =
  "./" +
  path.relative(path.dirname(task.source), task.target).replaceAll("\\", "/").replace(/\.ts$/, "");
const replacement = `const { ${names.join(", ")} } = useMemo(() => ${task.selector}(${task.call}), [${task.dependencies}]);`;
fs.writeFileSync(
  task.source,
  `import { ${task.selector} } from ${JSON.stringify(module)};\n` +
    text.slice(0, selected[0].getStart(ast)) +
    replacement +
    text.slice(selected.at(-1).end),
);
