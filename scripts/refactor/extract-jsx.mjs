/** Mechanical extraction of large, presentational JSX sections. */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const task = JSON.parse(process.argv[2]);
for (const section of task.sections) {
  const text = fs.readFileSync(task.source, "utf8");
  const ast = ts.createSourceFile(task.source, text, ts.ScriptTarget.Latest, true);
  const component = ast.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name.text === task.component,
  );
  let target;
  function find(n) {
    if (ts.isJsxElement(n) && n.openingElement.getText(ast).includes(section.match) && !target)
      target = n;
    ts.forEachChild(n, find);
  }
  find(component);
  if (!target) throw new Error(`Section ${section.match} not found`);
  const ids = new Set();
  function scan(n) {
    if (ts.isIdentifier(n)) ids.add(n.text);
    ts.forEachChild(n, scan);
  }
  scan(target);
  const bindings = component.body.statements
    .filter(ts.isVariableStatement)
    .flatMap((n) => n.declarationList.declarations)
    .filter(
      (d) =>
        ts.isObjectBindingPattern(d.name) &&
        d.initializer?.getText(ast) === (task.modelBinding ?? "model"),
    )
    .flatMap((d) => d.name.elements.map((e) => e.name.text))
    .filter((name) => ids.has(name));
  const imports = ast.statements
    .filter(ts.isImportDeclaration)
    .map((n) => n.getText(ast))
    .join("\n");
  const sectionText =
    imports +
    `\nexport function ${section.name}({ model }: { model: ${task.contract ?? `ReturnType<typeof ${task.hook ?? "useFinderController"}>`} }) {\n` +
    `const { ${bindings.join(", ")} } = model;\nreturn ${target.getText(ast)};\n}\n`;
  const next =
    `import { ${section.name} } from "./${section.name}";\n` +
    text.slice(0, target.getStart(ast)) +
    `<${section.name} model={${task.modelBinding ?? "model"}} />` +
    text.slice(target.end);
  const file = path.join(path.dirname(task.source), section.name + ".tsx");
  if (fs.existsSync(file)) throw new Error("Section file exists");
  fs.writeFileSync(file, sectionText);
  fs.writeFileSync(task.source, next);
}
