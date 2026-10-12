/** Move database query expressions without changing their order or payloads. */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile).config;
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, ".");
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const directory = "src/features/grid-connection/strategy";
for (const file of fs
  .readdirSync(directory)
  .filter((n) => n.startsWith("command-") || n === "use-strategy-controller.ts")) {
  const source = path.join(directory, file);
  const ast = program.getSourceFile(source);
  const queries = [];
  function visit(n) {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isIdentifier(n.expression.expression) &&
      n.expression.expression.text === "supabase" &&
      n.expression.name.text === "from"
    ) {
      let root = n;
      while (ts.isCallExpression(root.parent) || ts.isPropertyAccessExpression(root.parent))
        root = root.parent;
      queries.push(root);
      return;
    }
    ts.forEachChild(n, visit);
  }
  visit(ast);
  if (!queries.length) continue;
  const target = path.join(directory, `repository-${file.replace(/\.ts$/, "")}.ts`);
  if (fs.existsSync(target)) throw new Error("Refusing overwrite");
  const imports = ast.statements.filter(ts.isImportDeclaration).map((n) => n.getText(ast));
  const functions = [];
  const edits = [];
  queries.forEach((query, index) => {
    const captures = new Map();
    function capture(n) {
      if (ts.isIdentifier(n)) {
        const parent = n.parent;
        const property =
          (ts.isPropertyAccessExpression(parent) && parent.name === n) ||
          (ts.isPropertyAssignment(parent) && parent.name === n) ||
          (ts.isParameter(parent) && parent.name === n);
        if (!property) {
          const symbol = checker.getSymbolAtLocation(n);
          const declaration = symbol?.valueDeclaration;
          if (
            declaration &&
            declaration.getSourceFile() === ast &&
            declaration.pos < query.pos &&
            !ast.statements.includes(declaration) &&
            !ts.isImportSpecifier(declaration)
          ) {
            let owner = declaration;
            while (owner.parent && owner.parent !== ast) owner = owner.parent;
            if (!ts.isVariableStatement(owner) && !ts.isTypeAliasDeclaration(owner)) {
              const type = checker.getTypeAtLocation(n);
              captures.set(
                n.text,
                checker.typeToString(
                  type,
                  n,
                  ts.TypeFormatFlags.NoTruncation |
                    ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
                ),
              );
            }
          }
        }
      }
      ts.forEachChild(n, capture);
    }
    capture(query);
    const name = `query${index + 1}`;
    functions.push(
      `export function ${name}(${[...captures].map(([n, t]) => `${n}: ${t}`).join(", ")}) { return ${query.getText(ast)}; }`,
    );
    edits.push({
      start: query.getStart(ast),
      end: query.end,
      text: `strategyQueries.${name}(${[...captures.keys()].join(", ")})`,
    });
  });
  let text = ast.text;
  for (const e of edits.sort((a, b) => b.start - a.start))
    text = text.slice(0, e.start) + e.text + text.slice(e.end);
  text = `import * as strategyQueries from './${path.basename(target, ".ts")}';\n` + text;
  fs.writeFileSync(source, text);
  fs.writeFileSync(target, imports.join("\n") + "\n" + functions.join("\n\n") + "\n");
}
