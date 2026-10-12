/** Extracts contiguous source/layer/interaction registrations in original execution order. */
import fs from "node:fs";
import ts from "typescript";
const task = JSON.parse(process.argv[2]);
const file = "src/features/map/initialize-map.ts";
const text = fs.readFileSync(file, "utf8");
const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
let callback;
function find(n) {
  if (
    ts.isCallExpression(n) &&
    n.expression.getText(ast) === "map.on" &&
    n.arguments[0].getText(ast) === '"load"'
  )
    callback = n.arguments[1];
  ts.forEachChild(n, find);
}
find(ast);
const imports = ast.statements
  .filter(ts.isImportDeclaration)
  .map((n) => n.getText(ast))
  .join("\n");
const root = ast.statements.find(
  (n) => ts.isFunctionDeclaration(n) && n.name.text === "initializeMap",
);
const binding = root.body.statements.find(
  (n) =>
    ts.isVariableStatement(n) &&
    n.declarationList.declarations[0].initializer?.getText(ast) === "resources",
);
const changes = [],
  header = [];
for (const section of task) {
  const nodes = callback.body.statements.filter((n) => {
    const line = ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1;
    return line >= section.start && line < section.end;
  });
  if (!nodes.length) throw new Error("Empty registration group");
  const target = `src/features/map/${section.name}.ts`;
  if (fs.existsSync(target)) throw new Error("Target exists");
  const body = nodes
    .map((n) => n.getText(ast))
    .join("\n")
    .replace(/\bcancelled\b/g, "isCancelled()");
  fs.writeFileSync(
    target,
    imports +
      '\nimport type { Map as MapLibreMap } from "maplibre-gl";\n' +
      `export function ${section.name}(map: MapLibreMap, resources: ReturnType<typeof useMapResources>, isCancelled: () => boolean) {\n` +
      binding.getText(ast) +
      "\n" +
      body +
      "\n}\n",
  );
  changes.push([
    nodes[0].getStart(ast),
    nodes.at(-1).end,
    `${section.name}(map, resources, () => cancelled);`,
  ]);
  header.push(`import { ${section.name} } from "./${section.name}";`);
}
let next = text;
for (const [start, end, value] of changes.sort((a, b) => b[0] - a[0]))
  next = next.slice(0, start) + value + next.slice(end);
fs.writeFileSync(file, header.join("\n") + "\n" + next);
