import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const config = ts.parseJsonConfigFileContent(
  ts.readConfigFile("tsconfig.json", ts.sys.readFile).config,
  ts.sys,
  ".",
);
const program = ts.createProgram(config.fileNames, config.options);
const checker = program.getTypeChecker();
const dir = "src/features/grid-connection/strategy";
const typeImports = `import type { CandidateSite, Evidence, Scenario, OperatorPackage, IntervalProfile } from '@/lib/assessment-model';
import type { OperatorScreening } from '@/lib/german-grid-screening';
import type { OperatorPackageSnapshot } from '../deliverables';
import type { FlexibilityResult } from '../domain';
import type { FlexibleLoadSpecification, FlexibleLoadValidation } from '../flexible-load';
import type { DispatchAnalysis } from '@/lib/fca-engine';
import type { PostgrestSingleResponse, PostgrestResponseSuccess } from '@supabase/supabase-js';\n`;
for (const name of fs.readdirSync(dir).filter((n) => n.startsWith("repository-"))) {
  const target = path.join(dir, name);
  const ast = program.getSourceFile(target);
  const client = path.join(dir, name.replace("repository-", ""));
  const clientAst = program.getSourceFile(client);
  let repo = ast.text;
  let clientText = clientAst.text;
  const repoEdits = [],
    clientEdits = [];
  for (const fn of ast.statements.filter(ts.isFunctionDeclaration)) {
    const missing = new Set();
    function visit(n) {
      if (ts.isShorthandPropertyAssignment(n) && !checker.getShorthandAssignmentValueSymbol(n))
        missing.add(n.name.text);
      ts.forEachChild(n, visit);
    }
    visit(fn);
    if (!missing.size) continue;
    const calls = [];
    function find(n) {
      if (
        ts.isCallExpression(n) &&
        n.expression.getText(clientAst) === `strategyQueries.${fn.name.text}`
      )
        calls.push(n);
      ts.forEachChild(n, find);
    }
    find(clientAst);
    const call = calls[0];
    if (!call) throw new Error("Missing call");
    const types = [...missing].map((n) => {
      const symbol = checker
        .getSymbolsInScope(call, ts.SymbolFlags.Value)
        .find((s) => s.name === n);
      if (!symbol) throw new Error("Missing capture " + n);
      return `${n}: ${checker.typeToString(checker.getTypeOfSymbolAtLocation(symbol, call), call, ts.TypeFormatFlags.NoTruncation)}`;
    });
    repoEdits.push({
      start: fn.parameters.end,
      end: fn.parameters.end,
      text: (fn.parameters.length ? ", " : "") + types.join(", "),
    });
    for (const c of calls)
      clientEdits.push({
        start: c.arguments.end,
        end: c.arguments.end,
        text: (c.arguments.length ? ", " : "") + [...missing].join(", "),
      });
  }
  for (const e of repoEdits.sort((a, b) => b.start - a.start))
    repo = repo.slice(0, e.start) + e.text + repo.slice(e.end);
  for (const e of clientEdits.sort((a, b) => b.start - a.start))
    clientText = clientText.slice(0, e.start) + e.text + clientText.slice(e.end);
  // Organize imports merges repeated type specifiers after capture repair.
  fs.writeFileSync(target, typeImports + repo);
  fs.writeFileSync(client, clientText);
}
