import fs from "node:fs";
import ts from "typescript";
const file = "src/components/product/PowerFinderMap.tsx";
const text = fs.readFileSync(file, "utf8");
const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const component = ast.statements.find(
  (n) => ts.isFunctionDeclaration(n) && n.name.text === "PowerFinderMap",
);
const effect = component.body.statements.find(
  (n) => ts.isExpressionStatement(n) && n.expression.expression?.getText(ast) === "useEffect",
);
const prefix = component.body.statements.filter((n) => n.end <= effect.getStart(ast));
const refs = prefix
  .filter(ts.isVariableStatement)
  .flatMap((n) => n.declarationList.declarations)
  .map((n) => n.name.getText(ast));
const parameter = component.parameters[0].getText(ast);
const props = component.parameters[0].name.elements.map((n) => n.name.text);
const imports = ast.statements
  .filter(ts.isImportDeclaration)
  .map((n) => n.getText(ast))
  .join("\n")
  .replaceAll('"../../features/map/', '"./');
const resources =
  imports +
  '\nimport { useMemo } from "react";\n' +
  `export function useMapResources(${parameter}) {\n${prefix.map((n) => n.getText(ast)).join("\n")}\n` +
  `return useMemo(() => ({ ${refs.join(", ")} }), [${refs.join(", ")}]);\n}\n`;
const callback = effect.expression.arguments[0];
const initializer =
  imports +
  '\nimport type { useMapResources } from "./use-map-resources";\n' +
  `export function initializeMap(resources: ReturnType<typeof useMapResources>) {\nconst { ${refs.join(", ")} } = resources;\n` +
  callback.body.statements.map((n) => n.getText(ast)).join("\n") +
  "\n}\n";
const replacement = `const resources = useMapResources({ ${props.join(", ")} });\nconst { ${refs.join(", ")} } = resources;\nuseEffect(() => initializeMap(resources), [resources]);`;
const next =
  'import { useMapResources } from "../../features/map/use-map-resources";\nimport { initializeMap } from "../../features/map/initialize-map";\n' +
  text.slice(0, prefix[0].getFullStart()) +
  replacement +
  text.slice(effect.end);
for (const [target, value] of [
  ["src/features/map/use-map-resources.ts", resources],
  ["src/features/map/initialize-map.ts", initializer],
  [file, next],
])
  fs.writeFileSync(target, value);
