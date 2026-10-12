/** Separates a hook controller from JSX without changing either statement body. */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const task = JSON.parse(process.argv[2]);
const text = fs.readFileSync(task.source, "utf8");
const ast = ts.createSourceFile(task.source, text, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name.text === task.component,
);
const result = declaration.body.statements.filter(ts.isReturnStatement).at(-1);
if (!result?.expression) throw new Error("A single top-level JSX return is required");
const identifiers = new Set();
function visit(n) {
  if (ts.isIdentifier(n)) identifiers.add(n.text);
  ts.forEachChild(n, visit);
}
visit(result.expression);
function bound(n) {
  if (ts.isIdentifier(n)) return [n.text];
  if (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n))
    return n.elements.flatMap((e) => (e.name ? bound(e.name) : []));
  return [];
}
const locals = declaration.body.statements.flatMap((node) =>
  ts.isVariableStatement(node)
    ? node.declarationList.declarations.flatMap((d) => bound(d.name))
    : ts.isFunctionDeclaration(node)
      ? [node.name.text]
      : [],
);
const parameterNames = declaration.parameters.flatMap((parameter) => bound(parameter.name));
const captured = [...locals, ...parameterNames].filter((name) => identifiers.has(name));
const parameters = declaration.parameters.map((parameter) => parameter.getText(ast)).join(", ");
const forwarded = declaration.parameters
  .map((parameter) =>
    ts.isIdentifier(parameter.name)
      ? parameter.name.text
      : `{ ${bound(parameter.name).join(", ")} }`,
  )
  .join(", ");
const originalImports = ast.statements
  .filter(ts.isImportDeclaration)
  .map((node) => {
    let module = node.moduleSpecifier.text;
    if (module.startsWith(".")) {
      module = path
        .relative(path.dirname(task.controller), path.resolve(path.dirname(task.source), module))
        .replaceAll("\\", "/");
      if (!module.startsWith(".")) module = "./" + module;
    }
    return node.getText(ast).replace(node.moduleSpecifier.getText(ast), JSON.stringify(module));
  })
  .join("\n");
let body = text.slice(declaration.body.getStart(ast) + 1, result.getFullStart());
body = body
  .replaceAll("Route.useNavigate()", `useNavigate({ from: "${task.from ?? "/power-finder"}" })`)
  .replaceAll("Route.useSearch()", `useSearch({ from: "${task.from ?? "/power-finder"}" })`);
const controller =
  originalImports +
  '\nimport { useNavigate, useSearch } from "@tanstack/react-router";\n' +
  `export function ${task.hook}(${parameters}) {${body}\nreturn { ${captured.join(", ")} };\n}\n`;
const view =
  originalImports +
  `\nimport type { ${task.hook} } from "./${path.basename(task.controller).replace(/\.tsx?$/, "")}";\n` +
  `export function ${task.view}({ model }: { model: ReturnType<typeof ${task.hook}> }) {\nconst { ${captured.join(", ")} } = model;\nreturn ${result.expression.getText(ast)};\n}\n`;
const relative =
  "./" +
  path
    .relative(path.dirname(task.source), task.controller)
    .replaceAll("\\", "/")
    .replace(/\.tsx?$/, "");
const viewRelative =
  "./" +
  path
    .relative(path.dirname(task.source), task.viewFile)
    .replaceAll("\\", "/")
    .replace(/\.tsx?$/, "");
const exported = declaration.modifiers?.some(
  (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
)
  ? "export "
  : "";
const replacement = `${exported}function ${task.component}(${parameters}) { return <${task.view} model={${task.hook}(${forwarded})} />; }`;
const source =
  `import { ${task.hook} } from ${JSON.stringify(relative)};\nimport { ${task.view} } from ${JSON.stringify(viewRelative)};\n` +
  text.slice(0, declaration.getStart(ast)) +
  replacement +
  text.slice(declaration.end);
for (const [file, value] of [
  [task.controller, controller],
  [task.viewFile, view],
  [task.source, source],
]) {
  if (file !== task.source && fs.existsSync(file)) throw new Error("Target exists: " + file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}
