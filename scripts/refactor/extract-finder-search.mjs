import fs from "node:fs";
import ts from "typescript";
const source = "src/routes/power-finder.tsx";
const text = fs.readFileSync(source, "utf8");
const ast = ts.createSourceFile(source, text, ts.ScriptTarget.Latest, true);
const safe = ast.statements.find(
  (n) =>
    ts.isVariableStatement(n) &&
    n.declarationList.declarations[0].name.getText(ast) === "safeNumber",
);
let schema;
function visit(n) {
  if (ts.isPropertyAssignment(n) && n.name.getText(ast) === "validateSearch")
    schema = n.initializer;
  ts.forEachChild(n, visit);
}
visit(ast);
if (!schema || !safe) throw new Error("Missing search contract");
const target = "src/features/power-finder/search-contract.ts";
if (fs.existsSync(target)) throw new Error("Refusing overwrite");
fs.writeFileSync(
  target,
  `import { z } from 'zod';\n${safe.getText(ast)}\nexport const finderSearchSchema = ${schema.getText(ast)};\nexport type FinderSearch = z.infer<typeof finderSearchSchema>;\n`,
);
let result = text.slice(0, schema.getStart(ast)) + "finderSearchSchema" + text.slice(schema.end);
result = result.slice(0, safe.getFullStart()) + result.slice(safe.end);
result = result.replace(
  /import \{ z \} from "zod";/,
  'import { finderSearchSchema } from "@/features/power-finder/search-contract";',
);
fs.writeFileSync(source, result);
